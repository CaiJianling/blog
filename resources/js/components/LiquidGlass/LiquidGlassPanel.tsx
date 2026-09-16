import { useMemo } from 'react';
import { calculateDisplacementMap, calculateDisplacementMap2 } from './displacementMap';
import { CONVEX } from './surfaceEquations';

/**
 * 液态玻璃面板背景（性能优化版，与 Filter 的视觉结果一致）。
 *
 * 原实现对整个面板（约 19 万像素）运行完整 SVG 滤镜链，包含两次
 * feGaussianBlur（其中 stdDeviation=10 的高斯模糊最昂贵）。分析滤镜
 * 管线后发现：
 * - glow 通道（blur 10 + alpha 0.7）被上方不透明层完全覆盖，属无效计算；
 * - radius 小于 50 时 specular 通道恒为全透明，属无效计算；
 * - 位移场只在距边缘 bezelWidth 范围内非中性，内部区域等于恒等变换。
 *
 * 因此拆分为三层：
 * 1. 基础层（整面板）：CSS `backdrop-filter: blur(1px)`，
 *    与原滤镜中部区域的输出完全一致，由 GPU 加速。注意原滤镜链里
 *    saturate(6) 的 feColorMatrix 会被全透明的 specular 掩膜
 *    （radius < 50 时恒透明）裁掉，最终输出实际不带饱和度提升；
 * 2. 边缘折射条（四条，深度 = radius）：仅边缘条运行 SVG 折射 + 色散
 *    滤镜（无高斯模糊），处理面积缩小约 4/5；
 * 3. 玻璃底色层（整面板）：60% 玻璃色调，覆盖在折射结果之上。
 */

interface LiquidGlassPanelProps {
    /** 滤镜 id 前缀（内部拼接 -top/-bottom/-left/-right） */
    id: string;
    width: number;
    height: number;
    /** 折射场半径（= 边缘条深度） */
    radius?: number;
    /** 折射带宽度（距边缘的折射作用范围） */
    bezelWidth?: number;
    glassThickness?: number;
    refractiveIndex?: number;
    /** 基础层模糊半径 */
    baseBlur?: number;
}

function imageDataToUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL();
}

/**
 * 垂直翻转位移图（生成下边缘场），同时翻转 G 通道符号。
 * 位移编码为 128 ± v，故符号翻转即 256 - v。
 */
function flipVertical(img: ImageData): ImageData {
    const out = new ImageData(img.width, img.height);
    const src = img.data;
    const dst = out.data;
    const rowBytes = img.width * 4;

    for (let y = 0; y < img.height; y++) {
        const sy = (img.height - 1 - y) * rowBytes;
        const dy = y * rowBytes;

        for (let x = 0; x < rowBytes; x += 4) {
            dst[dy + x] = src[sy + x];
            dst[dy + x + 1] = 256 - src[sy + x + 1];
            dst[dy + x + 2] = src[sy + x + 2];
            dst[dy + x + 3] = src[sy + x + 3];
        }
    }

    return out;
}

/**
 * 水平翻转位移图（生成右边缘场），同时翻转 R 通道符号。
 */
function flipHorizontal(img: ImageData): ImageData {
    const out = new ImageData(img.width, img.height);
    const src = img.data;
    const dst = out.data;
    const w = img.width;

    for (let y = 0; y < img.height; y++) {
        const base = y * w * 4;

        for (let x = 0; x < w; x++) {
            const sx = (w - 1 - x) * 4;
            const dx = x * 4;
            dst[base + dx] = 256 - src[base + sx];
            dst[base + dx + 1] = src[base + sx + 1];
            dst[base + dx + 2] = src[base + sx + 2];
            dst[base + dx + 3] = src[base + sx + 3];
        }
    }

    return out;
}

/**
 * 竖直边缘条的首尾行会被 calculateDisplacementMap2 当作“角部”场计算，
 * 而面板对应位置实际是侧边缘的延续（侧场沿 y 不变），
 * 因此用中间行（纯侧场）覆盖首尾行。
 */
function fillSideStripEnds(img: ImageData, radius: number): void {
    const { width, height } = img;
    const data = img.data;
    const rowBytes = width * 4;
    const fromRow = Math.min(height - 1 - radius, Math.max(radius, Math.floor(height / 2))) * rowBytes;

    for (let y = 0; y < height; y++) {
        if (y >= radius && y < height - radius) {
            continue;
        }

        const off = y * rowBytes;

        for (let i = 0; i < rowBytes; i++) {
            data[off + i] = data[fromRow + i];
        }
    }
}

function useStripMaps(
    width: number,
    height: number,
    radius: number,
    bezelWidth: number,
    glassThickness: number,
    refractiveIndex: number,
    dpr: number,
) {
    return useMemo(() => {
        const profile = calculateDisplacementMap(glassThickness, bezelWidth, CONVEX.fn, refractiveIndex);
        const maxDisp = Math.max(...profile.map((v) => Math.abs(v)));

        // 与原实现一致按 dpr 超采样生成位移图：边缘行会与内侧行平均，
        // 避免最外一行满幅位移产生强烈色散红线
        const top = calculateDisplacementMap2(width, radius, width, radius, radius, bezelWidth, maxDisp, profile, dpr);
        const bottom = flipVertical(top);

        const sideHeight = height - radius * 2;
        let left: ImageData | null = null;
        let right: ImageData | null = null;

        if (sideHeight > radius * 2) {
            left = calculateDisplacementMap2(radius, sideHeight, radius, sideHeight, radius, bezelWidth, maxDisp, profile, dpr);
            fillSideStripEnds(left, radius);
            right = flipHorizontal(left);
        }

        return {
            maxDisp,
            sideHeight,
            topUrl: imageDataToUrl(top),
            bottomUrl: imageDataToUrl(bottom),
            leftUrl: left ? imageDataToUrl(left) : '',
            rightUrl: right ? imageDataToUrl(right) : '',
        };
    }, [width, height, radius, bezelWidth, glassThickness, refractiveIndex, dpr]);
}

/**
 * 单条边缘折射滤镜：RGB 分通道位移（色散）+ screen 合成。
 * 输入为基础层输出（已含 1px 模糊与饱和度），故无需再跑高斯模糊。
 */
function StripFilter({ id, mapUrl, width, height, maxDisp }: { id: string; mapUrl: string; width: number; height: number; maxDisp: number }) {
    return (
        <filter id={id}>
            <feImage href={mapUrl} x={0} y={0} width={width} height={height} result="displacement_map" />

            <feComponentTransfer in="SourceGraphic" result="red_channel">
                <feFuncR type="linear" slope="1" intercept="0" />
                <feFuncG type="linear" slope="0" intercept="0" />
                <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>

            <feComponentTransfer in="SourceGraphic" result="green_channel">
                <feFuncR type="linear" slope="0" intercept="0" />
                <feFuncG type="linear" slope="1" intercept="0" />
                <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>

            <feComponentTransfer in="SourceGraphic" result="blue_channel">
                <feFuncR type="linear" slope="0" intercept="0" />
                <feFuncG type="linear" slope="0" intercept="0" />
                <feFuncB type="linear" slope="1" intercept="0" />
            </feComponentTransfer>

            <feDisplacementMap in="red_channel" in2="displacement_map" scale={maxDisp * 0.8} xChannelSelector="R" yChannelSelector="G" result="displaced_red" />
            <feDisplacementMap in="green_channel" in2="displacement_map" scale={maxDisp * 0.9} xChannelSelector="R" yChannelSelector="G" result="displaced_green" />
            <feDisplacementMap in="blue_channel" in2="displacement_map" scale={maxDisp} xChannelSelector="R" yChannelSelector="G" result="displaced_blue" />

            <feBlend in="displaced_red" in2="displaced_green" mode="screen" result="displaced_rg" />
            <feBlend in="displaced_rg" in2="displaced_blue" mode="screen" />
        </filter>
    );
}

export default function LiquidGlassPanel({
    id,
    width,
    height,
    radius = 24,
    bezelWidth = 20,
    glassThickness = 90,
    refractiveIndex = 1.3,
    baseBlur = 1,
}: LiquidGlassPanelProps) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const maps = useStripMaps(width, height, radius, bezelWidth, glassThickness, refractiveIndex, dpr);
    const hasSides = maps.sideHeight > radius * 2;

    return (
        <>
            {/* 基础层：与原滤镜中部输出一致（仅 1px 模糊），GPU 加速 */}
            <div className="pointer-events-none absolute inset-0" style={{ backdropFilter: `blur(${baseBlur}px)` }} />

            {/* 边缘折射条：仅边缘运行 SVG 折射 + 色散滤镜 */}
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: radius, backdropFilter: `url(#${id}-top)` }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: radius, backdropFilter: `url(#${id}-bottom)` }} />
            {hasSides && (
                <>
                    <div className="pointer-events-none absolute left-0" style={{ top: radius, bottom: radius, width: radius, backdropFilter: `url(#${id}-left)` }} />
                    <div className="pointer-events-none absolute right-0" style={{ top: radius, bottom: radius, width: radius, backdropFilter: `url(#${id}-right)` }} />
                </>
            )}

            {/* 玻璃底色：与原实现一致的 60% 玻璃色调 */}
            <div className="pointer-events-none absolute inset-0 bg-white/60 dark:bg-[#222222]/60" />

            <svg colorInterpolationFilters="sRGB" style={{ display: 'none' }}>
                <defs>
                    <StripFilter id={`${id}-top`} mapUrl={maps.topUrl} width={width} height={radius} maxDisp={maps.maxDisp} />
                    <StripFilter id={`${id}-bottom`} mapUrl={maps.bottomUrl} width={width} height={radius} maxDisp={maps.maxDisp} />
                    {hasSides && (
                        <>
                            <StripFilter id={`${id}-left`} mapUrl={maps.leftUrl} width={radius} height={maps.sideHeight} maxDisp={maps.maxDisp} />
                            <StripFilter id={`${id}-right`} mapUrl={maps.rightUrl} width={radius} height={maps.sideHeight} maxDisp={maps.maxDisp} />
                        </>
                    )}
                </defs>
            </svg>
        </>
    );
}

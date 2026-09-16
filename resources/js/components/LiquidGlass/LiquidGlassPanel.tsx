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
 * - radius 小于 50 时 specular 通道恒为全透明，属无效计算（saturate(6)
 *   的 feColorMatrix 也被该透明掩膜裁掉，最终输出实际不带饱和度提升）；
 * - 位移场只在距边缘 bezelWidth 范围内非中性，内部区域等于恒等变换。
 *
 * 因此拆分为三层：
 * 1. 基础层（整面板）：CSS `backdrop-filter: blur(1px)`，
 *    与原滤镜中部区域的输出完全一致，由 GPU 加速；
 * 2. 边缘折射条（四条，深度 = radius）：仅边缘条运行 SVG 折射 + 色散
 *    滤镜（无高斯模糊），处理面积缩小约 4/5；
 * 3. 玻璃底色层（整面板）：60% 玻璃色调，覆盖在折射结果之上。
 *
 * 边缘彩色花边处理：squircle 曲面在边缘处切线接近垂直，最外行位移
 * 高达 ~75px，R/G/B 按 0.8/0.9/1.0 不同比例位移，边缘处通道间相差
 * 可达 15px，在高分对比度内容上呈现彩色花边。为此按通道生成三张位移
 * 图：最外 EDGE_FADE_CSS 像素内各通道比例平滑收敛到 1（保持满幅折射
 * 但无通道差），内侧恢复原始 0.8/0.9/1.0 色散；距离按各条的真实边缘
 * 几何（直边按行/列，角部按弧线）计算。
 */

/** 通道比例收敛带宽度（CSS 像素） */
const EDGE_FADE_CSS = 8;

type StripKind = 'top' | 'bottom' | 'left' | 'right';

/**
 * 条内像素到“折射场边缘线”的距离（CSS 像素，0 = 在边缘线上，
 * 负值 = 在边缘线外侧的角部过渡区）。
 * 直边区域按行/列距离；角部区域按到角部弧线中心的距离
 * （与 calculateDisplacementMap2 的角部场几何一致）。
 */
function stripEdgeDistance(kind: StripKind, x: number, y: number, width: number, height: number, radius: number): number {
    if (kind === 'top') {
        if (x < radius) {
            return radius - Math.hypot(x - radius, y - radius);
        }

        if (x > width - radius) {
            return radius - Math.hypot(x - (width - radius), y - radius);
        }

        return y;
    }

    if (kind === 'bottom') {
        if (x < radius) {
            return radius - Math.hypot(x - radius, y + 1);
        }

        if (x > width - radius) {
            return radius - Math.hypot(x - (width - radius), y + 1);
        }

        return height - 1 - y;
    }

    // 侧边条：面板侧边缘为直线，按列距离（角部由上/下条的弧线场覆盖）
    return kind === 'left' ? x : width - 1 - x;
}

interface ChannelMaps {
    redUrl: string;
    greenUrl: string;
    blueUrl: string;
}

/**
 * 由基准位移图按通道生成三张位移图：
 * - 红通道：边缘比例 1.0 → 内侧 0.8
 * - 绿通道：边缘比例 1.0 → 内侧 0.9
 * - 蓝通道：恒 1.0（即基准图）
 * 边缘处三通道位移一致（无花边），内侧保留原始色散。
 */
function buildChannelMaps(base: ImageData, kind: StripKind, radius: number, dpr: number): ChannelMaps {
    const { width, height } = base;
    const src = base.data;

    const build = (inner: number): ImageData => {
        const img = new ImageData(width, height);
        const data = img.data;
        const fadeDevicePx = EDGE_FADE_CSS * dpr;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dist = stripEdgeDistance(kind, x, y, width, height, radius);
                const u = Math.min(1, dist / fadeDevicePx);
                const atEdge = 1 - u * u * (3 - 2 * u);
                const factor = inner + (1 - inner) * atEdge;
                const off = (y * width + x) * 4;
                data[off] = 128 + (src[off] - 128) * factor;
                data[off + 1] = 128 + (src[off + 1] - 128) * factor;
                data[off + 2] = src[off + 2];
                data[off + 3] = src[off + 3];
            }
        }

        return img;
    };

    return {
        redUrl: imageDataToUrl(build(0.8)),
        greenUrl: imageDataToUrl(build(0.9)),
        blueUrl: imageDataToUrl(base),
    };
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

        // 与原实现一致按 dpr 超采样生成基准位移图
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

        // 翻转完成后按各条自身朝向计算通道收敛图（角部弧线几何随之正确）
        const topMaps = buildChannelMaps(top, 'top', radius, dpr);
        const bottomMaps = buildChannelMaps(bottom, 'bottom', radius, dpr);
        const leftMaps = left ? buildChannelMaps(left, 'left', radius, dpr) : null;
        const rightMaps = right ? buildChannelMaps(right, 'right', radius, dpr) : null;

        return {
            maxDisp,
            sideHeight,
            topMaps,
            bottomMaps,
            leftMaps,
            rightMaps,
        };
    }, [width, height, radius, bezelWidth, glassThickness, refractiveIndex, dpr]);
}

/**
 * 单条边缘折射滤镜：RGB 分通道位移（色散）+ screen 合成。
 * 输入为基础层输出（已含 1px 模糊），故无需再跑高斯模糊。
 * 三张位移图分别承载红/绿/蓝通道的空间比例（边缘收敛、内侧色散），
 * 因此 feDisplacementMap 统一使用满幅 scale。
 */
function StripFilter({ id, maps, width, height, maxDisp }: { id: string; maps: ChannelMaps; width: number; height: number; maxDisp: number }) {
    return (
        <filter id={id}>
            <feImage href={maps.redUrl} x={0} y={0} width={width} height={height} result="map_red" />
            <feImage href={maps.greenUrl} x={0} y={0} width={width} height={height} result="map_green" />
            <feImage href={maps.blueUrl} x={0} y={0} width={width} height={height} result="map_blue" />

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

            <feDisplacementMap in="red_channel" in2="map_red" scale={maxDisp} xChannelSelector="R" yChannelSelector="G" result="displaced_red" />
            <feDisplacementMap in="green_channel" in2="map_green" scale={maxDisp} xChannelSelector="R" yChannelSelector="G" result="displaced_green" />
            <feDisplacementMap in="blue_channel" in2="map_blue" scale={maxDisp} xChannelSelector="R" yChannelSelector="G" result="displaced_blue" />

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
}: {
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
}) {
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
                    <StripFilter id={`${id}-top`} maps={maps.topMaps} width={width} height={radius} maxDisp={maps.maxDisp} />
                    <StripFilter id={`${id}-bottom`} maps={maps.bottomMaps} width={width} height={radius} maxDisp={maps.maxDisp} />
                    {hasSides && maps.leftMaps && maps.rightMaps && (
                        <>
                            <StripFilter id={`${id}-left`} maps={maps.leftMaps} width={radius} height={maps.sideHeight} maxDisp={maps.maxDisp} />
                            <StripFilter id={`${id}-right`} maps={maps.rightMaps} width={radius} height={maps.sideHeight} maxDisp={maps.maxDisp} />
                        </>
                    )}
                </defs>
            </svg>
        </>
    );
}

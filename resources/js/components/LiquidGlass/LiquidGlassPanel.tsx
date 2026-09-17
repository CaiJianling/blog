import { useMemo } from 'react';
import { calculateDisplacementMap, calculateDisplacementMap2 } from './displacementMap';
import { CONVEX } from './surfaceEquations';

/**
 * 液态玻璃面板背景。
 *
 * 参考实现对整个面板运行完整 SVG 滤镜链，其中最昂贵的是两次
 * feGaussianBlur（glow 层 stdDeviation=10）。分析滤镜管线后发现：
 * - glow 通道（blur 10 + alpha 0.7）被上方不透明层完全覆盖，属无效计算；
 * - radius 小于 50 时 specular 通道恒为全透明，属无效计算（saturate 的
 *   feColorMatrix 也被该透明掩膜裁掉，最终输出实际不带饱和度提升）；
 * - 位移场只在距边缘 bezelWidth 范围内非中性，内部区域等于恒等变换。
 *
 * 因此关键约束是：**整块面板必须只做一次 backdrop 取样**。若拆成多条
 * 独立 backdrop-filter 元素（上/下/左/右各一条），相邻条各自取样、各自
 * 折射，交界处像素无法对齐，会出现肉眼可见的拼接缝。
 *
 * 当前实现为单元素单滤镜：
 * 1. 位移图覆盖整个面板，边缘按折射场计算、中部为中性（恒等变换）；
 * 2. 模糊交给 CSS `backdrop-filter: blur()` 前置层，GPU 加速，
 *    不再使用 SVG 高斯模糊；
 * 3. 折射层在上层元素对同一背景再取样一次并做径向位移 + 色散，
 *    其模糊由 `blur()` 与位移滤波合并表达。
 *
 * 边缘彩色花边处理：squircle 曲面在边缘处切线接近垂直，最外行位移
 * 高达 ~75px，R/G/B 按 0.8/0.9/1.0 不同比例位移，边缘处通道间相差
 * 可达 15px，在高分对比度内容上呈现彩色花边。为此按通道生成三张位移
 * 图：最外 EDGE_FADE_CSS 像素内各通道比例平滑收敛到 1（保持满幅折射
 * 但无通道差），内侧恢复原始 0.8/0.9/1.0 色散。
 */

/** 通道比例收敛带宽度（CSS 像素） */
const EDGE_FADE_CSS = 8;

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
 *
 * 性能：仅“距边缘 EDGE_FADE_CSS 像素内”的像素与基准图不同，内部区域
 * 恒等。故三张图共用同一 canvas，只写入边缘像素（其余保持基准），
 * 再分别 toDataURL，避免对整幅图做三次全像素循环 + 编码。
 */
function buildChannelMaps(base: ImageData, radius: number, dpr: number): ChannelMaps {
    const width = base.width;
    const height = base.height;
    const src = base.data;
    const fadeCss = EDGE_FADE_CSS * dpr;
    const r = radius * dpr;

    // 到面板外缘的最近距离（设备像素），> fade 的像素恒等于基准
    const edgeDist = (x: number, y: number): number => {
        const cx = x < r ? r - x : x > width - r ? x - (width - r) : 0;
        const cy = y < r ? r - y : y > height - r ? y - (height - r) : 0;

        if (cx === 0 && cy === 0) {
            return 0;
        }

        if (cx === 0) {
            return cy;
        }

        if (cy === 0) {
            return cx;
        }

        return r - Math.hypot(cx, cy);
    };

    // 仅收集边缘像素的索引（设备像素坐标）
    const edgeIndices: number[] = [];

    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const dist = edgeDist(px, py);

            if (dist <= fadeCss) {
                edgeIndices.push(py * width + px);
            }
        }
    }

    const makeMap = (inner: number): string => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        ctx.putImageData(base, 0, 0);

        const img = ctx.getImageData(0, 0, width, height);
        const data = img.data;

        for (const i of edgeIndices) {
            const x = i % width;
            const y = Math.floor(i / width);
            const dist = edgeDist(x, y);
            const u = Math.min(1, Math.max(0, dist) / fadeCss);
            const atEdge = 1 - u * u * (3 - 2 * u);
            const factor = inner + (1 - inner) * atEdge;
            const off = i * 4;
            data[off] = 128 + (src[off] - 128) * factor;
            data[off + 1] = 128 + (src[off + 1] - 128) * factor;
        }

        ctx.putImageData(img, 0, 0);

        return canvas.toDataURL();
    };

    return {
        redUrl: makeMap(0.8),
        greenUrl: makeMap(0.9),
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

function useDisplacementMaps(
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

        // 一张覆盖整面板的位移图：边缘为折射场，中部为中性（恒等变换）
        const base = calculateDisplacementMap2(width, height, width, height, radius, bezelWidth, maxDisp, profile, dpr);
        const maps = buildChannelMaps(base, radius, dpr);

        return { maxDisp, maps, bufferWidth: width, bufferHeight: height };
    }, [width, height, radius, bezelWidth, glassThickness, refractiveIndex, dpr]);
}

/**
 * 整面板折射滤镜：RGB 分通道位移（色散）+ screen 合成。
 * 位移图覆盖整块面板，中部中性区域位移为零，故一次取样即可获得
 * 连贯的整面折射（无拼接缝）。三张位移图分别承载红/绿/蓝通道的
 * 空间比例（边缘收敛、内侧色散），feDisplacementMap 统一满幅 scale。
 */
function PanelFilter({ id, maps, width, height, maxDisp }: { id: string; maps: ChannelMaps; width: number; height: number; maxDisp: number }) {
    return (
        <filter id={id} colorInterpolationFilters="sRGB">
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
    // 比最初 1px 稍强的磨砂
    baseBlur = 2,
}: {
    /** 滤镜 id */
    id: string;
    width: number;
    height: number;
    /** 折射场半径（角部弧线半径） */
    radius?: number;
    /** 折射带宽度（距边缘的折射作用范围） */
    bezelWidth?: number;
    glassThickness?: number;
    refractiveIndex?: number;
    /** 模糊半径 */
    baseBlur?: number;
}) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const { maps, maxDisp, bufferWidth, bufferHeight } = useDisplacementMaps(
        width,
        height,
        radius,
        bezelWidth,
        glassThickness,
        refractiveIndex,
        dpr,
    );

    return (
        <>
            {/*
              单次取样：模糊与折射合并在一个 backdrop-filter 里，
              避免多层各自取样造成的拼接缝。
              blur() 先于 url() 应用，位移图在已模糊的画面上做径向折射。
            */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{ backdropFilter: `blur(${baseBlur}px) url(#${id})` }}
            />

            {/* 玻璃底色：与原实现一致的 60% 玻璃色调 */}
            <div className="pointer-events-none absolute inset-0 bg-white/60 dark:bg-[#222222]/60" />

            {/* 边缘高光（iOS 27 液态玻璃调适）：
              上下“内部”亮色高光——沿上/下边缘内侧的亮线，向外渐淡；
              左右“外部”暗色高光——沿左/右边缘的暗线，向外渐淡。
              两组均用 1px 线 + 对称 box-shadow 扩散实现，仅作用于玻璃内部。 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[23px] bg-white/70 dark:bg-white/25 [box-shadow:0_1px_5px_-1px_rgba(255,255,255,0.5)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px rounded-b-[23px] bg-white/70 dark:bg-white/25 [box-shadow:0_-1px_5px_-1px_rgba(255,255,255,0.5)]" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-px rounded-l-[23px] bg-black/25 dark:bg-black/50 [box-shadow:2px_0_5px_-2px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px rounded-r-[23px] bg-black/25 dark:bg-black/50 [box-shadow:-2px_0_5px_-2px_rgba(0,0,0,0.35)]" />

            <svg colorInterpolationFilters="sRGB" style={{ display: 'none' }}>
                <defs>
                    <PanelFilter id={id} maps={maps} width={bufferWidth} height={bufferHeight} maxDisp={maxDisp} />
                </defs>
            </svg>
        </>
    );
}

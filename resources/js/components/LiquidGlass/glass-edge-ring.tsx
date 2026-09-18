import { cn } from '@/lib/utils';

type GlassEdgeRingProps = {
    /**
     * - `circle`：圆形玻璃（悬浮按钮）——贴外缘 1px 的环形暗线，
     *   左右最暗、向上下两端渐淡（渐变 + mask 镂空成 1px 环）。
     * - `edges`：圆角方形玻璃（面板/弹窗/开关滑块）——左右两条 1px 竖线，
     *   暗色峰值在线段中点，向两端（圆角处）渐淡。
     */
    variant?: 'circle' | 'edges';
    /** `edges` 变体：暗线渐淡起止位置（应等于容器圆角半径，px）。 */
    radius?: number;
    /** 暗线峰值不透明度（0-1）。缺省随变体：`circle` 0.5（按钮环形更需强调轮廓），`edges` 0.18（面板只要一条隐约的 1px 细线）。 */
    strength?: number;
    className?: string;
};

/**
 * 液态玻璃“外缘暗线”（iOS 27 液态玻璃调适）：
 * 画在玻璃表面**外面** 1px 的左右边缘暗色线，两边最黑、向四端渐淡。
 *
 * 必须作为玻璃容器的兄弟节点渲染（玻璃容器 overflow-hidden 会裁掉
 * 内部任何外扩的像素），或放在不被裁切的层内（如开关滑块高光层）。
 */
export default function GlassEdgeRing({ variant = 'edges', radius = 24, strength, className }: GlassEdgeRingProps) {
    // 未显式指定时按变体取缺省强度：
    // - circle（悬浮圆形按钮）：0.5，环形暗线需要足够强调按钮轮廓；
    // - edges（面板/弹窗左右竖线）：0.18，太黑会像一道厚黑边，只留一条 1px 隐约细线即可。
    const resolvedStrength = strength ?? (variant === 'circle' ? 0.5 : 0.18);
    const peak = `rgba(0, 0, 0, ${resolvedStrength})`;

    if (variant === 'circle') {
        // 1px 外扩环：左右最暗，向上下两端（圆环的“四端”）渐淡
        return (
            <span
                aria-hidden="true"
                className={cn('pointer-events-none absolute -inset-px rounded-full p-px', className)}
                style={{
                    background: `linear-gradient(90deg, ${peak} 0%, transparent 45%, transparent 55%, ${peak} 100%)`,
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                }}
            />
        );
    }

    // 左右两条 1px 竖线（外缘 1px），暗色峰值在线段中点，向两端渐淡
    return (
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
            <span
                className="absolute -left-px w-px rounded-full"
                style={{
                    top: radius,
                    bottom: radius,
                    background: `linear-gradient(to bottom, transparent, ${peak} 50%, transparent)`,
                }}
            />
            <span
                className="absolute -right-px w-px rounded-full"
                style={{
                    top: radius,
                    bottom: radius,
                    background: `linear-gradient(to bottom, transparent, ${peak} 50%, transparent)`,
                }}
            />
        </span>
    );
}

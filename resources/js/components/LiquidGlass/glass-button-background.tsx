import { useId } from 'react';
import { useEffects } from '@/hooks/use-effects';
import LiquidGlassPanel from './LiquidGlassPanel';

/**
 * 圆形悬浮按钮的液态玻璃背景（特效开启时渲染，关闭时返回 null，
 * 由按钮自身的纯色底样式接管）。
 *
 * 折射半径取直径的一半：此时上边缘条的角部弧线恰好就是按钮圆本身，
 * 几何与按钮轮廓精确对齐，无接缝。
 *
 * 外发光：按钮 `overflow-hidden` 会裁掉 `.hover-glow::after` 的 box-shadow，
 * 特效开启时补一层独立的外发光（在玻璃之上、不被裁切），复用主题色变量。
 */
export default function GlassButtonBackground({ size }: { size: number }) {
    const { effectsEnabled } = useEffects();
    const id = useId();

    if (!effectsEnabled || size <= 0) {
        return null;
    }

    return (
        <>
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <LiquidGlassPanel id={id} width={size} height={size} radius={size / 2} />
            </div>

            {/* 外发光：与 .hover-glow 一致的主题色投影，玻璃之上、不受 overflow-hidden 裁切 */}
            <div
                className="glass-btn-glow pointer-events-none absolute inset-0 rounded-full"
                aria-hidden="true"
            />

            {/* 边缘高光（iOS 27 液态玻璃调适）：上下内部亮色高光。
                左右外缘的渐淡暗线由按钮兄弟节点上的 GlassEdgeRing（circle 变体）承载，
                按钮 overflow-hidden 裁不掉外层的环。 */}
            <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                    boxShadow:
                        'inset 0 2px 4px -2px rgba(255,255,255,0.9), inset 0 -2px 4px -2px rgba(255,255,255,0.9)',
                }}
                aria-hidden="true"
            />
        </>
    );
}

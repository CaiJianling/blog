import { useId } from 'react';
import { useEffects } from '@/hooks/use-effects';
import LiquidGlassPanel from './LiquidGlassPanel';

/**
 * 圆形悬浮按钮的液态玻璃背景（特效开启时渲染，关闭时返回 null，
 * 由按钮自身的纯色底样式接管）。
 *
 * 折射半径取直径的一半：此时上边缘条的角部弧线恰好就是按钮圆本身，
 * 几何与按钮轮廓精确对齐，无接缝。
 */
export default function GlassButtonBackground({ size }: { size: number }) {
    const { effectsEnabled } = useEffects();
    const id = useId();

    if (!effectsEnabled || size <= 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <LiquidGlassPanel id={id} width={size} height={size} radius={size / 2} />
        </div>
    );
}

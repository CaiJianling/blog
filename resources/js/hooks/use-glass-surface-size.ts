import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export type GlassSurfaceSize = {
    readonly width: number;
    readonly height: number;
};

/**
 * 量取液态玻璃宿主元素的实际尺寸：LiquidGlassPanel 的位移图按像素生成，
 * 必须先知道面板有多大。
 *
 * 只在 enabled 时测量，未启用时恒为 0（使用方以 `width > 0` 作为渲染条件）。
 * 立即测一次（ResizeObserver 首次回调是异步的，直接测量可避免顶栏展开瞬间
 * 玻璃层缺失），ResizeObserver 负责后续尺寸变化，定时器兜底字体加载、
 * 图片撑开一类不触发回调的环境变化。
 */
export function useGlassSurfaceSize(
    ref: RefObject<HTMLElement | null>,
    enabled: boolean,
): GlassSurfaceSize {
    const [size, setSize] = useState<GlassSurfaceSize>({ width: 0, height: 0 });

    useEffect(() => {
        const el = ref.current;

        if (!enabled || !el) {
            setSize({ width: 0, height: 0 });

            return;
        }

        const update = (): void => {
            setSize({ width: el.offsetWidth, height: el.offsetHeight });
        };

        update();

        const observer = new ResizeObserver(update);

        observer.observe(el);
        const fallback1 = window.setTimeout(update, 50);
        const fallback2 = window.setTimeout(update, 300);

        return () => {
            observer.disconnect();
            window.clearTimeout(fallback1);
            window.clearTimeout(fallback2);
        };
    }, [ref, enabled]);

    return size;
}

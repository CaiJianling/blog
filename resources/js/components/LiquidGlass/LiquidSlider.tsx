import {
    animate,
    motion,
    useMotionValue,
    useMotionValueEvent,
    useSpring,
    useTransform,
    useVelocity,
} from 'framer-motion';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useEffects } from '@/hooks/use-effects';
import { Filter } from './Filter';

type LiquidSliderSize = 'sm' | 'md' | 'lg' | number;

interface LiquidSliderProps {
    /** 缩放：sm 0.5 / md 0.75 / lg 1，或自定义数值 */
    size?: LiquidSliderSize;
    /** 固定滑块宽度（fillContainer 开启时忽略） */
    width?: number;
    /** 滑块拉伸为容器宽度 */
    fillContainer?: boolean;
    /** 数值下限 */
    min?: number;
    /** 数值上限 */
    max?: number;
    /** 受控值（在 min/max 内）；不传则为非受控 */
    value?: number;
    /** 非受控模式的初始值 */
    defaultValue?: number;
    /** 拖拽过程中的数值变化（整数，已取整） */
    onChange?: (value: number) => void;
    /** 释放后的最终数值（含端点吸附结果） */
    onChangeEnd?: (value: number) => void;
    /** 无障碍标签 */
    'aria-label'?: string;
}

const SIZE_SCALES: Record<'sm' | 'md' | 'lg', number> = {
    sm: 0.5,
    md: 0.75,
    lg: 1,
};

const DEFAULT_SLIDER_WIDTH = 480;
const THUMB_WIDTH = 90;
const THUMB_HEIGHT = 60;
const THUMB_RADIUS = 30;
const SLIDER_HEIGHT = 10;

/**
 * 液态玻璃滑块（移植自 liunnn1994 的 LiquidGlass/LiquidSlider，改用 framer-motion）：
 * - 拖拽带橡皮筋边界与轨道液体形变（越界拉伸），松手时弹簧回弹
 * - 数值在两端 5% 物理区间内加速，贴近端点时松手吸附到 min/max
 * - 「界面特效」开启时拇指使用液态玻璃滤镜；关闭时回退为纯色圆角块
 */
export default function LiquidSlider({
    size = 'md',
    width = DEFAULT_SLIDER_WIDTH,
    fillContainer = false,
    min = 0,
    max = 100,
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    'aria-label': ariaLabel,
}: LiquidSliderProps) {
    const { effectsEnabled } = useEffects();
    const filterId = useId();
    const scale = typeof size === 'number' ? size : SIZE_SCALES[size];
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(width);

    const sliderWidth = fillContainer ? containerWidth : width;

    // 数值 <-> 归一化进度（0-100）
    const toNorm = useCallback((v: number): number => ((v - min) / (max - min)) * 100, [min, max]);
    const fromNorm = useCallback(
        (n: number): number => min + (n / 100) * (max - min),
        [min, max],
    );

    const scaledThumbWidth = THUMB_WIDTH * scale;
    const scaledThumbHeight = THUMB_HEIGHT * scale;
    const scaledThumbRadius = THUMB_RADIUS * scale;
    const scaledSliderHeight = SLIDER_HEIGHT * scale;
    const scaledSliderWidth = sliderWidth * scale;

    const MAX_STRETCH = scaledSliderWidth * 0.1;
    const STRETCH_RESISTANCE = 0.4;
    const SCALE_REST = 0.6;
    const SCALE_DRAG = 1;
    const thumbWidthRest = scaledThumbWidth * SCALE_REST;

    // 物理滑动范围（含两端超出拇指宽度的余量）
    const maxDragDistance = scaledSliderWidth - scaledThumbWidth;
    const constraintsLeft = -thumbWidthRest / 3;
    const constraintsRight = maxDragDistance + thumbWidthRest / 3;
    const totalSlideRange = constraintsRight - constraintsLeft;

    // 将归一化进度映射到物理 x（两端 5% 物理区间对应数值 0-10 / 90-100 的加速段）
    const normToX = useCallback(
        (norm: number): number => {
            const p = Math.max(0, Math.min(1, norm / 100));

            let linearProgress: number;

            if (p < 0.1) {
                linearProgress = (p / 0.1) * 0.05;
            } else if (p <= 0.9) {
                linearProgress = 0.05 + ((p - 0.1) / 0.8) * 0.9;
            } else {
                linearProgress = 0.95 + ((p - 0.9) / 0.1) * 0.05;
            }

            return constraintsLeft + linearProgress * totalSlideRange;
        },
        [constraintsLeft, totalSlideRange],
    );

    const initialValue = value ?? defaultValue ?? (min + max) / 2;
    const x = useMotionValue(normToX(toNorm(initialValue)));
    const norm = useMotionValue(toNorm(initialValue));
    const velocityX = useVelocity(x);
    const pointerDown = useMotionValue(0);
    const overshoot = useMotionValue(0);
    const lastEmitted = useRef(Math.round(initialValue));

    useMotionValueEvent(x, 'change', (latestX) => {
        const rawProgress = (latestX - constraintsLeft) / totalSlideRange;
        const linearProgress = Math.max(0, Math.min(1, rawProgress));

        let eased: number;

        if (linearProgress < 0.05) {
            eased = (linearProgress / 0.05) * 0.1;
        } else if (linearProgress <= 0.95) {
            eased = 0.1 + ((linearProgress - 0.05) / 0.9) * 0.8;
        } else {
            eased = 0.9 + ((linearProgress - 0.95) / 0.05) * 0.1;
        }

        const normValue = Math.max(0, Math.min(100, eased * 100));
        norm.set(normValue);

        const actual = Math.round(fromNorm(normValue));

        if (actual !== lastEmitted.current) {
            lastEmitted.current = actual;
            onChange?.(actual);
        }

        // 越界形变：记录拇指超出物理边界的距离
        if (pointerDown.get() > 0.5) {
            let over = 0;

            if (latestX < constraintsLeft) {
                over = latestX - constraintsLeft;
            } else if (latestX > constraintsRight) {
                over = latestX - constraintsRight;
            }

            overshoot.set(over);
        }
    });

    // 受控值外部变化时（如登录后数据库覆盖本地值）弹簧归位
    useEffect(() => {
        if (value === undefined) {
            return;
        }

        if (Math.abs(value - fromNorm(norm.get())) > 0.75) {
            void animate(x, normToX(toNorm(value)), {
                type: 'spring',
                stiffness: 400,
                damping: 30,
            });
        }
    }, [value, x, norm, normToX, toNorm, fromNorm]);

    // 容器宽度变化后把拇指复位到当前数值对应的物理位置
    useEffect(() => {
        if (!fillContainer) {
            return;
        }

        x.set(normToX(norm.get()));
    }, [sliderWidth, fillContainer, x, norm, normToX]);

    const overshootSpring = useSpring(overshoot, { stiffness: 400, damping: 30 });

    const trackScaleY = useTransform(overshootSpring, (o) => {
        const damped = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, o * STRETCH_RESISTANCE));
        const v = 1 - Math.abs(damped) / (scaledSliderWidth * 1.5);

        return Math.max(0.8, v);
    });

    const trackWidthStyle = useTransform(overshootSpring, (o) => {
        const stretch = Math.min(Math.abs(o * STRETCH_RESISTANCE), MAX_STRETCH);

        return scaledSliderWidth + stretch;
    });

    const trackXStyle = useTransform(overshootSpring, (o) => {
        const stretch = Math.min(Math.abs(o * STRETCH_RESISTANCE), MAX_STRETCH);
        const sign = Math.sign(o);

        if (sign > 0) {
            return stretch * 0.8;
        }

        return -stretch - stretch * 0.8;
    });

    // --- 玻璃拇指视觉（与 LiquidGlass 滤镜联动） ---
    const blur = useMotionValue(0);
    const specularOpacity = useMotionValue(0.4);
    const specularSaturation = useMotionValue(7);
    const refractionBase = useMotionValue(1);

    const isUp = useTransform((): number => (pointerDown.get() > 0.5 ? 1 : 0));
    const pressMultiplier = useTransform(isUp, [0, 1], [0.4, 0.9]);
    const scaleRatio = useSpring(
        useTransform([pressMultiplier, refractionBase], ([m, base]) => (Number(m) || 0) * (Number(base) || 0)),
    );

    const baseScale = useSpring(useTransform(isUp, [0, 1], [SCALE_REST, SCALE_DRAG]), {
        stiffness: 340,
        damping: 20,
    });
    const objectScaleY = useTransform(
        [baseScale, velocityX],
        ([s, v]) => {
            const velocityFactor = Math.abs(v as number) / 3000;
            const deformation = 1 - Math.min(velocityFactor, 0.3);

            return (s as number) * deformation;
        },
    );
    const objectScaleX = useTransform(
        [baseScale, objectScaleY],
        ([s, sy]) => {
            const currentScale = s as number;
            const currentScaleY = sy as number;

            return currentScale + (currentScale - currentScaleY);
        },
    );

    const backgroundOpacity = useSpring(useTransform(isUp, [0, 1], [1, 0.1]), { stiffness: 340, damping: 20 });
    const backgroundStyle = useTransform(backgroundOpacity, (op) => `rgba(255, 255, 255, ${op})`);
    const shadowSx = useSpring(useTransform(isUp, [0, 1], [0, 4 * scale]), { stiffness: 340, damping: 30 });
    const shadowSy = useSpring(useTransform(isUp, [0, 1], [0, 4 * scale]), { stiffness: 340, damping: 30 });
    const shadowAlpha = useSpring(useTransform(isUp, [0, 1], [0.16, 0.22]), { stiffness: 220, damping: 24 });
    const insetShadowAlpha = useSpring(useTransform(isUp, [0, 1], [0, 0.27]), { stiffness: 220, damping: 24 });
    const shadowBlur = useSpring(useTransform(isUp, [0, 1], [9 * scale, 24 * scale]), { stiffness: 340, damping: 30 });

    const boxShadow = useTransform(() => {
        const inset =
            pointerDown.get() > 0.5
                ? `inset ${shadowSx.get() / 2}px ${shadowSy.get() / 2}px ${24 * scale}px rgba(0,0,0,${insetShadowAlpha.get()}),
                   inset ${-shadowSx.get() / 2}px ${-shadowSy.get() / 2}px ${24 * scale}px rgba(255,255,255,${insetShadowAlpha.get()})`
                : '';

        return `${shadowSx.get()}px ${shadowSy.get()}px ${shadowBlur.get()}px rgba(0,0,0,${shadowAlpha.get()})${
            inset ? ', ' + inset : ''
        }`;
    });

    useEffect(() => {
        const onPointerUp = (): void => {
            pointerDown.set(0);
            void animate(overshoot, 0, { type: 'spring', stiffness: 400, damping: 30 });
        };

        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchend', onPointerUp);

        return () => {
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('mouseup', onPointerUp);
            window.removeEventListener('touchend', onPointerUp);
        };
    }, [overshoot, pointerDown]);

    // fillContainer：实测容器宽度（换算为 1 号基准宽度），并监听 resize
    useEffect(() => {
        if (!fillContainer) {
            return;
        }

        const updateWidth = (): void => {
            const rect = containerRef.current?.getBoundingClientRect();

            if (rect && rect.width > 0) {
                setContainerWidth(rect.width / scale);
            }
        };

        const timer = setTimeout(updateWidth, 100);
        window.addEventListener('resize', updateWidth);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateWidth);
        };
    }, [fillContainer, scale]);

    const onThumbKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const step = event.shiftKey ? 10 : 2;
        let next: number | null = null;

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                next = Math.max(min, fromNorm(norm.get()) - step);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                next = Math.min(max, fromNorm(norm.get()) + step);
                break;
            case 'Home':
                next = min;
                break;
            case 'End':
                next = max;
                break;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        const rounded = Math.round(next);

        void animate(x, normToX(toNorm(next)), { type: 'spring', stiffness: 400, damping: 30 });
        lastEmitted.current = rounded;
        onChange?.(rounded);
        onChangeEnd?.(rounded);
    };

    return (
        <div
            ref={containerRef}
            style={{ width: fillContainer ? '100%' : scaledSliderWidth, height: scaledThumbHeight, position: 'relative' }}
            className="touch-none"
        >
            <motion.div style={{ position: 'relative', width: scaledSliderWidth, height: scaledThumbHeight }}>
                {/* 轨道 */}
                <motion.div
                    style={{
                        display: 'inline-block',
                        height: scaledSliderHeight,
                        left: 0,
                        top: (scaledThumbHeight - scaledSliderHeight) / 2,
                        backgroundColor: '#89898F66',
                        borderRadius: scaledSliderHeight / 2,
                        position: 'absolute',
                        cursor: 'pointer',
                        width: trackWidthStyle,
                        x: trackXStyle,
                        scaleY: trackScaleY,
                        originX: 0,
                    }}
                >
                    <div className="h-full w-full overflow-hidden rounded-full">
                        <motion.div
                            style={{
                                top: 0,
                                left: 0,
                                height: scaledSliderHeight,
                                width: useTransform(norm, (n) => `${n}%`),
                                borderRadius: scaledSliderHeight / 2,
                                backgroundColor: 'var(--color-primary)',
                            }}
                        />
                    </div>
                </motion.div>

                {/* 液态玻璃拇指（特效开启时渲染滤镜 SVG） */}
                {effectsEnabled &&
                    typeof window !== 'undefined' && (
                        <Filter
                            id={filterId}
                            blur={blur}
                            scaleRatio={scaleRatio}
                            specularOpacity={specularOpacity}
                            specularSaturation={specularSaturation}
                            magnifyingScale={undefined}
                            width={scaledThumbWidth}
                            height={scaledThumbHeight}
                            radius={scaledThumbRadius}
                            bezelWidth={16 * scale}
                            glassThickness={80 * scale}
                            refractiveIndex={1.45}
                        />
                    )}

                {/* 拇指 */}
                <motion.div
                    role="slider"
                    aria-label={ariaLabel}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={value ?? undefined}
                    tabIndex={0}
                    onKeyDown={onThumbKeyDown}
                    drag="x"
                    dragElastic={0.1}
                    dragMomentum
                    dragTransition={{ power: 0.15, timeConstant: 250 }}
                    dragConstraints={{ left: constraintsLeft, right: constraintsRight }}
                    onMouseDown={() => pointerDown.set(1)}
                    onMouseUp={() => pointerDown.set(0)}
                    onDragStart={() => pointerDown.set(1)}
                    onDragEnd={() => {
                        pointerDown.set(0);

                        // 贴近两端时吸附到 min/max
                        const SNAP_THRESHOLD = 30 * scale;
                        const currentX = x.get();
                        let targetValue: number | null = null;

                        if (currentX < SNAP_THRESHOLD) {
                            targetValue = min;
                        } else if (currentX > maxDragDistance - SNAP_THRESHOLD) {
                            targetValue = max;
                        }

                        if (targetValue !== null) {
                            void animate(x, normToX(toNorm(targetValue)), {
                                type: 'spring',
                                stiffness: 400,
                                damping: 30,
                            });
                        }

                        void animate(overshoot, 0, { type: 'spring', stiffness: 400, damping: 30 });

                        const finalValue = targetValue !== null ? targetValue : Math.round(fromNorm(norm.get()));
                        lastEmitted.current = finalValue;
                        onChange?.(finalValue);
                        onChangeEnd?.(finalValue);
                    }}
                    className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{
                        height: scaledThumbHeight,
                        width: scaledThumbWidth,
                        top: 0,
                        borderRadius: scaledThumbRadius,
                        backdropFilter: effectsEnabled ? `url(#${filterId})` : undefined,
                        scaleX: objectScaleX,
                        scaleY: objectScaleY,
                        cursor: 'pointer',
                        backgroundColor: effectsEnabled
                            ? backgroundStyle
                            : 'var(--color-popover)',
                        boxShadow: effectsEnabled ? boxShadow : undefined,
                        x,
                    }}
                />
            </motion.div>
        </div>
    );
}

import { Link } from '@inertiajs/react';
import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * 分类球形标签云：分类点按斐波那契球面均匀分布，透视投影后近大远小、近实远虚，
 * 支持按住拖动旋转（带惯性），松手后缓慢回正并自转。
 *
 * 侧边栏宽度有限，长列表会把卡片拉得比正文还高，因此用球体把 N 个分类收进固定高度里。
 * 系统「减少动态效果」开启时不自转也不摆球，退回普通竖排列表。
 */
export type SphereItem = {
    key: string;
    label: string;
    count: number;
    href: string;
    active?: boolean;
};

/** 自转角速度（弧度/帧，约 70 秒一圈的慢速漂移）。 */
const AUTO_SPIN = 0.0015;
/** 拖拽位移到弧度的换算系数。 */
const DRAG_FACTOR = 0.0058;
/** 拖动多少像素后释放就不再当点击处理（容忍按下时的手部微抖）。 */
const DRAG_CLICK_THRESHOLD = 8;
/** 透视强度：越大近大远小越明显（与容器尺寸无关，取 depth 的系数）。 */
const PERSPECTIVE = 0.22;
/** 竖直拖动允许的最大倾角（约 66°），避免整个球翻到背面。 */
const MAX_TILT = 1.15;
/** 松手后倾角每帧回正的比例与惯性衰减比例。 */
const TILT_RESTORE = 0.99;
const VELOCITY_DECAY = 0.93;
/** 边缘留白：最长的分类名也不会顶出容器。 */
const EDGE_X = 34;
const EDGE_Y = 16;
/** 深度映射到的透明度区间。 */
const MIN_OPACITY = 0.34;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 首屏（含 SSR）用的半径与视角，之后由实测容器尺寸接管。 */
const INITIAL_RX = 78;
const INITIAL_RY = 144;
const INITIAL_TILT = 0.18;

type Point = { x: number; y: number; z: number };

/** 黄金角螺旋布线：把 count 个点尽量均匀地铺在单位球面上。
 * 纬线取区间中点（而非端点），避免首尾两个点落在极点上、自转时几乎不动。 */
function buildPoints(count: number): Point[] {
    return Array.from({ length: count }, (_, index) => {
        // 极轴取纬线中点，同一纬线圈上的半径随 |y| 增大而缩小
        const y = count === 1 ? 0 : 1 - (2 * index + 1) / count;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = index * GOLDEN_ANGLE;

        return { x: Math.cos(phi) * radius, y, z: Math.sin(phi) * radius };
    });
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

/** 先绕 Y 轴（水平转动）再绕 X 轴（俯仰），最后做透视投影。 */
function project(
    point: Point,
    spin: number,
    tilt: number,
    rx: number,
    ry: number,
) {
    const cosY = Math.cos(spin);
    const sinY = Math.sin(spin);
    const cosX = Math.cos(tilt);
    const sinX = Math.sin(tilt);

    const x = point.x * cosY + point.z * sinY;
    const depthY = -point.x * sinY + point.z * cosY;
    const y = point.y * cosX - depthY * sinX;
    const depth = point.y * sinX + depthY * cosX;

    // depth ∈ [-1, 1]：1 朝向读者，-1 在球背面
    const perspective = 1 / (1 - depth * PERSPECTIVE);

    return {
        x: x * rx * perspective,
        y: y * ry * perspective,
        depth,
        scale: perspective,
    };
}

/** 单个分类标签的静态样式（首屏渲染与 rAF 循环共用同一套算法）。 */
function labelStyle(
    point: Point,
    spin: number,
    tilt: number,
    rx: number,
    ry: number,
): React.CSSProperties {
    const { x, y, depth, scale } = project(point, spin, tilt, rx, ry);

    return {
        transform: `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
        opacity: MIN_OPACITY + (1 - MIN_OPACITY) * ((depth + 1) / 2),
        zIndex: Math.round((depth + 1) * 50),
    };
}

export default function CategorySphere({ items }: { items: SphereItem[] }) {
    const reduceMotion = useReducedMotion();
    const containerRef = useRef<HTMLElement>(null);
    const labelRefs = useRef<Array<HTMLElement | null>>([]);
    const points = useMemo(() => buildPoints(items.length), [items.length]);

    // 旋转状态放在 ref 里：每帧只写 DOM style，不进 React state 避免 30 个节点重渲染
    const spin = useRef(0);
    const tilt = useRef(0);
    const spinVelocity = useRef(0);
    const tiltVelocity = useRef(0);
    const dragging = useRef(false);
    const hovered = useRef(false);
    const dragOrigin = useRef({ x: 0, y: 0 });
    const dragDistance = useRef(0);
    const dragListeners = useRef<{
        move: (event: PointerEvent) => void;
        up: () => void;
    } | null>(null);

    const endDrag = useCallback(() => {
        dragging.current = false;

        const listeners = dragListeners.current;

        if (!listeners) {
            return;
        }

        window.removeEventListener('pointermove', listeners.move);
        window.removeEventListener('pointerup', listeners.up);
        window.removeEventListener('pointercancel', listeners.up);
        dragListeners.current = null;
    }, []);

    // 卸载兜底：拖动中组件被卸载时，不能把 window 监听留在页面上
    useEffect(() => endDrag, [endDrag]);

    useEffect(() => {
        if (reduceMotion) {
            return;
        }

        const container = containerRef.current;

        if (!container) {
            return;
        }

        // 尺寸只在容器变化时量一次：每帧读 getBoundingClientRect 会强制同步布局
        let rx = INITIAL_RX;
        let ry = INITIAL_RY;

        const measure = () => {
            const rect = container.getBoundingClientRect();

            rx = Math.max(36, rect.width / 2 - EDGE_X);
            ry = Math.max(48, rect.height / 2 - EDGE_Y);
        };

        measure();

        const apply = () => {
            for (const [index, node] of labelRefs.current.entries()) {
                const point = points[index];

                if (!node || !point) {
                    continue;
                }

                const { x, y, depth, scale } = project(
                    point,
                    spin.current,
                    tilt.current,
                    rx,
                    ry,
                );

                // 悬停/聚焦的标签要能被看清，抬到最前并去掉深度淡出
                const emphasized =
                    node.matches(':hover') || document.activeElement === node;

                node.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(emphasized ? scale * 1.12 : scale).toFixed(3)})`;
                node.style.opacity = emphasized
                    ? '1'
                    : String(
                          MIN_OPACITY + (1 - MIN_OPACITY) * ((depth + 1) / 2),
                      );
                node.style.zIndex = emphasized
                    ? '200'
                    : String(Math.round((depth + 1) * 50));
            }
        };

        let frame = 0;
        let visible = true;

        const tick = () => {
            frame = requestAnimationFrame(tick);

            if (!visible || document.hidden) {
                return;
            }

            if (!dragging.current) {
                spinVelocity.current *= VELOCITY_DECAY;
                tiltVelocity.current *= VELOCITY_DECAY;
                spin.current +=
                    spinVelocity.current + (hovered.current ? 0 : AUTO_SPIN);
                tilt.current = clamp(
                    tilt.current * TILT_RESTORE + tiltVelocity.current,
                    -MAX_TILT,
                    MAX_TILT,
                );
            }

            apply();
        };

        frame = requestAnimationFrame(tick);

        const resize = new ResizeObserver(measure);
        resize.observe(container);

        // 滚出视口 / 切到后台时停表，避免白耗一帧遍历
        const intersection = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting;
            },
            { rootMargin: '120px' },
        );
        intersection.observe(container);

        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            intersection.disconnect();
        };
    }, [points, reduceMotion]);

    /**
     * 拖动只挂 window 监听，绝不能用 setPointerCapture：
     * 指针捕获会把兼容性鼠标事件（mousedown/mouseup 以及随后的 click）一并重定向到捕获元素（容器），
     * 分类链接自身再也收不到 click，表现就是“球能转但链接点不开”。
     * window 监听同样能收到超出容器范围的位移，且不改变事件目标。
     */
    const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (reduceMotion || event.button > 0) {
            return;
        }

        endDrag();
        dragging.current = true;
        dragOrigin.current = { x: event.clientX, y: event.clientY };
        dragDistance.current = 0;

        const move = (moveEvent: PointerEvent) => {
            if (!dragging.current) {
                return;
            }

            const dx = moveEvent.clientX - dragOrigin.current.x;
            const dy = moveEvent.clientY - dragOrigin.current.y;

            dragOrigin.current = {
                x: moveEvent.clientX,
                y: moveEvent.clientY,
            };
            dragDistance.current += Math.abs(dx) + Math.abs(dy);

            spin.current += dx * DRAG_FACTOR;
            tilt.current = clamp(
                tilt.current + dy * DRAG_FACTOR,
                -MAX_TILT,
                MAX_TILT,
            );
            spinVelocity.current = dx * DRAG_FACTOR;
            tiltVelocity.current = dy * DRAG_FACTOR;
        };

        const up = () => {
            endDrag();
        };

        dragListeners.current = { move, up };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
    };

    /**
     * 拖动跨过了阈值就不再算「点击」，否则一拖就跳页。
     * 键盘激活的 click（detail 为 0）没有前置 pointerdown，距离是上一轮残留值，必须放行。
     */
    const handleClickCapture = (event: React.MouseEvent<HTMLElement>) => {
        if (
            event.detail === 0 ||
            dragDistance.current <= DRAG_CLICK_THRESHOLD
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    };

    // 减少动态效果：不自转、不摆球，退回可读性最好的竖排列表
    if (reduceMotion) {
        return (
            <ul className="space-y-0.5">
                {items.map((item) => (
                    <li key={item.key}>
                        <Link
                            href={item.href}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
                                item.active ? 'bg-primary/10 text-primary' : ''
                            }`}
                        >
                            <span>{item.label}</span>
                            <span className="text-footnote text-muted-foreground">
                                {item.count}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <nav
            ref={containerRef}
            aria-label="文章分类"
            onPointerEnter={() => {
                hovered.current = true;
            }}
            onPointerLeave={() => {
                hovered.current = false;
            }}
            onPointerDown={handlePointerDown}
            onClickCapture={handleClickCapture}
            className="relative h-[300px] w-full cursor-grab touch-pan-y touch-manipulation select-none active:cursor-grabbing sm:h-[330px]"
        >
            {items.map((item, index) => (
                <Link
                    key={item.key}
                    href={item.href}
                    // 链接默认可以被原生拖拽，不关掉的话拖动会被浏览器接走
                    draggable={false}
                    ref={(node) => {
                        labelRefs.current[index] = node as HTMLElement | null;
                    }}
                    style={labelStyle(
                        points[index],
                        0,
                        INITIAL_TILT,
                        INITIAL_RX,
                        INITIAL_RY,
                    )}
                    className={`absolute top-1/2 left-1/2 flex items-baseline gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap hover:text-primary focus-visible:text-primary ${
                        item.active
                            ? 'bg-primary/15 font-semibold text-primary'
                            : 'text-foreground/80'
                    }`}
                >
                    {item.label}
                    <span className="text-[9px] opacity-60">{item.count}</span>
                </Link>
            ))}
        </nav>
    );
}

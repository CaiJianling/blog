import { useLayoutEffect, useRef, useState } from 'react';

export type TrendPoint = {
    day: string;
    pv: number;
    uv: number;
};

type Props = {
    series: TrendPoint[];
    height?: number;
};

/**
 * 自绘 SVG 双折线趋势图（浏览量 + 独立访客），带悬停提示。
 */
export function TrendLineChart({ series, height = 240 }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [hover, setHover] = useState<number | null>(null);

    useLayoutEffect(() => {
        const el = containerRef.current;

        if (!el) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            setWidth(entries[0]?.contentRect.width ?? 0);
        });
        observer.observe(el);
        setWidth(el.clientWidth);

        return () => observer.disconnect();
    }, []);

    const pad = { top: 16, right: 12, bottom: 28, left: 36 };
    const innerW = Math.max(0, width - pad.left - pad.right);
    const innerH = height - pad.top - pad.bottom;

    const maxValue = Math.max(
        4,
        ...series.map((p) => p.pv),
        ...series.map((p) => p.uv),
    );
    // 向上取整到 4 的倍数，刻度更整齐
    const yMax = Math.ceil(maxValue / 4) * 4;

    const x = (i: number) =>
        pad.left +
        (series.length > 1 ? (i / (series.length - 1)) * innerW : innerW / 2);
    const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;

    const toPath = (key: 'pv' | 'uv') =>
        series
            .map(
                (p, i) =>
                    `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`,
            )
            .join(' ');

    const areaPath =
        toPath('pv') +
        ` L${x(series.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)}` +
        ` L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
        Math.round((yMax / tickCount) * i),
    );

    // 底部日期轴：首、中、尾各一段，避免拥挤
    const labelStep = Math.max(1, Math.ceil(series.length / 5));
    const xLabels = series
        .map((p, i) => ({ i, day: p.day }))
        .filter(({ i }) => i % labelStep === 0 || i === series.length - 1);

    const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const px = event.clientX - rect.left;

        if (series.length === 0 || innerW <= 0) {
            setHover(null);

            return;
        }

        const ratio = Math.min(1, Math.max(0, (px - pad.left) / innerW));
        setHover(Math.round(ratio * (series.length - 1)));
    };

    if (series.length === 0) {
        return (
            <div
                ref={containerRef}
                className="text-callout flex h-40 items-center justify-center text-muted-foreground"
            >
                暂无数据
            </div>
        );
    }

    const hovered = hover !== null ? series[hover] : null;

    return (
        <div className="relative" ref={containerRef}>
            {width > 0 && (
                <svg
                    width={width}
                    height={height}
                    onMouseMove={handleMove}
                    onMouseLeave={() => setHover(null)}
                    role="img"
                >
                    <defs>
                        <linearGradient
                            id="trend-area"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--color-primary)"
                                stopOpacity="0.25"
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--color-primary)"
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {/* 横向网格与 Y 轴刻度 */}
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line
                                x1={pad.left}
                                x2={width - pad.right}
                                y1={y(tick)}
                                y2={y(tick)}
                                stroke="var(--color-border)"
                                strokeOpacity="0.4"
                                strokeDasharray={tick === 0 ? undefined : '3 5'}
                            />
                            <text
                                x={pad.left - 8}
                                y={y(tick) + 3.5}
                                textAnchor="end"
                                className="fill-muted-foreground text-[10px]"
                            >
                                {tick}
                            </text>
                        </g>
                    ))}

                    {/* 面积与折线 */}
                    <path d={areaPath} fill="url(#trend-area)" />
                    <path
                        d={toPath('pv')}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <path
                        d={toPath('uv')}
                        fill="none"
                        stroke="var(--color-emerald-500, #10b981)"
                        strokeWidth="1.5"
                        strokeDasharray="5 4"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {/* X 轴日期标签 */}
                    {xLabels.map(({ i, day }) => (
                        <text
                            key={i}
                            x={x(i)}
                            y={height - 8}
                            textAnchor={
                                i === 0
                                    ? 'start'
                                    : i === series.length - 1
                                      ? 'end'
                                      : 'middle'
                            }
                            className="fill-muted-foreground text-[10px]"
                        >
                            {day.slice(5)}
                        </text>
                    ))}

                    {/* 悬停指示 */}
                    {hovered && hover !== null && (
                        <g>
                            <line
                                x1={x(hover)}
                                x2={x(hover)}
                                y1={pad.top}
                                y2={pad.top + innerH}
                                stroke="var(--color-foreground)"
                                strokeOpacity="0.25"
                            />
                            <circle
                                cx={x(hover)}
                                cy={y(hovered.pv)}
                                r="3.5"
                                fill="var(--color-primary)"
                            />
                            <circle
                                cx={x(hover)}
                                cy={y(hovered.uv)}
                                r="3.5"
                                fill="var(--color-emerald-500, #10b981)"
                            />
                        </g>
                    )}
                </svg>
            )}

            {hovered && (
                <div
                    className="text-footnote pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-background shadow-lg"
                    style={{
                        left: Math.min(Math.max(x(hover ?? 0), 70), width - 70),
                    }}
                >
                    <div className="mb-1 font-medium">{hovered.day}</div>
                    <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                        浏览量 {hovered.pv.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        独立访客 {hovered.uv.toLocaleString()}
                    </div>
                </div>
            )}

            <div className="text-footnote mt-2 flex items-center gap-4 px-1 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 rounded-full bg-[var(--color-primary)]" />
                    浏览量
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 rounded-full border-t-2 border-dashed border-emerald-500" />
                    独立访客
                </span>
            </div>
        </div>
    );
}

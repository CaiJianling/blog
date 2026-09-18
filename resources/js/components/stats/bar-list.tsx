export type BarItem = {
    name: string;
    value: number;
    /** 附加说明（如外链路径、日期区间） */
    hint?: string;
};

type Props = {
    items: BarItem[];
    /** 值标签，默认显示数字 */
    valueLabel?: string;
};

/**
 * 横向条形列表：按数值降序展示（降序由调用方保证），条形宽度相对最大值。
 */
export function BarList({ items, valueLabel }: Props) {
    const max = Math.max(0, ...items.map((item) => item.value));

    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={`${item.name}-${item.hint ?? ''}`}>
                    <div className="text-callout mb-1 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                            {item.name}
                            {item.hint && (
                                <span className="text-footnote ml-1.5 text-muted-foreground">
                                    {item.hint}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                            {item.value.toLocaleString()}
                            {valueLabel ? ` ${valueLabel}` : ''}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                                width:
                                    max > 0
                                        ? `${(item.value / max) * 100}%`
                                        : '0%',
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

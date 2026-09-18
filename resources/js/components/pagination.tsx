import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 后台列表通用分页控件。
 *
 * 展示：当前页/总页数 + 共 N 条；首页/末页、上一页/下一页；以及围绕当前页的页码
 * （首尾页常显，中间用省略号折叠）。点击任一按钮回调 onPageChange(page)。
 * 当 total 不超过一页时（lastPage <= 1）自动隐藏。
 */
interface PaginationProps {
    current: number;
    last: number;
    /** 记录总条数（可选，用于展示「共 N 条」） */
    total?: number;
    /** 每页条数（可选，用于展示「每页 N 条」） */
    perPage?: number;
    onPageChange: (page: number) => void;
    className?: string;
}

/** 计算需要渲染的页码序列：首尾常显，中间围绕当前页展开，缺口用省略号占位。 */
function buildItems(current: number, last: number): Array<number | 'left' | 'right'> {
    // 总页数较少时直接全部展示
    if (last <= 7) {
        return Array.from({ length: last }, (_, i) => i + 1);
    }

    const SIBLINGS = 2;

    // 围绕当前页的窗口
    let start = Math.max(2, current - SIBLINGS);
    let end = Math.min(last - 1, current + SIBLINGS);

    // 靠近首/尾页时向对应方向扩展，让窗口尽量保持 SIBLINGS*2+1 个页码
    if (end - start + 1 < SIBLINGS * 2 + 1) {
        if (start <= SIBLINGS + 1) {
            end = Math.min(last - 1, SIBLINGS * 2 + 1);
        } else {
            start = Math.max(2, last - SIBLINGS * 2);
        }
    }

    const items: Array<number | 'left' | 'right'> = [1];

    if (start > 2) {
        items.push('left');
    }

    for (let p = start; p <= end; p++) {
        items.push(p);
    }

    if (end < last - 1) {
        items.push('right');
    }

    items.push(last);

    return items;
}

export default function Pagination({
    current,
    last,
    total,
    perPage,
    onPageChange,
    className,
}: PaginationProps) {
    if (last <= 1) {
        return null;
    }

    const items = buildItems(current, last);

    const goTo = (page: number) => {
        if (page >= 1 && page <= last && page !== current) {
            onPageChange(page);
        }
    };

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {/* 当前页 / 总页数 · 共 N 条 */}
            <div className="flex items-center justify-center gap-2 text-callout text-secondary-label tabular-nums">
                <span>
                    第 {current} / {last} 页
                </span>
                {typeof total === 'number' && <span>· 共 {total} 条</span>}
                {typeof perPage === 'number' && <span>· 每页 {perPage} 条</span>}
            </div>

            {/* 翻页控件 */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={current === 1}
                    onClick={() => goTo(1)}
                >
                    <ChevronsLeft className="h-4 w-4" />
                    首页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={current === 1}
                    onClick={() => goTo(current - 1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                </Button>

                {items.map((item, index) =>
                    typeof item === 'number' ? (
                        <Button
                            key={`page-${item}`}
                            size="sm"
                            variant={item === current ? 'default' : 'outline'}
                            className={cn('h-8 w-8 p-0 tabular-nums', item === current && 'text-primary')}
                            disabled={item === current}
                            onClick={() => goTo(item)}
                            aria-current={item === current ? 'page' : undefined}
                        >
                            {item}
                        </Button>
                    ) : (
                        <span key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center text-secondary-label">
                            <MoreHorizontal className="h-4 w-4" />
                        </span>
                    ),
                )}

                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={current === last}
                    onClick={() => goTo(current + 1)}
                >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={current === last}
                    onClick={() => goTo(last)}
                >
                    末页
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface SearchScope {
    value: string;
    /** 简短范围名，同时用于触发器和下拉项（如「标题」「内容」） */
    label: string;
    /** 选中该范围时输入框的占位提示，缺省回退到 placeholder */
    placeholder?: string;
}

interface Props {
    /** 受控初始值（如当前搜索词） */
    initial?: string;
    placeholder?: string;
    buttonLabel?: string;
    /** 提供后显示搜索范围下拉框，默认取第一项 */
    scopes?: SearchScope[];
    initialScope?: string;
    /** 回车/点击搜索时的回调；提供 scopes 时第二参为当前范围 */
    onSubmit: (value: string, scope?: string) => void;
}

/**
 * 通用页面搜索框：范围下拉 + 输入框 + 搜索按钮合成一颗胶囊，回车或点击触发。
 *
 * 焦点环、下拉浮层都复用站内 shadcn 控件，避免原生 select 那种与主题脱节的观感。
 */
export default function PageSearch({
    initial = '',
    placeholder = '搜索',
    buttonLabel = '搜索',
    scopes,
    initialScope,
    onSubmit,
}: Props) {
    const [value, setValue] = useState(initial);
    const [scope, setScope] = useState(initialScope ?? scopes?.[0]?.value ?? '');

    const activePlaceholder =
        scopes?.find((s) => s.value === scope)?.placeholder ?? placeholder;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(value.trim(), scopes ? scope : undefined);
    };

    return (
        <form onSubmit={submit} className="w-full sm:w-auto">
            <div className="bg-background/60 border-border/60 focus-within:border-ring/80 focus-within:ring-ring/20 flex h-10 w-full items-center gap-1 rounded-full border py-0 pl-1 backdrop-blur-sm transition-all duration-200 ease-out focus-within:ring-4 sm:w-96">
                {scopes && scopes.length > 0 && (
                    <>
                        <Select value={scope} onValueChange={setScope}>
                            <SelectTrigger
                                aria-label="搜索范围"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground data-[state=open]:bg-muted h-8 w-auto shrink-0 gap-1 rounded-full border-0 bg-transparent px-2.5 font-medium shadow-none focus:border-transparent focus:ring-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" align="start">
                                <SelectGroup>
                                    <SelectLabel>搜索范围</SelectLabel>
                                    {scopes.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <span
                            aria-hidden
                            className="bg-border/70 h-5 w-px shrink-0"
                        />
                    </>
                )}
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={activePlaceholder}
                    aria-label={buttonLabel}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus:border-transparent focus:bg-transparent focus:ring-0"
                />
                <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    aria-label={buttonLabel}
                >
                    <Search className="h-4 w-4" />
                </Button>
            </div>
        </form>
    );
}

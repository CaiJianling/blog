import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface SearchScope {
    value: string;
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
 * 通用页面搜索框：可选的范围下拉 + 输入框 + 搜索按钮，回车或点击触发。
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
        <form onSubmit={submit} className="flex items-center gap-2">
            {scopes && scopes.length > 0 && (
                <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    aria-label="搜索范围"
                    className="h-10 shrink-0 cursor-pointer rounded-full border border-border/60 bg-background/50 px-3.5 text-[0.9375rem] text-foreground outline-none transition-all duration-200 focus:border-ring/80 focus:ring-4 focus:ring-ring/20"
                >
                    {scopes.map((s) => (
                        <option key={s.value} value={s.value}>
                            {s.label}
                        </option>
                    ))}
                </select>
            )}
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={activePlaceholder}
                className="h-10 w-full max-w-sm rounded-full"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label={buttonLabel}>
                <Search className="h-4 w-4" />
            </Button>
        </form>
    );
}

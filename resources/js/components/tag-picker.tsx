import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { store, destroy } from '@/routes/taxonomies';

export interface TagItem {
    id: number;
    name: string;
}

interface Props {
    items: TagItem[];
    selected: number[];
    onChange: (next: number[]) => void;
    onChanged?: () => void; // fired after add/delete, lets parent refresh list
}

export function TagPicker({ items, selected, onChange, onChanged }: Props) {
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const submit = async () => {
        const names = input
            .split(/[,,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);

        if (names.length === 0 || busy) {
return;
}

        setBusy(true);
        const newlyCreated: number[] = [];

        for (const name of names) {
            // try to find an existing tag with this name (case-insensitive)
            const existing = items.find((i) => i.name.toLowerCase() === name.toLowerCase());

            if (existing) {
                if (!selected.includes(existing.id) && !newlyCreated.includes(existing.id)) {
                    newlyCreated.push(existing.id);
                }

                continue;
            }

            try {
                await new Promise<void>((resolve) => {
                    router.post(
                        store().url,
                        { taxonomy: 'tag', name },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                onChanged?.();
                                resolve();
                            },
                            onError: () => resolve(),
                        },
                    );
                });
            } catch {
                /* ignore */
            }
        }

        // after creation, parent props should be reloaded; we still update selection optimistically
        setInput('');
        setBusy(false);

        if (newlyCreated.length) {
            onChange(Array.from(new Set([...selected, ...newlyCreated])));
        }
    };

    const removeTag = (item: TagItem) => {
        // First deselect
        onChange(selected.filter((id) => id !== item.id));

        if (!window.confirm(`确定要删除标签「${item.name}」吗？`)) {
return;
}

        router.delete(destroy({ termTaxonomy: item.id }).url, {
            preserveScroll: true,
            onSuccess: () => onChanged?.(),
        });
    };

    const selectedItems = items.filter((i) => selected.includes(i.id));
    const mostUsed = [...items]
        .sort((a, b) => (a.id > b.id ? -1 : 1))
        .slice(0, 18);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                {selectedItems.map((item) => (
                    <span
                        key={item.id}
                        className="apple-press inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs group"
                    >
                        #{item.name}
                        <button
                            type="button"
                            onClick={() => removeTag(item)}
                            className="hidden group-hover:inline-flex rounded text-muted-foreground hover:text-destructive"
                            aria-label={`删除 ${item.name}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    onBlur={() => {
                        if (input.trim()) {
submit();
}
                    }}
                    placeholder={selectedItems.length ? '' : '添加标签…'}
                    className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    disabled={busy}
                />
            </div>
            <p className="text-xs text-muted-foreground">用逗号或回车分隔。</p>

            {mostUsed.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">最多使用</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {mostUsed.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    if (!selected.includes(item.id)) {
                                        onChange([...selected, item.id]);
                                    }
                                }}
                                className="apple-press text-xs text-primary hover:underline"
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
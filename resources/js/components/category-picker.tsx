import { useState, useRef, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, X, Trash2 } from 'lucide-react';
import { store, destroy } from '@/routes/taxonomies';

export interface CategoryItem {
    id: number;
    name: string;
}

interface Props {
    items: CategoryItem[];
    selected: number[];
    onChange: (next: number[]) => void;
    onChanged?: () => void; // fired after add/delete, lets parent refresh list
}

export function CategoryPicker({ items, selected, onChange, onChanged }: Props) {
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (adding) inputRef.current?.focus();
    }, [adding]);

    const filtered = search.trim()
        ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
        : items;

    const toggle = (id: number) => {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    };

    const addNew = (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name || busy) return;
        setBusy(true);
        router.post(
            store().url,
            { taxonomy: 'category', name },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewName('');
                    setAdding(false);
                    setBusy(false);
                    onChanged?.();
                },
                onError: () => setBusy(false),
            },
        );
    };

    const remove = (item: CategoryItem, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`确定要删除分类「${item.name}」吗？`)) return;
        router.delete(destroy({ termTaxonomy: item.id }).url, {
            preserveScroll: true,
            onSuccess: () => onChanged?.(),
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索分类"
                    className="h-8 pl-8 text-xs"
                />
            </div>

            <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                        {search ? '无匹配分类' : '暂无分类'}
                    </p>
                ) : (
                    filtered.map((item) => {
                        const isChecked = selected.includes(item.id);
                        return (
                            <div
                                key={item.id}
                                className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent/60"
                            >
                                <label className="flex flex-1 cursor-pointer items-center gap-2">
                                    <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggle(item.id)}
                                        className="h-3.5 w-3.5"
                                    />
                                    <span className="truncate text-xs">{item.name}</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={(e) => remove(item, e)}
                                    className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                                    aria-label={`删除 ${item.name}`}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {adding ? (
                <form onSubmit={addNew} className="flex items-center gap-1.5">
                    <Input
                        ref={inputRef}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="新分类名称"
                        className="h-7 text-xs"
                        disabled={busy}
                    />
                    <Button type="submit" size="sm" disabled={busy || !newName.trim()} className="h-7 px-2 text-xs">
                        添加
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                            setAdding(false);
                            setNewName('');
                        }}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </form>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="apple-press flex items-center gap-1 self-start rounded-md px-1 py-0.5 text-xs text-primary hover:bg-primary/60"
                >
                    <Plus className="h-3 w-3" />
                    添加分类
                </button>
            )}
        </div>
    );
}
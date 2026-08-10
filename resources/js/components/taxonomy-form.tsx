import { router } from '@inertiajs/react';
import { Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { store, update } from '@/routes/taxonomies';

export interface TaxonomyItem {
    id: number;
    name: string;
    slug: string;
    description: string;
    count: number;
    parent: number;
}

interface Props {
    taxonomy: 'category' | 'tag';
    items: TaxonomyItem[];
    editing: TaxonomyItem | null;
    onSubmitted: () => void;
}

const emptyItem: TaxonomyItem = {
    id: 0,
    name: '',
    slug: '',
    description: '',
    count: 0,
    parent: 0,
};

export function TaxonomyForm({ taxonomy, items, editing, onSubmitted }: Props) {
    const [data, setData] = useState<TaxonomyItem>(emptyItem);
    const [processing, setProcessing] = useState(false);

    // Sync form state when editing target changes
    const editingId = editing?.id ?? 0;

    if (editing && data.id !== editingId) {
        setData(editing);
    } else if (!editing && data.id !== 0) {
        setData(emptyItem);
    }

    const isEditing = editing !== null;
    const title = isEditing
        ? (taxonomy === 'tag' ? '编辑标签' : '编辑分类')
        : (taxonomy === 'tag' ? '添加新标签' : '添加新分类');
    const submitLabel = isEditing ? '更新' : (taxonomy === 'tag' ? '添加新标签' : '添加新分类');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        if (processing) {
return;
}

        const payload: Record<string, string | number> = {
            name: data.name.trim(),
        };

        if (data.slug.trim()) {
payload.slug = data.slug.trim();
}

        if (data.description.trim()) {
payload.description = data.description.trim();
}

        if (taxonomy === 'category' && data.parent) {
payload.parent = data.parent;
}

        setProcessing(true);

        const finish = () => {
            setProcessing(false);
            setData(emptyItem);
            onSubmitted();
        };

        if (isEditing) {
            router.put(update({ termTaxonomy: editing!.id }).url, payload, {
                onSuccess: finish,
                onError: finish,
            });
        } else {
            router.post(store().url, { taxonomy, ...payload }, {
                onSuccess: finish,
                onError: finish,
            });
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
            <h3 className="text-subheadline font-semibold">{title}</h3>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-name">名称</Label>
                <Input
                    id="tax-name"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    required
                />
                <p className="text-xs text-muted-foreground">
                    名称是它在站点上显示的方式。
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-slug">别名</Label>
                <Input
                    id="tax-slug"
                    value={data.slug}
                    onChange={(e) => setData({ ...data, slug: e.target.value })}
                    placeholder={taxonomy === 'tag' ? '如：ai、docker' : '如：hospital-related'}
                />
                <p className="text-xs text-muted-foreground">
                    「别名」是在 URL 中使用的字符。它通常是小写字母，并且只包含字母、数字和连字符。
                </p>
            </div>

            {taxonomy === 'category' && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tax-parent">父级分类</Label>
                    <Select
                        value={String(data.parent || 'none')}
                        onValueChange={(value) =>
                            setData({ ...data, parent: value === 'none' ? 0 : Number(value) })
                        }
                    >
                        <SelectTrigger id="tax-parent">
                            <SelectValue placeholder="无" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">无</SelectItem>
                            {items
                                .filter((item) => !isEditing || item.id !== editing.id)
                                .map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        分类和标签不同，您可以创建层级关系。您可以有一个名为「音乐」的父类，在该父类下可以包含「流行」和「古典」子分类。
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-description">描述</Label>
                <Textarea
                    id="tax-description"
                    value={data.description}
                    onChange={(e) => setData({ ...data, description: e.target.value })}
                    rows={3}
                />
                <p className="text-xs text-muted-foreground">
                    {taxonomy === 'tag'
                        ? '描述默认不显示，但有些主题可能会显示。'
                        : '描述默认不显示，但有些主题可能会显示。'}
                </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                    type="submit"
                    disabled={processing || !data.name.trim()}
                    className="gap-1.5"
                >
                    {isEditing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {submitLabel}
                </Button>
                {isEditing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setData(emptyItem)}
                    >
                        取消
                    </Button>
                )}
            </div>
        </form>
    );
}
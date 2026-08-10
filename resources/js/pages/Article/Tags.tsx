import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { Tag, Pencil, Trash2, Search } from 'lucide-react';
import { useState } from 'react';
import type { TaxonomyItem } from '@/components/taxonomy-form';
import { TaxonomyForm } from '@/components/taxonomy-form';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tags as articlesTags } from '@/routes/articles';
import { destroy } from '@/routes/taxonomies';

interface Props {
    tags: TaxonomyItem[];
}

export default function Tags({ tags }: Props) {
    const [editing, setEditing] = useState<TaxonomyItem | null>(null);
    const [search, setSearch] = useState('');

    const filtered = tags.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleDelete = (item: TaxonomyItem) => {
        if (!window.confirm(`确定要删除标签「${item.name}」吗？`)) {
return;
}

        router.delete(destroy({ termTaxonomy: item.id }).url, {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title="标签" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">标签</h1>
                </div>

                <div className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr]">
                    {/* Left: Add/Edit Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {editing ? '编辑标签' : '添加新标签'}
                            </CardTitle>
                            <CardDescription>
                                {editing
                                    ? `正在编辑：「${editing.name}」`
                                    : '填写名称创建新标签。'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TaxonomyForm
                                taxonomy="tag"
                                items={tags}
                                editing={editing}
                                onSubmitted={() => setEditing(null)}
                            />
                        </CardContent>
                    </Card>

                    {/* Right: List */}
                    <Card className="flex flex-col">
                            <CardHeader className="flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle>标签列表</CardTitle>
                                    <CardDescription>
                                        共 {tags.length} 个标签
                                    </CardDescription>
                                </div>
                                <div className="relative w-64">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="搜索标签…"
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="h-10 px-4">名称</TableHead>
                                            <TableHead className="h-10 px-4">描述</TableHead>
                                            <TableHead className="h-10 px-4">别名</TableHead>
                                            <TableHead className="h-10 px-4 text-right">数量</TableHead>
                                            <TableHead className="h-10 px-4 w-28">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="py-8 text-center text-muted-foreground"
                                                >
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Tag className="h-8 w-8 text-muted-foreground/50" />
                                                        <p>
                                                            {search
                                                                ? '未找到匹配的标签'
                                                                : '暂无标签'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filtered.map((tag) => (
                                                <TableRow
                                                    key={tag.id}
                                                    className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${editing?.id === tag.id ? 'bg-muted/50' : ''}`}
                                                >
                                                    <TableCell className="px-4 py-3 font-medium">
                                                        {tag.name}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                                        {tag.description || '—'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                                        {tag.slug || '—'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right tabular-nums">
                                                        {tag.count}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => setEditing(tag)}
                                                                aria-label="编辑"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleDelete(tag)}
                                                                aria-label="删除"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                </div>
            </div>
        </>
    );
}

Tags.layout = {
    breadcrumbs: [
        {
            title: 'articles.tags',
            href: articlesTags().url,
        },
    ],
};
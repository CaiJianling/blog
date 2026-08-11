import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { categories as articlesCategories } from '@/routes/articles';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FolderClosed, Pencil, Trash2, Search } from 'lucide-react';
import { TaxonomyForm, TaxonomyItem } from '@/components/taxonomy-form';
import { router } from '@inertiajs/react';
import { destroy } from '@/routes/taxonomies';

interface Props {
    categories: TaxonomyItem[];
}

export default function Categories({ categories }: Props) {
    const [editing, setEditing] = useState<TaxonomyItem | null>(null);
    const [search, setSearch] = useState('');

    const filtered = categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleDelete = (item: TaxonomyItem) => {
        if (!window.confirm(`确定要删除分类「${item.name}」吗？`)) return;
        router.delete(destroy({ termTaxonomy: item.id }).url, {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title="分类目录" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">分类目录</h1>
                </div>

                <div className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr]">
                    {/* Left: Add/Edit Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {editing ? '编辑分类' : '添加新分类'}
                            </CardTitle>
                            <CardDescription>
                                {editing
                                    ? `正在编辑：「${editing.name}」`
                                    : '填写名称创建新分类。'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TaxonomyForm
                                taxonomy="category"
                                items={categories}
                                editing={editing}
                                onSubmitted={() => setEditing(null)}
                            />
                        </CardContent>
                    </Card>

                    {/* Right: List */}
                    <Card className="flex flex-col">
                            <CardHeader className="flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle>分类列表</CardTitle>
                                    <CardDescription>
                                        共 {categories.length} 个分类
                                    </CardDescription>
                                </div>
                                <div className="relative w-64">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="搜索分类…"
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
                                                        <FolderClosed className="h-8 w-8 text-muted-foreground/50" />
                                                        <p>
                                                            {search
                                                                ? '未找到匹配的分类'
                                                                : '暂无分类'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filtered.map((category) => (
                                                <TableRow
                                                    key={category.id}
                                                    className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${editing?.id === category.id ? 'bg-muted/50' : ''}`}
                                                >
                                                    <TableCell className="px-4 py-3 font-medium">
                                                        {category.name}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                                        {category.description || '—'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                                        {category.slug || '—'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right tabular-nums">
                                                        {category.count}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => setEditing(category)}
                                                                aria-label="编辑"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleDelete(category)}
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

Categories.layout = {
    breadcrumbs: [
        {
            title: 'articles.categories',
            href: articlesCategories().url,
        },
    ],
};
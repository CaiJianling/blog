import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FolderClosed } from 'lucide-react';

interface Category {
    id: number;
    name: string;
    description: string;
    slug: string;
    count: number;
    views: number;
}

interface Props {
    categories: Category[];
}

export default function Categories({ categories }: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('articles.categories')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('articles.categories')}
                    </h1>
                </div>

                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>
                                    {t('articles.categories')}
                                </CardTitle>
                                <CardDescription>
                                    {t('articles.manageCategories')}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-10 px-4">
                                        {t('articles.table.name')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('articles.table.description')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('articles.table.slug')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('articles.table.count')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('articles.table.views')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <FolderClosed className="h-8 w-8 text-muted-foreground/50" />
                                                <p>
                                                    {t('articles.noCategories')}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categories.map((category) => (
                                        <TableRow
                                            key={category.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {category.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {category.description || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {category.slug || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {category.count}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {category.views}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
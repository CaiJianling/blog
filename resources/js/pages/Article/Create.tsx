import { useState, useEffect, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BlockNoteEditor, type BlockNoteDocument } from '@/components/blocknote-editor';
import {
    FileText,
    Save,
    MessageSquare,
    PanelRightClose,
    PanelRightOpen,
    Send,
    Hash,
    Folder,
    Settings2,
    Link2,
    Eye,
    ChevronRight,
} from 'lucide-react';

interface Category {
    id: number;
    name: string;
}

interface Tag {
    id: number;
    name: string;
}

interface Props {
    categories: Category[];
    tags: Tag[];
}

export default function CreateArticle({ categories, tags }: Props) {
    const { t } = useTranslation();
    const titleRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        excerpt: '',
        content: null as BlockNoteDocument | null,
        status: 'draft',
        comment_status: 'open',
        categories: [] as number[],
        selectedTags: [] as number[],
        newTag: '',
    });
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.focus();
        }
    }, []);

    const handleSubmit = (e: React.FormEvent, overrideStatus?: string) => {
        e.preventDefault();

        const data = {
            title: formData.title,
            slug: formData.slug,
            excerpt: formData.excerpt,
            content: formData.content ?? [],
            status: overrideStatus ?? formData.status,
            comment_status: formData.comment_status,
            categories: formData.categories,
            tags: formData.selectedTags,
        };

        router.post('/articles', data as unknown as Parameters<typeof router.post>[1]);
    };

    const handleCategoryChange = (categoryId: number) => {
        const newCategories = formData.categories.includes(categoryId)
            ? formData.categories.filter(id => id !== categoryId)
            : [...formData.categories, categoryId];
        setFormData({ ...formData, categories: newCategories });
    };

    const handleTagChange = (tagId: number) => {
        const newTags = formData.selectedTags.includes(tagId)
            ? formData.selectedTags.filter(id => id !== tagId)
            : [...formData.selectedTags, tagId];
        setFormData({ ...formData, selectedTags: newTags });
    };

    const SidebarSection = ({
        icon: Icon,
        title,
        description,
        children,
        defaultOpen = true,
    }: {
        icon: React.ElementType;
        title: string;
        description?: string;
        children: React.ReactNode;
        defaultOpen?: boolean;
    }) => {
        const [open, setOpen] = useState(defaultOpen);
        return (
            <Card className="overflow-hidden">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="apple-press flex w-full items-center gap-3 p-4 text-left"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-callout font-medium">{title}</div>
                        {description && (
                            <div className="text-footnote text-tertiary-label">
                                {description}
                            </div>
                        )}
                    </div>
                    <ChevronRight
                        className={`h-5 w-5 text-tertiary-label transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                </button>
                <div
                    className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                    <div className="overflow-hidden">
                        <CardContent className="border-t border-border/40">
                            {children}
                        </CardContent>
                    </div>
                </div>
            </Card>
        );
    };

    return (
        <>
            <Head title={t('articles.create')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header with sticky actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('articles.create')}
                        </h1>
                        <p className="text-subheadline text-secondary-label">
                            创作你的下一篇精彩文章。
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title={t('articles.toggleSidebar')}
                            className="h-10 w-10"
                        >
                            {sidebarOpen
                                ? <PanelRightClose className="h-[18px] w-[18px]" />
                                : <PanelRightOpen className="h-[18px] w-[18px]" />}
                        </Button>
                        <Button variant="secondary" onClick={(e) => handleSubmit(e, 'draft')}>
                            <Save className="h-4 w-4" />
                            {t('articles.saveDraft')}
                        </Button>
                        <Button onClick={(e) => handleSubmit(e, 'publish')}>
                            <Send className="h-4 w-4" />
                            {t('articles.publish')}
                        </Button>
                    </div>
                </div>

                {/* Main layout with collapsible sidebar */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    {/* Editor area */}
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        {/* Title card (floating paper) */}
                        <Card className="overflow-hidden">
                            <CardContent className="!p-0">
                                <div className="border-b-0 px-6 pt-6 pb-2">
                                    <Input
                                        ref={titleRef}
                                        type="text"
                                        placeholder={t('articles.form.titlePlaceholder')}
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="text-title-2 h-auto font-semibold border-none bg-transparent focus-visible:ring-0 px-0 py-2 tracking-tight placeholder:text-tertiary-label"
                                    />
                                </div>
                                <div className="px-6 pb-6 pt-2">
                                    <BlockNoteEditor
                                        initialContent={formData.content}
                                        onChange={(document) => setFormData({ ...formData, content: document })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Excerpt */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-primary" />
                                    {t('articles.form.excerpt')}
                                </CardTitle>
                                <CardDescription>
                                    {t('articles.form.excerptDescription')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    placeholder={t('articles.form.excerptPlaceholder')}
                                    value={formData.excerpt}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, excerpt: e.target.value })}
                                    className="min-h-[100px] resize-y"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Settings sidebar */}
                    <div
                        className={
                            sidebarOpen
                                ? 'flex w-full shrink-0 flex-col gap-3 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:w-80'
                                : 'hidden w-0 shrink-0'
                        }
                    >
                        <SidebarSection
                            icon={Settings2}
                            title={t('articles.form.status')}
                            description="文章发布状态"
                        >
                            <Select
                                value={formData.status}
                                onValueChange={(value) => setFormData({ ...formData, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('articles.form.selectStatus')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">
                                        {t('articles.status.draft')}
                                    </SelectItem>
                                    <SelectItem value="pending">
                                        {t('articles.status.pending')}
                                    </SelectItem>
                                    <SelectItem value="publish">
                                        {t('articles.status.publish')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </SidebarSection>

                        <SidebarSection
                            icon={MessageSquare}
                            title={t('articles.form.comments')}
                            description="读者是否可以评论"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-callout">
                                    {t('articles.form.allowComments')}
                                </span>
                                <Select
                                    value={formData.comment_status}
                                    onValueChange={(value) => setFormData({ ...formData, comment_status: value })}
                                >
                                    <SelectTrigger className="w-28">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="open">
                                            {t('articles.form.open')}
                                        </SelectItem>
                                        <SelectItem value="close">
                                            {t('articles.form.close')}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </SidebarSection>

                        <SidebarSection
                            icon={Folder}
                            title={t('articles.form.categories')}
                            description={`已选 ${formData.categories.length} 个`}
                        >
                            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                                {categories.length === 0 ? (
                                    <p className="text-callout text-tertiary-label">
                                        {t('articles.form.noCategories')}
                                    </p>
                                ) : (
                                    categories.map((category) => (
                                        <label
                                            key={category.id}
                                            className="apple-press flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 hover:bg-accent/60"
                                        >
                                            <Checkbox
                                                checked={formData.categories.includes(category.id)}
                                                onCheckedChange={() => handleCategoryChange(category.id)}
                                            />
                                            <span className="text-callout">{category.name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </SidebarSection>

                        <SidebarSection
                            icon={Hash}
                            title={t('articles.form.tags')}
                            description={`已选 ${formData.selectedTags.length} 个`}
                        >
                            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                                {tags.length === 0 ? (
                                    <p className="text-callout text-tertiary-label">
                                        {t('articles.form.noTags')}
                                    </p>
                                ) : (
                                    tags.map((tag) => (
                                        <label
                                            key={tag.id}
                                            className="apple-press flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 hover:bg-accent/60"
                                        >
                                            <Checkbox
                                                checked={formData.selectedTags.includes(tag.id)}
                                                onCheckedChange={() => handleTagChange(tag.id)}
                                            />
                                            <span className="text-callout">#{tag.name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </SidebarSection>

                        <SidebarSection
                            icon={Link2}
                            title={t('articles.form.slug')}
                            description="URL 友好的文章别名"
                        >
                            <Input
                                type="text"
                                placeholder={t('articles.form.slugPlaceholder')}
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            />
                        </SidebarSection>
                    </div>
                </div>
            </div>
        </>
    );
}

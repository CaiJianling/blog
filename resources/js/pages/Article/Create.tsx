import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import {
    Save,
    MessageSquare,
    PanelRightClose,
    PanelRightOpen,
    Send,
    Hash,
    Folder,
    Settings2,
    Link2,
    FileText,
    ChevronRight,
    Sparkles,
    Search,
    Image as ImageIcon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AiGenerateDialog from '@/components/ai-generate-dialog';
import type { AiArticleResult } from '@/components/ai-generate-dialog';
import { BlockNoteEditor } from '@/components/blocknote-editor';
import type {
    BlockNoteDocument,
    BlockNoteEditorRef,
} from '@/components/blocknote-editor';
import type { CategoryItem } from '@/components/category-picker';
import { CategoryPicker } from '@/components/category-picker';
import FeaturedImagePicker from '@/components/featured-image-picker';
import type { FeaturedSelection } from '@/components/featured-image-picker';
import MediaQuickUpload from '@/components/media-quick-upload';
import type { TagItem } from '@/components/tag-picker';
import { TagPicker } from '@/components/tag-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { create as articlesCreate } from '@/routes/articles';

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

/** 合并两组 id 并去重（保留原有顺序，新 id 追加在后）。 */
function mergeUniqueIds(base: number[], extra: number[] | undefined): number[] {
    if (!extra || extra.length === 0) {
        return base;
    }

    return Array.from(new Set([...base, ...extra]));
}

/** 追加不在列表中的词条（按 id 去重），用于把 AI 新建的分类/标签回填进选择器。 */
function mergeUniqueItems<T extends { id: number; name: string }>(base: T[], extra: T[]): T[] {
    const existing = new Set(base.map((item) => item.id));
    const fresh = extra.filter((item) => !existing.has(item.id));

    return fresh.length ? [...base, ...fresh] : base;
}

function SidebarSection({
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
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Card className="overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="apple-press flex w-full items-center gap-2.5 px-3 py-2 text-left"
            >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-callout font-medium">
                            {title}
                        </span>
                        {description && (
                            <span className="text-tertiary-label truncate text-xs">
                                {description}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight
                    className={`text-tertiary-label h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
            </button>
            <div
                className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'}`}
            >
                <div className="overflow-hidden">
                    <div className="border-t border-border/40 px-3 py-2.5">
                        {children}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default function CreateArticle({ categories, tags }: Props) {
    const { t } = useTranslation();
    const titleRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<BlockNoteEditorRef | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        excerpt: '',
        meta_title: '',
        meta_description: '',
        content: null as BlockNoteDocument | null,
        status: 'draft',
        comment_status: 'open',
        categories: [] as number[],
        selectedTags: [] as number[],
        newTag: '',
    });
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [featuredImage, setFeaturedImage] =
        useState<FeaturedSelection>(null);

    // 本地持有分类/标签列表：AI 生成会新建词条，需要追加进来以便选择器展示
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    const [localTags, setLocalTags] = useState<Tag[]>(tags);

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
            meta_title: formData.meta_title,
            meta_description: formData.meta_description,
            content: formData.content ?? [],
            featured_image: featuredImage?.id ?? null,
            status: overrideStatus ?? formData.status,
            comment_status: formData.comment_status,
            categories: formData.categories,
            tags: formData.selectedTags,
        };

        router.post(
            '/articles',
            data as unknown as Parameters<typeof router.post>[1],
        );
    };

    // AI 生成结果填入编辑器，作者检查确认后再手动保存录入
    const applyAiResult = async (result: AiArticleResult) => {
        const editor = editorRef.current;

        const hasContent =
            formData.title.trim() !== '' ||
            (Array.isArray(formData.content) && formData.content.length > 1);

        if (hasContent && !window.confirm(t('articles.ai.confirmOverwrite'))) {
            return;
        }

        setFormData((prev) => ({
            ...prev,
            title: result.title,
            excerpt: result.excerpt || prev.excerpt,
            meta_title: result.meta_title || prev.meta_title,
            meta_description: result.meta_description || prev.meta_description,
            categories: mergeUniqueIds(prev.categories, result.category_ids),
            selectedTags: mergeUniqueIds(prev.selectedTags, result.tag_ids),
        }));

        // 把 AI 新建的分类/标签追加进本地列表，选择器才能展示它们
        if (result.created_categories?.length) {
            setLocalCategories((prev) => mergeUniqueItems(prev, result.created_categories ?? []));
        }

        if (result.created_tags?.length) {
            setLocalTags((prev) => mergeUniqueItems(prev, result.created_tags ?? []));
        }

        if (!editor || typeof editor.tryParseMarkdownToBlocks !== 'function') {
            toast.error(t('articles.ai.parseFailed'));

            return;
        }

        const blocks = await editor.tryParseMarkdownToBlocks(result.markdown);

        if (!blocks || blocks.length === 0) {
            toast.error(t('articles.ai.parseFailed'));

            return;
        }

        editor.replaceBlocks(editor.document, blocks);
        setFormData((prev) => ({
            ...prev,
            content: editor.document as BlockNoteDocument,
        }));
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
                            {sidebarOpen ? (
                                <PanelRightClose className="h-[18px] w-[18px]" />
                            ) : (
                                <PanelRightOpen className="h-[18px] w-[18px]" />
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setAiDialogOpen(true)}
                        >
                            <Sparkles className="h-4 w-4" />
                            {t('articles.ai.button')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={(e) => handleSubmit(e, 'draft')}
                        >
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
                        <Card className="gap-0 overflow-hidden py-0">
                            <CardContent className="!p-0">
                                <div className="border-b-0 px-8 pt-8 pb-3">
                                    <input
                                        ref={titleRef}
                                        type="text"
                                        placeholder={t(
                                            'articles.form.titlePlaceholder',
                                        )}
                                        value={formData.title}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                title: e.target.value,
                                            })
                                        }
                                        className="placeholder:text-tertiary-label/50 w-full border-none bg-transparent px-0 py-0 text-3xl leading-[1.15] font-semibold tracking-[-0.02em] outline-none selection:bg-primary/20"
                                    />
                                </div>
                                <div className="px-8 pt-3 pb-8">
                                    <BlockNoteEditor
                                        initialContent={formData.content}
                                        onChange={(document) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                content: document,
                                            }))
                                        }
                                        onReady={(editor) => {
                                            editorRef.current = editor;
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick media upload — only "All Media" before draft is saved */}
                        <MediaQuickUpload parentType="article" />
                    </div>

                    {/* Settings sidebar */}
                    <div
                        className={
                            sidebarOpen
                                ? 'flex w-full shrink-0 flex-col gap-3 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:w-72'
                                : 'hidden w-0 shrink-0'
                        }
                    >
                        <SidebarSection
                            icon={ImageIcon}
                            title={t('articles.featuredImage.title')}
                            description={t('articles.featuredImage.hint')}
                        >
                            <FeaturedImagePicker
                                selected={featuredImage}
                                onSelect={setFeaturedImage}
                                parentType="article"
                            />
                        </SidebarSection>

                        <SidebarSection
                            icon={Settings2}
                            title={t('articles.form.status')}
                            description="文章发布状态"
                        >
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, status: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={t(
                                            'articles.form.selectStatus',
                                        )}
                                    />
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
                            icon={FileText}
                            title={t('articles.form.excerpt')}
                            description={t('articles.form.excerptDescription')}
                        >
                            <Textarea
                                placeholder={t(
                                    'articles.form.excerptPlaceholder',
                                )}
                                value={formData.excerpt}
                                onChange={(
                                    e: React.ChangeEvent<HTMLTextAreaElement>,
                                ) =>
                                    setFormData({
                                        ...formData,
                                        excerpt: e.target.value,
                                    })
                                }
                                className="min-h-[80px] resize-y"
                            />
                        </SidebarSection>

                        <SidebarSection
                            icon={Search}
                            title={t('articles.form.seo')}
                            description={t('articles.form.seoDescription')}
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-tertiary-label text-xs">
                                        {t('articles.form.seoTitleDescription')}
                                    </span>
                                    <Input
                                        type="text"
                                        placeholder={t(
                                            'articles.form.seoTitlePlaceholder',
                                        )}
                                        value={formData.meta_title}
                                        onChange={(
                                            e: React.ChangeEvent<HTMLInputElement>,
                                        ) =>
                                            setFormData({
                                                ...formData,
                                                meta_title: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-tertiary-label text-xs">
                                        {t(
                                            'articles.form.seoDescriptionDescription',
                                        )}
                                    </span>
                                    <Textarea
                                        placeholder={t(
                                            'articles.form.seoDescriptionPlaceholder',
                                        )}
                                        value={formData.meta_description}
                                        onChange={(
                                            e: React.ChangeEvent<HTMLTextAreaElement>,
                                        ) =>
                                            setFormData({
                                                ...formData,
                                                meta_description:
                                                    e.target.value,
                                            })
                                        }
                                        className="min-h-[72px] resize-y"
                                    />
                                </div>
                            </div>
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
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            comment_status: value,
                                        })
                                    }
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
                            <CategoryPicker
                                items={localCategories as CategoryItem[]}
                                selected={formData.categories}
                                onChange={(next) =>
                                    setFormData({
                                        ...formData,
                                        categories: next,
                                    })
                                }
                            />
                        </SidebarSection>

                        <SidebarSection
                            icon={Hash}
                            title={t('articles.form.tags')}
                            description={`已选 ${formData.selectedTags.length} 个`}
                        >
                            <TagPicker
                                items={localTags as TagItem[]}
                                selected={formData.selectedTags}
                                onChange={(next) =>
                                    setFormData({
                                        ...formData,
                                        selectedTags: next,
                                    })
                                }
                            />
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
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        slug: e.target.value,
                                    })
                                }
                            />
                        </SidebarSection>
                    </div>
                </div>
            </div>

            <AiGenerateDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                onApply={applyAiResult}
            />
        </>
    );
}

CreateArticle.layout = {
    breadcrumbs: [
        {
            title: 'articles.create',
            href: articlesCreate().url,
        },
    ],
};

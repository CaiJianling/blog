import { Head, router } from '@inertiajs/react';
import {
    Save,
    MessageSquare,
    PanelRightClose,
    PanelRightOpen,
    Settings2,
    Link2,
    ChevronRight,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlockNoteEditor  } from '@/components/blocknote-editor';
import type {BlockNoteDocument} from '@/components/blocknote-editor';
import MediaQuickUpload from '@/components/media-quick-upload';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { index as pagesIndex } from '@/routes/pages';

interface PageData {
    id: number;
    title: string;
    slug: string;
    content: BlockNoteDocument | null;
    status: string;
    comment_status: string;
}

interface Props {
    page: PageData;
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
                        <span className="text-callout font-medium">{title}</span>
                        {description && (
                            <span className="truncate text-xs text-tertiary-label">
                                {description}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-tertiary-label transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
            </button>
            <div
                className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
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

export default function EditPage({ page }: Props) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        title: page.title,
        slug: page.slug,
        content: page.content,
        status: page.status,
        comment_status: page.comment_status,
    });
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleSubmit = (e: React.FormEvent, overrideStatus?: string) => {
        e.preventDefault();

        const data = {
            title: formData.title,
            slug: formData.slug,
            content: formData.content ?? [],
            status: overrideStatus ?? formData.status,
            comment_status: formData.comment_status,
        };

        router.put(`/pages/${page.id}`, data as unknown as Parameters<typeof router.put>[1]);
    };

    const handleTrash = (id: number) => {
        router.put(`/pages/${id}/trash`, {}, { preserveScroll: true });
    };

    return (
        <>
            <Head title={t('pages.editPage')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header with sticky actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('pages.editPage')}
                        </h1>
                        <p className="text-subheadline text-muted-foreground">
                            正在编辑：{formData.title || '未命名页面'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title={t('pages.toggleSidebar')}
                            className="h-10 w-10"
                        >
                            {sidebarOpen
                                ? <PanelRightClose className="h-[18px] w-[18px]" />
                                : <PanelRightOpen className="h-[18px] w-[18px]" />}
                        </Button>
                        <Button variant="secondary" onClick={(e) => handleSubmit(e, 'draft')}>
                            <Save className="h-4 w-4" />
                            {t('pages.saveDraft')}
                        </Button>
                        <Button onClick={(e) => handleSubmit(e, 'publish')}>
                            <RefreshCw className="h-4 w-4" />
                            {t('pages.update')}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleTrash(page.id)} title={t('pages.moveToTrash')} className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-[18px] w-[18px]" />
                        </Button>
                    </div>
                </div>

                {/* Main layout with collapsible sidebar */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    {/* Editor area */}
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        {/* Title card (floating paper) */}
                        <Card className="overflow-hidden py-0 gap-0">
                            <CardContent className="!p-0">
                                <div className="border-b-0 px-8 pt-8 pb-3">
                                    <input
                                        type="text"
                                        placeholder={t('pages.form.titlePlaceholder')}
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full border-none bg-transparent px-0 py-0 text-3xl font-semibold leading-[1.15] tracking-[-0.02em] outline-none placeholder:text-tertiary-label/50 selection:bg-primary/20"
                                    />
                                </div>
                                <div className="px-8 pb-8 pt-3">
                                    <BlockNoteEditor
                                        initialContent={formData.content}
                                        onChange={(document) => setFormData({ ...formData, content: document })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Media library for this page */}
                        <MediaQuickUpload parentType="page" parentId={page.id} />
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
                            icon={Settings2}
                            title={t('pages.form.status')}
                            description="页面发布状态"
                        >
                            <Select
                                value={formData.status}
                                onValueChange={(value) => setFormData({ ...formData, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('pages.form.selectStatus')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">
                                        {t('pages.status.draft')}
                                    </SelectItem>
                                    <SelectItem value="publish">
                                        {t('pages.status.publish')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </SidebarSection>

                        <SidebarSection
                            icon={MessageSquare}
                            title={t('pages.form.comments')}
                            description="读者是否可以评论"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-callout">
                                    {t('pages.form.allowComments')}
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
                                            {t('pages.form.open')}
                                        </SelectItem>
                                        <SelectItem value="close">
                                            {t('pages.form.close')}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </SidebarSection>

                        <SidebarSection
                            icon={Link2}
                            title={t('pages.form.slug')}
                            description="URL 友好的页面别名"
                        >
                            <Input
                                type="text"
                                placeholder={t('pages.form.slugPlaceholder')}
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

EditPage.layout = {
    breadcrumbs: [
        {
            title: 'pages.editPage',
            href: pagesIndex().url,
        },
    ],
};

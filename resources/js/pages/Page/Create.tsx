import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import {
    Save,
    MessageSquare,
    PanelRightClose,
    PanelRightOpen,
    Send,
    Settings2,
    Link2,
    ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BlockNoteEditor  } from '@/components/blocknote-editor';
import type {BlockNoteDocument} from '@/components/blocknote-editor';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { create as pagesCreate } from '@/routes/pages';

export default function CreatePage() {
    const { t } = useTranslation();
    const titleRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        content: null as BlockNoteDocument | null,
        status: 'draft',
        comment_status: 'close',
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
            content: formData.content ?? [],
            status: overrideStatus ?? formData.status,
            comment_status: formData.comment_status,
        };

        router.post('/pages', data as unknown as Parameters<typeof router.post>[1]);
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
                            <div className="text-footnote text-muted-foreground">
                                {description}
                            </div>
                        )}
                    </div>
                    <ChevronRight
                        className={`h-5 w-5 text-muted-foreground/50 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
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
            <Head title={t('pages.create')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header with sticky actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('pages.create')}
                        </h1>
                        <p className="text-subheadline text-muted-foreground">
                            创建新的独立页面。
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
                            <Send className="h-4 w-4" />
                            {t('pages.publish')}
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
                                        placeholder={t('pages.form.titlePlaceholder')}
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="text-title-2 h-auto font-semibold border-none bg-transparent focus-visible:ring-0 px-0 py-2 tracking-tight placeholder:text-muted-foreground/50"
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

CreatePage.layout = {
    breadcrumbs: [
        {
            title: 'pages.create',
            href: pagesCreate().url,
        },
    ],
};

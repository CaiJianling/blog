import { Head, router } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, MousePointerClick } from 'lucide-react';
import { formatCount } from '@/lib/utils';
import { BlockNoteEditor } from '@/components/blocknote-editor';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import { Button } from '@/components/ui/button';

type NavLinkIntro = {
    id: number;
    name: string;
    url: string;
    description: string | null;
    color: string;
    intro_content: BlockNoteDocument | null;
    clicks: number;
};

type Props = {
    link: NavLinkIntro;
};

export default function Intro({ link }: Props) {
    const hasIntro = Array.isArray(link.intro_content) && link.intro_content.length > 0;

    return (
        <>
            <Head title={`${link.name} - 图文介绍`} />

            <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
                <button
                    type="button"
                    onClick={() => router.visit('/nav')}
                    className="apple-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回导航
                </button>

                <div className="apple-card mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center md:p-8">
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
                        style={{ backgroundColor: link.color || '#6b7280' }}
                    >
                        {link.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-title">{link.name}</h1>
                        {link.description && (
                            <p className="mt-1 text-body text-muted-foreground">{link.description}</p>
                        )}
                        <p className="mt-1 truncate text-footnote text-muted-foreground">{link.url}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                            <MousePointerClick className="h-3 w-3" />
                            {formatCount(link.clicks ?? 0)} 次点击
                        </p>
                    </div>
                    <Button
                        onClick={() => window.open(`/nav/links/${link.id}/go`, '_blank', 'noopener,noreferrer')}
                        className="shrink-0"
                    >
                        <ExternalLink className="h-4 w-4" />
                        访问网站
                    </Button>
                </div>

                <h2 className="text-title mt-10 mb-4">图文介绍</h2>

                {hasIntro ? (
                    <BlockNoteEditor initialContent={link.intro_content} editable={false} />
                ) : (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        该网站暂无图文介绍。
                    </div>
                )}
            </div>
        </>
    );
}

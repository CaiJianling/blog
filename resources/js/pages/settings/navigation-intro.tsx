import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Eraser, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminSettingsShell from '@/components/admin-settings-shell';
import { BlockNoteEditor } from '@/components/blocknote-editor';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import { Button } from '@/components/ui/button';

interface Props {
    link: {
        id: number;
        name: string;
        url: string;
        has_intro: boolean;
        intro_content: BlockNoteDocument | null;
    };
}

export default function NavigationIntro({ link }: Props) {
    const { t } = useTranslation();
    const [content, setContent] = useState<BlockNoteDocument | null>(
        link.intro_content,
    );
    const [saving, setSaving] = useState(false);
    const contentRef = useRef<BlockNoteDocument | null>(link.intro_content);

    contentRef.current = content;

    const save = () => {
        setSaving(true);

        router.put(
            `/settings/navigation/links/${link.id}/intro`,
            { intro_content: contentRef.current ?? [] },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            },
        );
    };

    const clearIntro = () => {
        if (
            !window.confirm(
                t('settings.navigation.clearIntroConfirm', { name: link.name }),
            )
        ) {
            return;
        }

        setContent([]);
        contentRef.current = [];

        router.put(
            `/settings/navigation/links/${link.id}/intro`,
            { intro_content: [] },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head
                title={t('settings.navigation.introTitle', { name: link.name })}
            />

            <AdminSettingsShell
                title={t('settings.navigation.introHeading')}
                description={t('settings.navigation.introDescription', {
                    name: link.name,
                })}
                wide
            >
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.visit('/settings/navigation')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t('settings.navigation.backToNav')}
                        </Button>
                        <span className="min-w-0 truncate rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            {link.name} · {link.url}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            {link.has_intro && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearIntro}
                                >
                                    <Eraser className="h-4 w-4" />
                                    {t('settings.navigation.clearIntro')}
                                </Button>
                            )}
                            <Button size="sm" onClick={save} disabled={saving}>
                                <Save className="h-4 w-4" />
                                {saving ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {t('settings.navigation.introHint')}
                    </p>

                    <BlockNoteEditor
                        initialContent={link.intro_content}
                        onChange={(document) => setContent(document)}
                        placeholder={t('settings.navigation.introPlaceholder')}
                    />
                </div>
            </AdminSettingsShell>
        </>
    );
}

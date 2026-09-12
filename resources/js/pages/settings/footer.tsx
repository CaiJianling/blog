import { Head, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Link2, Mail, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FooterLink = {
    name: string;
    url: string;
};

interface Props {
    resources: FooterLink[];
    contacts: FooterLink[];
}

export default function FooterSettings({ resources, contacts }: Props) {
    const { t } = useTranslation();
    const [resourceList, setResourceList] = useState(resources);
    const [contactList, setContactList] = useState(contacts);
    const [saving, setSaving] = useState(false);

    const updateItem = (
        setter: React.Dispatch<React.SetStateAction<FooterLink[]>>,
        index: number,
        field: 'name' | 'url',
        value: string,
    ) => {
        setter((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const moveItem = (
        setter: React.Dispatch<React.SetStateAction<FooterLink[]>>,
        index: number,
        direction: -1 | 1,
    ) => {
        setter((prev) => {
            const target = index + direction;

            if (target < 0 || target >= prev.length) {
                return prev;
            }

            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        router.put(
            '/settings/footer',
            {
                resources: resourceList.map((item) => ({ name: item.name.trim(), url: item.url.trim() })),
                contacts: contactList.map((item) => ({ name: item.name.trim(), url: item.url.trim() })),
            },
            { onFinish: () => setSaving(false) },
        );
    };

    const linkEditor = (
        key: 'resources' | 'contacts',
        title: string,
        icon: React.ReactNode,
        list: FooterLink[],
        setter: React.Dispatch<React.SetStateAction<FooterLink[]>>,
        nameLabel: string,
        urlPlaceholder: string,
    ) => (
        <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="!p-0">
                <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                            {icon}
                        </div>
                        <span className="text-callout font-medium">{title}</span>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setter((prev) => [...prev, { name: '', url: '' }])}
                        disabled={list.length >= 20}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('settings.footer.add')}
                    </Button>
                </div>

                <div className="space-y-3 px-6 py-5">
                    {list.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">{t('settings.footer.empty')}</p>
                    )}

                    {list.map((item, index) => (
                        <div key={index} className="flex items-end gap-2">
                            <div className="w-32 space-y-1">
                                <Label className="text-[11px] text-muted-foreground">{nameLabel}</Label>
                                <Input
                                    value={item.name}
                                    onChange={(e) => updateItem(setter, index, 'name', e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label className="text-[11px] text-muted-foreground">{t('settings.footer.url')}</Label>
                                <Input
                                    value={item.url}
                                    onChange={(e) => updateItem(setter, index, 'url', e.target.value)}
                                    placeholder="https:// 或 mailto:"
                                    className="h-9"
                                />
                            </div>
                            <div className="flex items-center gap-0.5 pb-0.5">
                                <button
                                    type="button"
                                    onClick={() => moveItem(setter, index, -1)}
                                    disabled={index === 0}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                    aria-label={t('settings.footer.moveUp')}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                        <path d="m18 15-6-6-6 6" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveItem(setter, index, 1)}
                                    disabled={index === list.length - 1}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                    aria-label={t('settings.footer.moveDown')}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setter((prev) => prev.filter((_, i) => i !== index))}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={t('settings.footer.delete')}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <>
            <Head title={t('settings.footer.title')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.footer.heading')}
                        description={t('settings.footer.description')}
                    />

                    <form onSubmit={submit} className="space-y-6">
                        {linkEditor(
                            'resources',
                            t('settings.footer.resources'),
                            <Link2 className="h-4 w-4" />,
                            resourceList,
                            setResourceList,
                            t('settings.footer.name'),
                            'https://',
                        )}

                        {linkEditor(
                            'contacts',
                            t('settings.footer.contacts'),
                            <Mail className="h-4 w-4" />,
                            contactList,
                            setContactList,
                            t('settings.footer.name'),
                            'https:// 或 mailto:',
                        )}

                        <div className="flex justify-end">
                            <Button type="submit" disabled={saving}>
                                {saving ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

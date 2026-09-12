import { Form, Head, usePage } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
    avatar_url?: string | null;
};

function getCsrfToken(): { headerName: string; value: string } | null {
    const meta = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute('content');

    if (meta) {
        return { headerName: 'X-CSRF-TOKEN', value: meta };
    }

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    if (match?.[1]) {
        return {
            headerName: 'X-XSRF-TOKEN',
            value: decodeURIComponent(match[1]),
        };
    }

    return null;
}

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { t } = useTranslation();
    const { auth } = usePage<PageProps>().props;

    const initialAvatar = usePage<PageProps>().props.avatar_url ?? null;
    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const uploadAvatar = (file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.profile.avatarUploadFailed'));

            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/settings/profile/avatar', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
            body: formData,
        })
            .then(async (response) => {
                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    toast.error(data?.message ?? t('settings.profile.avatarUploadFailed'));

                    return;
                }

                setAvatarUrl(data.url);
                toast.success(t('settings.profile.avatarUploadSuccess'));
            })
            .catch(() => toast.error(t('settings.profile.avatarUploadFailed')))
            .finally(() => setUploading(false));
    };

    const removeAvatar = () => {
        fetch('/settings/profile/avatar', {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(() => {
                    const csrf = getCsrfToken();

                    return csrf ? { [csrf.headerName]: csrf.value } : {};
                })(),
            },
        })
            .then(async (response) => {
                if (!response.ok) {
                    toast.error(t('settings.profile.avatarUploadFailed'));

                    return;
                }

                setAvatarUrl(null);
                toast.success(t('settings.profile.avatarRestored'));
            })
            .catch(() => toast.error(t('settings.profile.avatarUploadFailed')));
    };

    return (
        <>
            <Head title={t('settings.profile.title')} />

            <h1 className="sr-only">{t('settings.profile.title')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('settings.profile.heading')}
                    description={t('settings.profile.description')}
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="space-y-1.5">
                                <Label>{t('settings.profile.avatar')}</Label>
                                <div className="flex items-center gap-3">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={auth.user.name} className="h-14 w-14 rounded-full object-cover" />
                                    ) : (
                                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                                            {(auth.user.name || 'A').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];

                                            if (file) {
                                                uploadAvatar(file);
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                        {uploading ? t('common.saving') : t('settings.profile.changeAvatar')}
                                    </Button>
                                    {avatarUrl && (
                                        <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
                                            {t('settings.profile.restoreAvatar')}
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{t('settings.profile.avatarHint')}</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('settings.profile.name')}</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder={t('settings.profile.namePlaceholder')}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="nickname">{t('settings.profile.nickname')}</Label>

                                <Input
                                    id="nickname"
                                    className="mt-1 block w-full"
                                    defaultValue={(auth.user.nickname as string) ?? ''}
                                    name="nickname"
                                    autoComplete="nickname"
                                    placeholder={t('settings.profile.nicknamePlaceholder')}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.nickname}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">{t('settings.profile.email')}</Label>

                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder={t('settings.profile.emailPlaceholder')}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <div>
                                        <p className="-mt-4 text-sm text-muted-foreground">
                                            {t('settings.profile.emailUnverified')}{' '}
                                            <Link
                                                href={send()}
                                                as="button"
                                                className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                            >
                                                {t('settings.profile.resendVerification')}
                                            </Link>
                                        </p>

                                        {status ===
                                            'verification-link-sent' && (
                                            <div className="mt-2 text-sm font-medium text-green-600">
                                                {t('settings.profile.verificationSent')}
                                            </div>
                                        )}
                                    </div>
                                )}

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    {t('settings.profile.save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <DeleteUser />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'settings.profile.title',
            href: edit(),
        },
    ],
};

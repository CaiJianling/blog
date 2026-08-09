import { Form, Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

type Props = {
    passwordRules: string;
};

type Locale = 'zh' | 'en';

export default function Register({ passwordRules }: Props) {
    const { t } = useTranslation();
    const locale = useLocale();

    const handleLocaleChange = (newLocale: Locale) => {
        updateLocale(newLocale);
    };

    return (
        <>
            <Head title={t('auth.register.title')} />
            
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t('auth.register.language')}</span>
                </div>
                <div
                    className={cn(
                        'inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 w-fit',
                    )}
                >
                    <button
                        onClick={() => handleLocaleChange('zh')}
                        className={cn(
                            'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
                            locale === 'zh'
                                ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                                : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                        )}
                    >
                        <span className="text-sm">{t('settings.appearance.chinese')}</span>
                    </button>
                    <button
                        onClick={() => handleLocaleChange('en')}
                        className={cn(
                            'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
                            locale === 'en'
                                ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                                : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                        )}
                    >
                        <span className="text-sm">{t('settings.appearance.english')}</span>
                    </button>
                </div>

                <Form
                    {...store.form()}
                    resetOnSuccess={['password', 'password_confirmation']}
                    disableWhileProcessing
                    className="flex flex-col gap-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">{t('auth.register.name')}</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="name"
                                        name="name"
                                        placeholder={t('auth.register.namePlaceholder')}
                                    />
                                    <InputError
                                        message={errors.name}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('auth.register.email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        required
                                        tabIndex={2}
                                        autoComplete="email"
                                        name="email"
                                        placeholder={t('auth.register.emailPlaceholder')}
                                    />
                                    <InputError message={errors.email} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password">{t('auth.register.password')}</Label>
                                    <PasswordInput
                                        id="password"
                                        required
                                        tabIndex={3}
                                        autoComplete="new-password"
                                        name="password"
                                        placeholder={t('auth.register.passwordPlaceholder')}
                                        passwordrules={passwordRules}
                                    />
                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">
                                        {t('auth.register.confirmPassword')}
                                    </Label>
                                    <PasswordInput
                                        id="password_confirmation"
                                        required
                                        tabIndex={4}
                                        autoComplete="new-password"
                                        name="password_confirmation"
                                        placeholder={t('auth.register.confirmPasswordPlaceholder')}
                                        passwordrules={passwordRules}
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>

                                <input
                                    type="hidden"
                                    name="locale"
                                    value={locale}
                                />

                                <Button
                                    type="submit"
                                    className="mt-2 w-full"
                                    tabIndex={5}
                                    data-test="register-user-button"
                                >
                                    {processing && <Spinner />}
                                    {t('auth.register.createAccount')}
                                </Button>
                            </div>

                            <div className="text-center text-sm text-muted-foreground">
                                {t('auth.register.hasAccount')}{' '}
                                <TextLink href={login()} tabIndex={6}>
                                    {t('auth.register.login')}
                                </TextLink>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

Register.layout = {
    title: 'auth.register.title',
    description: 'auth.register.description',
};
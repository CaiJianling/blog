import { Form, Head } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { login } from '@/routes';
import { store } from '@/routes/register';

type CaptchaProp = {
    /** math 简单计算（文本算术）| image 图形字符 | image_math 简单计算图形 */
    type: 'math' | 'image' | 'image_math';
    question?: string;
    token?: string;
    src?: string;
};

type Props = {
    passwordRules: string;
    captchaEnabled?: boolean;
    captcha?: CaptchaProp | null;
};

type Locale = 'zh' | 'en';

export default function Register({ passwordRules, captchaEnabled, captcha }: Props) {
    const { t } = useTranslation();
    const locale = useLocale();

    // 图形验证码（image / image_math）：提交失败后需重新拉图取新的会话答案。
    // 用自增计数做图片缓存戳（避免 Date.now() 在渲染期被判定为不纯），首屏 ?t=0 即为一次全新获取。
    const [captchaStamp, setCaptchaStamp] = useState(0);
    const refreshCaptcha = useCallback(
        () => setCaptchaStamp((stamp) => stamp + 1),
        [],
    );
    const showImageCaptcha =
        captchaEnabled === true && captcha != null && captcha.type !== 'math';
    const showMathCaptcha = captchaEnabled === true && captcha?.type === 'math';

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
                    onError={() => {
                        if (showImageCaptcha) {
                            refreshCaptcha();
                        }
                    }}
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

                                {showImageCaptcha && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="captcha">
                                            {captcha.type === 'image_math'
                                                ? t('auth.register.mathCaptcha')
                                                : t('auth.register.captcha')}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="captcha"
                                                name="captcha"
                                                required
                                                autoComplete="off"
                                                spellCheck={false}
                                                maxLength={6}
                                                inputMode={
                                                    captcha.type === 'image_math'
                                                        ? 'numeric'
                                                        : undefined
                                                }
                                                className="flex-1 font-mono tracking-[0.3em] uppercase"
                                                placeholder={
                                                    captcha.type === 'image_math'
                                                        ? t('auth.register.mathCaptchaPlaceholder')
                                                        : t('auth.register.captchaPlaceholder')
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={refreshCaptcha}
                                                title={t('auth.register.captchaRefresh')}
                                                aria-label={t('auth.register.captchaRefresh')}
                                                className="shrink-0 overflow-hidden rounded-lg border border-border/70 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <img
                                                    src={`${captcha.src}?t=${captchaStamp}`}
                                                    alt={t('auth.register.captcha')}
                                                    className="block h-12 w-auto max-w-full bg-background object-contain"
                                                />
                                            </button>
                                        </div>
                                        <InputError message={errors.captcha} />
                                        <p className="text-xs text-muted-foreground">
                                            {captcha.type === 'image_math'
                                                ? t('auth.register.mathCaptchaHint')
                                                : t('auth.register.captchaHint')}
                                        </p>
                                    </div>
                                )}

                                {showMathCaptcha && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="captcha_answer">
                                            {t('auth.register.mathCaptcha')}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-10 shrink-0 select-none items-center rounded-lg border border-border/70 bg-muted/50 px-3 font-mono text-base font-medium tracking-wider">
                                                {captcha.question} = ?
                                            </span>
                                            <Input
                                                id="captcha_answer"
                                                name="captcha_answer"
                                                required
                                                inputMode="numeric"
                                                autoComplete="off"
                                                className="flex-1"
                                                placeholder={t('auth.register.mathCaptchaPlaceholder')}
                                            />
                                        </div>
                                        <input
                                            type="hidden"
                                            name="captcha_token"
                                            value={captcha.token}
                                        />
                                        <InputError message={errors.captcha} />
                                        <p className="text-xs text-muted-foreground">
                                            {t('auth.register.mathCaptchaHint')}
                                        </p>
                                    </div>
                                )}

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
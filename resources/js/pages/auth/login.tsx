import { Form, Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type CaptchaProp = {
    /** math 简单计算（文本算术）| image 图形字符 | image_math 简单计算图形 */
    type: 'math' | 'image' | 'image_math';
    question?: string;
    token?: string;
    src?: string;
};

type Props = {
    status?: string;
    canResetPassword: boolean;
    captchaEnabled?: boolean;
    captcha?: CaptchaProp | null;
};

export default function Login({ status, canResetPassword, captchaEnabled, captcha }: Props) {
    const { t } = useTranslation();
    const { canRegister, errors: pageErrors } = usePage().props as {
        canRegister?: boolean;
        errors?: Record<string, string>;
    };

    // 图形验证码（image / image_math）：登录 POST 会消费会话中的验证码（无论对错），
    // 因此首次挂载与每次登录失败后都必须换一张新的。
    // math（简单计算）为无状态题目：校验失败回跳时服务端会生成新题，无需前端刷新。
    const [captchaStamp, setCaptchaStamp] = useState(Date.now());
    const refreshCaptcha = useCallback(() => {
        setCaptchaStamp(Date.now());
    }, []);

    const showImageCaptcha = captchaEnabled === true && captcha != null && captcha.type !== 'math';
    const showMathCaptcha = captchaEnabled === true && captcha?.type === 'math';

    useEffect(() => {
        if (showImageCaptcha) {
            refreshCaptcha();
        }
    }, [showImageCaptcha, refreshCaptcha]);

    useEffect(() => {
        if (showImageCaptcha && pageErrors && Object.keys(pageErrors).length > 0) {
            refreshCaptcha();
        }
    }, [showImageCaptcha, pageErrors, refreshCaptcha]);

    return (
        <>
            <Head title={t('auth.login.title')} />

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">{t('auth.login.email')}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder={t('auth.login.emailPlaceholder')}
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">{t('auth.login.password')}</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            {t('auth.login.forgotPassword')}
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder={t('auth.login.passwordPlaceholder')}
                                />
                                <InputError message={errors.password} />
                            </div>

                            {showImageCaptcha && (
                                <div className="grid gap-2">
                                    <Label htmlFor="captcha">
                                        {captcha.type === 'image_math'
                                            ? t('auth.login.mathCaptcha')
                                            : t('auth.login.captcha')}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="captcha"
                                            name="captcha"
                                            required
                                            tabIndex={3}
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
                                                    ? t('auth.login.mathCaptchaPlaceholder')
                                                    : t('auth.login.captchaPlaceholder')
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={refreshCaptcha}
                                            title={t('auth.login.captchaRefresh')}
                                            aria-label={t('auth.login.captchaRefresh')}
                                            className="shrink-0 overflow-hidden rounded-lg border border-border/70 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <img
                                                src={`${captcha.src}?t=${captchaStamp}`}
                                                alt={t('auth.login.captcha')}
                                                className="block h-12 w-auto max-w-full bg-background object-contain"
                                            />
                                        </button>
                                    </div>
                                    <InputError message={errors.captcha} />
                                    <p className="text-xs text-muted-foreground">
                                        {captcha.type === 'image_math'
                                            ? t('auth.login.mathCaptchaHint')
                                            : t('auth.login.captchaHint')}
                                    </p>
                                </div>
                            )}

                            {showMathCaptcha && (
                                <div className="grid gap-2">
                                    <Label htmlFor="captcha_answer">
                                        {t('auth.login.mathCaptcha')}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-10 shrink-0 select-none items-center rounded-lg border border-border/70 bg-muted/50 px-3 font-mono text-base font-medium tracking-wider">
                                            {captcha.question} = ?
                                        </span>
                                        <Input
                                            id="captcha_answer"
                                            name="captcha_answer"
                                            required
                                            tabIndex={3}
                                            inputMode="numeric"
                                            autoComplete="off"
                                            className="flex-1"
                                            placeholder={t('auth.login.mathCaptchaPlaceholder')}
                                        />
                                    </div>
                                    <input
                                        type="hidden"
                                        name="captcha_token"
                                        value={captcha.token}
                                    />
                                    <InputError message={errors.captcha} />
                                    <p className="text-xs text-muted-foreground">
                                        {t('auth.login.mathCaptchaHint')}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={4}
                                />
                                <Label htmlFor="remember">{t('auth.login.remember')}</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={5}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                {t('auth.login.login')}
                            </Button>
                        </div>

                        {canRegister && (
                            <div className="text-center text-sm text-muted-foreground">
                                {t('auth.login.noAccount')}{' '}
                                <TextLink href={register()} tabIndex={6}>
                                    {t('auth.login.signUp')}
                                </TextLink>
                            </div>
                        )}
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'auth.login.title',
    description: 'auth.login.description',
};

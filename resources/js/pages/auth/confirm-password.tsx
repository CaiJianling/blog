import { Form, Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword() {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('auth.confirmPassword.title')} />

            <PasskeyVerify
                routes={{
                    options: confirmOptions(),
                    submit: confirmStore(),
                }}
                label={t('auth.confirmPassword.confirmWithPasskey')}
                loadingLabel={t('auth.confirmPassword.confirming')}
                separator={t('auth.confirmPassword.orConfirmWithPassword')}
            />

            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">{t('auth.confirmPassword.password')}</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder={t('auth.confirmPassword.password')}
                                autoComplete="current-password"
                                autoFocus
                            />

                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center">
                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="confirm-password-button"
                            >
                                {processing && <Spinner />}
                                {t('auth.confirmPassword.confirmPassword')}
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </>
    );
}

ConfirmPassword.layout = {
    title: 'auth.confirmPassword.title',
    description: 'auth.confirmPassword.description',
};

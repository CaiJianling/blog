import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const ERROR_TRANSLATION_MAP: Record<string, string> = {
    'The provided password was incorrect.': 'errors.passwordIncorrect',
    'The email field is required.': 'errors.emailRequired',
    'These credentials do not match our records.': 'errors.credentialsMismatch',
    "We can't find a user with that email address.": 'errors.emailNotFound',
};

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    const { t } = useTranslation();

    if (!message) {
        return null;
    }

    const translationKey = ERROR_TRANSLATION_MAP[message];
    const translatedMessage = translationKey ? t(translationKey) : message;

    return (
        <p
            {...props}
            className={cn('text-sm text-red-600 dark:text-red-400', className)}
        >
            {translatedMessage}
        </p>
    );
}

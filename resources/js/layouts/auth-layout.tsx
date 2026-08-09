import { useTranslation } from 'react-i18next';
import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <AuthLayoutTemplate title={t(title) || title} description={t(description) || description}>
            {children}
        </AuthLayoutTemplate>
    );
}

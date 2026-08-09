import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

export default function LanguageToggle({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { t } = useTranslation();
    const locale = useLocale();

    const languages: { value: 'zh' | 'en'; label: string }[] = [
        { value: 'zh', label: t('settings.appearance.chinese') },
        { value: 'en', label: t('settings.appearance.english') },
    ];

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-700/60 w-fit',
                className,
            )}
            {...props}
        >
            {languages.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => updateLocale(value)}
                    className={cn(
                        'flex items-center rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                        locale === value
                            ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

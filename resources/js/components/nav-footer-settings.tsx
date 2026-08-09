import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

export function NavFooterSettings() {
    const { t } = useTranslation();
    const { appearance, updateAppearance } = useAppearance();
    const locale = useLocale();
    const { state } = useSidebar();

    const themes: { value: Appearance; icon: typeof Sun }[] = [
        { value: 'light', icon: Sun },
        { value: 'dark', icon: Moon },
        { value: 'system', icon: Monitor },
    ];

    const languages: { value: 'zh' | 'en'; label: string }[] = [
        { value: 'zh', label: t('settings.appearance.chinese') },
        { value: 'en', label: t('settings.appearance.english') },
    ];

    return (
        <div
            className={cn(
                'flex flex-col gap-2 px-2 transition-all duration-200 ease-in-out',
                state === 'collapsed'
                    ? 'opacity-0 pointer-events-none'
                    : 'opacity-100 pointer-events-auto',
            )}
        >
            <div className="inline-flex gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-700/60 w-fit">
                {themes.map(({ value, icon: Icon }) => (
                    <button
                        key={value}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'flex items-center justify-center rounded-lg px-2.5 py-1.5 transition-all duration-200',
                            appearance === value
                                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                        )}
                        title={t(`settings.appearance.${value}`)}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                ))}
            </div>

            <div className="inline-flex gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-700/60 w-fit">
                {languages.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => updateLocale(value)}
                        className={cn(
                            'flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
                            locale === value
                                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                        )}
                    >
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

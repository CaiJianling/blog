/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-07-22 09:48:48
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-07-22 12:01:14
 * @FilePath: /blog/resources/js/components/appearance-tabs.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Globe, Sun, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useEffects } from '@/hooks/use-effects';
import LanguageToggle from '@/components/language-toggle';
import { cn } from '@/lib/utils';

export default function AppearanceTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { t } = useTranslation();
    const { appearance, updateAppearance } = useAppearance();
    const { effectsEnabled, updateEffectsEnabled } = useEffects();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: t('settings.appearance.light') },
        { value: 'dark', icon: Moon, label: t('settings.appearance.dark') },
        { value: 'system', icon: Monitor, label: t('settings.appearance.system') },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="text-sm font-medium">{t('settings.appearance.theme')}</span>
            </div>
            <div
                className={cn(
                    'inline-flex gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-700/60 w-fit',
                    className,
                )}
                {...props}
            >
                {tabs.map(({ value, icon: Icon, label }) => (
                    <button
                        key={value}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'flex items-center rounded-lg px-3.5 py-1.5 transition-all duration-200',
                            appearance === value
                                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                        )}
                    >
                        <Icon className="-ml-1 h-4 w-4" />
                        <span className="ml-1.5 text-sm font-medium">{label}</span>
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-6">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">{t('settings.appearance.effects')}</span>
            </div>
            <div
                className={cn(
                    'inline-flex gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-700/60 w-fit',
                    className,
                )}
                {...props}
            >
                <button
                    onClick={() => updateEffectsEnabled(false)}
                    className={cn(
                        'flex items-center rounded-lg px-3.5 py-1.5 transition-all duration-200',
                        !effectsEnabled
                            ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                    )}
                >
                    <span className="text-sm font-medium">{t('settings.appearance.disabled')}</span>
                </button>
                <button
                    onClick={() => updateEffectsEnabled(true)}
                    className={cn(
                        'flex items-center rounded-lg px-3.5 py-1.5 transition-all duration-200',
                        effectsEnabled
                            ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-600 dark:text-white dark:ring-white/10'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-600/40 dark:hover:text-white',
                    )}
                >
                    <span className="text-sm font-medium">{t('settings.appearance.enabled')}</span>
                </button>
            </div>

            <div className="flex items-center gap-2 mt-6">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">{t('settings.appearance.language')}</span>
            </div>
            <LanguageToggle />
        </div>
    );
}

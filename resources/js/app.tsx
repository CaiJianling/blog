/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-07-22 09:48:48
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-07-22 10:52:55
 * @FilePath: /blog/resources/js/app.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createInertiaApp } from '@inertiajs/react';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { initializeEffects } from '@/hooks/use-effects';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import i18n, { initPromise } from './i18n';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

initPromise.then(() => {
    createInertiaApp({
        title: (title) => (title ? `${title} - ${appName}` : appName),
        layout: (name) => {
            switch (true) {
                case name === 'welcome':
                    return null;
                case name.startsWith('auth/'):
                    return AuthLayout;
                case name.startsWith('settings/'):
                    return [AppLayout, SettingsLayout];
                default:
                    return AppLayout;
            }
        },
        strictMode: true,
        withApp(app) {
            return (
                <I18nextProvider i18n={i18n}>
                    <TooltipProvider delayDuration={0}>
                        {app}
                        <Toaster />
                    </TooltipProvider>
                </I18nextProvider>
            );
        },
        progress: {
            color: '#4B5563',
        },
    });

    initializeTheme();
    initializeEffects();
});

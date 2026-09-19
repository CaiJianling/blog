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
import { initializeGlassFrost } from '@/hooks/use-glass-frost';
import { initializePageFilter } from '@/hooks/use-page-filter';
import { initializeThemeColor } from '@/hooks/use-theme-color';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import PublicLayout from '@/layouts/public-layout';
import SettingsLayout from '@/layouts/settings/layout';
import i18n, { initPromise } from './i18n';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

initPromise.then(() => {
    // 顶部进度条跟随主题主色：读取 <meta name="theme-color">（无主题时为内置默认蓝）
    const progressColor =
        (typeof document !== 'undefined'
            ? document
                  .querySelector('meta[name="theme-color"]')
                  ?.getAttribute('content')
            : null) || '#0071e3';

    createInertiaApp({
        title: (title) => (title ? `${title} - ${appName}` : appName),
        layout: (name) => {
            switch (true) {
                case name === 'welcome':
                    return null;
                case name === 'Home' ||
                    name.startsWith('Blog/') ||
                    name.startsWith('Tools/') ||
                    name.startsWith('Nav/') ||
                    name.startsWith('Links/') ||
                    name.startsWith('Moment/') ||
                    name.startsWith('Archive/'):
                    return PublicLayout;
                case name.startsWith('auth/'):
                    return AuthLayout;
                case name === 'settings/permalink':
                case name === 'settings/smilies':
                case name === 'settings/navigation':
                case name === 'settings/navigation-intro':
                case name === 'settings/ai':
                case name === 'settings/assistant':
                case name === 'settings/tools':
                case name === 'settings/sidebar':
                case name === 'settings/footer':
                case name === 'settings/home':
                case name === 'settings/theme':
                case name === 'settings/links':
                    return AppLayout;
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
        // 顶部细条为 Inertia 页面加载进度（非阅读进度）
        progress: {
            color: progressColor,
            showSpinner: false,
        },
    });

    initializeTheme();
    initializeEffects();
    initializeThemeColor();
    initializePageFilter();
    initializeGlassFrost();
});

import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className="overflow-x-hidden overflow-y-auto"
            >
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {/*
                  液态玻璃顶栏（sticky top-0）需要背后有内容才能折射/透出。
                  内容整体上移贴到顶栏下方（-mt 抵消顶栏占位，pt 把可见内容
                  顶回原位），滚动容器静止时也始终有内容垫在玻璃后面；
                  侧栏折叠时顶栏由 h-16 变 h-12，负边距/内边距同步切换。
                */}
                <div className="-mt-16 pt-16 transition-[margin-top,padding-top] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-has-data-[collapsible=icon]/sidebar-wrapper:-mt-12 group-has-data-[collapsible=icon]/sidebar-wrapper:pt-12">
                    {children}
                </div>
            </AppContent>
        </AppShell>
    );
}

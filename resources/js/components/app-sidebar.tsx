import { Link, usePage } from '@inertiajs/react';
import {
    LayoutGrid,
    Settings2,
    Users,
    Home,
    FileText,
    FileStack,
    Image,
    MessageSquare,
    FolderTree,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooterSettings } from '@/components/nav-footer-settings';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard, home } from '@/routes';
import { edit as editAi } from '@/routes/ai';
import { edit as editHome } from '@/routes/home';
import { index as menusIndex } from '@/routes/menus';
import { edit as editNavigation } from '@/routes/navigation';
import { edit as editPermalink } from '@/routes/permalink';
import { edit as editSite } from '@/routes/site';
import { index as smiliesIndex } from '@/routes/smilies';
import { admin as toolsAdmin } from '@/routes/tools';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const { auth } = usePage().props as any;
    const isAdmin = auth?.user?.role === 'administrator';

    const mainNavItems: NavItem[] = [
        {
            title: 'nav.home',
            href: home(),
            icon: Home,
        },
        {
            title: 'nav.dashboard',
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            title: 'articles.title',
            href: '/articles',
            icon: FileText,
            children: [
                {
                    title: 'articles.allArticles',
                    href: '/articles',
                },
                {
                    title: 'articles.create',
                    href: '/articles/create',
                },
                {
                    title: 'articles.categories',
                    href: '/articles/categories',
                },
                {
                    title: 'articles.tags',
                    href: '/articles/tags',
                },
            ],
        },
        {
            title: 'pages.title',
            href: '/pages',
            icon: FileStack,
            children: [
                {
                    title: 'pages.allPages',
                    href: '/pages',
                },
                {
                    title: 'pages.create',
                    href: '/pages/create',
                },
            ],
        },
        {
            title: 'media.title',
            href: '/attachments',
            icon: Image,
            children: [
                {
                    title: 'media.library',
                    href: '/attachments',
                },
                {
                    title: 'media.addNew',
                    href: '/attachments/create',
                },
            ],
        },
        {
            title: 'commentManagement.title',
            href: '/comments',
            icon: MessageSquare,
            children: [
                {
                    title: 'comments.title',
                    href: '/comments',
                },
            ],
        },
    ];

    if (isAdmin) {
        // 内容管理（导航页、工具页、菜单、表情）插在页面管理之后
        const pagesIndex = mainNavItems.findIndex(
            (item) => item.title === 'pages.title',
        );

        mainNavItems.splice(pagesIndex + 1, 0, {
            title: 'contentManagement.title',
            href: editNavigation(),
            icon: FolderTree,
            children: [
                {
                    title: 'settings.navigation.title',
                    href: editNavigation(),
                },
                {
                    title: 'settings.tools.title',
                    href: toolsAdmin(),
                },
                {
                    title: 'menus.title',
                    href: menusIndex(),
                },
            ],
        });

        // 表情管理仅管理员可见，追加到「评论管理」分组
        const commentsGroup = mainNavItems.find(
            (item) => item.title === 'commentManagement.title',
        );

        commentsGroup?.children?.push({
            title: 'settings.smilies.title',
            href: smiliesIndex(),
        });

        mainNavItems.push({
            title: 'userManagement.title',
            href: '/users',
            icon: Users,
        });
        mainNavItems.push({
            title: 'settings.title',
            href: editSite(),
            icon: Settings2,
            children: [
                {
                    title: 'settings.site.title',
                    href: editSite(),
                },
                {
                    title: 'settings.home.title',
                    href: editHome(),
                },
                {
                    title: 'settings.ai.title',
                    href: editAi(),
                },
                {
                    title: 'settings.permalink.title',
                    href: editPermalink(),
                },
            ],
        });
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooterSettings />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, Users, Home, FileText, FileStack } from 'lucide-react';
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
    ];

    if (isAdmin) {
        mainNavItems.push({
            title: 'userManagement.title',
            href: '/users',
            icon: Users,
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

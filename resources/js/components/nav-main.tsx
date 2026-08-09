import { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const { t } = useTranslation();
    const { isCurrentUrl } = useCurrentUrl();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement | Element>, href: string) => {
        if (isCurrentUrl(href)) {
            e.preventDefault();
            router.reload({ only: [] });
        }
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        {item.children && item.children.length > 0 ? (
                            <CollapsibleNavItem item={item} isCurrentUrl={isCurrentUrl} />
                        ) : (
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(item.href || '')}
                                tooltip={{ children: t(item.title) }}
                            >
                                <Link
                                    href={item.href || '#'}
                                    prefetch
                                    onClick={(e) => item.href && handleClick(e, String(item.href))}
                                >
                                    {item.icon && <item.icon />}
                                    <span>{t(item.title)}</span>
                                </Link>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

function CollapsibleNavItem({ item, isCurrentUrl }: { item: NavItem; isCurrentUrl: (href: NonNullable<InertiaLinkProps['href']>) => boolean }) {
    const { t } = useTranslation();
    const hasActiveChild = item.children?.some(subItem => subItem.href && isCurrentUrl(subItem.href));
    const [isOpen, setIsOpen] = useState(hasActiveChild);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement | Element>, href: string) => {
        if (isCurrentUrl(href)) {
            e.preventDefault();
            router.reload({ only: [] });
        }
    };

    return (
        <>
            <SidebarMenuButton
                onClick={() => setIsOpen(!isOpen)}
                isActive={hasActiveChild}
                tooltip={{ children: t(item.title) }}
            >
                {item.icon && <item.icon />}
                <span>{t(item.title)}</span>
                {isOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
            </SidebarMenuButton>
            {isOpen && item.children && (
                <SidebarMenuSub>
                    {item.children.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                                asChild
                                isActive={subItem.href ? isCurrentUrl(subItem.href) : false}
                            >
                                <Link
                                    href={subItem.href || '#'}
                                    prefetch
                                    onClick={(e) => subItem.href && handleClick(e, String(subItem.href))}
                                >
                                    <span>{t(subItem.title)}</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    ))}
                </SidebarMenuSub>
            )}
        </>
    );
}
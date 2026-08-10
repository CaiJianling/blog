import { useState, useLayoutEffect, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
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
        <SidebarGroup className="px-2">
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
                                    <span className="group-data-[collapsible=icon]:hidden">{t(item.title)}</span>
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
    const { state } = useSidebar();
    const hasActiveChild = item.children?.some(subItem => subItem.href && isCurrentUrl(subItem.href));
    const [isOpen, setIsOpen] = useState(hasActiveChild);

    const collapsed = state === 'collapsed';
    const prevCollapsedRef = useRef(collapsed);

    // When expanding: auto-open parent if on a submenu page
    // When collapsing: close any open submenu (don't show dropdown)
    useLayoutEffect(() => {
        if (collapsed !== prevCollapsedRef.current) {
            setIsOpen(collapsed ? false : hasActiveChild);
            prevCollapsedRef.current = collapsed;
        }
    }, [collapsed, hasActiveChild]);

    const handleSubClick = (e: React.MouseEvent<HTMLAnchorElement | Element>, href: string) => {
        if (isCurrentUrl(href)) {
            e.preventDefault();
            router.reload({ only: [] });
        }
    };

    // Collapsed state: use DropdownMenu (same pattern as NavUser)
    if (collapsed) {
        return (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        isActive={hasActiveChild}
                        tooltip={{ children: t(item.title) }}
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        {item.icon && <item.icon />}
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                {item.children && (
                    <DropdownMenuContent
                        side="right"
                        align="start"
                        className="min-w-44 rounded-lg"
                    >
                        <DropdownMenuLabel>{t(item.title)}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {item.children.map((subItem) => (
                                <DropdownMenuItem key={subItem.title} asChild>
                                    <Link
                                        href={subItem.href || '#'}
                                        prefetch
                                        className={cn(
                                            subItem.href && isCurrentUrl(subItem.href) && '!bg-accent !text-accent-foreground font-medium',
                                        )}
                                        onClick={(e) => {
                                            if (subItem.href) {
                                                handleSubClick(e, String(subItem.href));
                                            }
                                        }}
                                    >
                                        <span>{t(subItem.title)}</span>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                )}
            </DropdownMenu>
        );
    }

    // Expanded state: click-to-expand inline submenu
    return (
        <>
            <SidebarMenuButton
                onClick={() => setIsOpen(!isOpen)}
                isActive={hasActiveChild}
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
                                    onClick={(e) => subItem.href && handleSubClick(e, String(subItem.href))}
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
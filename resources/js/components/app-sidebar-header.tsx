import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <header className="material-thin flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/30 px-6 transition-[width,height] ease-[cubic-bezier(0.25,0.1,0.25,1)] duration-200 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4 z-20">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
        </header>
    );
}

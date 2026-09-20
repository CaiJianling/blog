import { useId, useRef } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import LiquidGlassPanel from '@/components/LiquidGlass/LiquidGlassPanel';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { EFFECT_LEVEL, useEffectsAtLeast } from '@/hooks/use-effects';
import { useGlassSurfaceSize } from '@/hooks/use-glass-surface-size';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const glassId = useId();
    const barRef = useRef<HTMLElement>(null);
    // 极致档：后台顶栏与前台顶栏一样换成液态玻璃面板（磨砂度全局可调）
    const barGlass = useEffectsAtLeast(EFFECT_LEVEL.ultimate);
    const barSize = useGlassSurfaceSize(barRef, barGlass);

    return (
        <header
            ref={barRef}
            className={cn(
                'sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/30 px-6 transition-[width,height] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4',
                // 未达极致档时回退到原有 material-thin 磨砂底
                !barGlass && 'material-thin',
                barGlass && 'overflow-hidden',
            )}
        >
            {barGlass && barSize.width > 0 && barSize.height > 0 && (
                <LiquidGlassPanel
                    id={glassId}
                    width={barSize.width}
                    height={barSize.height}
                    radius={12}
                    bezelWidth={10}
                />
            )}

            <div className="relative flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
        </header>
    );
}

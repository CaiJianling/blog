import type { ReactNode } from 'react';
import AiAssistantWidget from '@/components/ai-assistant-widget';
import FloatingActions from '@/components/floating-actions';
import PublicFooter from '@/components/public-footer';
import PublicNavbar from '@/components/public-navbar';
import { pageFilterCss, usePageFilter } from '@/hooks/use-page-filter';

export default function PublicLayout({ children }: { children: ReactNode }) {
    const { saturation, brightness } = usePageFilter();
    const filter = pageFilterCss({ saturation, brightness });

    return (
        <div className="flex min-h-screen flex-col">
            {/*
                页面滤镜（饱和度/亮度）只作用于页面内容：CSS filter 会让 fixed 后代改以本容器
                为包含块，因此悬浮操作组与小助手放在滤镜容器之外，保持视口定位不受影响。
                背景色同步画在本容器上（与 body 的 --background 一致），否则 body 的底色在
                filter 作用范围之外，亮度调整对背景无效。
            */}
            <div className="flex min-h-screen flex-col bg-background" style={filter ? { filter } : undefined}>
                <PublicNavbar />
                <main className="flex-1">{children}</main>
                <PublicFooter />
            </div>
            <FloatingActions />
            <AiAssistantWidget />
        </div>
    );
}

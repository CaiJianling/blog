import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import AiAssistantWidget from '@/components/ai-assistant-widget';
import FloatingActions from '@/components/floating-actions';
import PublicFooter from '@/components/public-footer';
import PublicNavbar from '@/components/public-navbar';
import { pageFilterCss, usePageFilter } from '@/hooks/use-page-filter';

interface PageBackgroundProps {
    mode: string;
    url: string | null;
    opacity: number;
}

export default function PublicLayout({ children }: { children: ReactNode }) {
    const { saturation, brightness } = usePageFilter();
    const filter = pageFilterCss({ saturation, brightness });
    const { url, opacity } = (usePage().props as unknown as { pageBackground?: PageBackgroundProps }).pageBackground
        ?? { mode: '', url: null, opacity: 100 };

    return (
        <div className="flex min-h-screen flex-col">
            {/*
                页面滤镜（饱和度/亮度）只作用于页面内容：CSS filter 会让 fixed 后代改以本容器
                为包含块，因此悬浮操作组与小助手放在滤镜容器之外，保持视口定位不受影响。
                背景色同步画在本容器上（与 body 的 --background 一致），否则 body 的底色在
                filter 作用范围之外，亮度调整对背景无效。
                isolate 让容器成为独立的层叠上下文：壁纸层（-z-10）稳定画在容器背景之上、
                内容之下，不受是否开启滤镜影响。
            */}
            <div className="relative isolate flex min-h-screen flex-col bg-background" style={filter ? { filter } : undefined}>
                {/*
                    壁纸层：铺满整个页面容器；bg-fixed 让图片锚定视口（长页不会被拉伸），
                    iOS Safari 不支持时退化为随页滚动。透明度由后台「主题设置 → 背景设置」调节。
                */}
                {url && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat bg-fixed"
                        style={{
                            backgroundImage: `url(${url})`,
                            opacity: Math.min(100, Math.max(0, opacity)) / 100,
                        }}
                    />
                )}
                <PublicNavbar />
                <main className="flex-1">{children}</main>
                <PublicFooter />
            </div>
            <FloatingActions />
            <AiAssistantWidget />
        </div>
    );
}

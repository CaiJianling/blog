import { usePage } from '@inertiajs/react';
import { MessageSquare, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import FloatingSettingsPanel from '@/components/floating-settings-panel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * 前台右下角悬浮操作组：
 * - 回到顶部（按钮圆环显示文章阅读进度）
 * - 跳转评论区（文章详情页且开启评论，点击后聚焦评论输入框）
 *
 * 页面顶部的进度条为 Inertia 页面加载进度（见 app.tsx 的 progress 配置）。
 * 位置与 AI 小助手按钮协调：启用时悬浮其上方，未启用时贴底。
 */
export default function FloatingActions() {
    const { assistant } = usePage().props as unknown as { assistant?: { enabled?: boolean } };

    const [showTop, setShowTop] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isArticle, setIsArticle] = useState(false);
    const [hasComments, setHasComments] = useState(false);
    const { url } = usePage();

    useEffect(() => {
        const onScroll = () => {
            const scrollY = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(maxScroll > 0 ? Math.min(100, (scrollY / maxScroll) * 100) : 0);
            setShowTop(scrollY > 300);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // 页面切换后重新探测：是否文章详情页、是否有评论区
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsArticle(!!document.querySelector('article'));
            setHasComments(!!document.getElementById('comments'));
            window.dispatchEvent(new Event('scroll'));
        }, 150);

        return () => clearTimeout(timer);
    }, [url]);

    const bottomOffset = assistant?.enabled ? 'bottom-[92px]' : 'bottom-6';

    const scrollToComments = () => {
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });

        // 滚动完成后聚焦评论输入框
        setTimeout(() => {
            const textarea = document.querySelector<HTMLTextAreaElement>('#comments textarea');

            textarea?.focus({ preventScroll: true });
        }, 700);
    };

    const backToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const showRing = isArticle && progress > 0;
    const ringRadius = 17;
    const ringCircumference = 2 * Math.PI * ringRadius;

    return (
        <div className={`fixed right-5 z-40 flex flex-col gap-2 ${bottomOffset}`}>
            {isArticle && hasComments && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={scrollToComments}
                            className="hover-glow flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-popover text-muted-foreground shadow-md transition-all hover:text-primary"
                            aria-label="跳转到评论区"
                        >
                            <MessageSquare className="h-4 w-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="tooltip-dark">
                        跳转到评论区
                    </TooltipContent>
                </Tooltip>
            )}
            {showTop && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={backToTop}
                            className="hover-glow relative flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-popover text-muted-foreground shadow-md transition-all hover:text-primary"
                            aria-label="回到顶部"
                        >
                            {showRing && (
                                <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 h-10 w-10 -rotate-90">
                                    <circle cx="20" cy="20" r={ringRadius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border/40" />
                                    <circle
                                        cx="20"
                                        cy="20"
                                        r={ringRadius}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        className="text-primary transition-[stroke-dashoffset] duration-150 ease-out"
                                        strokeDasharray={ringCircumference}
                                        strokeDashoffset={ringCircumference * (1 - progress / 100)}
                                    />
                                </svg>
                            )}
                            <Rocket className="h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="tooltip-dark">
                    {showRing ? `阅读进度 ${Math.round(progress)}%` : '回到顶部'}
                </TooltipContent>
            </Tooltip>
            )}
            <FloatingSettingsPanel />
        </div>
    );
}

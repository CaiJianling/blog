import { Link, usePage } from '@inertiajs/react';
import { motion, useAnimationControls } from 'framer-motion';
import { MessageSquare, Rocket, SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import FloatingSettingsPanel from '@/components/floating-settings-panel';
import GlassButtonBackground from '@/components/LiquidGlass/glass-button-background';
import GlassEdgeRing from '@/components/LiquidGlass/glass-edge-ring';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EFFECT_LEVEL, useEffectsAtLeast } from '@/hooks/use-effects';
import { cn } from '@/lib/utils';

/**
 * 前台右下角悬浮操作组：
 * - 编辑本文（仅文章作者本人登录时出现，跳后台编辑页）
 * - 回到顶部（按钮圆环显示文章阅读进度）
 * - 跳转评论区（文章详情页且开启评论，点击后聚焦评论输入框）
 *
 * 页面顶部的进度条为 Inertia 页面加载进度（见 app.tsx 的 progress 配置）。
 * 位置与 AI 小助手按钮协调：启用时悬浮其上方，未启用时贴底。
 */
export default function FloatingActions() {
    const { assistant, article } = usePage().props as unknown as {
        assistant?: { enabled?: boolean };
        article?: { id?: number; can_edit?: boolean };
    };
    const glassButtons = useEffectsAtLeast(EFFECT_LEVEL.pro);

    const [showTop, setShowTop] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isArticle, setIsArticle] = useState(false);
    const [hasComments, setHasComments] = useState(false);
    const { url } = usePage();

    // 作者本人的编辑入口：can_edit 由 BlogController 按 author_id 判定后下发
    const editUrl = article?.can_edit === true && typeof article.id === 'number'
        ? `/admin/articles/${article.id}/edit`
        : null;

    // 按下缩放反馈（与小助手 FAB 的 whileTap 一致）
    const pressEdit = useAnimationControls();
    const pressComment = useAnimationControls();
    const pressTop = useAnimationControls();

    const press = (controls: ReturnType<typeof useAnimationControls>): void => {
        void controls.start({ scale: 0.94, transition: { duration: 0.1, ease: 'easeOut' } });
    };

    const release = (controls: ReturnType<typeof useAnimationControls>): void => {
        void controls.start({ scale: 1, transition: { type: 'spring', stiffness: 420, damping: 26 } });
    };

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
            {editUrl && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.span
                            animate={pressEdit}
                            className="relative block h-10 w-10"
                        >
                            <Link
                                href={editUrl}
                                onPointerDown={() => press(pressEdit)}
                                onPointerUp={() => release(pressEdit)}
                                onPointerLeave={() => release(pressEdit)}
                                className={cn(
                                    'hover-glow relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-primary/45 text-primary shadow-md transition-colors hover:bg-primary/10',
                                    !glassButtons && 'bg-popover',
                                )}
                                aria-label="编辑这篇文章"
                            >
                                <GlassButtonBackground size={40} />
                                <SquarePen className="relative h-4 w-4" />
                            </Link>
                            {glassButtons && <GlassEdgeRing variant="circle" />}
                        </motion.span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="tooltip-dark">
                        编辑这篇文章
                    </TooltipContent>
                </Tooltip>
            )}
            {isArticle && hasComments && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.span
                            animate={pressComment}
                            className="relative block h-10 w-10"
                        >
                            <button
                                type="button"
                                onClick={scrollToComments}
                                onPointerDown={() => press(pressComment)}
                                onPointerUp={() => release(pressComment)}
                                onPointerLeave={() => release(pressComment)}
                                className={cn(
                                    'hover-glow relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/60 text-muted-foreground shadow-md transition-colors hover:text-primary',
                                    !glassButtons && 'bg-popover',
                                )}
                                aria-label="跳转到评论区"
                            >
                                <GlassButtonBackground size={40} />
                                <MessageSquare className="relative h-4 w-4" />
                            </button>
                            {glassButtons && <GlassEdgeRing variant="circle" />}
                        </motion.span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="tooltip-dark">
                        跳转到评论区
                    </TooltipContent>
                </Tooltip>
            )}
            {showTop && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.span
                            animate={pressTop}
                            className="relative block h-10 w-10"
                        >
                            <button
                                type="button"
                                onClick={backToTop}
                                onPointerDown={() => press(pressTop)}
                                onPointerUp={() => release(pressTop)}
                                onPointerLeave={() => release(pressTop)}
                                className={cn(
                                    'hover-glow relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/60 text-muted-foreground shadow-md transition-colors hover:text-primary',
                                    !glassButtons && 'bg-popover',
                                )}
                                aria-label="回到顶部"
                            >
                                <GlassButtonBackground size={40} />
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
                                <Rocket className="relative h-4 w-4" />
                            </button>
                            {glassButtons && <GlassEdgeRing variant="circle" />}
                        </motion.span>
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

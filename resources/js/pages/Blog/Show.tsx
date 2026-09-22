import { Head, Link, usePage } from '@inertiajs/react';
import {
    Eye,
    MessageSquare,
    Clock,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    Home,
    ListTree,
    Heart,
    Timer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import CommentSection from '@/components/comments/comment-section';
import type {
    Captcha,
    CommentItem,
    SmileyGroupData,
} from '@/components/comments/comment-section';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import { copyToClipboard } from '@/lib/clipboard';
import { buildSeoMeta } from '@/lib/seo';
import { home } from '@/routes';
import blog from '@/routes/blog';

type Article = {
    id: number;
    title: string;
    content: BlockNoteDocument;
    excerpt: string;
    meta_title: string | null;
    meta_description: string | null;
    author_name: string;
    author_avatar: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
    views: number;
    comment_count: number;
    reading_time: number;
    created_at: string;
    permalink: string;
    comment_status: string;
    likes: number;
    liked_by_me: boolean | null;
    can_edit: boolean;
};

type Related = {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    created_at: string;
};

type PrevNext = {
    title: string;
    permalink: string;
} | null;

type Props = {
    article: Article;
    comments: CommentItem[];
    captcha: Captcha;
    smileyGroups: SmileyGroupData[];
    relatedArticles: Related[];
    prevArticle: PrevNext;
    nextArticle: PrevNext;
};

// 代码块交互按钮的切换图标（复制成功后瞬时替换、全屏关闭）。
const CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** 游客读取本地点赞记录 */
function readGuestLiked(articleId: number): boolean {
    try {
        const likedList: number[] = JSON.parse(
            localStorage.getItem('blog-liked-articles') ?? '[]',
        );

        return likedList.includes(articleId);
    } catch {
        return false;
    }
}

type TocItem = {
    id: string;
    text: string;
    level: number;
};

/** 从 BlockNote 内容中提取标题生成文章大纲。 */
function extractHeadings(content: BlockNoteDocument): TocItem[] {
    const items: TocItem[] = [];

    const walk = (blocks: BlockNoteDocument) => {
        for (const block of blocks) {
            if ((block as { type?: string }).type === 'heading') {
                const typed = block as {
                    props?: { level?: number };
                    content?: unknown;
                };
                const level = Math.min(
                    Math.max(Number(typed.props?.level) || 1, 1),
                    4,
                );
                const text = Array.isArray(typed.content)
                    ? typed.content
                          .map((inline) =>
                              typeof inline === 'object' &&
                              inline !== null &&
                              'text' in inline
                                  ? String(
                                        (inline as { text?: unknown }).text ??
                                            '',
                                    )
                                  : '',
                          )
                          .join('')
                    : '';

                if (text.trim() !== '') {
                    items.push({
                        id: `heading-${items.length}`,
                        text: text.trim(),
                        level,
                    });
                }
            }

            const children = (block as { children?: BlockNoteDocument })
                .children;

            if (Array.isArray(children)) {
                walk(children);
            }
        }
    };

    walk(content ?? []);

    return items;
}

export default function Show({
    article,
    comments,
    captcha,
    smileyGroups,
    relatedArticles,
    prevArticle,
    nextArticle,
}: Props) {
    const { t } = useTranslation();
    const { name } = usePage().props as { name?: string };
    const seo = usePage().props.seo;
    const pageTitle = article.meta_title?.trim() || article.title;
    const pageDescription = article.meta_description?.trim() || article.excerpt;
    const firstCategory = article.categories[0];

    const tocItems = useMemo(
        () => extractHeadings(article.content ?? []),
        [article.content],
    );
    // 正文 HTML（含大纲锚点 id）：按内容记忆化，避免每次渲染重复生成并触发 innerHTML 重写
    const contentHtml = useMemo(
        () =>
            article.content && article.content.length > 0
                ? blocknoteToHtml(article.content)
                : '',
        [article.content],
    );
    const [activeHeading, setActiveHeading] = useState<string | null>(null);
    const tocNavRef = useRef<HTMLElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const isLoggedIn = !!usePage().props.auth?.user;
    const [likes, setLikes] = useState(article.likes);
    const [liked, setLiked] = useState<boolean>(
        // 游客根据浏览器本地记录判断是否点赞过
        article.liked_by_me ?? readGuestLiked(article.id),
    );
    const [likeSending, setLikeSending] = useState(false);

    const guestId = useCallback((): string => {
        let id = localStorage.getItem('blog-guest-id');

        if (!id) {
            id =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `guest-${Date.now()}`;
            localStorage.setItem('blog-guest-id', id);
        }

        return id;
    }, []);

    const toggleLike = async () => {
        if (likeSending) {
            return;
        }

        setLikeSending(true);

        try {
            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const xsrf = document.cookie.match(
                /(?:^|;\s*)XSRF-TOKEN=([^;]+)/,
            )?.[1];
            const headers: Record<string, string> = {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            } else if (xsrf) {
                headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
            }

            const response = await fetch(`/articles/${article.id}/like`, {
                method: 'POST',
                headers,
                body: JSON.stringify(isLoggedIn ? {} : { guestId: guestId() }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message ?? '点赞失败');
            }

            setLikes(data.likes);
            setLiked(data.liked);

            // 游客的点赞状态记录在浏览器本地
            if (!isLoggedIn) {
                const likedList: number[] = JSON.parse(
                    localStorage.getItem('blog-liked-articles') ?? '[]',
                );
                const next = data.liked
                    ? [
                          ...likedList.filter((id) => id !== article.id),
                          article.id,
                      ]
                    : likedList.filter((id) => id !== article.id);

                localStorage.setItem(
                    'blog-liked-articles',
                    JSON.stringify(next),
                );
            }
        } catch {
            // 静默失败，不打断阅读
        } finally {
            setLikeSending(false);
        }
    };

    // 标题锚点 id（heading-N）已由 blocknoteToHtml 写入 HTML，随 React 渲染持久保留，
    // 无需再在 effect 里手动写入（否则 DOM 被重渲染重建后 id 会丢失）。

    // 滚动高亮当前所在章节：定位"阅读线"上方最近的标题；滚到页面底部时兜底选中最后一个标题。
    // 每次更新都实时读取标题 DOM（内容可能因重渲染重建，不能缓存旧引用）。
    useEffect(() => {
        if (tocItems.length === 0) {
            return;
        }

        let frame = 0;

        const update = () => {
            frame = 0;

            const readingLine = window.innerHeight * 0.3;
            const maxScrollable =
                document.documentElement.scrollHeight - window.innerHeight;
            const nearBottom = window.scrollY >= maxScrollable - 2;

            let current = tocItems[0].id;

            for (const item of tocItems) {
                const node = document.getElementById(item.id);

                if (node && node.getBoundingClientRect().top <= readingLine) {
                    current = item.id;
                }
            }

            if (nearBottom) {
                current = tocItems[tocItems.length - 1].id;
            }

            setActiveHeading((prev) => (prev === current ? prev : current));
        };

        const schedule = () => {
            if (!frame) {
                frame = requestAnimationFrame(update);
            }
        };

        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });

        return () => {
            if (frame) {
                cancelAnimationFrame(frame);
            }

            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [tocItems]);

    // 大纲随滚动自动下翻：当前章节变化时，把对应目录项滚动到列表可视区（只滚目录自身，不动整页）。
    useEffect(() => {
        const nav = tocNavRef.current;

        if (!nav || activeHeading === null) {
            return;
        }

        const item = nav.querySelector<HTMLElement>(
            `a[href="#${activeHeading}"]`,
        );

        if (!item) {
            return;
        }

        const navRect = nav.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        const withinTop = itemRect.top >= navRect.top + 4;
        const withinBottom = itemRect.bottom <= navRect.bottom - 4;

        if (withinTop && withinBottom) {
            return;
        }

        const offset = itemRect.top - navRect.top + nav.scrollTop - 8;
        const maxScroll = nav.scrollHeight - nav.clientHeight;

        nav.scrollTo({
            top: Math.max(0, Math.min(offset, maxScroll)),
            behavior: 'smooth',
        });
    }, [activeHeading]);

    // 冷加载（整页/新标签打开，如后台文章列表跳到 #comments）时浏览器在 hydration 前
    // 找不到锚点；锚点元素又可能在挂载后一段时间才出现。用「定时器首查 +
    // MutationObserver 监听插入」定位（不能只依赖 rAF：后台标签页里 rAF 会被节流）。
    // 定位时让跳过去的区域整体可见：能装下视口就垂直居中，装不下/小目标则顶部
    // 对齐（留 72px 让出导航栏），并触发一次落点高亮动画。
    useEffect(() => {
        if (!location.hash) {
            return;
        }

        const id = location.hash.slice(1);
        let done = false;
        let settleTimer = 0;
        let clearTimer = 0;

        const scrollToAnchor = () => {
            if (done) {
                return;
            }

            const el = document.getElementById(id);

            if (!el) {
                return;
            }

            // 稍等布局稳定（字体/图片引起的高度变化）再定位
            settleTimer = window.setTimeout(() => {
                const target = document.getElementById(id);

                if (!target) {
                    return;
                }

                done = true;

                // 清掉 URL hash，阻止浏览器后续对锚点的原生重新对齐
                // （原生对齐对高于视口的元素会贴底，把标题顶出屏外）
                history.replaceState(
                    null,
                    '',
                    location.pathname + location.search,
                );

                const rect = target.getBoundingClientRect();
                const sectionDocTop = rect.top + window.scrollY;
                const sectionHeight = rect.height;

                // 评论区能整体装进视口时垂直居中（完整可见，无需再滚）；
                // 装不下（或标题锚点等小目标）时顶部对齐到导航栏下方
                const navHeight = 56;
                const usable = window.innerHeight - navHeight;

                const topOffset =
                    id === 'comments' && sectionHeight <= usable
                        ? navHeight + Math.round((usable - sectionHeight) / 2)
                        : 72;

                window.scrollTo({
                    top: Math.max(0, sectionDocTop - topOffset),
                });

                // 落点高亮：触发一次短暂描边发光动画，结束后移除类名
                target.classList.remove('anchor-flash');
                void target.offsetWidth; // 强制重排，保证动画可重复触发
                target.classList.add('anchor-flash');

                const clear = () => target.classList.remove('anchor-flash');

                target.addEventListener('animationend', clear, { once: true });
                clearTimer = window.setTimeout(clear, 1800);
            }, 300);
        };

        const observer = new MutationObserver(scrollToAnchor);

        observer.observe(document.body, { childList: true, subtree: true });
        const firstTimer = window.setTimeout(scrollToAnchor, 100);
        const bailTimer = window.setTimeout(
            () => observer.disconnect(),
            10_000,
        );

        return () => {
            done = true;
            observer.disconnect();
            clearTimeout(settleTimer);
            clearTimeout(clearTimer);
            clearTimeout(firstTimer);
            clearTimeout(bailTimer);
        };
    }, []);

    // 代码块交互：行号/折行开关、复制、全屏（对 dangerouslySetInnerHTML 渲染出的 .code-block 做后置绑定）。
    useEffect(() => {
        const container = contentRef.current;
        let closeOverlay: (() => void) | null = null;

        const onKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && closeOverlay) {
                closeOverlay();
            }
        };

        const openFullscreen = (block: HTMLElement) => {
            const bodyClone = block
                .querySelector('.code-block__body')
                ?.cloneNode(true) as HTMLElement | null;

            if (!bodyClone) {
                return;
            }

            const stage = document.createElement('div');
            stage.className = 'code-block__stage';

            const bar = document.createElement('div');
            bar.className = 'code-block__bar code-block__bar--overlay';

            const dots = document.createElement('span');
            dots.className = 'code-block__dots';
            dots.innerHTML =
                '<span class="dot dot--red"></span><span class="dot dot--yellow"></span><span class="dot dot--green"></span>';

            // 复用正文块的行号/折行/复制按钮（去掉全屏），作用在舞台元素上。
            const actions = document.createElement('span');
            actions.className = 'code-block__actions';

            const sourceButtons = Array.from(
                block.querySelectorAll<HTMLElement>('.code-block__btn'),
            ).filter((b) => b.getAttribute('data-code-action') !== 'fs');

            for (const source of sourceButtons) {
                const clone = source.cloneNode(true) as HTMLElement;
                clone.setAttribute(
                    'aria-pressed',
                    source.getAttribute('aria-pressed') ?? '',
                );
                actions.appendChild(clone);
            }

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'code-block__btn';
            closeBtn.setAttribute('data-tip', '关闭');
            closeBtn.setAttribute('aria-label', '关闭');
            closeBtn.innerHTML = CLOSE_ICON;

            bar.append(dots, actions, closeBtn);
            stage.append(bar, bodyClone);

            const overlay = document.createElement('div');
            overlay.className = 'code-block-overlay';
            overlay.append(stage);
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';

            let isClosing = false;

            const close = () => {
                if (isClosing) {
                    return;
                }

                isClosing = true;
                document.removeEventListener('keydown', onKeydown);
                overlay.classList.add('closing');

                const finish = () => {
                    overlay.remove();
                    document.body.style.overflow = '';
                    closeOverlay = null;
                };

                overlay.addEventListener('animationend', finish, {
                    once: true,
                });
                window.setTimeout(finish, 260);
            };

            const stageAction = (btn: HTMLElement) => {
                const action = btn.getAttribute('data-code-action');

                switch (action) {
                    case 'ln': {
                        const hidden = stage.classList.toggle('no-ln');
                        btn.setAttribute('aria-pressed', String(!hidden));
                        const tip = hidden ? '显示行号' : '隐藏行号';
                        btn.setAttribute('data-tip', tip);
                        btn.setAttribute('aria-label', tip);
                        break;
                    }
                    case 'wrap': {
                        const wrapped = stage.classList.toggle('wrap');
                        btn.setAttribute('aria-pressed', String(wrapped));
                        const tip = wrapped ? '关闭折行' : '折行';
                        btn.setAttribute('data-tip', tip);
                        btn.setAttribute('aria-label', tip);
                        break;
                    }
                    case 'copy': {
                        const original = btn.innerHTML;
                        void copyToClipboard(rawCodeOf(stage)).then((ok) => {
                            if (!ok) {
                                toast.error('复制失败，请手动选择文本复制');

                                return;
                            }

                            btn.innerHTML = CHECK_ICON;
                            window.setTimeout(() => {
                                btn.innerHTML = original;
                            }, 1500);
                        });
                        break;
                    }
                }
            };

            actions
                .querySelectorAll<HTMLElement>('.code-block__btn')
                .forEach((btn) => {
                    btn.addEventListener('click', () => stageAction(btn));
                });

            closeBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close();
                }
            });
            document.addEventListener('keydown', onKeydown);
            closeOverlay = close;
        };

        const rawCodeOf = (block: HTMLElement): string =>
            Array.from(block.querySelectorAll('.cb-line'))
                .map(
                    (line) => line.querySelector('.cb-text')?.textContent ?? '',
                )
                .join('\n');

        // 事件委托：容器是稳定 React 元素，点击时实时查 DOM，避免对动态渲染的按钮逐个绑定（重渲染会重复绑定）。
        const handleClick = (event: MouseEvent) => {
            const btn = (event.target as HTMLElement).closest<HTMLElement>(
                '.code-block__btn',
            );

            if (!btn) {
                return;
            }

            const block = btn.closest<HTMLElement>('.code-block');

            if (!block) {
                return;
            }

            const action = btn.getAttribute('data-code-action');

            switch (action) {
                case 'ln': {
                    const hidden = block.classList.toggle('no-ln');
                    const tip = hidden ? '显示行号' : '隐藏行号';

                    btn.setAttribute('aria-pressed', String(!hidden));
                    btn.setAttribute('data-tip', tip);
                    btn.setAttribute('aria-label', tip);
                    break;
                }
                case 'wrap': {
                    const wrapped = block.classList.toggle('wrap');
                    const tip = wrapped ? '关闭折行' : '折行';

                    btn.setAttribute('aria-pressed', String(wrapped));
                    btn.setAttribute('data-tip', tip);
                    btn.setAttribute('aria-label', tip);
                    break;
                }
                case 'copy': {
                    const original = btn.innerHTML;

                    void copyToClipboard(rawCodeOf(block)).then((ok) => {
                        if (!ok) {
                            toast.error('复制失败，请手动选择文本复制');

                            return;
                        }

                        btn.innerHTML = CHECK_ICON;
                        window.setTimeout(() => {
                            btn.innerHTML = original;
                        }, 1500);
                    });
                    break;
                }
                case 'fs': {
                    if (!closeOverlay) {
                        openFullscreen(block);
                    }

                    break;
                }
            }
        };

        if (container) {
            container.addEventListener('click', handleClick);
        }

        document.addEventListener('keydown', onKeydown);

        return () => {
            container?.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', onKeydown);
            closeOverlay?.();
        };
    }, [article.content]);

    return (
        <>
            <Head title={pageTitle}>
                {buildSeoMeta({
                    site: seo,
                    title: pageTitle,
                    description: pageDescription,
                    type: 'article',
                })}
            </Head>

            <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
                {/* 面包屑 */}
                <nav
                    aria-label="breadcrumb"
                    className="text-footnote flex flex-wrap items-center gap-1.5 text-muted-foreground"
                >
                    <Link
                        href={home()}
                        className="apple-press inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                    >
                        <Home className="h-3.5 w-3.5" />
                        {name}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <Link
                        href={blog.index()}
                        className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                    >
                        {t('articlePage.blog')}
                    </Link>
                    {firstCategory && (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                            <Link
                                href={blog.index({
                                    query: { category: firstCategory.slug },
                                })}
                                className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                            >
                                {firstCategory.name}
                            </Link>
                        </>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="line-clamp-1 max-w-[12rem] text-foreground/80">
                        {article.title}
                    </span>
                </nav>

                <div className="mt-6 flex items-start gap-6">
                    {/* 文章大纲 */}
                    {tocItems.length > 0 && (
                        <aside className="top-24 hidden w-60 shrink-0 self-start xl:sticky xl:block">
                            <div className="apple-card p-4">
                                <h3 className="text-callout mb-2.5 flex items-center gap-1.5 px-1 font-medium">
                                    <ListTree className="h-3.5 w-3.5 text-primary" />
                                    大纲
                                </h3>
                                <nav
                                    ref={tocNavRef}
                                    className="scroll-nice max-h-[60vh] space-y-0.5 overflow-y-auto"
                                >
                                    {tocItems.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                document
                                                    .getElementById(item.id)
                                                    ?.scrollIntoView({
                                                        behavior: 'smooth',
                                                    });
                                            }}
                                            className={`block truncate rounded-lg py-1.5 pr-2 text-xs transition-colors hover:text-primary ${
                                                activeHeading === item.id
                                                    ? 'font-medium text-primary'
                                                    : 'text-muted-foreground'
                                            } ${item.level === 2 ? 'pl-2.5' : item.level === 3 ? 'pl-5' : 'pl-1.5'}`}
                                            title={item.text}
                                        >
                                            {item.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </aside>
                    )}
                    <div className="min-w-0 flex-1">
                        <article className="mt-0">
                            {/* 文章头部 */}
                            <header className="apple-card p-6 md:p-10">
                                {article.categories.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {article.categories.map((cat) => (
                                            <Link
                                                key={cat.slug}
                                                href={blog.index({
                                                    query: {
                                                        category: cat.slug,
                                                    },
                                                })}
                                                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-80"
                                            >
                                                {cat.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <h1 className="text-title md:text-display leading-tight md:leading-tight">
                                    {article.title}
                                </h1>

                                {/* 元信息栏 */}
                                <div className="text-footnote mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border/40 pt-5 text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                        {article.author_avatar ? (
                                            <img
                                                src={article.author_avatar}
                                                alt={article.author_name}
                                                className="h-6 w-6 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                {(article.author_name || 'A')
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                        )}
                                        {article.author_name}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {article.created_at}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5" />
                                        {t('articlePage.readTime', {
                                            count: article.reading_time,
                                        })}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5" />
                                        {t('publicComment.views', {
                                            count: article.views,
                                        })}
                                    </span>
                                    <a
                                        href="#comments"
                                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        {t('publicComment.commentsCount', {
                                            count: article.comment_count,
                                        })}
                                    </a>
                                </div>
                            </header>

                            {/* 正文 */}
                            <div
                                ref={contentRef}
                                className="apple-card mt-5 px-6 py-8 md:px-10 md:py-10"
                            >
                                {article.content &&
                                article.content.length > 0 ? (
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{
                                            __html: contentHtml,
                                        }}
                                    />
                                ) : (
                                    <p className="text-muted-foreground">
                                        {t('articlePage.noContent')}
                                    </p>
                                )}

                                {/* 标签 */}
                                {article.tags.length > 0 && (
                                    <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border/40 pt-6">
                                        {article.tags.map((tag) => (
                                            <Link
                                                key={tag.slug}
                                                href={blog.index({
                                                    query: { tag: tag.slug },
                                                })}
                                                className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                            >
                                                #{tag.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </article>

                        {/* 点赞 */}
                        <div className="mt-5 flex justify-center">
                            <button
                                type="button"
                                onClick={() => void toggleLike()}
                                disabled={likeSending}
                                className={`apple-press flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
                                    liked
                                        ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                                        : 'border-border/60 bg-popover text-muted-foreground hover:border-rose-200 hover:text-rose-500 dark:hover:border-rose-500/30'
                                }`}
                                aria-pressed={liked}
                            >
                                <Heart
                                    className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400' : ''}`}
                                />
                                {liked ? '已点赞' : '点赞'}
                                <span className="tabular-nums">{likes}</span>
                            </button>
                        </div>

                        {/* 评论：置于正文之后、上下篇之前 */}
                        <div className="mt-12">
                            <CommentSection
                                articleId={article.id}
                                comments={comments}
                                captcha={captcha}
                                smileyGroups={smileyGroups}
                                commentStatus={article.comment_status}
                            />
                        </div>

                        {/* 上一篇 / 下一篇 */}
                        {(prevArticle || nextArticle) && (
                            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {prevArticle ? (
                                    <Link
                                        href={prevArticle.permalink}
                                        className="apple-card apple-press hover-glow group flex items-center gap-3 p-5"
                                    >
                                        <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-footnote text-muted-foreground">
                                                {t('articlePage.prev')}
                                            </p>
                                            <p className="mt-0.5 line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
                                                {prevArticle.title}
                                            </p>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="hidden sm:block" />
                                )}
                                {nextArticle && (
                                    <Link
                                        href={nextArticle.permalink}
                                        className="apple-card apple-press hover-glow group flex items-center justify-end gap-3 p-5 text-right"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-footnote text-muted-foreground">
                                                {t('articlePage.next')}
                                            </p>
                                            <p className="mt-0.5 line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
                                                {nextArticle.title}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* 相关文章 */}
                        {relatedArticles.length > 0 && (
                            <div className="mt-12">
                                <h2 className="text-title mb-5">
                                    {t('articlePage.related')}
                                </h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {relatedArticles.map((r) => (
                                        <Link
                                            key={r.id}
                                            href={r.permalink}
                                            className="apple-card apple-press hover-glow group p-5"
                                        >
                                            <h3 className="text-headline line-clamp-2 transition-colors group-hover:text-primary">
                                                {r.title}
                                            </h3>
                                            <span className="text-footnote mt-2 text-muted-foreground">
                                                {r.created_at}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

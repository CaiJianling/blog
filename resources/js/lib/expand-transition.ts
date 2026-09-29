import { router } from '@inertiajs/react';

/**
 * 列表卡片 ↔ 详情页头部的「展开 / 缩回」过渡（View Transitions）。
 *
 * 前进去程：点击的卡片与详情页头部挂同一个 view-transition-name，浏览器把两者的
 * 盒子做形变、内容交叉淡入，视觉上就是卡片长成页面头部（文章页与说说页共用）。
 * 返回路程：浏览器后退时把列表里那张原卡片重新命名，于是头部再缩回它原来的位置。
 */
export const EXPAND_TRANSITION_NAME = 'expand-card';

/** 卡片上的来源标记：后退时靠它找回「当初那一张」，值用详情页的 permalink。 */
export const EXPAND_SOURCE_ATTR = 'data-expand-source';

/** 详情页头部的标记属性，值是该页 permalink（既作存在标记，也作身份标识）。 */
export const EXPAND_TARGET_ATTR = 'data-expand-target';

const ORIGIN_KEY = 'expandTransitionOrigin';

/**
 * 等待新页面出现的上限：超过它就不再等（退化成普通切换）。
 * 快机器上轮询几十毫秒就命中，这个值只在慢设备/长正文上起作用：
 * 太短会配不上对（看不到动画），太长点击会像没反应。
 */
const MAX_WAIT_MS = 900;

/** 出发位置：后退时要把卡片找回来并滚到同一处。 */
type TransitionOrigin = {
    permalink: string;
    /** 来源卡片的 data-expand-source 值（列表翻页后可能已经找不到）。 */
    sourceKey: string;
    listUrl: string;
    scrollY: number;
};

/** 同一时刻只允许一个元素持有过渡名，记录上一个以便清理（同名元素会打断过渡）。 */
let namedCard: HTMLElement | null = null;
let popstateInstalled = false;

function canAnimate(): boolean {
    if (typeof document.startViewTransition !== 'function') {
        return false;
    }

    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function readOrigin(): TransitionOrigin | null {
    try {
        const raw = window.sessionStorage.getItem(ORIGIN_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<TransitionOrigin>;

        if (
            typeof parsed.permalink !== 'string' ||
            typeof parsed.sourceKey !== 'string' ||
            typeof parsed.listUrl !== 'string' ||
            typeof parsed.scrollY !== 'number'
        ) {
            return null;
        }

        return {
            permalink: parsed.permalink,
            sourceKey: parsed.sourceKey,
            listUrl: parsed.listUrl,
            scrollY: parsed.scrollY,
        };
    } catch {
        return null;
    }
}

function saveOrigin(origin: TransitionOrigin): void {
    try {
        window.sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
    } catch {
        // 隐私模式下 sessionStorage 可能不可写，最多是没有反向动画
    }
}

function clearOrigin(): void {
    try {
        window.sessionStorage.removeItem(ORIGIN_KEY);
    } catch {
        // 同上
    }
}

/** 给元素挂过渡名，并清掉上一个还挂着名字的卡片。 */
function nameCard(card: HTMLElement): void {
    if (namedCard && namedCard !== card) {
        namedCard.style.viewTransitionName = '';
    }

    namedCard = card;
    card.style.viewTransitionName = EXPAND_TRANSITION_NAME;
}

function releaseCard(): void {
    if (namedCard) {
        namedCard.style.viewTransitionName = '';
        namedCard = null;
    }
}

/**
 * 播放一次过渡：先执行 kick 发起切换，随后每 16ms 问一次 ready，
 * ready 为真（或超时）后交还新快照。
 *
 * 轮询刻意用 setInterval 而不是 requestAnimationFrame：过渡抓取阶段文档渲染被挂起，
 * rAF 可能一直不回来，回调 Promise 就会永远悬着（实测会让整次过渡卡死）。
 */
function runTransition(kick: () => void, ready: () => boolean): void {
    void document
        .startViewTransition(
            () =>
                new Promise<void>((resolve) => {
                    let settled = false;
                    let stopListening = (): void => {};
                    let guard = 0;
                    let ticker = 0;

                    const finish = () => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        window.clearTimeout(guard);
                        window.clearInterval(ticker);
                        stopListening();
                        resolve();
                    };

                    const poll = () => {
                        if (ready()) {
                            finish();
                        }
                    };

                    guard = window.setTimeout(finish, MAX_WAIT_MS);
                    ticker = window.setInterval(poll, 16);
                    stopListening = router.on('navigate', poll);

                    kick();
                }),
        )
        .finished.finally(releaseCard);
}

/**
 * 接管一次「进入详情」的跳转并播放展开过渡。
 *
 * source 可以是卡片本身，也可以是卡片内部的链接（说说卡片里可点的是内部链接），
 * 会向上找最近的带 data-expand-source 的元素。
 *
 * 返回 true 表示跳转已在这里发起，调用方需要 preventDefault 掉 <Link> 的默认行为；
 * 返回 false 表示不播放（浏览器不支持或用户要求减少动效），交给 <Link> 普通跳转。
 */
export function beginExpandTransition(source: Element, href: string): boolean {
    const card = source.closest(`[${EXPAND_SOURCE_ATTR}]`) ?? source;

    if (!(card instanceof HTMLElement) || !canAnimate()) {
        return false;
    }

    nameCard(card);
    saveOrigin({
        permalink: href,
        sourceKey: card.getAttribute(EXPAND_SOURCE_ATTR) ?? href,
        listUrl: window.location.pathname + window.location.search,
        scrollY: window.scrollY,
    });

    runTransition(
        () => router.visit(href),
        // 详情页头部已经渲染出来才能配成对，否则只剩整页交叉淡入
        () => !!document.querySelector(`[${EXPAND_TARGET_ATTR}]`),
    );

    return true;
}

/**
 * 浏览器后退离开详情页：把列表里原来的卡片重新命名，头部就缩回它的位置。
 *
 * 只接管「从详情页退回它来源的那个列表」这一种历史跳转；对不上的情况
 * （换过列表页、卡片已被翻页换掉、深链进来再后退）一律放行，走普通切换。
 */
function handlePopState(): void {
    if (!canAnimate()) {
        return;
    }

    const leaving = document.querySelector(`[${EXPAND_TARGET_ATTR}]`);
    const permalink = leaving?.getAttribute(EXPAND_TARGET_ATTR) ?? '';
    const origin = readOrigin();

    if (
        !leaving ||
        !origin ||
        permalink !== origin.permalink ||
        window.location.pathname + window.location.search !== origin.listUrl
    ) {
        clearOrigin();

        return;
    }

    const targetScrollY = origin.scrollY;

    runTransition(
        // 后退由浏览器与 Inertia 自己完成，这里只负责等待新快照就位
        () => undefined,
        () => {
            const card = document.querySelector(
                `[${EXPAND_SOURCE_ATTR}="${CSS.escape(origin.sourceKey)}"]`,
            );

            if (!(card instanceof HTMLElement)) {
                return false;
            }

            nameCard(card);

            // 强制样式重算：resolve 之后浏览器立刻抓新快照，
            // 刚写上的过渡名必须已经生效，否则配不上对
            void getComputedStyle(card).viewTransitionName;

            // 不等 Inertia 自己恢复滚动（它可能在抓快照之后才滚），自己滚回原位；
            // 位置没落定就继续轮询，否则缩回会落到屏幕外
            if (Math.abs(window.scrollY - targetScrollY) >= 4) {
                window.scrollTo(0, targetScrollY);

                return false;
            }

            return true;
        },
    );

    clearOrigin();
}

if (typeof window !== 'undefined' && !popstateInstalled) {
    popstateInstalled = true;
    window.addEventListener('popstate', handlePopState);
}

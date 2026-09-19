import { usePage } from '@inertiajs/react';
import { useCallback, useState } from 'react';

/** 游客点赞状态记录在浏览器本地。 */
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

/**
 * 文章/说说点赞：登录用户直接记录，游客按 guestId 限流并把状态存本地。
 */
export function useArticleLike(
    articleId: number,
    initialLikes: number,
    initialLiked: boolean | null,
) {
    const isLoggedIn = !!usePage().props.auth?.user;
    const [likes, setLikes] = useState(initialLikes);
    const [liked, setLiked] = useState<boolean>(
        initialLiked ?? readGuestLiked(articleId),
    );
    const [sending, setSending] = useState(false);

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
        if (sending) {
            return;
        }

        setSending(true);

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

            const response = await fetch(`/articles/${articleId}/like`, {
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
                          ...likedList.filter((id: number) => id !== articleId),
                          articleId,
                      ]
                    : likedList.filter((id: number) => id !== articleId);

                localStorage.setItem(
                    'blog-liked-articles',
                    JSON.stringify(next),
                );
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    return { likes, liked, sending, toggleLike };
}

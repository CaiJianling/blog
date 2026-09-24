import {
    Copy,
    Facebook,
    Loader2,
    MessageCircle,
    Share2,
    Star,
    Twitter,
    Globe,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';

/**
 * 文章底部分享条：复制「标题 + 链接」、微信（悬浮二维码）、微博、QQ 空间、X、Facebook，
 * 以及在支持的设备上调用系统分享面板。
 *
 * 除微信外的平台都走各自的网页分享入口（无需 App Key）；微信没有网页分享接口，
 * 只能扫码，因此二维码在本地用 qrcode 生成，不把文章地址交给任何第三方服务。
 */
export default function ArticleShare({
    permalink,
    title,
}: {
    permalink: string;
    title: string;
}) {
    const { t } = useTranslation();
    const [qr, setQr] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const qrRequested = useRef(false);

    // 分享必须用绝对地址，写法与 lib/seo.tsx 一致（无 SSR 阶段时留空）
    const shareUrl =
        typeof window !== 'undefined'
            ? window.location.origin + permalink
            : permalink;
    const canNativeShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function';

    const loadQr = async () => {
        if (qrRequested.current || qr !== '') {
            return;
        }

        qrRequested.current = true;
        setQrLoading(true);

        try {
            setQr(
                await QRCode.toDataURL(shareUrl, {
                    margin: 1,
                    width: 148,
                    errorCorrectionLevel: 'M',
                }),
            );
        } catch {
            // 生成失败时保留提示文案，作者仍可用「复制链接」
            qrRequested.current = false;
        } finally {
            setQrLoading(false);
        }
    };

    const copyTitleAndLink = async () => {
        const ok = await copyToClipboard(`${title}\n${shareUrl}`);

        toast(
            ok
                ? t('articlePage.share.copied')
                : t('articlePage.share.copyFailed'),
        );
    };

    const openShare = (target: string) => {
        window.open(
            target,
            '_blank',
            'noopener,noreferrer,width=680,height=560',
        );
    };

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);

    const channels = [
        {
            key: 'weibo',
            label: t('articlePage.share.weibo'),
            icon: Globe,
            href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}`,
        },
        {
            key: 'qzone',
            label: t('articlePage.share.qzone'),
            icon: Star,
            href: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodedUrl}&title=${encodedTitle}`,
        },
        {
            key: 'x',
            label: t('articlePage.share.x'),
            icon: Twitter,
            href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
        },
        {
            key: 'facebook',
            label: t('articlePage.share.facebook'),
            icon: Facebook,
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        },
    ];

    return (
        <div className="apple-card mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-3">
            <span className="text-callout text-muted-foreground">
                {t('articlePage.share.title')}
            </span>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyTitleAndLink()}
                className="h-8 gap-1.5 rounded-full px-3 text-xs"
            >
                <Copy className="h-3.5 w-3.5" />
                {t('articlePage.share.copy')}
            </Button>

            {/* 微信：悬停/键盘聚焦时显示扫码分享面板 */}
            <div
                className="group relative"
                onMouseEnter={() => void loadQr()}
                onFocus={() => void loadQr()}
            >
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full px-3 text-xs"
                >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t('articlePage.share.wechat')}
                </Button>
                <div className="invisible absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="apple-card flex w-44 flex-col items-center gap-2 p-3">
                        {/* 二维码必须是浅底深码，否则深色模式下扫不出来 */}
                        <div className="flex h-[148px] w-[148px] items-center justify-center rounded-lg bg-white">
                            {qr ? (
                                <img
                                    src={qr}
                                    alt={t('articlePage.share.wechat')}
                                    className="h-full w-full"
                                />
                            ) : qrLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : null}
                        </div>
                        <p className="text-tertiary-label text-center text-xs">
                            {t('articlePage.share.wechatHint')}
                        </p>
                    </div>
                </div>
            </div>

            {channels.map((channel) => (
                <Button
                    key={channel.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openShare(channel.href)}
                    className="h-8 gap-1.5 rounded-full px-3 text-xs"
                >
                    <channel.icon className="h-3.5 w-3.5" />
                    {channel.label}
                </Button>
            ))}

            {canNativeShare && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        void navigator
                            .share({ title, url: shareUrl })
                            .catch(() => undefined)
                    }
                    className="h-8 gap-1.5 rounded-full px-3 text-xs"
                >
                    <Share2 className="h-3.5 w-3.5" />
                    {t('articlePage.share.system')}
                </Button>
            )}
        </div>
    );
}

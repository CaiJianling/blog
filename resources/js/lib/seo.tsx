import type { ReactElement } from 'react';
import type { SiteSeo } from '@/types/global';

export interface SeoMetaOptions {
    /** 站点级 SEO（来自共享 props）。 */
    site: SiteSeo;
    /** 页面标题，缺省回退到站点标题。 */
    title?: string;
    /** 页面描述，缺省回退到站点描述。 */
    description?: string;
    /** 页面关键词，缺省回退到站点关键词。 */
    keywords?: string;
    /** 页面绝对 URL（用于 canonical / og:url），缺省使用当前地址。 */
    url?: string;
    /** OpenGraph 类型，默认 website，文章页传 article。 */
    type?: 'website' | 'article';
}

function currentUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
}

/**
 * 统一生成 description / keywords / canonical / OpenGraph / Twitter 标签数组。
 *
 * 返回 React 元素数组，直接作为 <Head> 的 children 传入即可，
 * 由 Inertia Head 渲染为真实 <meta> / <link> 标签。
 */
export function buildSeoMeta({
    site,
    title,
    description,
    keywords,
    url,
    type = 'website',
}: SeoMetaOptions): ReactElement[] {
    const pageTitle = title?.trim() || site.title;
    const pageDescription = description?.trim() || site.description;
    const pageKeywords =
        keywords !== undefined ? keywords.trim() : site.keywords;
    const canonicalUrl = url ?? currentUrl();

    const tags: ReactElement[] = [];

    if (pageDescription) {
        tags.push(
            <meta
                key="description"
                name="description"
                content={pageDescription}
            />,
        );
    }

    if (pageKeywords) {
        tags.push(
            <meta key="keywords" name="keywords" content={pageKeywords} />,
        );
    }

    if (canonicalUrl) {
        tags.push(<link key="canonical" rel="canonical" href={canonicalUrl} />);
    }

    // OpenGraph
    tags.push(<meta key="og:title" property="og:title" content={pageTitle} />);

    if (pageDescription) {
        tags.push(
            <meta
                key="og:description"
                property="og:description"
                content={pageDescription}
            />,
        );
    }

    tags.push(<meta key="og:type" property="og:type" content={type} />);
    tags.push(
        <meta
            key="og:site_name"
            property="og:site_name"
            content={site.title}
        />,
    );

    if (canonicalUrl) {
        tags.push(
            <meta key="og:url" property="og:url" content={canonicalUrl} />,
        );
    }

    // Twitter Card
    tags.push(
        <meta key="twitter:card" name="twitter:card" content="summary" />,
    );
    tags.push(
        <meta key="twitter:title" name="twitter:title" content={pageTitle} />,
    );

    if (pageDescription) {
        tags.push(
            <meta
                key="twitter:description"
                name="twitter:description"
                content={pageDescription}
            />,
        );
    }

    return tags;
}

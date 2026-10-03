import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeft, MousePointerClick } from 'lucide-react';
import Base64Tool from '@/components/tools/Base64Tool';
import CaseConverter from '@/components/tools/CaseConverter';
import ColorConverter from '@/components/tools/ColorConverter';
import DiffChecker from '@/components/tools/DiffChecker';
import HashGenerator from '@/components/tools/HashGenerator';
import ImageToBase64 from '@/components/tools/ImageToBase64';
import JsonFormatter from '@/components/tools/JsonFormatter';
import JwtDecoder from '@/components/tools/JwtDecoder';
import MarkdownPreview from '@/components/tools/MarkdownPreview';
import PasswordGenerator from '@/components/tools/PasswordGenerator';
import RadixConverter from '@/components/tools/RadixConverter';
import RegexTester from '@/components/tools/RegexTester';
import SqlFormatter from '@/components/tools/SqlFormatter';
import TextCounter from '@/components/tools/TextCounter';
import TimestampConverter from '@/components/tools/TimestampConverter';
import UnitConverter from '@/components/tools/UnitConverter';
import UrlEncoder from '@/components/tools/UrlEncoder';
import UuidGenerator from '@/components/tools/UuidGenerator';
import XmlFormatter from '@/components/tools/XmlFormatter';
import { buildSeoMeta } from '@/lib/seo';
import { formatCount } from '@/lib/utils';
import tools from '@/routes/tools';
import type { SiteSeo } from '@/types/global';

type Tool = {
    slug: string;
    name: string;
    description: string;
    icon: string;
    clicks: number;
};

type Props = {
    tool: Tool;
    category: string;
    /** 后台「工具设置」里该工具的名称与描述拼出的本页 SEO 文案。 */
    meta: SiteSeo;
};

const toolMap: Record<string, React.FC> = {
    'json-formatter': JsonFormatter,
    'xml-formatter': XmlFormatter,
    'hash-generator': HashGenerator,
    base64: Base64Tool,
    'url-encoder': UrlEncoder,
    'text-counter': TextCounter,
    'regex-tester': RegexTester,
    'diff-checker': DiffChecker,
    'case-converter': CaseConverter,
    timestamp: TimestampConverter,
    'sql-formatter': SqlFormatter,
    'unit-converter': UnitConverter,
    'markdown-preview': MarkdownPreview,
    'password-generator': PasswordGenerator,
    'uuid-generator': UuidGenerator,
    'radix-converter': RadixConverter,
    'jwt-decoder': JwtDecoder,
    'color-converter': ColorConverter,
    'image-to-base64': ImageToBase64,
};

export default function Show({ tool, category, meta }: Props) {
    const seo = usePage().props.seo;
    const ToolComponent = toolMap[tool.slug];

    return (
        <>
            <Head title={meta.title}>
                {buildSeoMeta({
                    site: seo,
                    title: meta.title,
                    description: meta.description || undefined,
                    keywords: meta.keywords || undefined,
                })}
            </Head>

            <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
                {/* 返回工具列表 */}
                <Link
                    href={tools.index()}
                    prefetch
                    className="apple-press inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    返回工具列表
                </Link>

                <header className="apple-card mt-6 mb-8 p-6 md:p-8">
                    <span className="text-footnote text-muted-foreground">
                        {category}
                    </span>
                    <h1 className="text-display mt-1">{tool.name}</h1>
                    <p className="text-body mt-2 text-muted-foreground">
                        {tool.description}
                    </p>
                    <p className="text-footnote mt-3 flex items-center gap-1.5 text-muted-foreground/80">
                        <MousePointerClick className="h-3.5 w-3.5" />
                        累计使用 {formatCount(tool.clicks ?? 0)} 次
                    </p>
                </header>

                <div className="apple-card p-6 md:p-8">
                    {ToolComponent ? (
                        <ToolComponent />
                    ) : (
                        <ComingSoon name={tool.name} />
                    )}
                </div>
            </div>
        </>
    );
}

function ComingSoon({ name }: { name: string }) {
    return (
        <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <span className="text-2xl">🚧</span>
            </div>
            <h2 className="text-title">{name} 即将上线</h2>
            <p className="mt-2 text-muted-foreground">
                该工具正在开发中，敬请期待。
            </p>
        </div>
    );
}

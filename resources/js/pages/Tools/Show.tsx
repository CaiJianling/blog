import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, MousePointerClick } from 'lucide-react';
import { formatCount } from '@/lib/utils';
import tools from '@/routes/tools';
import JsonFormatter from '@/components/tools/JsonFormatter';
import XmlFormatter from '@/components/tools/XmlFormatter';
import HashGenerator from '@/components/tools/HashGenerator';
import Base64Tool from '@/components/tools/Base64Tool';
import UrlEncoder from '@/components/tools/UrlEncoder';
import TextCounter from '@/components/tools/TextCounter';
import RegexTester from '@/components/tools/RegexTester';
import DiffChecker from '@/components/tools/DiffChecker';
import CaseConverter from '@/components/tools/CaseConverter';
import TimestampConverter from '@/components/tools/TimestampConverter';
import SqlFormatter from '@/components/tools/SqlFormatter';
import UnitConverter from '@/components/tools/UnitConverter';
import MarkdownPreview from '@/components/tools/MarkdownPreview';
import PasswordGenerator from '@/components/tools/PasswordGenerator';
import UuidGenerator from '@/components/tools/UuidGenerator';
import RadixConverter from '@/components/tools/RadixConverter';
import JwtDecoder from '@/components/tools/JwtDecoder';
import ColorConverter from '@/components/tools/ColorConverter';
import ImageToBase64 from '@/components/tools/ImageToBase64';

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
};

const toolMap: Record<string, React.FC> = {
    'json-formatter': JsonFormatter,
    'xml-formatter': XmlFormatter,
    'hash-generator': HashGenerator,
    'base64': Base64Tool,
    'url-encoder': UrlEncoder,
    'text-counter': TextCounter,
    'regex-tester': RegexTester,
    'diff-checker': DiffChecker,
    'case-converter': CaseConverter,
    'timestamp': TimestampConverter,
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

export default function Show({ tool, category }: Props) {
    const ToolComponent = toolMap[tool.slug];

    return (
        <>
            <Head title={`${tool.name} - 在线工具`} />

            <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
                <Link
                    href={tools.index()}
                    className="apple-press inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    返回工具列表
                </Link>

                <header className="mt-6 mb-8">
                    <span className="text-footnote text-muted-foreground">{category}</span>
                    <h1 className="mt-1 text-display">{tool.name}</h1>
                    <p className="mt-2 text-body text-muted-foreground">{tool.description}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-footnote text-muted-foreground/80">
                        <MousePointerClick className="h-3.5 w-3.5" />
                        累计使用 {formatCount(tool.clicks ?? 0)} 次
                    </p>
                </header>

                <div className="apple-card p-6 md:p-8">
                    {ToolComponent ? <ToolComponent /> : <ComingSoon name={tool.name} />}
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
            <p className="mt-2 text-muted-foreground">该工具正在开发中，敬请期待。</p>
        </div>
    );
}

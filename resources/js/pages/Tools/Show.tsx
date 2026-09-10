import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
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

type Tool = {
    slug: string;
    name: string;
    description: string;
    icon: string;
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

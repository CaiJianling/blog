import { useMemo } from 'react';
import { highlightCode, type CodeLang } from '@/lib/code-highlight';

interface HighlightedCodeProps {
    code: string;
    lang: CodeLang;
    className?: string;
}

/** 工具输出高亮代码块（只读）。 */
export default function HighlightedCode({ code, lang, className = '' }: HighlightedCodeProps) {
    const html = useMemo(() => highlightCode(code, lang), [code, lang]);

    if (code === '') {
        return (
            <div
                className={`flex h-80 items-start rounded-2xl border border-input p-4 font-mono text-sm text-muted-foreground ${className}`}
            >
                格式化结果将显示在这里
            </div>
        );
    }

    return (
        <pre
            className={`h-80 overflow-auto rounded-2xl border border-input bg-muted/40 p-4 font-mono text-sm leading-relaxed ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

import { useMemo, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SAMPLE = '# 标题\n\n这是一段 **Markdown** 示例文本。\n\n- 列表项一\n- 列表项二\n\n> 引用内容\n\n```js\nconst hello = "world";\n```\n\n[链接](https://example.com) 与 `行内代码`。';

export default function MarkdownPreview() {
    const [text, setText] = useState(SAMPLE);
    const [view, setView] = useState<'split' | 'edit' | 'preview'>('split');

    const html = useMemo(() => renderMarkdown(text), [text]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                {([
                    ['split', '分屏'],
                    ['edit', '编辑'],
                    ['preview', '预览'],
                ] as const).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setView(key)}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-sm transition-colors',
                            view === key
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className={cn('grid gap-4', view === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
                {view !== 'preview' && (
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="输入 Markdown..."
                        className="min-h-[22rem] font-mono text-sm"
                    />
                )}
                {view !== 'edit' && (
                    <div className="min-h-[22rem] overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-4">
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-pre:bg-muted"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

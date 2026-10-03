import { useState, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export default function RegexTester() {
    const [pattern, setPattern] = useState('');
    const [flags, setFlags] = useState('g');
    const [text, setText] = useState('');
    const [error, setError] = useState('');

    const result = useMemo(() => {
        if (!pattern) return { matches: [], groups: [] };
        try {
            const re = new RegExp(pattern, flags);
            const matches = [...text.matchAll(re)];
            setError('');
            return { matches, groups: matches.flatMap((m) => m.slice(1)) };
        } catch (e) {
            setError(e instanceof Error ? e.message : '正则表达式错误');
            return { matches: [], groups: [] };
        }
    }, [pattern, flags, text]);

    const flagOptions = ['g', 'i', 'm', 's', 'u', 'y'];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-muted-foreground">/</span>
                    <Input
                        value={pattern}
                        onChange={(e) => setPattern(e.target.value)}
                        placeholder="正则表达式"
                        className="font-mono"
                    />
                    <span className="text-muted-foreground">/</span>
                </div>
                <div className="flex gap-1">
                    {flagOptions.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFlags((prev) => (prev.includes(f) ? prev.replace(f, '') : prev + f))}
                            className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                                flags.includes(f) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70 hover:bg-accent'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium">测试文本</label>
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="输入要测试的文本..."
                        className="h-56 font-mono text-sm"
                    />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium">
                        匹配结果 ({result.matches.length})
                    </label>
                    <div className="h-56 overflow-auto rounded-2xl border border-border/60 bg-background/50 p-4">
                        {result.matches.length === 0 ? (
                            <p className="text-sm text-muted-foreground">无匹配</p>
                        ) : (
                            <div className="space-y-2">
                                {result.matches.map((m, i) => (
                                    <div key={i} className="rounded-lg bg-accent/40 p-2 font-mono text-sm">
                                        <span className="text-muted-foreground">#{i + 1}</span>{' '}
                                        <span className="break-all">{m[0]}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

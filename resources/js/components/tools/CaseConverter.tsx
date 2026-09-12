import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy } from 'lucide-react';

type CaseStyle = 'camel' | 'pascal' | 'snake' | 'kebab' | 'upper' | 'lower' | 'title';

const styles: { key: CaseStyle; label: string; sample: string }[] = [
    { key: 'camel', label: 'camelCase', sample: 'helloWorld' },
    { key: 'pascal', label: 'PascalCase', sample: 'HelloWorld' },
    { key: 'snake', label: 'snake_case', sample: 'hello_world' },
    { key: 'kebab', label: 'kebab-case', sample: 'hello-world' },
    { key: 'upper', label: 'UPPER CASE', sample: 'HELLO WORLD' },
    { key: 'lower', label: 'lower case', sample: 'hello world' },
    { key: 'title', label: 'Title Case', sample: 'Hello World' },
];

function toWords(input: string): string[] {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase());
}

function convert(input: string, style: CaseStyle): string {
    const words = toWords(input);
    if (words.length === 0) return '';
    switch (style) {
        case 'camel':
            return words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        case 'pascal':
            return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        case 'snake':
            return words.join('_');
        case 'kebab':
            return words.join('-');
        case 'upper':
            return input.toUpperCase();
        case 'lower':
            return input.toLowerCase();
        case 'title':
            return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}

export default function CaseConverter() {
    const [input, setInput] = useState('');
    const [selected, setSelected] = useState<CaseStyle>('camel');
    const [copied, setCopied] = useState('');

    const copy = async (text: string, key: string) => {
        if (!text || !(await copyToClipboard(text))) {
            toast.error('复制失败，请手动选择文本复制');

            return;
        }

        setCopied(key);
        setTimeout(() => setCopied(''), 1500);
    };

    return (
        <div className="space-y-5">
            <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入文本，例如 hello_world 或 HelloWorld..."
                className="h-32 font-mono text-sm"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {styles.map((s) => {
                    const result = input ? convert(input, s.key) : '';
                    const copiedThis = copied === s.key;

                    return (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setSelected(s.key)}
                            className={`apple-press relative rounded-2xl border p-4 text-left transition-colors ${
                                selected === s.key ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted'
                            }`}
                        >
                            <p className="text-sm font-semibold">{s.label}</p>
                            <p className="mt-1 break-all pr-5 font-mono text-xs text-muted-foreground">
                                {input ? result : s.sample}
                            </p>
                            {result && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void copy(result, s.key);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.stopPropagation();
                                            void copy(result, s.key);
                                        }
                                    }}
                                    className={`absolute right-2 top-2 transition-colors ${
                                        copiedThis ? 'text-emerald-500' : 'text-muted-foreground/60 hover:text-primary'
                                    }`}
                                    aria-label={`复制 ${s.label} 结果`}
                                    title="复制"
                                >
                                    {copiedThis ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {input && (
                <div className="apple-card p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-footnote text-muted-foreground">
                            当前结果 ({styles.find((s) => s.key === selected)?.label})
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void copy(convert(input, selected), `main-${selected}`)}
                        >
                            {copied === `main-${selected}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            复制
                        </Button>
                    </div>
                    <p className="mt-1 break-all font-mono text-lg font-semibold">{convert(input, selected)}</p>
                </div>
            )}
        </div>
    );
}

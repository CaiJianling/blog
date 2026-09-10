import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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

    return (
        <div className="space-y-5">
            <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入文本，例如 hello_world 或 HelloWorld..."
                className="h-32 font-mono text-sm"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {styles.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => setSelected(s.key)}
                        className={`apple-press rounded-2xl border p-4 text-left transition-colors ${
                            selected === s.key ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted'
                        }`}
                    >
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {input ? convert(input, s.key) : s.sample}
                        </p>
                    </button>
                ))}
            </div>
            {input && (
                <div className="apple-card p-4">
                    <p className="text-footnote text-muted-foreground">当前结果 ({styles.find((s) => s.key === selected)?.label})</p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold">{convert(input, selected)}</p>
                </div>
            )}
        </div>
    );
}

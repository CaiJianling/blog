import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BASES = [
    { value: 2, label: '二进制' },
    { value: 8, label: '八进制' },
    { value: 10, label: '十进制' },
    { value: 16, label: '十六进制' },
];

const DIGIT_RE: Record<number, RegExp> = {
    2: /^[01]+$/,
    8: /^[0-7]+$/,
    10: /^[0-9]+$/,
    16: /^[0-9a-fA-F]+$/,
};

export default function RadixConverter() {
    const [fromBase, setFromBase] = useState(10);
    const [raw, setRaw] = useState('');

    const value = raw.trim();
    const valid = value !== '' && (DIGIT_RE[fromBase]?.test(value) ?? false);
    const parsed = valid ? Number.parseInt(value, fromBase) : null;
    const outOfRange = parsed !== null && (parsed > Number.MAX_SAFE_INTEGER || parsed < Number.MIN_SAFE_INTEGER);

    const results = BASES.filter((b) => b.value !== fromBase).map((b) => ({
        ...b,
        text: parsed === null || outOfRange ? '—' : parsed.toString(b.value),
    }));

    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label>输入进制</Label>
                    <select
                        value={fromBase}
                        onChange={(e) => setFromBase(Number(e.target.value))}
                        className="h-10 cursor-pointer rounded-2xl border border-border/60 bg-background/50 px-3 text-sm outline-none"
                    >
                        {BASES.map((b) => (
                            <option key={b.value} value={b.value}>
                                {b.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="radix-input">数值</Label>
                    <Input
                        id="radix-input"
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        placeholder={fromBase === 16 ? '例如：ff' : '例如：255'}
                        className="font-mono"
                    />
                </div>
            </div>

            {value !== '' && !valid && (
                <p className="text-sm text-destructive">输入格式不符合所选进制，请检查。</p>
            )}
            {outOfRange && (
                <p className="text-sm text-destructive">数值超出安全整数范围，结果可能不准确。</p>
            )}

            <div className="space-y-2">
                {results.map((r) => (
                    <div key={r.value} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                        <span className="text-footnote text-muted-foreground">{r.label}</span>
                        <span className="font-mono text-sm break-all">{r.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

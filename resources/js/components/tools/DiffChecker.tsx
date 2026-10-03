import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function DiffChecker() {
    const [left, setLeft] = useState('');
    const [right, setRight] = useState('');

    const diff = useMemo(() => {
        const a = left.split('\n');
        const b = right.split('\n');
        const max = Math.max(a.length, b.length);
        const rows = [];
        for (let i = 0; i < max; i++) {
            const la = a[i] ?? '';
            const lb = b[i] ?? '';
            rows.push({ left: la, right: lb, same: la === lb });
        }
        return rows;
    }, [left, right]);

    const sample = () => {
        setLeft('line 1\nline 2 changed\nline 3\nline 4');
        setRight('line 1\nline 2 modified\nline 3\nline 4 new');
    };

    return (
        <div className="space-y-5">
            <div className="flex gap-2">
                <Button variant="outline" onClick={sample}>示例</Button>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Textarea value={left} onChange={(e) => setLeft(e.target.value)} placeholder="原始文本" className="h-40 font-mono text-sm" />
                <Textarea value={right} onChange={(e) => setRight(e.target.value)} placeholder="对比文本" className="h-40 font-mono text-sm" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {(['left', 'right'] as const).map((side) => (
                    <div key={side} className="overflow-hidden rounded-2xl border border-border/60">
                        {diff.map((row, i) => (
                            <div
                                key={i}
                                className={`flex gap-2 px-3 py-1.5 font-mono text-sm ${
                                    row.same ? 'bg-background/50' : side === 'left' ? 'bg-destructive/10' : 'bg-chart-2/10'
                                }`}
                            >
                                <span className="w-8 shrink-0 text-right text-footnote text-muted-foreground">{i + 1}</span>
                                <span className="break-all whitespace-pre-wrap">{row[side]}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

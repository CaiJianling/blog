import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Category = 'length' | 'weight' | 'temperature' | 'storage';

const units: Record<Category, { name: string; toBase: (v: number) => number; fromBase: (v: number) => number }[]> = {
    length: [
        { name: '毫米 mm', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
        { name: '厘米 cm', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
        { name: '米 m', toBase: (v) => v, fromBase: (v) => v },
        { name: '千米 km', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
        { name: '英寸 in', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
        { name: '英尺 ft', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    ],
    weight: [
        { name: '毫克 mg', toBase: (v) => v / 1000000, fromBase: (v) => v * 1000000 },
        { name: '克 g', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
        { name: '千克 kg', toBase: (v) => v, fromBase: (v) => v },
        { name: '吨 t', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
        { name: '磅 lb', toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
    ],
    temperature: [
        { name: '摄氏度 °C', toBase: (v) => v, fromBase: (v) => v },
        { name: '华氏度 °F', toBase: (v) => (v - 32) / 1.8, fromBase: (v) => v * 1.8 + 32 },
        { name: '开尔文 K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
    storage: [
        { name: 'B', toBase: (v) => v, fromBase: (v) => v },
        { name: 'KB', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
        { name: 'MB', toBase: (v) => v * 1024 ** 2, fromBase: (v) => v / 1024 ** 2 },
        { name: 'GB', toBase: (v) => v * 1024 ** 3, fromBase: (v) => v / 1024 ** 3 },
        { name: 'TB', toBase: (v) => v * 1024 ** 4, fromBase: (v) => v / 1024 ** 4 },
    ],
};

const categoryNames: Record<Category, string> = {
    length: '长度',
    weight: '重量',
    temperature: '温度',
    storage: '存储',
};

export default function UnitConverter() {
    const [category, setCategory] = useState<Category>('length');
    const [value, setValue] = useState('1');
    const [fromIdx, setFromIdx] = useState(2);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const list = units[category];
    const base = useMemo(() => {
        const v = parseFloat(value);
        if (isNaN(v)) return null;
        return list[fromIdx].toBase(v);
    }, [value, fromIdx, list]);

    const copyValue = async (i: number, text: string) => {
        if (!(await copyToClipboard(text))) {
            toast.error('复制失败，请手动选择文本复制');

            return;
        }

        setCopiedIdx(i);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                {(Object.keys(units) as Category[]).map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => { setCategory(c); setFromIdx(0); }}
                        className={`apple-press rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            category === c ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                        }`}
                    >
                        {categoryNames[c]}
                    </button>
                ))}
            </div>

            <div className="flex gap-3">
                <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-40 font-mono" />
                <select
                    value={fromIdx}
                    onChange={(e) => setFromIdx(parseInt(e.target.value))}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm"
                >
                    {list.map((u, i) => (
                        <option key={i} value={i}>{u.name}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u, i) => {
                    const display = base !== null ? (i === fromIdx ? parseFloat(value) : parseFloat(u.fromBase(base).toFixed(6))) : null;
                    const copiedThis = copiedIdx === i;

                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => display !== null && void copyValue(i, String(display))}
                            disabled={display === null}
                            className={`apple-card apple-press relative p-4 text-left transition-colors ${
                                display !== null ? 'hover-glow' : 'cursor-default'
                            } ${copiedThis ? 'ring-2 ring-emerald-500/50' : ''}`}
                            title={display !== null ? '点击复制' : undefined}
                        >
                            <p className="text-footnote text-muted-foreground">{u.name}</p>
                            <p className="mt-1 flex items-center gap-1.5 font-mono text-lg font-semibold">
                                {display !== null ? display : '—'}
                                {copiedThis && <Check className="h-4 w-4 text-emerald-500" />}
                            </p>
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-muted-foreground">点击结果卡片即可复制数值。</p>
        </div>
    );
}

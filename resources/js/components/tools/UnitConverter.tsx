import { useState, useMemo } from 'react';
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

export default function UnitConverter() {
    const [category, setCategory] = useState<Category>('length');
    const [value, setValue] = useState('1');
    const [fromIdx, setFromIdx] = useState(2);

    const list = units[category];
    const base = useMemo(() => {
        const v = parseFloat(value);
        if (isNaN(v)) return null;
        return list[fromIdx].toBase(v);
    }, [value, fromIdx, list]);

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
                        {c === 'length' ? '长度' : c === 'weight' ? '重量' : c === 'temperature' ? '温度' : '存储'}
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
                {list.map((u, i) => (
                    <div key={i} className="apple-card p-4">
                        <p className="text-footnote text-muted-foreground">{u.name}</p>
                        <p className="mt-1 font-mono text-lg font-semibold">
                            {base !== null ? (i === fromIdx ? parseFloat(value) : parseFloat(u.fromBase(base).toFixed(6))) : '—'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());

    if (!m) {
        return null;
    }

    const n = Number.parseInt(m[1], 16);

    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
        const d = max - min;

        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        if (max === rn) {
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        } else if (max === gn) {
            h = ((bn - rn) / d + 2) * 60;
        } else {
            h = ((rn - gn) / d + 4) * 60;
        }
    }

    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const toHex = (n: number) => n.toString(16).padStart(2, '0');

export default function ColorConverter() {
    const [hex, setHex] = useState('#0071e3');
    const rgb = hexToRgb(hex);
    const hsl = rgb ? rgbToHsl(rgb) : null;
    const [copied, setCopied] = useState('');

    const rows = rgb && hsl
        ? [
            { label: 'HEX', value: `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}` },
            { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
            { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
        ]
        : [];

    const copy = async (text: string) => {
        if (await copyToClipboard(text)) {
            setCopied(text);
            setTimeout(() => setCopied(''), 1500);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-4">
                <input
                    type="color"
                    value={rgb ? hex.toLowerCase() : '#000000'}
                    onChange={(e) => setHex(e.target.value)}
                    className="h-14 w-14 shrink-0 cursor-pointer rounded-xl border border-border/70 bg-transparent p-1"
                    aria-label="取色器"
                />
                <div className="grid flex-1 gap-2">
                    <Label htmlFor="color-hex">HEX 颜色值</Label>
                    <Input
                        id="color-hex"
                        value={hex}
                        onChange={(e) => setHex(e.target.value)}
                        placeholder="#0071e3"
                        className="font-mono"
                    />
                    {hex.trim() !== '' && !rgb && (
                        <p className="text-sm text-destructive">格式不正确，应为 6 位十六进制（如 #0071e3）。</p>
                    )}
                </div>
            </div>

            {rgb && (
                <>
                    <div
                        className="flex h-24 items-center justify-center rounded-2xl border border-border/60 font-mono text-sm font-medium shadow-inner"
                        style={{ backgroundColor: hex.toLowerCase() }}
                    >
                        <span className={rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 150 ? 'text-black/70' : 'text-white/85'}>
                            颜色预览
                        </span>
                    </div>

                    <div className="space-y-2">
                        {rows.map((row) => (
                            <button
                                key={row.label}
                                type="button"
                                onClick={() => copy(row.value)}
                                className="apple-press flex w-full items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                            >
                                <span className="text-footnote text-muted-foreground">{row.label}</span>
                                <span className="flex items-center gap-2 font-mono text-sm">
                                    {row.value}
                                    {copied === row.value
                                        ? <Check className="h-4 w-4 text-emerald-500" />
                                        : <Copy className="h-4 w-4 text-muted-foreground" />}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

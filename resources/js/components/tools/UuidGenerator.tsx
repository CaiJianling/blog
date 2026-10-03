import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // 非安全上下文回退：基于 getRandomValues 拼装 v4 UUID
    const bytes = new Uint8Array(16);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function UuidGenerator() {
    const [count, setCount] = useState(5);
    const [list, setList] = useState<string[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const generate = () => {
        const n = Math.max(1, Math.min(50, count || 1));

        setList(Array.from({ length: n }, generateUuid));
        setCopiedIndex(null);
    };

    const copy = async (uuid: string, index: number) => {
        if (await copyToClipboard(uuid)) {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 1500);
        }
    };

    const copyAll = async () => {
        if (await copyToClipboard(list.join('\n'))) {
            toast.success('已复制全部 UUID。');
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-end gap-2">
                <div className="w-32">
                    <Input
                        type="number"
                        min={1}
                        max={50}
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                    />
                </div>
                <Button type="button" onClick={generate}>
                    <Sparkles className="h-4 w-4" />
                    生成
                </Button>
                {list.length > 0 && (
                    <Button type="button" variant="outline" onClick={copyAll}>
                        复制全部
                    </Button>
                )}
            </div>

            {list.length > 0 && (
                <div className="space-y-1.5">
                    {list.map((uuid, index) => (
                        <button
                            key={`${uuid}-${index}`}
                            type="button"
                            onClick={() => copy(uuid, index)}
                            className="apple-press flex w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-left font-mono text-sm transition-colors hover:bg-muted/50"
                        >
                            <span className="truncate">{uuid}</span>
                            {copiedIndex === index && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
                        </button>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground">点击单行即可复制；UUID 在浏览器本地生成（v4 随机）。</p>
        </div>
    );
}

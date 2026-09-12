import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy, Loader2, Wand2 } from 'lucide-react';

type HashResult = {
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
};

const ALGORITHMS: { key: keyof HashResult; label: string; webcrypto?: string }[] = [
    { key: 'md5', label: 'MD5' },
    { key: 'sha1', label: 'SHA-1', webcrypto: 'SHA-1' },
    { key: 'sha256', label: 'SHA-256', webcrypto: 'SHA-256' },
    { key: 'sha512', label: 'SHA-512', webcrypto: 'SHA-512' },
];

const EMPTY: HashResult = { md5: '', sha1: '', sha256: '', sha512: '' };

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 服务端兜底：HTTP 环境下 WebCrypto 不可用（且 WebCrypto 本身不支持 MD5）。 */
async function hashViaServer(text: string, algorithm: string): Promise<string> {
    const csrf =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ??
        decodeURIComponent(document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf;
    }

    const response = await fetch('/tools/hash', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, algorithm }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message ?? '计算失败');
    }

    return data.hash as string;
}

async function computeHash(algorithm: string, webcrypto: string | undefined, text: string): Promise<string> {
    // 优先使用本地 WebCrypto（仅安全上下文可用，且不支持 MD5）
    if (webcrypto && typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            return toHex(await crypto.subtle.digest(webcrypto, new TextEncoder().encode(text)));
        } catch {
            // 降级到服务端
        }
    }

    return hashViaServer(text, algorithm);
}

export default function HashGenerator() {
    const [input, setInput] = useState('');
    const [hashes, setHashes] = useState<HashResult>(EMPTY);
    const [copied, setCopied] = useState('');
    const [computing, setComputing] = useState(false);

    const generate = async () => {
        if (!input.trim() || computing) {
            return;
        }

        setComputing(true);
        setHashes(EMPTY);

        try {
            const entries = await Promise.all(
                ALGORITHMS.map(async ({ key, webcrypto }) => [key, await computeHash(key, webcrypto, input)] as const),
            );

            setHashes(Object.fromEntries(entries) as HashResult);
        } catch {
            setHashes({
                md5: '计算失败，请重试',
                sha1: '计算失败，请重试',
                sha256: '计算失败，请重试',
                sha512: '计算失败，请重试',
            });
        } finally {
            setComputing(false);
        }
    };

    const copy = async (text: string, key: string) => {
        if (!(await copyToClipboard(text))) {
            toast.error('复制失败，请手动选择文本复制');

            return;
        }

        setCopied(key);
        setTimeout(() => setCopied(''), 1500);
    };

    const sample = 'Hello, 世界';

    const rows = ALGORITHMS.map(({ key, label }) => ({
        label,
        value: hashes[key],
        key,
    }));

    return (
        <div className="space-y-5">
            <div>
                <label className="mb-2 block text-footnote font-medium">输入文本</label>
                <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入要生成哈希的文本..."
                    className="h-32 font-mono text-sm"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => void generate()} disabled={computing || !input.trim()}>
                    {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {computing ? '计算中…' : '生成'}
                </Button>
                <Button variant="outline" onClick={() => { setInput(sample); setHashes(EMPTY); }}>
                    示例
                </Button>
                <Button
                    variant="ghost"
                    onClick={async () => {
                        if (!(await copyToClipboard(rows.map((row) => `${row.label}: ${row.value}`).join('\n')))) {
                            toast.error('复制失败，请手动选择文本复制');

                            return;
                        }

                        setCopied('all');
                        setTimeout(() => setCopied(''), 1500);
                    }}
                    disabled={!hashes.md5}
                >
                    {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'all' ? '已复制全部' : '复制全部'}
                </Button>
            </div>
            <div className="space-y-3">
                {rows.map((row) => (
                    <div key={row.key} className="apple-card p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{row.label}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copy(row.value, row.key)}
                                disabled={!row.value}
                                aria-label={`复制 ${row.label}`}
                                title="复制"
                            >
                                {copied === row.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                        <p className="mt-2 break-all font-mono text-sm text-muted-foreground">
                            {computing ? '计算中…' : row.value || '—'}
                        </p>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                浏览器不支持本地计算时（HTTP 访问），将自动通过本站服务端计算，文本不会发送到第三方。
            </p>
        </div>
    );
}

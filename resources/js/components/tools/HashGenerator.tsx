import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy } from 'lucide-react';

type HashResult = {
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
};

export default function HashGenerator() {
    const [input, setInput] = useState('');
    const [hashes, setHashes] = useState<HashResult>({ md5: '', sha1: '', sha256: '', sha512: '' });
    const [copied, setCopied] = useState('');

    useEffect(() => {
        if (!input) {
            setHashes({ md5: '', sha1: '', sha256: '', sha512: '' });
            return;
        }
        (async () => {
            const data = new TextEncoder().encode(input);
            const [md5Buf, sha1Buf, sha256Buf, sha512Buf] = await Promise.all([
                crypto.subtle.digest('MD5', data).catch(() => null),
                crypto.subtle.digest('SHA-1', data),
                crypto.subtle.digest('SHA-256', data),
                crypto.subtle.digest('SHA-512', data),
            ]);
            setHashes({
                md5: md5Buf ? toHex(md5Buf) : '浏览器不支持 MD5',
                sha1: toHex(sha1Buf),
                sha256: toHex(sha256Buf),
                sha512: toHex(sha512Buf),
            });
        })();
    }, [input]);

    const toHex = (buf: ArrayBuffer): string =>
        Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const copy = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(''), 1500);
    };

    const rows = [
        { label: 'MD5', value: hashes.md5, key: 'md5' },
        { label: 'SHA-1', value: hashes.sha1, key: 'sha1' },
        { label: 'SHA-256', value: hashes.sha256, key: 'sha256' },
        { label: 'SHA-512', value: hashes.sha512, key: 'sha512' },
    ];

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
            <div className="space-y-3">
                {rows.map((row) => (
                    <div key={row.key} className="apple-card p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{row.label}</span>
                            {row.value && (
                                <Button variant="ghost" size="sm" onClick={() => copy(row.value, row.key)}>
                                    {copied === row.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                        </div>
                        <p className="mt-2 break-all font-mono text-sm text-muted-foreground">
                            {row.value || '—'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

function base64UrlDecode(segment: string): string {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

    return new TextDecoder().decode(bytes);
}

function prettyJson(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

export default function JwtDecoder() {
    const [token, setToken] = useState('');

    const parts = useMemo(() => token.trim().split('.'), [token]);

    const decoded = useMemo(() => {
        if (parts.length < 2 || parts.some((p) => p === '')) {
            return null;
        }

        try {
            return {
                header: prettyJson(base64UrlDecode(parts[0])),
                payload: prettyJson(base64UrlDecode(parts[1])),
            };
        } catch {
            return null;
        }
    }, [parts]);

    const expired = useMemo(() => {
        if (!decoded) {
            return false;
        }

        try {
            const payload = JSON.parse(decoded.payload) as { exp?: number };

            return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
        } catch {
            return false;
        }
    }, [decoded]);

    return (
        <div className="space-y-5">
            <div className="grid gap-2">
                <Label htmlFor="jwt-input">粘贴 JWT（本地解析，不会上传）</Label>
                <Textarea
                    id="jwt-input"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="min-h-[7rem] font-mono text-xs break-all"
                />
            </div>

            {token.trim() !== '' && !decoded && (
                <p className="text-sm text-destructive">无法解析：不是有效的 JWT（应为三段 Base64URL，以点分隔）。</p>
            )}

            {decoded && (
                <div className="space-y-4">
                    {expired && (
                        <p className="rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
                            此 Token 已过期（exp 时间早于当前时间）。
                        </p>
                    )}
                    <div className="grid gap-2">
                        <Label>Header</Label>
                        <pre className="max-h-56 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-4 font-mono text-xs">
                            {decoded.header}
                        </pre>
                    </div>
                    <div className="grid gap-2">
                        <Label>Payload</Label>
                        <pre className="max-h-72 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-4 font-mono text-xs">
                            {decoded.payload}
                        </pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        仅解码展示，不做签名校验；请勿在不受信任的环境粘贴含敏感信息的 Token。
                    </p>
                </div>
            )}
        </div>
    );
}

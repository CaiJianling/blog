import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
};

/** 生成密码用的高质量随机整数（Web Crypto，带非安全上下文回退）。 */
function randomInt(max: number): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const limit = Math.floor(0xffffffff / max) * max;
        const buf = new Uint32Array(1);
        let value = 0;

        do {
            crypto.getRandomValues(buf);
            value = buf[0];
        } while (value >= limit);

        return value % max;
    }

    return Math.floor(Math.random() * max);
}

export default function PasswordGenerator() {
    const [length, setLength] = useState(16);
    const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });
    const [password, setPassword] = useState('');
    const [copied, setCopied] = useState(false);

    const generate = useCallback(() => {
        const pool = Object.entries(SETS)
            .filter(([key]) => opts[key as keyof typeof opts])
            .map(([, chars]) => chars)
            .join('');

        if (!pool) {
            toast.error('请至少选择一种字符类型。');

            return;
        }

        setPassword(Array.from({ length }, () => pool[randomInt(pool.length)]).join(''));
        setCopied(false);
    }, [length, opts]);

    const copy = async () => {
        if (!password) {
            return;
        }

        if (await copyToClipboard(password)) {
            setCopied(true);
            toast.success('密码已复制。');
        }
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="pwd-length">密码长度：{length}</Label>
                </div>
                <input
                    id="pwd-length"
                    type="range"
                    min={6}
                    max={64}
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                    ['upper', '大写字母 A-Z'],
                    ['lower', '小写字母 a-z'],
                    ['digits', '数字 0-9'],
                    ['symbols', '特殊符号'],
                ] as const).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                        <Checkbox
                            checked={opts[key]}
                            onCheckedChange={(checked) => setOpts((prev) => ({ ...prev, [key]: checked === true }))}
                        />
                        {label}
                    </label>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <Input
                    value={password}
                    readOnly
                    placeholder="点击「生成密码」"
                    className="font-mono text-sm"
                />
                <Button type="button" onClick={generate}>
                    <RefreshCw className="h-4 w-4" />
                    生成密码
                </Button>
                <Button type="button" variant="outline" onClick={copy} disabled={!password}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    复制
                </Button>
            </div>

            <p className="text-xs text-muted-foreground">密码仅在浏览器本地生成，不会上传服务器。</p>
        </div>
    );
}

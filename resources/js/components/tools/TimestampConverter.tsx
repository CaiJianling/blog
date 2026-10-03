import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Check, Copy, CopyCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function TimestampConverter() {
    const [timestamp, setTimestamp] = useState('');
    const [date, setDate] = useState('');
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    const [copied, setCopied] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);

        return () => clearInterval(timer);
    }, []);

    const tsToDate = (ts: string): string => {
        const num = parseInt(ts, 10);
        if (isNaN(num)) return '';
        const d = new Date(ts.length <= 10 ? num * 1000 : num);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const dateToTs = (d: string): string => {
        const parsed = new Date(d.replace(' ', 'T'));
        if (isNaN(parsed.getTime())) return '';
        return Math.floor(parsed.getTime() / 1000).toString();
    };

    const copy = async (text: string, key: string) => {
        if (!text || !(await copyToClipboard(text))) {
            toast.error('复制失败，请手动选择文本复制');

            return;
        }

        setCopied(key);
        setTimeout(() => setCopied(''), 1500);
    };

    const copyButton = (text: string, key: string, label: string) => (
        <Button variant="ghost" size="sm" onClick={() => void copy(text, key)} disabled={!text}>
            {copied === key ? <Check className="h-3.5 w-3.5" /> : <CopyCheck className="h-3.5 w-3.5" />}
            {copied === key ? '已复制' : label}
        </Button>
    );

    return (
        <div className="space-y-6">
            <div className="apple-card flex items-center justify-between p-5">
                <div>
                    <p className="text-footnote text-muted-foreground">当前时间戳</p>
                    <p className="text-title font-mono">{now}</p>
                </div>
                <div className="flex items-center gap-2">
                    {copyButton(String(now), 'now', '复制')}
                    <Button variant="outline" onClick={() => setNow(Math.floor(Date.now() / 1000))}>刷新</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="apple-card p-5">
                    <h3 className="text-headline mb-4">时间戳 → 日期</h3>
                    <Textarea
                        value={timestamp}
                        onChange={(e) => setTimestamp(e.target.value)}
                        placeholder="输入时间戳（秒或毫秒）"
                        className="h-20 font-mono text-sm"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted p-3 font-mono text-sm">
                        <span className="break-all">{timestamp ? tsToDate(timestamp) : '—'}</span>
                        {timestamp && copyButton(tsToDate(timestamp), 'ts', '复制')}
                    </div>
                </div>

                <div className="apple-card p-5">
                    <h3 className="text-headline mb-4">日期 → 时间戳</h3>
                    <Textarea
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="YYYY-MM-DD HH:mm:ss"
                        className="h-20 font-mono text-sm"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted p-3 font-mono text-sm">
                        <span className="break-all">{date ? dateToTs(date) : '—'}</span>
                        {date && copyButton(dateToTs(date), 'date', '复制')}
                    </div>
                </div>
            </div>
        </div>
    );
}

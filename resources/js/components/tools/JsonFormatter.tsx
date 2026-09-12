import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import HighlightedCode from '@/components/tools/highlighted-code';
import { Check, X, Copy, Wand2, Minimize2 } from 'lucide-react';

export default function JsonFormatter() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const format = () => {
        try {
            const parsed = JSON.parse(input);
            setOutput(JSON.stringify(parsed, null, 2));
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : '解析失败');
            setOutput('');
        }
    };

    const minify = () => {
        try {
            const parsed = JSON.parse(input);
            setOutput(JSON.stringify(parsed));
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : '解析失败');
            setOutput('');
        }
    };

    const copy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const sample = '{"name":"blog","version":"1.0","tags":["laravel","react"],"meta":{"author":"you"}}';

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <Button onClick={format}>
                    <Wand2 className="h-4 w-4" /> 格式化
                </Button>
                <Button variant="outline" onClick={minify}>
                    <Minimize2 className="h-4 w-4" /> 压缩
                </Button>
                <Button variant="outline" onClick={() => { setInput(sample); setOutput(''); setError(''); }}>
                    示例
                </Button>
                {output && (
                    <Button variant="ghost" onClick={copy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? '已复制' : '复制'}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium text-foreground">输入 JSON</label>
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder='{"key": "value"}'
                        className="h-80 font-mono text-sm"
                    />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium text-foreground">输出</label>
                    {error ? (
                        <div className="flex h-80 items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            <X className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="font-mono">{error}</span>
                        </div>
                    ) : (
                        <HighlightedCode code={output} lang="json" />
                    )}
                </div>
            </div>
        </div>
    );
}

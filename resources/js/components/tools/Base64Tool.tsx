import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, Copy, Check } from 'lucide-react';

export default function Base64Tool() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const encode = () => {
        try {
            setOutput(btoa(unescape(encodeURIComponent(input))));
            setError('');
        } catch {
            setError('编码失败');
            setOutput('');
        }
    };

    const decode = () => {
        try {
            setOutput(decodeURIComponent(escape(atob(input.trim()))));
            setError('');
        } catch {
            setError('Base64 解码失败，请检查输入');
            setOutput('');
        }
    };

    const swap = () => {
        setInput(output);
        setOutput(input);
    };

    const copy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <Button onClick={encode}>编码 →</Button>
                <Button variant="outline" onClick={decode}>← 解码</Button>
                {input && output && (
                    <Button variant="ghost" onClick={swap}><ArrowRightLeft className="h-4 w-4" /> 交换</Button>
                )}
                {output && (
                    <Button variant="ghost" onClick={copy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? '已复制' : '复制'}
                    </Button>
                )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium">输入</label>
                    <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入文本..." className="h-64 font-mono text-sm" />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium">输出</label>
                    <Textarea value={output} readOnly placeholder="结果将显示在这里" className="h-64 font-mono text-sm" />
                </div>
            </div>
        </div>
    );
}

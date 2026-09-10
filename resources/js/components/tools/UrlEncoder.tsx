import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, Copy, Check } from 'lucide-react';

export default function UrlEncoder() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [copied, setCopied] = useState(false);

    const encode = () => {
        setOutput(encodeURIComponent(input));
    };

    const decode = () => {
        try {
            setOutput(decodeURIComponent(input));
        } catch {
            setOutput('解码失败：非法的 URL 编码');
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium">输入</label>
                    <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入 URL 或文本..." className="h-56 font-mono text-sm" />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium">输出</label>
                    <Textarea value={output} readOnly placeholder="结果将显示在这里" className="h-56 font-mono text-sm" />
                </div>
            </div>
        </div>
    );
}

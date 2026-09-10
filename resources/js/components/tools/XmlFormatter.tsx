import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy, Wand2, Minimize2, X } from 'lucide-react';

export default function XmlFormatter() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const formatXml = (xml: string): string => {
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        let formatted = '';
        let pad = 0;

        xml = xml.replace(reg, '$1\r\n$2$3');
        xml.split('\r\n').forEach((node) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/) && pad > 0) {
                pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            formatted += PADDING.repeat(pad) + node + '\r\n';
            pad += indent;
        });
        return formatted.trim();
    };

    const validate = (xml: string): boolean => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        return doc.getElementsByTagName('parsererror').length === 0;
    };

    const format = () => {
        if (!input.trim()) { setError('请输入 XML 内容'); setOutput(''); return; }
        if (!validate(input)) { setError('XML 结构不合法'); setOutput(''); return; }
        try {
            setOutput(formatXml(input.trim()));
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : '格式化失败');
        }
    };

    const minify = () => {
        if (!input.trim()) { setError('请输入 XML 内容'); setOutput(''); return; }
        if (!validate(input)) { setError('XML 结构不合法'); setOutput(''); return; }
        setOutput(input.replace(/>\s*</g, '><').trim());
        setError('');
    };

    const copy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const sample = '<root><item id="1"><name>test</name><value>123</value></item><item id="2"><name>demo</name><value>456</value></item></root>';

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <Button onClick={format}><Wand2 className="h-4 w-4" /> 格式化</Button>
                <Button variant="outline" onClick={minify}><Minimize2 className="h-4 w-4" /> 压缩</Button>
                <Button variant="outline" onClick={() => { setInput(sample); setOutput(''); setError(''); }}>示例</Button>
                {output && (
                    <Button variant="ghost" onClick={copy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? '已复制' : '复制'}
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium">输入 XML</label>
                    <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="<root>...</root>" className="h-80 font-mono text-sm" />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium">输出</label>
                    {error ? (
                        <div className="flex h-80 items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            <X className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-mono">{error}</span>
                        </div>
                    ) : (
                        <Textarea value={output} readOnly placeholder="格式化结果将显示在这里" className="h-80 font-mono text-sm" />
                    )}
                </div>
            </div>
        </div>
    );
}

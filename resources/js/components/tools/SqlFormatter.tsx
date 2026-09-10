import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Check, Copy } from 'lucide-react';

export default function SqlFormatter() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [copied, setCopied] = useState(false);

    const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'DISTINCT', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE'];

    const format = () => {
        if (!input.trim()) { setOutput(''); return; }
        let result = input.trim();
        keywords.forEach((kw) => {
            const re = new RegExp(`\\b${kw}\\b`, 'gi');
            result = result.replace(re, (m) => m.toUpperCase());
        });
        ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON', 'AND', 'OR', 'UNION', 'VALUES', 'SET'].forEach((kw) => {
            const re = new RegExp(`\\s+\\b${kw}\\b`, 'gi');
            result = result.replace(re, '\n' + kw);
        });
        result = result.replace(/,\s*/g, ',\n    ');
        setOutput(result);
    };

    const copy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const sample = 'select id,name,email from users where status=1 and created_at > "2024-01-01" order by created_at desc limit 10';

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <Button onClick={format}><Wand2 className="h-4 w-4" /> 格式化</Button>
                <Button variant="outline" onClick={() => { setInput(sample); setOutput(''); }}>示例</Button>
                {output && (
                    <Button variant="ghost" onClick={copy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? '已复制' : '复制'}
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="mb-2 block text-footnote font-medium">输入 SQL</label>
                    <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="SELECT * FROM users..." className="h-80 font-mono text-sm" />
                </div>
                <div>
                    <label className="mb-2 block text-footnote font-medium">输出</label>
                    <Textarea value={output} readOnly placeholder="格式化结果将显示在这里" className="h-80 font-mono text-sm" />
                </div>
            </div>
        </div>
    );
}

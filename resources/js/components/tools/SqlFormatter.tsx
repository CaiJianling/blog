import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import HighlightedCode from '@/components/tools/highlighted-code';
import { Wand2, Minimize2, Check, Copy } from 'lucide-react';

/** 压缩 SQL：去除注释与多余空白，字符串字面量保持原样。 */
export function minifySql(sql: string): string {
    let stripped = '';
    let i = 0;
    let inString = false;

    // 先剥离注释（跳过字符串内的内容）
    while (i < sql.length) {
        const ch = sql[i];

        if (inString) {
            stripped += ch;

            if (ch === "'" && sql[i + 1] === "'") {
                stripped += "'";
                i += 2;

                continue;
            }

            if (ch === "'") {
                inString = false;
            }

            i++;

            continue;
        }

        if (ch === "'") {
            inString = true;
            stripped += ch;
            i++;

            continue;
        }

        if (ch === '-' && sql[i + 1] === '-') {
            while (i < sql.length && sql[i] !== '\n') {
                i++;
            }

            continue;
        }

        if (ch === '/' && sql[i + 1] === '*') {
            i += 2;

            while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
                i++;
            }

            i += 2;

            continue;
        }

        stripped += ch;
        i++;
    }

    return stripped
        .replace(/\s+/g, ' ')
        .replace(/\s*([(),;=<>!+\-*/])\s*/g, '$1')
        .trim();
}

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

    const minify = () => {
        if (!input.trim()) { setOutput(''); return; }
        setOutput(minifySql(input));
    };

    const copy = async () => {
        if (!(await copyToClipboard(output))) {
            toast.error('复制失败，请手动选择文本复制');

            return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const sample = 'select id,name,email from users where status=1 and created_at > "2024-01-01" order by created_at desc limit 10';

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <Button onClick={format}><Wand2 className="h-4 w-4" /> 格式化</Button>
                <Button variant="outline" onClick={minify}><Minimize2 className="h-4 w-4" /> 压缩</Button>
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
                    <HighlightedCode code={output} lang="sql" />
                </div>
            </div>
        </div>
    );
}

import { useState, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Type, FileText, Hash, Clock } from 'lucide-react';

export default function TextCounter() {
    const [text, setText] = useState('');

    const stats = useMemo(() => {
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, '').length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lines = text ? text.split('\n').length : 0;
        const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const english = (text.match(/[a-zA-Z]/g) || []).length;
        const digits = (text.match(/[0-9]/g) || []).length;
        const readTime = Math.ceil(chinese / 400 + english / 200);
        return { chars, charsNoSpace, words, lines, chinese, english, digits, readTime };
    }, [text]);

    const cards = [
        { label: '字符数', value: stats.chars, icon: Type },
        { label: '不含空格', value: stats.charsNoSpace, icon: FileText },
        { label: '单词数', value: stats.words, icon: Hash },
        { label: '行数', value: stats.lines, icon: FileText },
        { label: '中文字符', value: stats.chinese, icon: Type },
        { label: '英文字母', value: stats.english, icon: Type },
        { label: '数字', value: stats.digits, icon: Hash },
        { label: '阅读时长', value: `${stats.readTime} 分钟`, icon: Clock },
    ];

    return (
        <div className="space-y-5">
            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入文本进行统计..."
                className="h-56 text-sm"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {cards.map((c) => (
                    <div key={c.label} className="apple-card flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                            <c.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-footnote text-muted-foreground">{c.label}</p>
                            <p className="text-headline">{c.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

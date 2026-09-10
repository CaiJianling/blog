import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
    /** 受控初始值（如当前搜索词） */
    initial?: string;
    placeholder?: string;
    buttonLabel?: string;
    /** 回车/点击搜索时的回调 */
    onSubmit: (value: string) => void;
}

/**
 * 通用页面搜索框：输入框 + 搜索按钮，回车或点击触发。
 */
export default function PageSearch({ initial = '', placeholder = '搜索', buttonLabel = '搜索', onSubmit }: Props) {
    const [value, setValue] = useState(initial);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(value.trim());
    };

    return (
        <form onSubmit={submit} className="flex items-center gap-2">
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="h-10 w-full max-w-sm rounded-full"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label={buttonLabel}>
                <Search className="h-4 w-4" />
            </Button>
        </form>
    );
}

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Upload } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const MAX_SIZE = 5 * 1024 * 1024;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageToBase64() {
    const [dataUri, setDataUri] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleFile = (file: File) => {
        if (!ACCEPTED.includes(file.type)) {
            toast.error('仅支持 jpg / png / gif / webp / svg 图片。');

            return;
        }

        if (file.size > MAX_SIZE) {
            toast.error('图片不能超过 5 MB。');

            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            setDataUri(String(reader.result ?? ''));
            setFileName(file.name);
            setFileSize(file.size);
            setCopied(false);
        };
        reader.onerror = () => toast.error('读取图片失败，请重试。');
        reader.readAsDataURL(file);
    };

    const copy = async () => {
        if (await copyToClipboard(dataUri)) {
            setCopied(true);
            toast.success('Base64 已复制。');
        }
    };

    return (
        <div className="space-y-5">
            <label className="apple-press flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <Upload className="h-6 w-6" />
                <span className="text-sm">点击选择图片（jpg / png / gif / webp / svg，≤ 5MB）</span>
                <input
                    type="file"
                    accept={ACCEPTED.join(',')}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];

                        if (file) {
                            handleFile(file);
                        }

                        e.target.value = '';
                    }}
                />
            </label>

            {dataUri && (
                <>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{fileName}</p>
                            <p className="text-footnote text-muted-foreground">
                                原始大小 {formatSize(fileSize)} · Base64 长度 {formatSize(dataUri.length)}
                            </p>
                        </div>
                        <img src={dataUri} alt={fileName} className="h-12 w-12 shrink-0 rounded-lg border border-border/60 object-cover" />
                    </div>

                    <div className="grid gap-2">
                        <Textarea readOnly value={dataUri} className="min-h-[9rem] font-mono text-xs" />
                        <Button type="button" variant="outline" onClick={copy}>
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            复制 Data URI
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">转换在浏览器本地完成，图片不会上传。</p>
                </>
            )}
        </div>
    );
}

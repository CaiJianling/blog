import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AiErrorDetail {
    message: string;
    debug?: unknown;
}

interface ErrorDetailDialogProps {
    detail: AiErrorDetail | null;
    onClose: () => void;
}

function formatDebug(debug: unknown): string {
    if (debug === null || debug === undefined) {
        return '（接口未返回额外的错误详情）';
    }

    if (typeof debug === 'string') {
        return debug;
    }

    try {
        return JSON.stringify(debug, null, 2);
    } catch {
        return String(debug);
    }
}

/**
 * AI 接口错误详情弹窗：展示后端返回的 debug 上下文
 * （HTTP 状态码、请求 URL、上游原始返回体/原始文本等）。
 */
export default function ErrorDetailDialog({ detail, onClose }: ErrorDetailDialogProps) {
    return (
        <Dialog open={detail !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>接口错误详情</DialogTitle>
                    <DialogDescription className="break-all">{detail?.message}</DialogDescription>
                </DialogHeader>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed">
                    {formatDebug(detail?.debug)}
                </pre>
            </DialogContent>
        </Dialog>
    );
}

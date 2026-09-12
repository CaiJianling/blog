/**
 * 剪贴板复制工具函数。
 *
 * navigator.clipboard 仅在 HTTPS/localhost 安全上下文可用；
 * HTTP 环境（如内网部署）自动降级为隐藏文本框 + execCommand('copy')。
 * 返回是否复制成功。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);

            return true;
        }
    } catch {
        // 降级到 execCommand
    }

    try {
        const textarea = document.createElement('textarea');

        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const ok = document.execCommand('copy');

        document.body.removeChild(textarea);

        return ok;
    } catch {
        return false;
    }
}

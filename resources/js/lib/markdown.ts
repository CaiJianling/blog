/**
 * 轻量 Markdown 渲染器（用于 AI 小助手气泡）。
 *
 * 安全策略：先整体做 HTML 转义，再基于转义后的文本做语法转换，
 * 因此用户/模型内容中的 <script> 等不会被执行；链接仅允许
 * http(s)、mailto 与站内相对地址。
 */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
    const trimmed = url.trim();

    if (/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) {
        return trimmed.replace(/"/g, '%22');
    }

    return '#';
}

function renderInline(text: string): string {
    let out = escapeHtml(text);

    // 行内代码 `code`
    out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">$1</code>');

    // 图片 ![alt](url) → 链接形式（聊天气泡内不直接加载外域图片，避免滥用手改为链接）
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="underline">${alt || url}</a>`);

    // 链接 [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text2: string, url: string) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="underline break-all">${text2}</a>`);

    // 粗体 / 斜体
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // 删除线
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return out;
}

export function renderMarkdown(source: string): string {
    const text = source.replace(/\r\n/g, '\n');
    const blocks: string[] = [];
    const lines = text.split('\n');

    let i = 0;
    let listBuffer: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
        if (listBuffer.length > 0 && listType) {
            blocks.push(`<${listType} class="my-1 ml-4 list-outside">${listBuffer.join('')}</${listType}>`);
        }
        listBuffer = [];
        listType = null;
    };

    while (i < lines.length) {
        const line = lines[i];

        // 围栏代码块
        const fence = line.match(/^```(\w*)\s*$/);

        if (fence) {
            flushList();
            const codeLines: string[] = [];
            i++;

            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }

            i++; // 跳过收尾 ```

            blocks.push(
                `<pre class="my-2 overflow-x-auto rounded-lg bg-black/85 p-3 text-[12px] leading-relaxed text-zinc-100 dark:bg-black/60"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
            );

            continue;
        }

        // 标题
        const heading = line.match(/^(#{1,4})\s+(.+)$/);

        if (heading) {
            flushList();
            const level = heading[1].length;
            const sizes = ['text-base', 'text-[15px]', 'text-sm', 'text-sm'];
            blocks.push(
                `<h${level + 2} class="${sizes[level - 1]} mt-2 mb-1 font-semibold">${renderInline(heading[2])}</h${level + 2}>`,
            );
            i++;

            continue;
        }

        // 分隔线
        if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
            flushList();
            blocks.push('<hr class="my-2 border-border/60" />');
            i++;

            continue;
        }

        // 引用
        if (/^>\s?/.test(line)) {
            flushList();
            const quoteLines: string[] = [];

            while (i < lines.length && /^>\s?/.test(lines[i])) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }

            blocks.push(
                `<blockquote class="my-1 border-l-2 border-primary/40 pl-2 text-muted-foreground">${renderInline(quoteLines.join('\n')).replace(/\n/g, '<br />')}</blockquote>`,
            );

            continue;
        }

        // 无序列表
        if (/^\s*[-*+]\s+/.test(line)) {
            if (listType !== 'ul') {
                flushList();
                listType = 'ul';
            }
            listBuffer.push(`<li class="ml-1">${renderInline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
            i++;

            continue;
        }

        // 有序列表
        if (/^\s*\d+[.、]\s+/.test(line)) {
            if (listType !== 'ol') {
                flushList();
                listType = 'ol';
            }
            listBuffer.push(`<li class="ml-1">${renderInline(line.replace(/^\s*\d+[.、]\s+/, ''))}</li>`);
            i++;

            continue;
        }

        // 空行
        if (line.trim() === '') {
            flushList();
            i++;

            continue;
        }

        // 普通段落（连续非空行合并）
        flushList();
        const paragraphLines: string[] = [];

        while (
            i < lines.length
            && lines[i].trim() !== ''
            && !/^```/.test(lines[i])
            && !/^(#{1,4})\s+/.test(lines[i])
            && !/^>\s?/.test(lines[i])
            && !/^\s*[-*+]\s+/.test(lines[i])
            && !/^\s*\d+[.、]\s+/.test(lines[i])
        ) {
            paragraphLines.push(lines[i]);
            i++;
        }

        blocks.push(`<p class="my-1">${renderInline(paragraphLines.join('\n')).replace(/\n/g, '<br />')}</p>`);
    }

    flushList();

    return blocks.join('');
}

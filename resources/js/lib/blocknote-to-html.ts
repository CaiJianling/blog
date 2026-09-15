import type { PartialBlock } from '@blocknote/core';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { labelFor, normalizeLang } from '@/lib/code-languages';

// 仅注册文章代码块用到的语言，控制打包体积。
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('php', php);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

/**
 * 将 BlockNote JSON 块数组转换为纯 HTML 字符串，用于前台静态展示。
 *
 * 仅覆盖默认 schema 的常用块类型，未知类型按容器降级处理。
 * 所有文本与属性均做 HTML 转义，防止注入。
 */

type InlineContentItem =
    | { type: 'text'; text: string; styles?: Record<string, unknown> }
    | { type: 'link'; href: string; content: InlineContentItem[] };

type TableContent = {
    type: 'tableContent';
    rows?: {
        cells?: (
            | string
            | { type: 'tableContent'; rows?: unknown[] }
            | { content?: InlineContentItem[] }
        )[];
    }[];
};

type BlockLike = PartialBlock & {
    type?: string;
    props?: Record<string, unknown>;
    content?: InlineContentItem[] | TableContent | string;
    children?: BlockLike[];
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const attr = (value: unknown): string => escapeHtml(String(value ?? ''));

function escapeAttr(value: unknown): string {
    return attr(value).replace(/`/g, '');
}

function styleToString(styles: Record<string, unknown>): string {
    const css: string[] = [];

    if (typeof styles.textColor === 'string' && styles.textColor !== 'default') {
        css.push(`color: var(--bn-colors-text-${escapeAttr(styles.textColor)}, inherit)`);
    }
    if (typeof styles.backgroundColor === 'string' && styles.backgroundColor !== 'default') {
        css.push(`background-color: var(--bn-colors-background-${escapeAttr(styles.backgroundColor)}, transparent)`);
    }
    if (typeof styles.fontSize === 'string') {
        css.push(`font-size: ${escapeAttr(styles.fontSize)}`);
    }

    return css.length > 0 ? ` style="${escapeAttr(css.join('; '))}"` : '';
}

function renderInline(items: InlineContentItem[] | undefined | string): string {
    if (typeof items === 'string' || items === undefined || items === null) {
        return escapeHtml(String(items ?? ''));
    }

    return items
        .map((item) => {
            if (item.type === 'link') {
                const href = escapeAttr((item as { href?: string }).href ?? '#');
                return `<a href="${href}">${renderInline((item as { content?: InlineContentItem[] }).content)}</a>`;
            }

            const text = escapeHtml((item as { text?: string }).text ?? '');
            const styles = (item as { styles?: Record<string, unknown> }).styles ?? {};
            let html = text;

            if (styles.code) {
                html = `<code>${html}</code>`;
            }
            if (styles.strike) {
                html = `<s>${html}</s>`;
            }
            if (styles.underline) {
                html = `<u>${html}</u>`;
            }
            if (styles.italic) {
                html = `<em>${html}</em>`;
            }
            if (styles.bold) {
                html = `<strong>${html}</strong>`;
            }

            const inlineStyle = styleToString(styles);

            return inlineStyle !== '' ? `<span${inlineStyle}>${html}</span>` : html;
        })
        .join('');
}

function renderList(blocks: BlockLike[], listType: 'bulletListItem' | 'numberedListItem'): string {
    const tag = listType === 'bulletListItem' ? 'ul' : 'ol';
    const items = blocks
        .filter((block) => block.type === listType)
        .map((block) => `<li>${renderChildren(block)}</li>`)
        .join('');

    return `<${tag}>${items}</${tag}>`;
}

/**
 * 渲染块的行内内容与嵌套子块（用于列表项等容器）。
 */
function renderChildren(block: BlockLike): string {
    const inline = renderInline(block.content as InlineContentItem[] | undefined);
    const nested = renderBlocks(block.children ?? []);

    return inline + nested;
}

// 代码块右上角按钮图标（内联 SVG，供静态 HTML 使用；尺寸由 CSS 统一控制）。
const CODE_ICONS: Record<string, string> = {
    ln: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M5 6h.01M5 12h.01M5 18h.01"/></svg>',
    wrap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13"/><path d="m14 4 3 3-3 3"/><path d="M4 15h7"/><path d="m10 12 3 3-3 3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
};

/** 编辑器语言键 → highlight.js 已注册语言名（未列出的按纯文本处理）。 */
const HLJS_LANGS: Record<string, string> = {
    javascript: 'javascript',
    typescript: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    html: 'xml',
    css: 'css',
    json: 'json',
    python: 'python',
    bash: 'bash',
    powershell: 'powershell',
    sql: 'sql',
    go: 'go',
    rust: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    php: 'php',
    ruby: 'ruby',
    yaml: 'yaml',
    markdown: 'markdown',
    diff: 'diff',
};

/**
 * 把整块高亮 HTML 按换行切分为逐行 HTML。
 * highlight.js 仅输出 <span>/</span>，跨行令牌（多行注释/字符串）会在换行处
 * 闭合已打开的 span、下一行再原样重开，保证逐行独立且着色连续。
 */
function splitHighlightedLines(html: string): string[] {
    const lines: string[] = [];
    const open: string[] = [];
    let buf = '';
    let i = 0;

    while (i < html.length) {
        const ch = html[i];

        if (ch === '<') {
            const end = html.indexOf('>', i);
            const tag = html.slice(i, end + 1);

            if (tag.startsWith('</')) {
                open.pop();
            } else {
                open.push(tag);
            }

            buf += tag;
            i = end + 1;
            continue;
        }

        if (ch === '\n') {
            for (let k = open.length - 1; k >= 0; k -= 1) {
                buf += '</span>';
            }

            lines.push(buf);
            buf = '';

            for (const tag of open) {
                buf += tag;
            }

            i += 1;
            continue;
        }

        buf += ch;
        i += 1;
    }

    lines.push(buf);

    return lines;
}

/** 高亮整块代码并切分为逐行 HTML；未知/纯文本语言回退转义纯文本。 */
function highlightCodeLines(lang: string, codeText: string): string[] {
    const hljsName = HLJS_LANGS[lang];

    if (hljsName && hljs.getLanguage(hljsName)) {
        const result = hljs.highlight(codeText, {
            language: hljsName,
            ignoreIllegals: true,
        });

        return splitHighlightedLines(result.value);
    }

    return codeText
        .split('\n')
        .map((line) => `<span class="tok-plain">${escapeHtml(line)}</span>`);
}

/** 大纲标题锚点计数器（blocknoteToHtml 每次调用重置，保证 id 稳定且随重渲染保留）。 */
let headingIndex = 0;

/**
 * 计算标题的纯文本（与 Blog/Show.extractHeadings 的判定规则一致：
 * 只拼接顶层行内项中带有 text 字段的内容，链接等不计入）。
 */
function headingPlainText(block: BlockLike): string {
    const content = block.content;

    if (!Array.isArray(content)) {
        return '';
    }

    return (content as InlineContentItem[])
        .map((inline) =>
            typeof inline === 'object' && inline !== null && 'text' in inline
                ? String((inline as { text?: unknown }).text ?? '')
                : '',
        )
        .join('');
}

/** 从行内内容扁平化出纯文本（用于代码块，忽略样式）。 */
function inlineText(items: InlineContentItem[] | undefined | string): string {
    if (typeof items === 'string' || items === null || items === undefined) {
        return String(items ?? '');
    }

    return items
        .map((item) => {
            if (item.type === 'link') {
                return inlineText((item as { content?: InlineContentItem[] }).content);
            }

            return String((item as { text?: string }).text ?? '');
        })
        .join('');
}

/** 组装结构化代码块：顶部语言标签 + 4 个操作按钮 + 逐行行号代码。 */
function renderCodeBlock(lang: string, codeText: string): string {
    const key = normalizeLang(lang);
    const label = labelFor(key);

    const highlightedLines = highlightCodeLines(key, codeText);

    const body = highlightedLines
        .map(
            (content, index) =>
                `<span class="cb-line"><span class="cb-ln">${index + 1}</span><span class="cb-text">${content}</span></span>`,
        )
        .join('');

    const button = (action: string, tip: string, pressed?: boolean): string =>
        `<button type="button" class="code-block__btn" data-code-action="${action}"${
            pressed === undefined ? '' : ` aria-pressed="${pressed}"`
        } data-tip="${tip}" aria-label="${tip}">${CODE_ICONS[action]}</button>`;

    return (
        `<figure class="code-block" data-lang="${attr(key)}" aria-label="代码块：${label}">` +
        `<figcaption class="code-block__bar">` +
        `<span class="code-block__dots"><span class="dot dot--red"></span><span class="dot dot--yellow"></span><span class="dot dot--green"></span></span>` +
        `<span class="code-block__actions">` +
        button('ln', '隐藏行号', true) +
        button('wrap', '折行', false) +
        button('copy', '复制') +
        button('fs', '全屏') +
        `</span></figcaption>` +
        `<div class="code-block__body"><pre class="code-block__pre"><code class="code-block__code">${body}</code></pre></div>` +
        `</figure>`
    );
}

function renderBlock(block: BlockLike): string {
    const props = block.props ?? {};

    switch (block.type) {
        case 'heading': {
            const level = Math.min(Math.max(Number(props.level) || 1, 1), 6);
            const idAttr =
                headingPlainText(block).trim() !== ''
                    ? ` id="heading-${headingIndex++}"`
                    : '';
            return `<h${level}${idAttr}>${renderChildren(block)}</h${level}>`;
        }
        case 'paragraph':
            return `<p>${renderChildren(block)}</p>`;
        case 'quote':
            return `<blockquote>${renderChildren(block)}</blockquote>`;
        case 'bulletListItem':
        case 'numberedListItem':
            return renderList([block], block.type);
        case 'checkListItem': {
            const checked = props.checked ? ' checked' : '';
            return `<ul class="checklist"><li class="${props.checked ? 'checked' : ''}"><input type="checkbox" disabled${checked}> ${renderChildren(block)}</li></ul>`;
        }
        case 'codeBlock': {
            const language = String(props.language ?? 'text');
            const text = inlineText(block.content as InlineContentItem[] | undefined);

            return renderCodeBlock(language, text);
        }
        case 'image': {
            const url = escapeAttr(props.url ?? '');
            const caption = props.caption ? `<figcaption>${escapeHtml(String(props.caption))}</figcaption>` : '';
            const alt = escapeAttr(props.caption ?? '');

            return `<figure><img src="${url}" alt="${alt}" loading="lazy" />${caption}</figure>`;
        }
        case 'video':
            return `<video src="${escapeAttr(props.url ?? '')}" controls preload="metadata"></video>`;
        case 'audio':
            return `<audio src="${escapeAttr(props.url ?? '')}" controls preload="metadata"></audio>`;
        case 'file':
            return `<p><a href="${escapeAttr(props.url ?? '#')}" target="_blank" rel="noopener noreferrer">${props.name ? escapeHtml(String(props.name)) : '附件'}</a></p>`;
        case 'table': {
            const tableContent = block.content as TableContent | undefined;
            const rows = tableContent?.rows ?? [];
            const body = rows
                .map((row) => {
                    const cells = (row.cells ?? [])
                        .map((cell) => {
                            const cellContent =
                                typeof cell === 'object' && cell !== null && 'content' in cell
                                    ? renderInline((cell as { content?: InlineContentItem[] }).content)
                                    : escapeHtml(String(cell ?? ''));

                            return `<td>${cellContent}</td>`;
                        })
                        .join('');

                    return `<tr>${cells}</tr>`;
                })
                .join('');

            return `<table><tbody>${body}</tbody></table>`;
        }
        default:
            // 未知块类型：按容器降级，保留行内内容与嵌套子块
            return `<div>${renderChildren(block)}</div>`;
    }
}

/**
 * 渲染块数组；连续的同类列表项会被归组到同一个 ul/ol 中。
 */
function renderBlocks(blocks: BlockLike[]): string {
    const html: string[] = [];
    let index = 0;

    while (index < blocks.length) {
        const block = blocks[index];

        if (block.type === 'bulletListItem' || block.type === 'numberedListItem') {
            const group: BlockLike[] = [];
            while (index < blocks.length && blocks[index].type === block.type) {
                group.push(blocks[index]);
                index++;
            }
            html.push(renderList(group, block.type as 'bulletListItem' | 'numberedListItem'));
            continue;
        }

        html.push(renderBlock(block));
        index++;
    }

    return html.join('\n');
}

/**
 * 将 BlockNote JSON 块数组转换为纯 HTML 字符串。
 */
export function blocknoteToHtml(blocks: unknown): string {
    headingIndex = 0;

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return '';
    }

    return renderBlocks(blocks as BlockLike[]);
}

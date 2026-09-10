import type { PartialBlock } from '@blocknote/core';

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

function renderBlock(block: BlockLike): string {
    const props = block.props ?? {};

    switch (block.type) {
        case 'heading': {
            const level = Math.min(Math.max(Number(props.level) || 1, 1), 6);
            return `<h${level}>${renderChildren(block)}</h${level}>`;
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
            const content = block.content;

            if (typeof content === 'string') {
                return `<pre><code>${escapeHtml(content)}</code></pre>`;
            }

            return `<pre><code>${renderInline(content as InlineContentItem[] | undefined)}</code></pre>`;
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
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return '';
    }

    return renderBlocks(blocks as BlockLike[]);
}

/**
 * 轻量代码高亮：为工具页的 JSON / XML / SQL 输出提供语法着色。
 * 无第三方依赖：基于逐段扫描 + HTML 转义，输出带语义 class 的 <span>。
 */

export type CodeLang = 'json' | 'xml' | 'sql';

const CLASS = {
    key: 'tok-key',
    string: 'tok-str',
    number: 'tok-num',
    keyword: 'tok-kw',
    punct: 'tok-punct',
    comment: 'tok-comment',
    tag: 'tok-tag',
    attr: 'tok-attr',
    plain: 'tok-plain',
} as const;

function span(cls: string, text: string): string {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `<span class="${cls}">${escaped}</span>`;
}

/** JSON：键、字符串、数字、布尔/null、标点。 */
function highlightJson(code: string): string {
    const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:]/g;
    let out = '';
    let last = 0;

    for (let m = pattern.exec(code); m !== null; m = pattern.exec(code)) {
        if (m.index > last) {
            out += span(CLASS.plain, code.slice(last, m.index));
        }

        if (m[2] !== undefined) {
            // 键名 + 冒号
            out += span(CLASS.key, m[1]) + span(CLASS.punct, m[2]);
        } else if (m[0].startsWith('"')) {
            out += span(CLASS.string, m[0]);
        } else if (/^-?\d/.test(m[0])) {
            out += span(CLASS.number, m[0]);
        } else if (m[0] === 'true' || m[0] === 'false' || m[0] === 'null') {
            out += span(CLASS.keyword, m[0]);
        } else {
            out += span(CLASS.punct, m[0]);
        }

        last = m.index + m[0].length;
    }

    out += span(CLASS.plain, code.slice(last));

    return out;
}

/** XML：标签、属性名、属性值、注释、文本。 */
function highlightXml(code: string): string {
    const pattern = /<!--[\s\S]*?-->|<\/?[\w:-]+|\/?>|[\w:-]+(?==)|"(?:[^"]*)"|'[^']*'|[<>&]/g;
    let out = '';
    let last = 0;
    let inTag = false;

    for (let m = pattern.exec(code); m !== null; m = pattern.exec(code)) {
        if (m.index > last) {
            const gap = code.slice(last, m.index);

            // 标签内的空白归属标点上下文，标签外是文本
            out += span(inTag ? CLASS.plain : CLASS.plain, gap);
        }

        const token = m[0];

        if (token.startsWith('<!--')) {
            out += span(CLASS.comment, token);
        } else if (token === '<' || token === '&') {
            // 未成对字符按普通文本（已转义）
            out += span(CLASS.plain, token);
        } else if (token.startsWith('</') || token.startsWith('<') || token === '/>' || token === '>') {
            inTag = !token.startsWith('</') && token !== '/>' && token !== '>' ? true : inTag;
            out += span(CLASS.tag, token);
        } else if (inTag && m[0].startsWith('"')) {
            out += span(CLASS.string, token);
        } else if (inTag) {
            out += span(CLASS.attr, token);
        } else {
            out += span(CLASS.plain, token);
        }

        last = m.index + m[0].length;

        // `>` 结束一个标签
        if (token === '>') {
            inTag = false;
        }
    }

    out += span(CLASS.plain, code.slice(last));

    return out;
}

const SQL_KEYWORDS = new Set([
    'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete',
    'create', 'table', 'drop', 'alter', 'add', 'column', 'index', 'view', 'database',
    'join', 'inner', 'left', 'right', 'full', 'outer', 'on', 'as', 'and', 'or', 'not',
    'null', 'is', 'in', 'like', 'between', 'order', 'group', 'by', 'having', 'limit',
    'offset', 'distinct', 'case', 'when', 'then', 'else', 'end', 'union', 'all',
    'primary', 'key', 'foreign', 'references', 'default', 'unique', 'constraint',
    'asc', 'desc', 'exists', 'if',
]);

const SQL_TYPES = new Set([
    'int', 'integer', 'varchar', 'char', 'text', 'date', 'datetime', 'timestamp',
    'decimal', 'numeric', 'float', 'double', 'boolean', 'bool', 'bigint', 'json',
]);

/** SQL：关键字、类型/函数、字符串、注释、数字、标点。 */
function highlightSql(code: string): string {
    const pattern = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*|[(),;.*=<>!+\-/]/g;
    let out = '';
    let last = 0;

    for (let m = pattern.exec(code); m !== null; m = pattern.exec(code)) {
        if (m.index > last) {
            out += span(CLASS.plain, code.slice(last, m.index));
        }

        const token = m[0];

        if (token.startsWith('--') || token.startsWith('/*')) {
            out += span(CLASS.comment, token);
        } else if (token.startsWith("'")) {
            out += span(CLASS.string, token);
        } else if (/^\d/.test(token)) {
            out += span(CLASS.number, token);
        } else if (/^[A-Za-z_]/.test(token)) {
            const lower = token.toLowerCase();

            if (SQL_KEYWORDS.has(lower)) {
                out += span(CLASS.keyword, token);
            } else if (SQL_TYPES.has(lower)) {
                out += span(CLASS.attr, token);
            } else {
                out += span(CLASS.plain, token);
            }
        } else {
            out += span(CLASS.punct, token);
        }

        last = m.index + m[0].length;
    }

    out += span(CLASS.plain, code.slice(last));

    return out;
}

export function highlightCode(code: string, lang: CodeLang): string {
    if (code === '') {
        return '';
    }

    switch (lang) {
        case 'json':
            return highlightJson(code);
        case 'xml':
            return highlightXml(code);
        case 'sql':
            return highlightSql(code);
        default:
            return span(CLASS.plain, code);
    }
}

/**
 * 代码块语言注册表：编辑器（BlockNote `supportedLanguages`）与前台渲染（语言标签）共用。
 * key 为存储到 codeBlock.props.language 的标识，name 为显示名称，aliases 供编辑器的输入规则/粘贴识别。
 */
export interface CodeLanguage {
    name: string;
    aliases?: string[];
}

export const CODE_LANGUAGES: Record<string, CodeLanguage> = {
    text: { name: '纯文本', aliases: ['plaintext', 'txt'] },
    javascript: { name: 'JavaScript', aliases: ['js', 'node'] },
    typescript: { name: 'TypeScript', aliases: ['ts'] },
    jsx: { name: 'JSX', aliases: ['react'] },
    tsx: { name: 'TSX' },
    html: { name: 'HTML', aliases: ['xml', 'svg'] },
    css: { name: 'CSS' },
    json: { name: 'JSON' },
    python: { name: 'Python', aliases: ['py'] },
    bash: { name: 'Bash', aliases: ['sh', 'shell', 'zsh', 'console'] },
    powershell: { name: 'PowerShell', aliases: ['pwsh'] },
    sql: { name: 'SQL' },
    go: { name: 'Go', aliases: ['golang'] },
    rust: { name: 'Rust', aliases: ['rs'] },
    java: { name: 'Java' },
    c: { name: 'C' },
    cpp: { name: 'C++', aliases: ['c++', 'cc'] },
    csharp: { name: 'C#', aliases: ['c#', 'cs'] },
    php: { name: 'PHP', aliases: ['php'] },
    ruby: { name: 'Ruby', aliases: ['rb'] },
    yaml: { name: 'YAML', aliases: ['yml'] },
    markdown: { name: 'Markdown', aliases: ['md'] },
    diff: { name: 'Diff' },
};

/** 归一化语言标识：小写、去空白；空值回退 text。 */
export function normalizeLang(lang: string | null | undefined): string {
    const value = (lang ?? '').trim().toLowerCase();

    return value === '' ? 'text' : value;
}

/** 显示语言名称；未知语言原样返回其标识。 */
export function labelFor(lang: string | null | undefined): string {
    const key = normalizeLang(lang);

    return CODE_LANGUAGES[key]?.name ?? key;
}

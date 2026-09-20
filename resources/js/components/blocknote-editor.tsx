import '@blocknote/react/style.css';
import '@blocknote/mantine/style.css';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { zh, en } from '@blocknote/core/locales';
import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from '@blocknote/core';
import type { BlockNoteEditor as BlockNoteEditorInstance, Dictionary, PartialBlock } from '@blocknote/core';
import { useEffect } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import { useLocale } from '@/hooks/use-locale';
import type { Locale } from '@/i18n';
import { CODE_LANGUAGES } from '@/lib/code-languages';
import { getCsrfHeaders } from '@/lib/csrf';

/**
 * BlockNote 块编辑器组件。
 *
 * 数据以 BlockNote 的 JSON 块数组形式存取（editor.document），
 * 对应数据库 content json 字段，无需 HTML 字符串转换。
 * 可编辑状态下，图片/文件插入会自动上传到 /attachments 并写回外链地址。
 */

export type BlockNoteDocument = PartialBlock[];
export type BlockNoteEditorRef = BlockNoteEditorInstance;

interface BlockNoteEditorProps {
    /** 初始块数据，新建文章时传 null / undefined 即可。 */
    initialContent?: BlockNoteDocument | null;
    /** 块数据变化时回调，传出 BlockNote JSON 块数组。 */
    onChange?: (document: BlockNoteDocument) => void;
    /** 编辑器实例创建完成时回调（用于 AI 生成等需要命令式操作文档的场景）。 */
    onReady?: (editor: BlockNoteEditorRef) => void;
    placeholder?: string;
    editable?: boolean;
}

const LOCALE_DICTIONARY: Record<Locale, Dictionary> = {
    zh,
    en,
};

// 自定义 schema：仅替换 codeBlock，为其启用语言选择器（默认 schema 的 codeBlock 无语言下拉）。
// 其余块沿用 defaultBlockSpecs，避免整表重定义。
const editorSchema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        codeBlock: createCodeBlockSpec({
            defaultLanguage: 'text',
            supportedLanguages: CODE_LANGUAGES,
        }),
    },
});

/** 上传文件到媒体库，返回可直接访问的 URL。 */
async function uploadAttachment(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('files[]', file);

    const csrf = getCsrfHeaders();

    if (!csrf) {
        throw new Error('CSRF token not found.');
    }

    const response = await fetch('/admin/attachments', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...csrf,
        },
        body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message ?? '文件上传失败。');
    }

    const first = data?.data?.[0];

    if (!first?.url) {
        throw new Error('文件上传失败。');
    }

    return first.url;
}

export function BlockNoteEditor({
    initialContent,
    onChange,
    onReady,
    placeholder,
    editable = true,
}: BlockNoteEditorProps) {
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';
    const locale = useLocale();

    const editor = useCreateBlockNote({
        schema: editorSchema,
        initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
        placeholders: placeholder ? { default: placeholder } : undefined,
        dictionary: LOCALE_DICTIONARY[locale],
        uploadFile: editable ? uploadAttachment : undefined,
    });

    useEffect(() => {
        onReady?.(editor);
        // 仅在编辑器实例创建时触发一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    return (
        <div
            className={`blocknote-editor-wrapper overflow-hidden rounded-2xl border ${
                editable ? 'min-h-[420px]' : 'min-h-[96px]'
            } ${isDark ? 'border-zinc-700/50 bg-zinc-900/30' : 'border-gray-200/60 bg-white/50'}`}
        >
            <BlockNoteView
                key={locale}
                editor={editor}
                theme={isDark ? 'dark' : 'light'}
                editable={editable}
                onChange={() => {
                    onChange?.(editor.document as BlockNoteDocument);
                }}
            />
        </div>
    );
}

import '@blocknote/react/style.css';
import '@blocknote/mantine/style.css';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { zh, en } from '@blocknote/core/locales';
import type { Dictionary, PartialBlock } from '@blocknote/core';
import { useAppearance } from '@/hooks/use-appearance';
import { useLocale } from '@/hooks/use-locale';
import type { Locale } from '@/i18n';

/**
 * BlockNote 块编辑器组件。
 *
 * 数据以 BlockNote 的 JSON 块数组形式存取（editor.document），
 * 对应数据库 content json 字段，无需 HTML 字符串转换。
 */

export type BlockNoteDocument = PartialBlock[];

interface BlockNoteEditorProps {
    /** 初始块数据，新建文章时传 null / undefined 即可。 */
    initialContent?: BlockNoteDocument | null;
    /** 块数据变化时回调，传出 BlockNote JSON 块数组。 */
    onChange?: (document: BlockNoteDocument) => void;
    placeholder?: string;
    editable?: boolean;
}

const LOCALE_DICTIONARY: Record<Locale, Dictionary> = {
    zh,
    en,
};

export function BlockNoteEditor({
    initialContent,
    onChange,
    placeholder,
    editable = true,
}: BlockNoteEditorProps) {
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';
    const locale = useLocale();

    const editor = useCreateBlockNote({
        initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
        placeholders: placeholder ? { default: placeholder } : undefined,
        dictionary: LOCALE_DICTIONARY[locale],
    });

    return (
        <div
            className={`blocknote-editor-wrapper overflow-hidden rounded-2xl border min-h-[420px] ${
                isDark ? 'border-zinc-700/50 bg-zinc-900/30' : 'border-gray-200/60 bg-white/50'
            }`}
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

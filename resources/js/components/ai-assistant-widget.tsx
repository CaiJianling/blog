import { usePage } from '@inertiajs/react';
import { Bot, MessageSquarePlus, Send, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantConversation, AssistantMessage } from '@/lib/assistant-db';
import { deleteConversation, listConversations, newConversationId, putConversation } from '@/lib/assistant-db';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AssistantConfig {
    enabled: boolean;
    name?: string;
    avatarUrl?: string | null;
    welcome?: string | null;
}

function Avatar({ url, name, size = 'h-8 w-8' }: { url?: string | null; name: string; size?: string }) {
    return url ? (
        <img src={url} alt={name} className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
        <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary`}>
            <Bot className="h-4 w-4" />
        </span>
    );
}

export default function AiAssistantWidget() {
    const { assistant } = usePage().props as unknown as { assistant?: AssistantConfig };

    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [conversations, setConversations] = useState<AssistantConversation[]>([]);
    const [current, setCurrent] = useState<AssistantConversation | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const name = assistant?.name || 'AI 小助手';
    const welcome = assistant?.welcome || '你好！我是 AI 小助手，有什么可以帮你？';

    const refreshList = useCallback(async () => {
        setConversations(await listConversations());
    }, []);

    useEffect(() => {
        if (open && !loaded) {
            setLoaded(true);
            void refreshList().then(() => {
                setCurrent((prev) => prev ?? { id: newConversationId(), title: '', chatId: null, messages: [], updatedAt: Date.now() });
            });
        }
    }, [open, loaded, refreshList]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [current?.messages.length, sending]);

    if (!assistant?.enabled) {
        return null;
    }

    const persist = async (conversation: AssistantConversation) => {
        conversation.updatedAt = Date.now();
        setCurrent({ ...conversation });
        await putConversation(conversation);
        await refreshList();
    };

    const startNew = () => {
        setShowHistory(false);
        setCurrent({ id: newConversationId(), title: '', chatId: null, messages: [], updatedAt: Date.now() });
        inputRef.current?.focus();
    };

    const removeConversation = async (id: string) => {
        await deleteConversation(id);
        await refreshList();

        if (current?.id === id) {
            setCurrent({ id: newConversationId(), title: '', chatId: null, messages: [], updatedAt: Date.now() });
        }
    };

    const send = async () => {
        const text = input.trim();

        if (!text || sending || !current) {
            return;
        }

        setInput('');
        setSending(true);

        const userMessage: AssistantMessage = { role: 'user', content: text, ts: Date.now() };
        const conversation: AssistantConversation = {
            ...current,
            title: current.title || (text.length > 20 ? `${text.slice(0, 20)}…` : text),
            messages: [...current.messages, userMessage],
        };
        await persist(conversation);

        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const xsrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1];
            const headers: Record<string, string> = {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            } else if (xsrf) {
                headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
            }

            const response = await fetch('/assistant/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: text,
                    chatId: conversation.chatId ?? undefined,
                    history: conversation.messages
                        .filter((m) => m.content !== welcome)
                        .slice(-10, -1)
                        .map(({ role, content }) => ({ role, content })),
                }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message ?? '请求失败，请稍后重试。');
            }

            conversation.messages.push({ role: 'assistant', content: data.reply, ts: Date.now() });

            if (data.chatId) {
                conversation.chatId = data.chatId;
            }

            await persist(conversation);
        } catch (error) {
            const reason = error instanceof Error ? error.message : '请求失败，请稍后重试。';
            conversation.messages.push({ role: 'assistant', content: `⚠️ ${reason}`, ts: Date.now() });
            await persist(conversation);
        } finally {
            setSending(false);
        }
    };

    const messages = current?.messages ?? [];
    const showWelcome = messages.length === 0;

    return (
        <>
            {/* 悬浮按钮 */}
            <AnimatePresence>
                {!open && (
                    <Tooltip key="assistant-fab">
                        <TooltipTrigger asChild>
                            <motion.button
                                type="button"
                                onClick={() => setOpen(true)}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.94 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                                className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                                aria-label={`打开${name}`}
                            >
                                {assistant.avatarUrl ? (
                                    <img src={assistant.avatarUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
                                ) : (
                                    <Bot className="h-6 w-6" />
                                )}
                            </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="tooltip-dark">
                            {name}
                        </TooltipContent>
                    </Tooltip>
                )}
            </AnimatePresence>

            {/* 对话面板 */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="assistant-panel"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                        style={{ transformOrigin: 'bottom right' }}
                        className="fixed right-4 bottom-4 z-50 flex h-[min(70vh,600px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/55 text-popover-foreground shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur-2xl backdrop-saturate-150"
                    >
                        {/* 顶部高光，营造玻璃层次（不止半透明） */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/35 via-white/8 to-transparent" />

                        {/* 头部 */}
                        <div className="relative flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
                        <Avatar url={assistant.avatarUrl} name={name} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{name}</p>
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                在线
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={startNew}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="新建对话"
                            title="新建对话"
                        >
                            <MessageSquarePlus className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowHistory((v) => !v)}
                            className={cnHistoryButton(showHistory)}
                            aria-label="历史对话"
                            title="历史对话"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                                <path d="M12 7v5l4 2" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="收起"
                            title="收起"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="relative flex min-h-0 flex-1">
                        {/* 消息列表 */}
                        <div className="scroll-nice flex w-full flex-1 flex-col overflow-y-auto px-3 py-3">
                            {showWelcome && (
                                <div className="flex items-start gap-2">
                                    <Avatar url={assistant.avatarUrl} name={name} />
                                    <div
                                        className="assistant-md max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(welcome) }}
                                    />
                                </div>
                            )}

                            {messages.map((message, index) =>
                                message.role === 'user' ? (
                                    <div key={index} className="mt-2 flex justify-end">
                                        <div className="assistant-md max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                                            {message.content}
                                        </div>
                                    </div>
                                ) : (
                                    <div key={index} className="mt-2 flex items-start gap-2">
                                        <Avatar url={assistant.avatarUrl} name={name} />
                                        <div
                                            className="assistant-md max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                        />
                                    </div>
                                ),
                            )}

                            {sending && (
                                <div className="mt-2 flex items-start gap-2">
                                    <Avatar url={assistant.avatarUrl} name={name} />
                                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* 历史对话侧栏 */}
                        {showHistory && (
                            <div className="absolute inset-0 z-10 flex flex-col border-l border-border/50 bg-popover">
                                <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                                    <p className="text-sm font-medium">历史对话</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistory(false)}
                                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label="关闭历史对话"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="scroll-nice flex-1 overflow-y-auto p-2">
                                    {conversations.length === 0 && (
                                        <p className="py-8 text-center text-xs text-muted-foreground">暂无历史对话</p>
                                    )}
                                    {conversations.map((conversation) => (
                                        <div
                                            key={conversation.id}
                                            className={`group flex items-center gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-muted ${current?.id === conversation.id ? 'bg-primary/10' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setCurrent(conversation);
                                                    setShowHistory(false);
                                                }}
                                                className="min-w-0 flex-1 text-left"
                                            >
                                                <p className="truncate text-sm">{conversation.title || '新对话'}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {new Date(conversation.updatedAt).toLocaleString()}
                                                </p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeConversation(conversation.id)}
                                                className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                                aria-label={`删除对话「${conversation.title || '新对话'}」`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 输入区 */}
                    <div className="border-t border-border/50 p-2.5">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void send();
                                    }
                                }}
                                rows={1}
                                placeholder="输入消息…"
                                className="max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary"
                            />
                            <button
                                type="button"
                                onClick={() => void send()}
                                disabled={sending || !input.trim()}
                                className="apple-press flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                                aria-label="发送"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                            Enter 发送 · Shift+Enter 换行 · 会话仅保存在本浏览器
                        </p>
                    </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function cnHistoryButton(active: boolean): string {
    return cn(
        'rounded-lg p-1.5 transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );
}

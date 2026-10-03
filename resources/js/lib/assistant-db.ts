/**
 * AI 小助手会话存储：每个访客的会话保存在浏览器 IndexedDB 中，
 * 支持多会话（历史对话）、删除与清空。
 */

export interface AssistantMessage {
    role: 'user' | 'assistant';
    content: string;
    ts: number;
}

export interface AssistantConversation {
    /** 会话 id，同时作为 FastGPT 的 chatId（保证唯一且长度 < 250） */
    id: string;
    title: string;
    chatId: string | null;
    messages: AssistantMessage[];
    updatedAt: number;
}

const DB_NAME = 'ai-assistant';
const STORE = 'conversations';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();

    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
    });
}

export async function listConversations(): Promise<AssistantConversation[]> {
    const all = await withStore<AssistantConversation[]>('readonly', (store) => store.getAll() as IDBRequest<AssistantConversation[]>);

    return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<AssistantConversation | undefined> {
    return withStore<AssistantConversation | undefined>('readonly', (store) => store.get(id) as IDBRequest<AssistantConversation | undefined>);
}

export async function putConversation(conversation: AssistantConversation): Promise<void> {
    await withStore('readwrite', (store) => store.put(conversation) as IDBRequest<IDBValidKey>);
}

export async function deleteConversation(id: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

export async function clearConversations(): Promise<void> {
    await withStore('readwrite', (store) => store.clear() as IDBRequest<undefined>);
}

export function newConversationId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

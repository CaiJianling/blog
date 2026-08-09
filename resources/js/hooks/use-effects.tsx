import { useSyncExternalStore } from 'react';

export type UseEffectsReturn = {
    readonly effectsEnabled: boolean;
    readonly updateEffectsEnabled: (enabled: boolean) => void;
};

const listeners = new Set<() => void>();
let currentEffectsEnabled: boolean = false;

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredEffectsEnabled = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return localStorage.getItem('effectsEnabled') === 'true';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

export function initializeEffects(): void {
    if (typeof window === 'undefined') {
        return;
    }

    if (!localStorage.getItem('effectsEnabled')) {
        localStorage.setItem('effectsEnabled', 'false');
        setCookie('effectsEnabled', 'false');
    }

    currentEffectsEnabled = getStoredEffectsEnabled();
}

export function useEffects(): UseEffectsReturn {
    const effectsEnabled: boolean = useSyncExternalStore(
        subscribe,
        () => currentEffectsEnabled,
        () => false,
    );

    const updateEffectsEnabled = (enabled: boolean): void => {
        currentEffectsEnabled = enabled;

        localStorage.setItem('effectsEnabled', enabled.toString());
        setCookie('effectsEnabled', enabled.toString());

        notify();
    };

    return { effectsEnabled, updateEffectsEnabled } as const;
}
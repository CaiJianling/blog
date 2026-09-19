import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/** 点击量等计数的紧凑显示：1234 → 1.2k，12000 → 1.2w，其余原样。 */
export function formatCount(count: number): string {
    if (!Number.isFinite(count) || count < 0) {
        return '0';
    }

    if (count >= 10000) {
        return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}w`;
    }

    if (count >= 1000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }

    return String(count);
}

import type { ReactNode } from 'react';
import AiAssistantWidget from '@/components/ai-assistant-widget';
import FloatingActions from '@/components/floating-actions';
import PublicNavbar from '@/components/public-navbar';
import PublicFooter from '@/components/public-footer';

export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <PublicNavbar />
            <main className="flex-1">{children}</main>
            <PublicFooter />
            <FloatingActions />
            <AiAssistantWidget />
        </div>
    );
}

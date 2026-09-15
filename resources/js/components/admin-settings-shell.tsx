import Heading from '@/components/heading';
import { cn } from '@/lib/utils';

interface AdminSettingsShellProps {
    /** 当前页面标题。 */
    title: string;
    /** 当前页面描述。 */
    description: string;
    /** 内容区是否使用宽布局（默认限宽居中，适合表单）。 */
    wide?: boolean;
    children: React.ReactNode;
}

/**
 * 后台设置统一外壳：页面标题 + 内容区，
 * 所有后台设置页面套用此布局以保证一致的外观。
 */
export default function AdminSettingsShell({
    title,
    description,
    wide = false,
    children,
}: AdminSettingsShellProps) {
    return (
        <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
            <Heading variant="small" title={title} description={description} />

            <div
                className={cn(
                    'min-w-0 flex-1',
                    wide
                        ? 'mx-auto w-full max-w-[1500px]'
                        : 'mx-auto w-full max-w-2xl lg:mx-0',
                )}
            >
                {children}
            </div>
        </div>
    );
}

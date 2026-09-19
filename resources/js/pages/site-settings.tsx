import { Form, Head, router } from '@inertiajs/react';
import {
    CalendarClock,
    Image as ImageIcon,
    Languages,
    Search,
    Settings,
    Trash2,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as optionActions from '@/actions/App/Http/Controllers/OptionController';
import AdminSettingsShell from '@/components/admin-settings-shell';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { edit as editSite } from '@/routes/site';

type OptionItem = { value: string; label: string };
type IconItem = { id: number; file_name: string; url: string } | null;

interface Props {
    options: Record<string, string>;
    site_icon: IconItem;
    roles: OptionItem[];
    languages: OptionItem[];
    timezones: OptionItem[];
    weekdays: OptionItem[];
    dateFormats: { value: string; example: string }[];
    timeFormats: { value: string; example: string }[];
    captchaComplexities: OptionItem[];
    captchaTypes: OptionItem[];
}

const PRESET_DATE_FORMATS = ['Y年n月j日', 'Y-m-d', 'm/d/Y', 'd/m/Y', 'd.m.Y'];
const PRESET_TIME_FORMATS = ['ag:i', 'H:i'];

/**
 * 按 PHP date() 格式串实时渲染预览。
 * 支持常用字符：Y y m n d j H G h g i s a A
 * a/A 在中文习惯显示为「上午/下午」，其余字符原样输出。
 */
function formatPhpDate(format: string, date: Date): string {
    const hour = date.getHours();
    const twelve = ((hour + 11) % 12) + 1;
    const isAm = hour < 12;
    const map: Record<string, string> = {
        Y: String(date.getFullYear()),
        y: String(date.getFullYear()).slice(-2),
        m: String(date.getMonth() + 1).padStart(2, '0'),
        n: String(date.getMonth() + 1),
        d: String(date.getDate()).padStart(2, '0'),
        j: String(date.getDate()),
        H: String(hour).padStart(2, '0'),
        G: String(hour),
        h: String(twelve).padStart(2, '0'),
        g: String(twelve),
        i: String(date.getMinutes()).padStart(2, '0'),
        s: String(date.getSeconds()).padStart(2, '0'),
        a: isAm ? '上午' : '下午',
        A: isAm ? 'AM' : 'PM',
    };

    return format.replace(/[YymndjHGhgisaA]/g, (ch) => map[ch] ?? ch);
}

export default function Site({
    options,
    site_icon,
    roles,
    languages,
    timezones,
    weekdays,
    dateFormats,
    timeFormats,
    captchaComplexities,
    captchaTypes,
}: Props) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const customDateRef = useRef<HTMLInputElement>(null);
    const customTimeRef = useRef<HTMLInputElement>(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [currentIcon, setCurrentIcon] = useState<IconItem>(site_icon);

    const initialDateFormat = options.date_format ?? 'Y年n月j日';
    const initialTimeFormat = options.time_format ?? 'ag:i';
    const isInitialDateCustom =
        !PRESET_DATE_FORMATS.includes(initialDateFormat);
    const isInitialTimeCustom =
        !PRESET_TIME_FORMATS.includes(initialTimeFormat);

    // 「选中哪一项」与「自定义文本」分离，避免自定义值与预设冲突导致选项回弹
    const [dateChoice, setDateChoice] = useState<string>(
        isInitialDateCustom ? 'custom' : initialDateFormat,
    );
    const [customDate, setCustomDate] = useState(
        isInitialDateCustom ? initialDateFormat : '',
    );
    const [timeChoice, setTimeChoice] = useState<string>(
        isInitialTimeCustom ? 'custom' : initialTimeFormat,
    );
    const [customTime, setCustomTime] = useState(
        isInitialTimeCustom ? initialTimeFormat : '',
    );
    const [membership, setMembership] = useState(options.membership === '1');
    const [timelineIncludeMoments, setTimelineIncludeMoments] = useState(
        options.timeline_include_moments === '1',
    );
    const [loginCaptchaEnabled, setLoginCaptchaEnabled] = useState(
        options.login_captcha_enabled === '1',
    );
    const [loginCaptchaType, setLoginCaptchaType] = useState(
        options.login_captcha_type ?? 'math',
    );
    const [loginCaptchaComplexity, setLoginCaptchaComplexity] = useState(
        options.login_captcha_complexity ?? 'medium',
    );
    const [commentCaptchaEnabled, setCommentCaptchaEnabled] = useState(
        options.comment_captcha_enabled !== '0',
    );
    const [commentCaptchaType, setCommentCaptchaType] = useState(
        options.comment_captcha_type ?? 'math',
    );
    const [commentCaptchaComplexity, setCommentCaptchaComplexity] = useState(
        options.comment_captcha_complexity ?? 'medium',
    );
    const [registerCaptchaEnabled, setRegisterCaptchaEnabled] = useState(
        options.register_captcha_enabled === '1',
    );
    const [registerCaptchaType, setRegisterCaptchaType] = useState(
        options.register_captcha_type ?? 'math',
    );
    const [registerCaptchaComplexity, setRegisterCaptchaComplexity] = useState(
        options.register_captcha_complexity ?? 'medium',
    );
    const [requireEmailVerification, setRequireEmailVerification] = useState(
        options.require_email_verification === '1',
    );
    const [defaultRole, setDefaultRole] = useState(
        options.default_role ?? 'subscriber',
    );
    const [siteLanguage, setSiteLanguage] = useState(
        options.site_language ?? 'zh',
    );
    const [timezone, setTimezone] = useState(
        options.timezone ?? 'Asia/Shanghai',
    );
    const [startOfWeek, setStartOfWeek] = useState(
        options.start_of_week ?? '1',
    );

    const effectiveDateFormat =
        dateChoice === 'custom' ? customDate : dateChoice;
    const effectiveTimeFormat =
        timeChoice === 'custom' ? customTime : timeChoice;
    const previewNow = new Date();

    const getCsrfToken = (): { headerName: string; value: string } | null => {
        const meta = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        if (meta) {
            return { headerName: 'X-CSRF-TOKEN', value: meta };
        }

        const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

        if (match?.[1]) {
            return {
                headerName: 'X-XSRF-TOKEN',
                value: decodeURIComponent(match[1]),
            };
        }

        return null;
    };

    const handleIconUpload = async (file: File) => {
        setUploadingIcon(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            const result = await new Promise<{
                id: number;
                file_name: string;
                url: string;
            }>((resolve, reject) => {
                xhr.open('POST', optionActions.uploadSiteIcon.url());
                xhr.withCredentials = true;
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json');

                const csrf = getCsrfToken();

                if (csrf) {
                    xhr.setRequestHeader(csrf.headerName, csrf.value);
                } else {
                    reject(new Error('CSRF token not found.'));

                    return;
                }

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch {
                            reject(new Error('Invalid response.'));
                        }
                    } else {
                        let message = `Upload failed (HTTP ${xhr.status})`;

                        try {
                            const json = JSON.parse(xhr.responseText);

                            if (json?.message) {
                                message = json.message;
                            }

                            if (json?.errors?.file) {
                                message = json.errors.file.join(' ');
                            }
                        } catch {
                            /* ignore */
                        }

                        reject(new Error(message));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            setCurrentIcon(result);
            toast.success(t('settings.site.iconUploadSuccess'));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            toast.error(message);
        } finally {
            setUploadingIcon(false);
        }
    };

    const handleIconRemove = () => {
        router.delete(optionActions.removeSiteIcon.url(), {
            preserveScroll: true,
            onSuccess: () => {
                setCurrentIcon(null);
                toast.success(t('settings.site.iconRemoved'));
            },
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            void handleIconUpload(file);
            e.target.value = '';
        }
    };

    const cardHeader = (icon: React.ReactNode, title: string) => (
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    {icon}
                </div>
                <span className="text-callout font-medium">{title}</span>
            </div>
        </div>
    );

    const saveButton = (saving: boolean) => (
        <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
            <Button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
            </Button>
        </div>
    );

    return (
        <>
            <Head title={t('settings.site.title')} />

            <AdminSettingsShell
                title={t('settings.site.heading')}
                description={t('settings.site.description')}
                wide
            >
                <Form
                    {...optionActions.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <input
                                type="hidden"
                                name="site_icon"
                                value={currentIcon?.id ?? ''}
                            />
                            <input
                                type="hidden"
                                name="membership"
                                value={membership ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="timeline_include_moments"
                                value={timelineIncludeMoments ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="login_captcha_enabled"
                                value={loginCaptchaEnabled ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="login_captcha_type"
                                value={loginCaptchaType}
                            />
                            <input
                                type="hidden"
                                name="login_captcha_complexity"
                                value={loginCaptchaComplexity}
                            />
                            <input
                                type="hidden"
                                name="comment_captcha_enabled"
                                value={commentCaptchaEnabled ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="comment_captcha_type"
                                value={commentCaptchaType}
                            />
                            <input
                                type="hidden"
                                name="comment_captcha_complexity"
                                value={commentCaptchaComplexity}
                            />
                            <input
                                type="hidden"
                                name="register_captcha_enabled"
                                value={registerCaptchaEnabled ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="register_captcha_type"
                                value={registerCaptchaType}
                            />
                            <input
                                type="hidden"
                                name="register_captcha_complexity"
                                value={registerCaptchaComplexity}
                            />
                            <input
                                type="hidden"
                                name="require_email_verification"
                                value={requireEmailVerification ? '1' : '0'}
                            />
                            <input
                                type="hidden"
                                name="default_role"
                                value={defaultRole}
                            />
                            <input
                                type="hidden"
                                name="site_language"
                                value={siteLanguage}
                            />
                            <input
                                type="hidden"
                                name="timezone"
                                value={timezone}
                            />
                            <input
                                type="hidden"
                                name="start_of_week"
                                value={startOfWeek}
                            />
                            <input
                                type="hidden"
                                name="date_format"
                                value={effectiveDateFormat}
                            />
                            <input
                                type="hidden"
                                name="time_format"
                                value={effectiveTimeFormat}
                            />

                            {/* General section */}
                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <Settings className="h-4 w-4" />,
                                    t('settings.site.general'),
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <div className="grid gap-2">
                                        <Label htmlFor="site_title">
                                            {t('settings.site.siteTitle')}
                                        </Label>
                                        <Input
                                            id="site_title"
                                            name="site_title"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.site_title ?? ''
                                            }
                                            required
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.site_title}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="site_tagline">
                                            {t('settings.site.siteTagline')}
                                        </Label>
                                        <Textarea
                                            id="site_tagline"
                                            name="site_tagline"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.site_tagline ?? ''
                                            }
                                            rows={2}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.siteTaglineDescription',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.site_tagline}
                                        />
                                    </div>

                                    {/* Site Icon */}
                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.siteIcon')}
                                        </Label>
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                                                {currentIcon ? (
                                                    <img
                                                        src={currentIcon.url}
                                                        alt={
                                                            currentIcon.file_name
                                                        }
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/jpeg,image/png,image/gif,image/webp,image/x-icon"
                                                    onChange={handleFileSelect}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={uploadingIcon}
                                                    onClick={() =>
                                                        fileInputRef.current?.click()
                                                    }
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    {t(
                                                        'settings.site.changeSiteIcon',
                                                    )}
                                                </Button>
                                                {currentIcon && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={
                                                            handleIconRemove
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        {t(
                                                            'settings.site.removeSiteIcon',
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.siteIconDescription',
                                            )}
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="cms_url">
                                            {t('settings.site.cmsUrl')}
                                        </Label>
                                        <Input
                                            id="cms_url"
                                            name="cms_url"
                                            className="mt-1 block w-full"
                                            defaultValue={options.cms_url ?? ''}
                                            required
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.cms_url}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="site_url">
                                            {t('settings.site.siteUrl')}
                                        </Label>
                                        <Input
                                            id="site_url"
                                            name="site_url"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.site_url ?? ''
                                            }
                                            required
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.siteUrlDescription',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.site_url}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="admin_email">
                                            {t('settings.site.adminEmail')}
                                        </Label>
                                        <Input
                                            id="admin_email"
                                            name="admin_email"
                                            type="email"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.admin_email ?? ''
                                            }
                                            required
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.adminEmailDescription',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.admin_email}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.membership')}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="membership"
                                                checked={membership}
                                                onCheckedChange={(checked) =>
                                                    setMembership(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="membership"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.membershipLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <InputError
                                            className="mt-2"
                                            message={errors.membership}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.timeline')}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="timeline_include_moments"
                                                checked={timelineIncludeMoments}
                                                onCheckedChange={(checked) =>
                                                    setTimelineIncludeMoments(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="timeline_include_moments"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.timelineLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-footnote text-muted-foreground">
                                            {t('settings.site.timelineHint')}
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.loginCaptcha')}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="login_captcha_enabled"
                                                checked={loginCaptchaEnabled}
                                                onCheckedChange={(checked) =>
                                                    setLoginCaptchaEnabled(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="login_captcha_enabled"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.loginCaptchaLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-footnote text-muted-foreground">
                                            {t('settings.site.loginCaptchaHint')}
                                        </p>
                                        {loginCaptchaEnabled && (
                                            <>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="login_captcha_type">
                                                        {t(
                                                            'settings.site.loginCaptchaType',
                                                        )}
                                                    </Label>
                                                    <Select
                                                        value={
                                                            loginCaptchaType
                                                        }
                                                        onValueChange={
                                                            setLoginCaptchaType
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="login_captcha_type"
                                                            className="w-72"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {captchaTypes.map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={
                                                                            item.value
                                                                        }
                                                                        value={
                                                                            item.value
                                                                        }
                                                                    >
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {loginCaptchaType !== 'math' && (
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="login_captcha_complexity">
                                                            {t(
                                                                'settings.site.loginCaptchaComplexity',
                                                            )}
                                                        </Label>
                                                        <Select
                                                            value={
                                                                loginCaptchaComplexity
                                                            }
                                                            onValueChange={
                                                                setLoginCaptchaComplexity
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                id="login_captcha_complexity"
                                                                className="w-72"
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {captchaComplexities.map(
                                                                    (item) => (
                                                                        <SelectItem
                                                                            key={
                                                                                item.value
                                                                            }
                                                                            value={
                                                                                item.value
                                                                            }
                                                                        >
                                                                            {
                                                                                item.label
                                                                            }
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <InputError
                                            className="mt-2"
                                            message={
                                                errors.login_captcha_complexity
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t(
                                                'settings.site.commentCaptcha',
                                            )}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="comment_captcha_enabled"
                                                checked={commentCaptchaEnabled}
                                                onCheckedChange={(checked) =>
                                                    setCommentCaptchaEnabled(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="comment_captcha_enabled"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.commentCaptchaLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-footnote text-muted-foreground">
                                            {t(
                                                'settings.site.commentCaptchaHint',
                                            )}
                                        </p>
                                        {commentCaptchaEnabled && (
                                            <>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="comment_captcha_type">
                                                        {t(
                                                            'settings.site.loginCaptchaType',
                                                        )}
                                                    </Label>
                                                    <Select
                                                        value={
                                                            commentCaptchaType
                                                        }
                                                        onValueChange={
                                                            setCommentCaptchaType
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="comment_captcha_type"
                                                            className="w-72"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {captchaTypes.map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={
                                                                            item.value
                                                                        }
                                                                        value={
                                                                            item.value
                                                                        }
                                                                    >
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    </div>
                                                    {commentCaptchaType !==
                                                        'math' && (
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="comment_captcha_complexity">
                                                                {t(
                                                                    'settings.site.loginCaptchaComplexity',
                                                                )}
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    commentCaptchaComplexity
                                                                }
                                                                onValueChange={
                                                                    setCommentCaptchaComplexity
                                                                }
                                                            >
                                                                <SelectTrigger
                                                                    id="comment_captcha_complexity"
                                                                    className="w-72"
                                                                >
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {captchaComplexities.map(
                                                                        (
                                                                            item,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    item.value
                                                                                }
                                                                                value={
                                                                                    item.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    item.label
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                        <InputError
                                            className="mt-2"
                                            message={
                                                errors.comment_captcha_complexity
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.registerCaptcha')}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="register_captcha_enabled"
                                                checked={registerCaptchaEnabled}
                                                onCheckedChange={(checked) =>
                                                    setRegisterCaptchaEnabled(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="register_captcha_enabled"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.registerCaptchaLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-footnote text-muted-foreground">
                                            {t(
                                                'settings.site.registerCaptchaHint',
                                            )}
                                        </p>
                                        {registerCaptchaEnabled && (
                                            <>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="register_captcha_type">
                                                        {t(
                                                            'settings.site.loginCaptchaType',
                                                        )}
                                                    </Label>
                                                    <Select
                                                        value={
                                                            registerCaptchaType
                                                        }
                                                        onValueChange={
                                                            setRegisterCaptchaType
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="register_captcha_type"
                                                            className="w-72"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {captchaTypes.map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={
                                                                            item.value
                                                                        }
                                                                        value={
                                                                            item.value
                                                                        }
                                                                    >
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    </div>
                                                    {registerCaptchaType !==
                                                        'math' && (
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="register_captcha_complexity">
                                                                {t(
                                                                    'settings.site.loginCaptchaComplexity',
                                                                )}
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    registerCaptchaComplexity
                                                                }
                                                                onValueChange={
                                                                    setRegisterCaptchaComplexity
                                                                }
                                                            >
                                                                <SelectTrigger
                                                                    id="register_captcha_complexity"
                                                                    className="w-72"
                                                                >
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {captchaComplexities.map(
                                                                        (
                                                                            item,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    item.value
                                                                                }
                                                                                value={
                                                                                    item.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    item.label
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                        <InputError
                                            className="mt-2"
                                            message={
                                                errors.register_captcha_complexity
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>
                                            {t(
                                                'settings.site.requireEmailVerification',
                                            )}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id="require_email_verification"
                                                checked={requireEmailVerification}
                                                onCheckedChange={(checked) =>
                                                    setRequireEmailVerification(
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor="require_email_verification"
                                                className="cursor-pointer font-normal"
                                            >
                                                {t(
                                                    'settings.site.requireEmailVerificationLabel',
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-footnote text-muted-foreground">
                                            {t(
                                                'settings.site.requireEmailVerificationHint',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={
                                                errors.require_email_verification
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="default_role">
                                            {t('settings.site.defaultRole')}
                                        </Label>
                                        <Select
                                            value={defaultRole}
                                            onValueChange={setDefaultRole}
                                        >
                                            <SelectTrigger
                                                id="default_role"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles.map((role) => (
                                                    <SelectItem
                                                        key={role.value}
                                                        value={role.value}
                                                    >
                                                        {role.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={errors.default_role}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* SEO section */}
                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <Search className="h-4 w-4" />,
                                    t('settings.site.seo'),
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <div className="grid gap-2">
                                        <Label htmlFor="seo_description">
                                            {t('settings.site.seoDescription')}
                                        </Label>
                                        <Textarea
                                            id="seo_description"
                                            name="seo_description"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.seo_description ?? ''
                                            }
                                            rows={3}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.seoDescriptionDescription',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.seo_description}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="seo_keywords">
                                            {t('settings.site.seoKeywords')}
                                        </Label>
                                        <Input
                                            id="seo_keywords"
                                            name="seo_keywords"
                                            className="mt-1 block w-full"
                                            defaultValue={
                                                options.seo_keywords ?? ''
                                            }
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.seo_keywords}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Localization section */}
                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <Languages className="h-4 w-4" />,
                                    `${t('settings.site.language')} / ${t(
                                        'settings.site.timezone',
                                    )}`,
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <div className="grid gap-2">
                                        <Label htmlFor="site_language">
                                            {t('settings.site.language')}
                                        </Label>
                                        <Select
                                            value={siteLanguage}
                                            onValueChange={setSiteLanguage}
                                        >
                                            <SelectTrigger
                                                id="site_language"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {languages.map((lang) => (
                                                    <SelectItem
                                                        key={lang.value}
                                                        value={lang.value}
                                                    >
                                                        {lang.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={errors.site_language}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="timezone">
                                            {t('settings.site.timezone')}
                                        </Label>
                                        <Select
                                            value={timezone}
                                            onValueChange={setTimezone}
                                        >
                                            <SelectTrigger
                                                id="timezone"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {timezones.map((tz) => (
                                                    <SelectItem
                                                        key={tz.value}
                                                        value={tz.value}
                                                    >
                                                        {tz.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'settings.site.timezoneDescription',
                                            )}
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.timezone}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="start_of_week">
                                            {t('settings.site.startOfWeek')}
                                        </Label>
                                        <Select
                                            value={startOfWeek}
                                            onValueChange={setStartOfWeek}
                                        >
                                            <SelectTrigger
                                                id="start_of_week"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {weekdays.map((day) => (
                                                    <SelectItem
                                                        key={day.value}
                                                        value={day.value}
                                                    >
                                                        {day.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            className="mt-2"
                                            message={errors.start_of_week}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Date & Time Format section */}
                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <CalendarClock className="h-4 w-4" />,
                                    `${t('settings.site.dateFormat')} / ${t(
                                        'settings.site.timeFormat',
                                    )}`,
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    {/* Date Format */}
                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.dateFormat')}
                                        </Label>
                                        <div className="space-y-2">
                                            {dateFormats.map((fmt) => (
                                                <label
                                                    key={fmt.value}
                                                    className={cn(
                                                        'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                        dateChoice === fmt.value
                                                            ? 'bg-accent ring-1 ring-primary'
                                                            : 'hover:bg-muted/50',
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="date_format_preset"
                                                            value={fmt.value}
                                                            checked={
                                                                dateChoice ===
                                                                fmt.value
                                                            }
                                                            onChange={() =>
                                                                setDateChoice(
                                                                    fmt.value,
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm">
                                                            {formatPhpDate(
                                                                fmt.value,
                                                                previewNow,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <code className="text-xs text-muted-foreground">
                                                        {fmt.value}
                                                    </code>
                                                </label>
                                            ))}
                                            <label
                                                className={cn(
                                                    'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                    dateChoice === 'custom'
                                                        ? 'bg-accent ring-1 ring-primary'
                                                        : 'hover:bg-muted/50',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="date_format_preset"
                                                        value="custom"
                                                        checked={
                                                            dateChoice ===
                                                            'custom'
                                                        }
                                                        onChange={() => {
                                                            setDateChoice(
                                                                'custom',
                                                            );

                                                            if (!customDate) {
                                                                setCustomDate(
                                                                    'Y年n月j日',
                                                                );
                                                            }

                                                            setTimeout(
                                                                () =>
                                                                    customDateRef.current?.focus(),
                                                                0,
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-sm">
                                                        {t(
                                                            'settings.site.custom',
                                                        )}
                                                    </span>
                                                </div>
                                            </label>
                                            {dateChoice === 'custom' && (
                                                <div className="ml-6 flex items-center gap-2">
                                                    <Label
                                                        htmlFor="custom_date_format"
                                                        className="shrink-0 text-sm text-muted-foreground"
                                                    >
                                                        {t(
                                                            'settings.site.customFormat',
                                                        )}
                                                        :
                                                    </Label>
                                                    <Input
                                                        ref={customDateRef}
                                                        id="custom_date_format"
                                                        className="max-w-xs"
                                                        value={customDate}
                                                        placeholder="Y年n月j日"
                                                        onChange={(e) =>
                                                            setCustomDate(
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t('settings.site.preview')}:{' '}
                                            <strong>
                                                {formatPhpDate(
                                                    effectiveDateFormat,
                                                    previewNow,
                                                )}
                                            </strong>
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.date_format}
                                        />
                                    </div>

                                    {/* Time Format */}
                                    <div className="grid gap-2">
                                        <Label>
                                            {t('settings.site.timeFormat')}
                                        </Label>
                                        <div className="space-y-2">
                                            {timeFormats.map((fmt) => (
                                                <label
                                                    key={fmt.value}
                                                    className={cn(
                                                        'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                        timeChoice === fmt.value
                                                            ? 'bg-accent ring-1 ring-primary'
                                                            : 'hover:bg-muted/50',
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="time_format_preset"
                                                            value={fmt.value}
                                                            checked={
                                                                timeChoice ===
                                                                fmt.value
                                                            }
                                                            onChange={() =>
                                                                setTimeChoice(
                                                                    fmt.value,
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm">
                                                            {formatPhpDate(
                                                                fmt.value,
                                                                previewNow,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <code className="text-xs text-muted-foreground">
                                                        {fmt.value}
                                                    </code>
                                                </label>
                                            ))}
                                            <label
                                                className={cn(
                                                    'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                    timeChoice === 'custom'
                                                        ? 'bg-accent ring-1 ring-primary'
                                                        : 'hover:bg-muted/50',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="time_format_preset"
                                                        value="custom"
                                                        checked={
                                                            timeChoice ===
                                                            'custom'
                                                        }
                                                        onChange={() => {
                                                            setTimeChoice(
                                                                'custom',
                                                            );

                                                            if (!customTime) {
                                                                setCustomTime(
                                                                    'ag:i',
                                                                );
                                                            }

                                                            setTimeout(
                                                                () =>
                                                                    customTimeRef.current?.focus(),
                                                                0,
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-sm">
                                                        {t(
                                                            'settings.site.custom',
                                                        )}
                                                    </span>
                                                </div>
                                            </label>
                                            {timeChoice === 'custom' && (
                                                <div className="ml-6 flex items-center gap-2">
                                                    <Label
                                                        htmlFor="custom_time_format"
                                                        className="shrink-0 text-sm text-muted-foreground"
                                                    >
                                                        {t(
                                                            'settings.site.customFormat',
                                                        )}
                                                        :
                                                    </Label>
                                                    <Input
                                                        ref={customTimeRef}
                                                        id="custom_time_format"
                                                        className="max-w-xs"
                                                        value={customTime}
                                                        placeholder="ag:i"
                                                        onChange={(e) =>
                                                            setCustomTime(
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t('settings.site.preview')}:{' '}
                                            <strong>
                                                {formatPhpDate(
                                                    effectiveTimeFormat,
                                                    previewNow,
                                                )}
                                            </strong>
                                        </p>
                                        <InputError
                                            className="mt-2"
                                            message={errors.time_format}
                                        />
                                    </div>

                                    {saveButton(processing)}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </Form>
            </AdminSettingsShell>
        </>
    );
}

Site.layout = {
    breadcrumbs: [
        {
            title: 'settings.site.title',
            href: editSite(),
        },
    ],
};

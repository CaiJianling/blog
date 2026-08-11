import { Form, Head, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import * as optionActions from '@/actions/App/Http/Controllers/OptionController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
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
import { edit as editSite } from '@/routes/site';
import { cn } from '@/lib/utils';

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
}

const PRESET_DATE_FORMATS = ['Y年n月j日', 'Y-m-d', 'm/d/Y', 'd/m/Y', 'd.m.Y'];
const PRESET_TIME_FORMATS = ['ag:i', 'H:i'];

export default function Site({
    options,
    site_icon,
    roles,
    languages,
    timezones,
    weekdays,
    dateFormats,
    timeFormats,
}: Props) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [currentIcon, setCurrentIcon] = useState<IconItem>(site_icon);

    const initialDateFormat = options.date_format ?? 'Y年n月j日';
    const initialTimeFormat = options.time_format ?? 'ag:i';
    const isInitialDateCustom = !PRESET_DATE_FORMATS.includes(initialDateFormat);
    const isInitialTimeCustom = !PRESET_TIME_FORMATS.includes(initialTimeFormat);

    const [dateFormat, setDateFormat] = useState(initialDateFormat);
    const [customDateFormat, setCustomDateFormat] = useState(
        isInitialDateCustom ? initialDateFormat : '',
    );
    const [timeFormat, setTimeFormat] = useState(initialTimeFormat);
    const [customTimeFormat, setCustomTimeFormat] = useState(
        isInitialTimeCustom ? initialTimeFormat : '',
    );
    const [membership, setMembership] = useState(options.membership === '1');
    const [defaultRole, setDefaultRole] = useState(options.default_role ?? 'subscriber');
    const [siteLanguage, setSiteLanguage] = useState(options.site_language ?? 'zh');
    const [timezone, setTimezone] = useState(options.timezone ?? 'Asia/Shanghai');
    const [startOfWeek, setStartOfWeek] = useState(options.start_of_week ?? '1');

    const isCustomDate = !PRESET_DATE_FORMATS.includes(dateFormat);
    const isCustomTime = !PRESET_TIME_FORMATS.includes(timeFormat);

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
            const result = await new Promise<{ id: number; file_name: string; url: string }>((resolve, reject) => {
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
                            if (json?.message) message = json.message;
                            if (json?.errors?.file) message = json.errors.file.join(' ');
                        } catch { /* ignore */ }
                        reject(new Error(message));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            setCurrentIcon(result);
            toast.success(t('settings.site.iconUploadSuccess'));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
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

    return (
        <>
            <Head title={t('settings.site.title')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <h1 className="sr-only">{t('settings.site.title')}</h1>

                <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('settings.site.heading')}
                    description={t('settings.site.description')}
                />

                <Form
                    {...optionActions.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-12"
                >
                    {({ processing, errors }) => (
                        <>
                            <input type="hidden" name="site_icon" value={currentIcon?.id ?? ''} />
                            <input type="hidden" name="membership" value={membership ? '1' : '0'} />
                            <input type="hidden" name="default_role" value={defaultRole} />
                            <input type="hidden" name="site_language" value={siteLanguage} />
                            <input type="hidden" name="timezone" value={timezone} />
                            <input type="hidden" name="start_of_week" value={startOfWeek} />
                            <input type="hidden" name="date_format" value={dateFormat} />
                            <input type="hidden" name="time_format" value={timeFormat} />

                            {/* General section */}
                            <div className="space-y-6">
                                <h3 className="text-base font-medium">{t('settings.site.general')}</h3>

                                <div className="grid gap-2">
                                    <Label htmlFor="site_title">{t('settings.site.siteTitle')}</Label>
                                    <Input
                                        id="site_title"
                                        name="site_title"
                                        className="mt-1 block w-full"
                                        defaultValue={options.site_title ?? ''}
                                        required
                                    />
                                    <InputError className="mt-2" message={errors.site_title} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="site_tagline">{t('settings.site.siteTagline')}</Label>
                                    <Textarea
                                        id="site_tagline"
                                        name="site_tagline"
                                        className="mt-1 block w-full"
                                        defaultValue={options.site_tagline ?? ''}
                                        rows={2}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.siteTaglineDescription')}
                                    </p>
                                    <InputError className="mt-2" message={errors.site_tagline} />
                                </div>

                                {/* Site Icon */}
                                <div className="grid gap-2">
                                    <Label>{t('settings.site.siteIcon')}</Label>
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                                            {currentIcon ? (
                                                <img
                                                    src={currentIcon.url}
                                                    alt={currentIcon.file_name}
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
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Upload className="h-4 w-4" />
                                                {t('settings.site.changeSiteIcon')}
                                            </Button>
                                            {currentIcon && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleIconRemove}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    {t('settings.site.removeSiteIcon')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.siteIconDescription')}
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="cms_url">{t('settings.site.cmsUrl')}</Label>
                                    <Input
                                        id="cms_url"
                                        name="cms_url"
                                        className="mt-1 block w-full"
                                        defaultValue={options.cms_url ?? ''}
                                        required
                                    />
                                    <InputError className="mt-2" message={errors.cms_url} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="site_url">{t('settings.site.siteUrl')}</Label>
                                    <Input
                                        id="site_url"
                                        name="site_url"
                                        className="mt-1 block w-full"
                                        defaultValue={options.site_url ?? ''}
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.siteUrlDescription')}
                                    </p>
                                    <InputError className="mt-2" message={errors.site_url} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="admin_email">{t('settings.site.adminEmail')}</Label>
                                    <Input
                                        id="admin_email"
                                        name="admin_email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={options.admin_email ?? ''}
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.adminEmailDescription')}
                                    </p>
                                    <InputError className="mt-2" message={errors.admin_email} />
                                </div>

                                <div className="grid gap-2">
                                    <Label>{t('settings.site.membership')}</Label>
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="membership"
                                            checked={membership}
                                            onCheckedChange={(checked) => setMembership(checked === true)}
                                        />
                                        <Label htmlFor="membership" className="cursor-pointer font-normal">
                                            {t('settings.site.membershipLabel')}
                                        </Label>
                                    </div>
                                    <InputError className="mt-2" message={errors.membership} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="default_role">{t('settings.site.defaultRole')}</Label>
                                    <Select
                                        value={defaultRole}
                                        onValueChange={setDefaultRole}
                                    >
                                        <SelectTrigger id="default_role" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.value} value={role.value}>
                                                    {role.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError className="mt-2" message={errors.default_role} />
                                </div>
                            </div>

                            {/* Localization section */}
                            <div className="space-y-6">
                                <h3 className="text-base font-medium">
                                    {t('settings.site.language')} / {t('settings.site.timezone')}
                                </h3>

                                <div className="grid gap-2">
                                    <Label htmlFor="site_language">{t('settings.site.language')}</Label>
                                    <Select
                                        value={siteLanguage}
                                        onValueChange={setSiteLanguage}
                                    >
                                        <SelectTrigger id="site_language" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {languages.map((lang) => (
                                                <SelectItem key={lang.value} value={lang.value}>
                                                    {lang.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError className="mt-2" message={errors.site_language} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="timezone">{t('settings.site.timezone')}</Label>
                                    <Select
                                        value={timezone}
                                        onValueChange={setTimezone}
                                    >
                                        <SelectTrigger id="timezone" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {timezones.map((tz) => (
                                                <SelectItem key={tz.value} value={tz.value}>
                                                    {tz.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.timezoneDescription')}
                                    </p>
                                    <InputError className="mt-2" message={errors.timezone} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="start_of_week">{t('settings.site.startOfWeek')}</Label>
                                    <Select
                                        value={startOfWeek}
                                        onValueChange={setStartOfWeek}
                                    >
                                        <SelectTrigger id="start_of_week" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {weekdays.map((day) => (
                                                <SelectItem key={day.value} value={day.value}>
                                                    {day.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError className="mt-2" message={errors.start_of_week} />
                                </div>
                            </div>

                            {/* Date & Time Format section */}
                            <div className="space-y-6">
                                <h3 className="text-base font-medium">
                                    {t('settings.site.dateFormat')} / {t('settings.site.timeFormat')}
                                </h3>

                                {/* Date Format */}
                                <div className="grid gap-2">
                                    <Label>{t('settings.site.dateFormat')}</Label>
                                    <div className="space-y-2">
                                        {dateFormats.map((fmt) => (
                                            <label
                                                key={fmt.value}
                                                className={cn(
                                                    'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                    dateFormat === fmt.value && !isCustomDate
                                                        ? 'bg-accent ring-1 ring-primary'
                                                        : 'hover:bg-muted/50',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="date_format_preset"
                                                        value={fmt.value}
                                                        checked={dateFormat === fmt.value && !isCustomDate}
                                                        onChange={() => {
                                                            setDateFormat(fmt.value);
                                                            setCustomDateFormat('');
                                                        }}
                                                    />
                                                    <span className="text-sm">{fmt.example}</span>
                                                </div>
                                                <code className="text-xs text-muted-foreground">{fmt.value}</code>
                                            </label>
                                        ))}
                                        <label
                                            className={cn(
                                                'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                isCustomDate
                                                    ? 'bg-accent ring-1 ring-primary'
                                                    : 'hover:bg-muted/50',
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="date_format_preset"
                                                    value="custom"
                                                    checked={isCustomDate}
                                                    onChange={() => {
                                                        const next = customDateFormat || 'Y年n月j日';
                                                        setCustomDateFormat(next);
                                                        setDateFormat(next);
                                                    }}
                                                />
                                                <span className="text-sm">{t('settings.site.custom')}</span>
                                            </div>
                                        </label>
                                        {isCustomDate && (
                                            <div className="ml-6 flex items-center gap-2">
                                                <Label htmlFor="custom_date_format" className="text-sm text-muted-foreground">
                                                    {t('settings.site.customFormat')}:
                                                </Label>
                                                <Input
                                                    id="custom_date_format"
                                                    className="max-w-xs"
                                                    value={customDateFormat}
                                                    onChange={(e) => {
                                                        setCustomDateFormat(e.target.value);
                                                        setDateFormat(e.target.value);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.preview')}: <strong>{new Date().toLocaleDateString()}</strong>
                                    </p>
                                    <InputError className="mt-2" message={errors.date_format} />
                                </div>

                                {/* Time Format */}
                                <div className="grid gap-2">
                                    <Label>{t('settings.site.timeFormat')}</Label>
                                    <div className="space-y-2">
                                        {timeFormats.map((fmt) => (
                                            <label
                                                key={fmt.value}
                                                className={cn(
                                                    'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                    timeFormat === fmt.value && !isCustomTime
                                                        ? 'bg-accent ring-1 ring-primary'
                                                        : 'hover:bg-muted/50',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="time_format_preset"
                                                        value={fmt.value}
                                                        checked={timeFormat === fmt.value && !isCustomTime}
                                                        onChange={() => {
                                                            setTimeFormat(fmt.value);
                                                            setCustomTimeFormat('');
                                                        }}
                                                    />
                                                    <span className="text-sm">{fmt.example}</span>
                                                </div>
                                                <code className="text-xs text-muted-foreground">{fmt.value}</code>
                                            </label>
                                        ))}
                                        <label
                                            className={cn(
                                                'flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-all',
                                                isCustomTime
                                                    ? 'bg-accent ring-1 ring-primary'
                                                    : 'hover:bg-muted/50',
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="time_format_preset"
                                                    value="custom"
                                                    checked={isCustomTime}
                                                    onChange={() => {
                                                        const next = customTimeFormat || 'ag:i';
                                                        setCustomTimeFormat(next);
                                                        setTimeFormat(next);
                                                    }}
                                                />
                                                <span className="text-sm">{t('settings.site.custom')}</span>
                                            </div>
                                        </label>
                                        {isCustomTime && (
                                            <div className="ml-6 flex items-center gap-2">
                                                <Label htmlFor="custom_time_format" className="text-sm text-muted-foreground">
                                                    {t('settings.site.customFormat')}:
                                                </Label>
                                                <Input
                                                    id="custom_time_format"
                                                    className="max-w-xs"
                                                    value={customTimeFormat}
                                                    onChange={(e) => {
                                                        setCustomTimeFormat(e.target.value);
                                                        setTimeFormat(e.target.value);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.site.preview')}: <strong>{new Date().toLocaleTimeString()}</strong>
                                    </p>
                                    <InputError className="mt-2" message={errors.time_format} />
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button disabled={processing}>
                                    {t('settings.site.save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
                </div>
            </div>
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

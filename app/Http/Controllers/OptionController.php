<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Option;
use App\Services\AttachmentService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class OptionController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * List of all configurable site options.
     */
    private const SITE_OPTION_KEYS = [
        'site_title',
        'site_tagline',
        'site_icon',
        'cms_url',
        'site_url',
        'admin_email',
        'membership',
        'default_role',
        'site_language',
        'timezone',
        'date_format',
        'time_format',
        'start_of_week',
    ];

    /**
     * Show the site settings page.
     */
    public function edit(Request $request): Response
    {
        $options = Option::whereIn('option_name', self::SITE_OPTION_KEYS)
            ->pluck('option_value', 'option_name');

        $siteIconId = (int) $options->get('site_icon', '');
        $siteIcon = null;
        if ($siteIconId > 0) {
            $attachment = Attachment::find($siteIconId);
            if ($attachment && $attachment->isImage()) {
                /** @var FilesystemAdapter $publicDisk */
                $publicDisk = Storage::disk('public');
                $siteIcon = [
                    'id' => $attachment->id,
                    'file_name' => $attachment->file_name,
                    'url' => $publicDisk->url($attachment->file_path),
                ];
            }
        }

        return Inertia::render('site-settings', [
            'options' => $options->toArray(),
            'site_icon' => $siteIcon,
            'roles' => [
                ['value' => 'subscriber', 'label' => '订阅者'],
                ['value' => 'contributor', 'label' => '贡献者'],
                ['value' => 'author', 'label' => '作者'],
            ],
            'languages' => [
                ['value' => 'zh', 'label' => '中文'],
                ['value' => 'en', 'label' => 'English'],
            ],
            'timezones' => $this->getTimezones(),
            'weekdays' => [
                ['value' => '0', 'label' => '星期日'],
                ['value' => '1', 'label' => '星期一'],
                ['value' => '2', 'label' => '星期二'],
                ['value' => '3', 'label' => '星期三'],
                ['value' => '4', 'label' => '星期四'],
                ['value' => '5', 'label' => '星期五'],
                ['value' => '6', 'label' => '星期六'],
            ],
            'dateFormats' => [
                ['value' => 'Y年n月j日', 'example' => now()->format('Y年n月j日')],
                ['value' => 'Y-m-d', 'example' => now()->format('Y-m-d')],
                ['value' => 'm/d/Y', 'example' => now()->format('m/d/Y')],
                ['value' => 'd/m/Y', 'example' => now()->format('d/m/Y')],
                ['value' => 'd.m.Y', 'example' => now()->format('d.m.Y')],
            ],
            'timeFormats' => [
                ['value' => 'ag:i', 'example' => now()->format('g:i A')],
                ['value' => 'H:i', 'example' => now()->format('H:i')],
            ],
        ]);
    }

    /**
     * Update the site settings.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'site_title' => ['required', 'string', 'max:255'],
            'site_tagline' => ['nullable', 'string', 'max:500'],
            'site_icon' => ['nullable', 'integer'],
            'cms_url' => ['required', 'string', 'url', 'max:255'],
            'site_url' => ['required', 'string', 'url', 'max:255'],
            'admin_email' => ['required', 'string', 'email', 'max:255'],
            'membership' => ['nullable', 'in:0,1'],
            'default_role' => ['required', 'in:subscriber,contributor,author'],
            'site_language' => ['required', 'in:zh,en'],
            'timezone' => ['required', 'string', 'timezone'],
            'date_format' => ['required', 'string', 'max:50'],
            'time_format' => ['required', 'string', 'max:50'],
            'start_of_week' => ['required', 'in:0,1,2,3,4,5,6'],
        ]);

        foreach (self::SITE_OPTION_KEYS as $key) {
            $value = $validated[$key] ?? '';
            Option::set($key, $value);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => '站点设置已保存。']);

        return to_route('site.edit');
    }

    /**
     * Remove the site icon.
     */
    public function removeSiteIcon()
    {
        Option::set('site_icon', '');

        return to_route('site.edit');
    }

    /**
     * Upload a new site icon and store its attachment ID.
     */
    public function uploadSiteIcon(Request $request)
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:5120',
                'mimes:jpg,jpeg,png,gif,webp,ico',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.file' => '请上传文件类型。',
            'file.max' => '站点图标不能超过 5 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp/ico 格式。',
        ]);

        $file = $validated['file'];
        $meta = $this->attachments->validateUploadedFile($file);
        $attachment = $this->attachments->persistFile(
            $file,
            $meta,
            'site_icon',
            null,
        );

        Option::set('site_icon', (string) $attachment->id);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'file_name' => $attachment->file_name,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * Get common timezones grouped by region.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function getTimezones(): array
    {
        $identifiers = \DateTimeZone::listIdentifiers();
        $common = [
            'Asia/Shanghai' => '上海',
            'Asia/Hong_Kong' => '香港',
            'Asia/Tokyo' => '东京',
            'Asia/Singapore' => '新加坡',
            'Asia/Seoul' => '首尔',
            'Asia/Bangkok' => '曼谷',
            'Asia/Dubai' => '迪拜',
            'Europe/London' => '伦敦',
            'Europe/Paris' => '巴黎',
            'Europe/Berlin' => '柏林',
            'Europe/Moscow' => '莫斯科',
            'America/New_York' => '纽约',
            'America/Chicago' => '芝加哥',
            'America/Los_Angeles' => '洛杉矶',
            'America/Toronto' => '多伦多',
            'America/Sao_Paulo' => '圣保罗',
            'Australia/Sydney' => '悉尼',
            'Pacific/Auckland' => '奥克兰',
            'UTC' => 'UTC',
        ];

        $result = [];
        foreach ($common as $value => $label) {
            if (in_array($value, $identifiers, true)) {
                $result[] = ['value' => $value, 'label' => $label];
            }
        }

        return $result;
    }
}

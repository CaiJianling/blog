<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Option;
use App\Services\AttachmentService;
use App\Services\CaptchaService;
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
        'seo_description',
        'seo_keywords',
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
        'timeline_include_moments',
        'login_captcha_enabled',
        'login_captcha_type',
        'login_captcha_complexity',
        'comment_captcha_type',
    ];

    /**
     * Show the site settings page.
     */
    public function edit(Request $request): Response
    {
        $options = Option::whereIn('option_name', self::SITE_OPTION_KEYS)
            ->pluck('option_value', 'option_name');

        // 验证码设置默认值：登录默认关闭、简单计算方式、中等复杂度；评论默认简单计算方式
        $options->put('login_captcha_enabled', $options->get('login_captcha_enabled', '0'));
        $options->put('login_captcha_type', $options->get('login_captcha_type', CaptchaService::TYPE_MATH));
        $options->put('login_captcha_complexity', $options->get('login_captcha_complexity', CaptchaService::COMPLEXITY_MEDIUM));
        $options->put('comment_captcha_type', $options->get('comment_captcha_type', CaptchaService::TYPE_MATH));

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
            'captchaComplexities' => [
                ['value' => CaptchaService::COMPLEXITY_EASY, 'label' => '简单（4 位，轻度干扰）'],
                ['value' => CaptchaService::COMPLEXITY_MEDIUM, 'label' => '中等（4 位，中等干扰）'],
                ['value' => CaptchaService::COMPLEXITY_HARD, 'label' => '困难（5 位，强干扰）'],
            ],
            'captchaTypes' => [
                ['value' => CaptchaService::TYPE_MATH, 'label' => '简单计算验证码'],
                ['value' => CaptchaService::TYPE_IMAGE, 'label' => '图形字符验证码'],
                ['value' => CaptchaService::TYPE_IMAGE_MATH, 'label' => '简单计算图形验证码'],
            ],
        ]);
    }

    /**
     * Update the site settings.
     */
    public function update(Request $request)
    {
        // 规范化空字符串字段：site_icon 为空时转为 null，membership 缺省为 '0'
        $request->merge([
            'site_icon' => $request->input('site_icon') ?: null,
            'membership' => $request->input('membership', '0') === '1' ? '1' : '0',
            'timeline_include_moments' => $request->input('timeline_include_moments', '0') === '1' ? '1' : '0',
            'login_captcha_enabled' => $request->input('login_captcha_enabled', '0') === '1' ? '1' : '0',
            'login_captcha_complexity' => in_array($request->input('login_captcha_complexity'), [CaptchaService::COMPLEXITY_EASY, CaptchaService::COMPLEXITY_MEDIUM, CaptchaService::COMPLEXITY_HARD], true)
                ? $request->input('login_captcha_complexity')
                : CaptchaService::COMPLEXITY_MEDIUM,
            'login_captcha_type' => in_array($request->input('login_captcha_type'), CaptchaService::validTypes(), true)
                ? $request->input('login_captcha_type')
                : CaptchaService::TYPE_MATH,
            'comment_captcha_type' => in_array($request->input('comment_captcha_type'), CaptchaService::validTypes(), true)
                ? $request->input('comment_captcha_type')
                : CaptchaService::TYPE_MATH,
        ]);

        $validated = $request->validate([
            'site_title' => ['required', 'string', 'max:255'],
            'site_tagline' => ['nullable', 'string', 'max:500'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'seo_keywords' => ['nullable', 'string', 'max:200'],
            'site_icon' => ['nullable', 'integer'],
            'cms_url' => ['required', 'string', 'url', 'max:255'],
            'site_url' => ['required', 'string', 'url', 'max:255'],
            'admin_email' => ['required', 'string', 'email', 'max:255'],
            'membership' => ['nullable', 'in:0,1'],
            'timeline_include_moments' => ['nullable', 'in:0,1'],
            'login_captcha_enabled' => ['nullable', 'in:0,1'],
            'login_captcha_complexity' => ['nullable', 'in:easy,medium,hard'],
            'login_captcha_type' => ['nullable', 'in:math,image,image_math'],
            'comment_captcha_type' => ['nullable', 'in:math,image,image_math'],
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
        // 恢复默认：从文件库删除站点图标
        $this->attachments->deleteByParent('site_icon', null);
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

        // 更换图标：先从文件库删除旧图
        $attachment = $this->attachments->replaceSystemImage('site_icon', null, $file, $meta);

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

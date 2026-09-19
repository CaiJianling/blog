<?php

namespace App\Services;

use App\Models\Attachment;
use App\Models\Option;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * 前台网页背景：
 * - 模式：不使用壁纸（''）/ 自定义壁纸（custom）/ 必应每日壁纸（bing）
 * - 透明度：壁纸层的不透明度 0-100（0=不可见，100=完全不透明）
 *
 * 壁纸以「系统图像」形式存于附件库（parent_type = page_background_custom / page_background_bing），
 * 上传替换、移除、必应每日刷新时都会删除上一张存储的壁纸文件与记录。
 * 必应壁纸由后台访问/每日计划任务触发刷新（前台请求零外网依赖）。
 */
class PageBackgroundService
{
    public function __construct(protected AttachmentService $attachments) {}

    /**
     * 背景模式：不使用壁纸。
     */
    public const MODE_NONE = '';

    /**
     * 背景模式：自定义上传壁纸。
     */
    public const MODE_CUSTOM = 'custom';

    /**
     * 背景模式：必应每日壁纸。
     */
    public const MODE_BING = 'bing';

    /**
     * 允许的壁纸模式列表。
     *
     * @return array<int, string>
     */
    public static function modes(): array
    {
        return [self::MODE_NONE, self::MODE_CUSTOM, self::MODE_BING];
    }

    /**
     * 必应接口可尝试的主机（命中即用，图片也从同一主机下载）。
     *
     * @return array<int, string>
     */
    public static function bingHosts(): array
    {
        return ['https://cn.bing.com', 'https://www.bing.com'];
    }

    /**
     * 当前背景模式。
     */
    public function mode(): string
    {
        $mode = (string) Option::get('page_background_mode', self::MODE_NONE);

        return in_array($mode, self::modes(), true) ? $mode : self::MODE_NONE;
    }

    /**
     * 壁纸不透明度（0-100，默认 100）。
     */
    public function opacity(): int
    {
        $opacity = (int) Option::get('page_background_opacity', '100');

        return max(0, min(100, $opacity));
    }

    /**
     * 当前生效的壁纸 URL（按模式解析；无壁纸或壁纸缺失返回 null）。不产生任何网络请求。
     */
    public function currentUrl(): ?string
    {
        return match ($this->mode()) {
            self::MODE_CUSTOM => $this->customUrl(),
            self::MODE_BING => $this->bingUrl(),
            default => null,
        };
    }

    /**
     * 自定义壁纸 URL。
     */
    public function customUrl(): ?string
    {
        return $this->attachments->systemImageUrl('page_background_custom', null);
    }

    /**
     * 已存储的必应壁纸 URL（仅读取本地，不联网）。
     */
    public function bingUrl(): ?string
    {
        return $this->attachments->systemImageUrl('page_background_bing', null);
    }

    /**
     * 前台共享给 Inertia 的背景配置。
     *
     * @return array{mode: string, url: ?string, opacity: int}
     */
    public function configProps(): array
    {
        return [
            'mode' => $this->mode(),
            'url' => $this->currentUrl(),
            'opacity' => $this->opacity(),
        ];
    }

    /**
     * 后台主题设置页所需的背景 props（含两种壁纸的预览地址）。
     *
     * @return array{mode: string, opacity: int, url: ?string, customUrl: ?string, bingUrl: ?string}
     */
    public function settingsProps(): array
    {
        return [
            'mode' => $this->mode(),
            'opacity' => $this->opacity(),
            'url' => $this->currentUrl(),
            'customUrl' => $this->customUrl(),
            'bingUrl' => $this->bingUrl(),
        ];
    }

    /**
     * 上传自定义壁纸：替换语义，旧壁纸文件与记录先被删除。
     */
    public function storeCustom(UploadedFile $file): Attachment
    {
        $meta = $this->attachments->validateUploadedFile($file);

        if (! $meta['is_image']) {
            throw new RuntimeException('壁纸必须是图片文件（jpg/png/webp）。');
        }

        $attachment = $this->attachments->replaceSystemImage('page_background_custom', null, $file, $meta);
        Option::set('page_background_custom', (string) $attachment->id);

        return $attachment;
    }

    /**
     * 移除自定义壁纸（删除文件与记录）；若当前模式为自定义则一并切回"不使用"。
     */
    public function removeCustom(): void
    {
        $this->attachments->deleteByParent('page_background_custom', null);
        Option::set('page_background_custom', '');

        if ($this->mode() === self::MODE_CUSTOM) {
            Option::set('page_background_mode', self::MODE_NONE);
        }
    }

    /**
     * 切换背景模式并清理不再使用的存储壁纸：
     * - 离开 custom 模式 → 删除自定义壁纸
     * - 离开 bing 模式 → 删除必应壁纸
     */
    public function changeMode(string $mode): void
    {
        $mode = in_array($mode, self::modes(), true) ? $mode : self::MODE_NONE;
        $previous = $this->mode();

        if ($previous === self::MODE_CUSTOM && $mode !== self::MODE_CUSTOM) {
            $this->attachments->deleteByParent('page_background_custom', null);
            Option::set('page_background_custom', '');
        }

        if ($previous === self::MODE_BING && $mode !== self::MODE_BING) {
            $this->attachments->deleteByParent('page_background_bing', null);
            Option::set('page_background_bing', '');
            Option::set('page_background_bing_date', '');
        }

        Option::set('page_background_mode', $mode);
    }

    /**
     * 刷新必应每日壁纸：今日已获取则直接返回本地 URL；
     * 否则拉取必应接口下载当日壁纸，替换旧图（先删除上一张）。
     * 拉取失败时保留旧壁纸并记录日志（不抛出，供计划任务安全调用）。
     *
     * @param  bool  $force  强制刷新（忽略"今日已获取"判断，仅后台手动/定时场景使用）
     */
    public function refreshBingWallpaper(bool $force = false): ?string
    {
        $previous = $this->bingUrl();

        if ($this->mode() !== self::MODE_BING && ! $force) {
            return $previous;
        }

        if (! $force && Option::get('page_background_bing_date', '') === now()->toDateString()) {
            return $previous;
        }

        try {
            $image = $this->fetchBingImage();

            // 替换语义：先删除上一张必应壁纸（文件 + 记录）
            $this->attachments->deleteByParent('page_background_bing', null);

            $attachment = $this->storeImageBytes(
                $image['bytes'],
                $image['extension'],
                $image['mime'],
                'bing_daily_'.now()->toDateString(),
            );

            Option::set('page_background_bing', (string) $attachment->id);
            Option::set('page_background_bing_date', now()->toDateString());

            return Storage::disk('public')->url($attachment->file_path);
        } catch (\Throwable $e) {
            Log::warning('PageBackgroundService: 获取必应每日壁纸失败，保留上一张', [
                'error' => $e->getMessage(),
            ]);

            return $previous;
        }
    }

    /**
     * 拉取必应当日壁纸接口并下载图片字节。
     *
     * @return array{bytes: string, extension: string, mime: string}
     */
    protected function fetchBingImage(): array
    {
        $payload = null;
        $host = null;

        foreach (self::bingHosts() as $candidate) {
            try {
                $response = Http::timeout(8)->connectTimeout(5)
                    ->get($candidate.'/HPImageArchive.aspx', [
                        'format' => 'js',
                        'idx' => 0,
                        'n' => 1,
                    ]);
            } catch (\Throwable) {
                continue;
            }

            if ($response->successful()) {
                $images = $response->json('images');

                if (is_array($images) && isset($images[0]['url']) && is_string($images[0]['url']) && $images[0]['url'] !== '') {
                    $payload = $images[0];
                    $host = $candidate;

                    break;
                }
            }
        }

        if ($payload === null || $host === null) {
            throw new RuntimeException('必应壁纸接口不可用。');
        }

        $path = (string) $payload['url'];
        $imageUrl = str_starts_with($path, 'http') ? $path : $host.$path;

        $image = Http::timeout(20)->connectTimeout(5)->get($imageUrl);

        if ($image->failed()) {
            throw new RuntimeException("壁纸图片下载失败（HTTP {$image->status()}）。");
        }

        $bytes = $image->body();

        if ($bytes === '' || strlen($bytes) > 20 * 1024 * 1024) {
            throw new RuntimeException('壁纸图片内容为空或超过 20MB 限制。');
        }

        $info = @getimagesizefromstring($bytes);

        if ($info === false) {
            throw new RuntimeException('下载内容不是合法图片。');
        }

        $mime = (string) ($info['mime'] ?? '');
        $extension = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => throw new RuntimeException("不支持的壁纸图片类型：{$mime}。"),
        };

        return ['bytes' => $bytes, 'extension' => $extension, 'mime' => $mime];
    }

    /**
     * 把图片字节写入公共磁盘并创建附件记录（parent_type = page_background_bing）。
     */
    protected function storeImageBytes(string $bytes, string $extension, string $mime, string $baseName): Attachment
    {
        $directory = 'uploads/'.now()->format('Y/m');
        $filename = date('YmdHis').'_'.substr(bin2hex(random_bytes(6)), 0, 12).'.'.$extension;
        $path = "{$directory}/{$filename}";

        if (! Storage::disk('public')->put($path, $bytes)) {
            throw new RuntimeException('壁纸写入磁盘失败。');
        }

        /** @var array<int, int>|false $dimensions */
        $dimensions = @getimagesizefromstring($bytes);

        return Attachment::create([
            'author_id' => Auth::id(),
            'file_name' => "{$baseName}.{$extension}",
            'file_path' => $path,
            'mime_type' => $mime,
            'file_size' => strlen($bytes),
            'width' => is_array($dimensions) ? ($dimensions[0] ?? null) : null,
            'height' => is_array($dimensions) ? ($dimensions[1] ?? null) : null,
            'parent_type' => 'page_background_bing',
            'parent_id' => null,
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Option;
use App\Services\PageBackgroundService;
use Illuminate\Contracts\Filesystem\Filesystem as FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 主题设置：站点主色 + 前台网页背景（壁纸模式/透明度）。
 * 强调色、选中环、侧边栏高亮与图表首色均由主色自动派生。
 */
class ThemeSettingController extends Controller
{
    public function __construct(protected PageBackgroundService $backgrounds) {}

    /**
     * 内置默认主色（浅色）。theme_color 为空时页面回退到 CSS 内置值。
     */
    public const DEFAULT_COLOR = '#0071e3';

    /**
     * 可选预设色板。
     *
     * @return array<int, string>
     */
    public static function presets(): array
    {
        // Material Design 500 级主色板（均为可用对比度的标准色）。
        return [
            '#2196f3', // Blue
            '#3f51b5', // Indigo
            '#9c27b0', // Purple
            '#e91e63', // Pink
            '#f44336', // Red
            '#ff9800', // Orange
            '#009688', // Teal
            '#4caf50', // Green
        ];
    }

    /**
     * 前台「悬浮设置面板」的快捷色板：比后台精简，仅列常用色。
     *
     * @return array<int, string>
     */
    public static function frontPresets(): array
    {
        return [
            '#0071e3', // Blue（与内置默认一致）
            '#9c27b0', // Purple
            '#e91e63', // Pink
            '#4caf50', // Green
            '#ff9800', // Orange
        ];
    }

    /**
     * 当前主题色。未配置时为空字符串（页面回退到内置默认蓝）。
     */
    public static function color(): string
    {
        return (string) Option::get('theme_color', '');
    }

    /**
     * 生成覆盖 CSS：由主色派生的变量（浅色 + 深色）。
     *
     * 注意：与前端 `resources/js/lib/theme.ts` 的 `themeStyleFor()` 必须保持一致，
     * 前者用于首屏 SSR、后者用于保存后无刷新即时生效。
     */
    public static function styleCss(string $color): string
    {
        // 浅色用较深的主色（保证在白底上作为文字/图标可读），深色用较浅的主色（黑底可读）。
        $light = self::themePrimary($color, 'light');
        $dark = self::themePrimary($color, 'dark');
        $lightFg = self::primaryForeground($light);
        $darkFg = self::primaryForeground($dark);

        return <<<CSS
:root {
    --primary: {$light};
    --primary-foreground: {$lightFg};
    --accent-foreground: {$light};
    --accent: color-mix(in srgb, {$light} 10%, transparent);
    --ring: color-mix(in srgb, {$light} 45%, transparent);
    --chart-1: {$light};
    --sidebar-primary: {$light};
    --sidebar-primary-foreground: {$lightFg};
    --sidebar-accent-foreground: {$light};
    --sidebar-accent: color-mix(in srgb, {$light} 10%, transparent);
    --sidebar-ring: color-mix(in srgb, {$light} 35%, transparent);
}

.dark {
    --primary: {$dark};
    --primary-foreground: {$darkFg};
    --accent-foreground: {$dark};
    --accent: color-mix(in srgb, {$dark} 16%, transparent);
    --ring: color-mix(in srgb, {$dark} 55%, transparent);
    --chart-1: {$dark};
    --sidebar-primary: {$dark};
    --sidebar-primary-foreground: {$darkFg};
    --sidebar-accent-foreground: {$dark};
    --sidebar-accent: color-mix(in srgb, {$dark} 18%, transparent);
    --sidebar-ring: color-mix(in srgb, {$dark} 45%, transparent);
}
CSS;
    }

    /**
     * 派生指定外观下实际使用的主色（Material 浅色/深色取不同亮度）。
     * light：亮度上限 48%，保证浅色外观下作为文字仍可读；dark：亮度下限 55%，保证深色外观下可读。
     */
    public static function themePrimary(string $color, string $mode): string
    {
        $hex = ltrim(self::normalize($color), '#');

        if (strlen($hex) !== 6) {
            return self::normalize($color);
        }

        [$h, $s, $l] = self::rgbToHsl(hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2)));
        $l = $mode === 'light' ? min($l, 48) : max($l, 55);
        [$r, $g, $b] = self::hslToRgb($h, $s, $l);

        return sprintf('#%02x%02x%02x', $r, $g, $b);
    }

    /**
     * @return array{0: int, 1: int, 2: int} [H 0-360, S 0-100, L 0-100]
     */
    public static function rgbToHsl(int $r, int $g, int $b): array
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max === $min) {
            return [0, 0, round($l * 100)];
        }

        $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);

        if ($max === $r) {
            $h = ($g - $b) / $d + ($g < $b ? 6 : 0);
        } elseif ($max === $g) {
            $h = ($b - $r) / $d + 2;
        } else {
            $h = ($r - $g) / $d + 4;
        }

        $h *= 60;
        if ($h < 0) {
            $h += 360;
        }

        return [round($h), round($s * 100), round($l * 100)];
    }

    /**
     * @return array{0: int, 1: int, 2: int} [R, G, B] 0-255
     */
    public static function hslToRgb(int $h, int $s, int $l): array
    {
        $h /= 360;
        $s /= 100;
        $l /= 100;

        if ($s === 0.0) {
            $v = round($l * 255);

            return [$v, $v, $v];
        }

        $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        $p = 2 * $l - $q;

        $hue = function (float $t) use ($p, $q): float {
            if ($t < 0) {
                $t += 1;
            }

            if ($t > 1) {
                $t -= 1;
            }

            if ($t < 1 / 6) {
                return $p + ($q - $p) * 6 * $t;
            }

            if ($t < 1 / 2) {
                return $q;
            }

            if ($t < 2 / 3) {
                return $p + ($q - $p) * (2 / 3 - $t) * 6;
            }

            return $p;
        };

        return [
            (int) round($hue($h + 1 / 3) * 255),
            (int) round($hue($h) * 255),
            (int) round($hue($h - 1 / 3) * 255),
        ];
    }

    /**
     * 主色过浅时用深色文字保证对比度，否则用白色。
     */
    public static function primaryForeground(string $color): string
    {
        return self::luminance($color) > 0.35 ? '#0f172a' : '#ffffff';
    }

    /**
     * 计算颜色的相对亮度（WCAG，线性化 sRGB，0–1）。
     */
    public static function luminance(string $color): float
    {
        $hex = ltrim($color, '#');

        if (strlen($hex) !== 6) {
            return 0.0;
        }

        $channel = function (int $i) use ($hex): float {
            $c = hexdec(substr($hex, $i, 2)) / 255;

            return $c <= 0.03928 ? $c / 12.92 : ((($c + 0.055) / 1.055) ** 2.4);
        };

        return 0.2126 * $channel(0) + 0.7152 * $channel(2) + 0.0722 * $channel(4);
    }

    /**
     * 主题设置页面。
     */
    public function edit(): Response
    {
        // 必应模式下顺带刷新当日壁纸（后台路径触发，前台请求零外网依赖）
        if ($this->backgrounds->mode() === PageBackgroundService::MODE_BING) {
            $this->backgrounds->refreshBingWallpaper();
        }

        return Inertia::render('settings/theme', [
            'themeColor' => self::color(),
            'defaultColor' => self::DEFAULT_COLOR,
            'presets' => self::presets(),
            'background' => $this->backgrounds->settingsProps(),
        ]);
    }

    /**
     * 保存主题色与背景设置。主色空值 = 恢复内置默认；背景模式空值 = 不使用壁纸。
     * 模式切换会清理不再使用的存储壁纸（更换/移除语义）。
     */
    public function update(Request $request)
    {
        $request->merge(['theme_color' => self::normalize($request->input('theme_color'))]);

        $validated = $request->validate([
            'theme_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'background_mode' => ['nullable', 'in:custom,bing'],
            'background_opacity' => ['nullable', 'integer', 'min:0', 'max:100'],
        ], [
            'theme_color.regex' => '主题颜色格式不正确，应为 #rrggbb。',
            'background_mode.in' => '背景模式不正确。',
            'background_opacity.min' => '壁纸透明度范围为 0-100。',
            'background_opacity.max' => '壁纸透明度范围为 0-100。',
        ]);

        Option::set('theme_color', $validated['theme_color'] ?? '');

        $mode = (string) ($validated['background_mode'] ?? '');
        $this->backgrounds->changeMode($mode);

        if (array_key_exists('background_opacity', $validated) && $validated['background_opacity'] !== null) {
            Option::set('page_background_opacity', (string) $validated['background_opacity']);
        }

        // 切到必应模式后立即拉取当日壁纸；失败保留旧图，不影响保存
        if ($mode === PageBackgroundService::MODE_BING) {
            $this->backgrounds->refreshBingWallpaper();
        }

        return to_route('theme.edit')
            ->with('toast', ['type' => 'success', 'message' => '主题设置已保存。']);
    }

    /**
     * 上传自定义壁纸：替换语义（旧壁纸先删除），并切到自定义模式。
     */
    public function uploadBackground(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:10240',
                'mimes:jpg,jpeg,png,gif,webp',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '壁纸不能超过 10 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        try {
            $attachment = $this->backgrounds->storeCustom($validated['file']);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }

        Option::set('page_background_mode', PageBackgroundService::MODE_CUSTOM);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * 移除自定义壁纸（删除存储的文件与记录），模式切回"不使用"。
     */
    public function destroyBackground(): JsonResponse
    {
        $this->backgrounds->removeCustom();

        return response()->json(['ok' => true]);
    }

    /**
     * 归一化颜色输入：去空白、补前导 #、转小写；空值归一为 ''。
     */
    protected static function normalize(mixed $input): string
    {
        $value = trim((string) $input);

        if ($value === '') {
            return '';
        }

        if ($value[0] !== '#') {
            $value = '#'.$value;
        }

        return strtolower($value);
    }
}

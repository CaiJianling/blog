<?php

namespace App\Services;

use App\Models\Option;
use Illuminate\Support\Facades\Session;

/**
 * 登录图形验证码：GD 生成图片（无第三方依赖），答案哈希后存会话，
 * 校验时一次性消费并限时有效，防止机器人爆破登录。
 *
 * 复杂程度（后台「站点设置 → 常规」可配）：easy / medium / hard，
 * 分别影响字符数、旋转角度、干扰线与噪点密度。
 */
class CaptchaService
{
    public const COMPLEXITY_EASY = 'easy';

    public const COMPLEXITY_MEDIUM = 'medium';

    public const COMPLEXITY_HARD = 'hard';

    /**
     * 会话存储键。
     */
    protected const SESSION_KEY = 'login_captcha';

    /**
     * 验证码有效期（分钟）。
     */
    protected const TTL_MINUTES = 5;

    /**
     * 各复杂程度的渲染参数。
     * length 字符数；rotate 最大旋转角；lines 干扰线；dots 噪点；jitter 垂直抖动。
     *
     * @var array<string, array{length: int, rotate: int, lines: int, dots: int, jitter: int}>
     */
    protected const COMPLEXITY_CONFIG = [
        self::COMPLEXITY_EASY => ['length' => 4, 'rotate' => 10, 'lines' => 2, 'dots' => 80, 'jitter' => 3],
        self::COMPLEXITY_MEDIUM => ['length' => 4, 'rotate' => 16, 'lines' => 4, 'dots' => 160, 'jitter' => 5],
        self::COMPLEXITY_HARD => ['length' => 5, 'rotate' => 22, 'lines' => 6, 'dots' => 280, 'jitter' => 8],
    ];

    /**
     * 验证码字符集（剔除易混淆的 0/o/1/l/I/i）。
     */
    protected const CHARSET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';

    /**
     * 是否已开启登录验证码。
     */
    public function isEnabled(): bool
    {
        return Option::get('login_captcha_enabled', '0') === '1';
    }

    /**
     * 当前复杂程度（未配置或非法值回退 medium）。
     */
    public function complexity(): string
    {
        $complexity = (string) Option::get('login_captcha_complexity', self::COMPLEXITY_MEDIUM);

        return isset(self::COMPLEXITY_CONFIG[$complexity]) ? $complexity : self::COMPLEXITY_MEDIUM;
    }

    /**
     * 合法复杂程度列表。
     *
     * @return array<int, string>
     */
    public function validComplexities(): array
    {
        return array_keys(self::COMPLEXITY_CONFIG);
    }

    /**
     * 按复杂程度生成随机验证码文本。
     */
    public function buildCode(string $complexity): string
    {
        $length = self::COMPLEXITY_CONFIG[$this->normalizeComplexity($complexity)]['length'];
        $max = strlen(self::CHARSET) - 1;
        $code = '';

        for ($i = 0; $i < $length; $i++) {
            $code .= self::CHARSET[random_int(0, $max)];
        }

        return $code;
    }

    /**
     * 生成验证码：渲染 PNG 并把答案哈希写入会话（覆盖旧验证码）。
     *
     * @return string PNG 图片字节
     */
    public function generate(): string
    {
        $complexity = $this->complexity();
        $code = $this->buildCode($complexity);

        Session::put(self::SESSION_KEY, [
            'hash' => hash('sha256', strtolower($code)),
            'expires' => now()->addMinutes(self::TTL_MINUTES)->timestamp,
        ]);

        return $this->render($code, $complexity);
    }

    /**
     * 校验并消费验证码（无论对错均失效，需重新获取）。
     * 忽略大小写与空格；过期或不存在视为失败。
     */
    public function verifyAndConsume(?string $answer): bool
    {
        /** @var array{hash?: string, expires?: int}|mixed $stored */
        $stored = Session::pull(self::SESSION_KEY);

        if (! is_array($stored) || ! isset($stored['hash'], $stored['expires'])) {
            return false;
        }

        if (now()->timestamp > (int) $stored['expires']) {
            return false;
        }

        $normalized = strtolower((string) preg_replace('/[^a-zA-Z0-9]/', '', (string) $answer));

        if ($normalized === '') {
            return false;
        }

        return hash_equals((string) $stored['hash'], hash('sha256', $normalized));
    }

    /**
     * 渲染验证码图片：逐字符绘制到小块 → 旋转 → 贴主画布，再叠加干扰线与噪点。
     */
    protected function render(string $code, string $complexity): string
    {
        $config = self::COMPLEXITY_CONFIG[$this->normalizeComplexity($complexity)];
        $cellWidth = 30;
        $height = 48;
        $padding = 10;
        $width = $cellWidth * strlen($code) + $padding * 2;

        $image = imagecreatetruecolor($width, $height);

        // 统一的浅色底（与字符小块同色，保证旋转贴图无接缝）
        $background = imagecolorallocate($image, 247, 248, 250);

        imagefilledrectangle($image, 0, 0, $width - 1, $height - 1, $background);

        // 逐字符：独立小块绘制 → 随机旋转 → 贴回主画布
        $font = 5;
        $charWidth = imagefontwidth($font);
        $charHeight = imagefontheight($font);

        foreach (str_split($code) as $index => $char) {
            $cell = imagecreatetruecolor($cellWidth, $height);
            $cellBackground = imagecolorallocate($cell, 247, 248, 250);

            imagefilledrectangle($cell, 0, 0, $cellWidth - 1, $height - 1, $cellBackground);

            $color = imagecolorallocate($cell, random_int(30, 110), random_int(30, 110), random_int(30, 110));
            $x = intdiv($cellWidth - $charWidth, 2);
            $y = intdiv($height - $charHeight, 2) + random_int(-$config['jitter'], $config['jitter']);

            imagestring($cell, $font, $x, max(2, min($height - $charHeight - 2, $y)), $char, $color);

            $angle = (float) random_int(-$config['rotate'], $config['rotate']);
            $rotated = imagerotate($cell, $angle, $background);

            imagecopy(
                $image,
                $rotated,
                $padding + $index * $cellWidth - intdiv(imagesx($rotated) - $cellWidth, 2),
                -intdiv(imagesy($rotated) - $height, 2),
                0,
                0,
                imagesx($rotated),
                imagesy($rotated),
            );

            imagedestroy($cell);
            imagedestroy($rotated);
        }

        // 干扰线（叠在字符上方）
        for ($i = 0; $i < $config['lines']; $i++) {
            $lineColor = imagecolorallocate($image, random_int(150, 210), random_int(150, 210), random_int(150, 210));

            imageline(
                $image,
                random_int(0, $width - 1),
                random_int(0, $height - 1),
                random_int(0, $width - 1),
                random_int(0, $height - 1),
                $lineColor,
            );
        }

        // 噪点
        for ($i = 0; $i < $config['dots']; $i++) {
            $dotColor = imagecolorallocate($image, random_int(120, 220), random_int(120, 220), random_int(120, 220));

            imagefilledellipse(
                $image,
                random_int(0, $width - 1),
                random_int(0, $height - 1),
                random_int(1, 2),
                random_int(1, 2),
                $dotColor,
            );
        }

        ob_start();
        imagepng($image);
        $bytes = (string) ob_get_clean();

        imagedestroy($image);

        return $bytes;
    }

    /**
     * 归一化复杂程度：非法值回退 medium。
     */
    protected function normalizeComplexity(string $complexity): string
    {
        return isset(self::COMPLEXITY_CONFIG[$complexity]) ? $complexity : self::COMPLEXITY_MEDIUM;
    }
}

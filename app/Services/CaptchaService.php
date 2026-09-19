<?php

namespace App\Services;

use App\Models\Option;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Session;

/**
 * 统一验证码服务：登录与评论共用。
 *
 * 三种方式（type）：
 * - math       简单计算验证码：文本算术题 + 加密 token（无状态，10 分钟有效）
 * - image      图形字符验证码：GD 渲染随机字符，答案哈希存会话（一次性消费）
 * - image_math 简单计算图形验证码：GD 把算式渲染成图片，答案为计算结果
 *
 * 会话键按 scope 区分（captcha_login / captcha_comment），登录与评论互不干扰。
 * 复杂程度（easy/medium/hard）影响图形方式的字符数、旋转角度与干扰密度；
 * 简单计算的难度固定（加减乘、小数值），与评论原有行为一致。
 */
class CaptchaService
{
    public const COMPLEXITY_EASY = 'easy';

    public const COMPLEXITY_MEDIUM = 'medium';

    public const COMPLEXITY_HARD = 'hard';

    /**
     * 验证码方式：简单计算（文本）。
     */
    public const TYPE_MATH = 'math';

    /**
     * 验证码方式：图形字符。
     */
    public const TYPE_IMAGE = 'image';

    /**
     * 验证码方式：简单计算图形。
     */
    public const TYPE_IMAGE_MATH = 'image_math';

    /**
     * 会话 scope：登录。
     */
    public const SCOPE_LOGIN = 'login';

    /**
     * 会话 scope：评论。
     */
    public const SCOPE_COMMENT = 'comment';

    /**
     * 会话存储键前缀（captcha_{scope}）。
     */
    protected const SESSION_PREFIX = 'captcha_';

    /**
     * 已消费的简单计算 token 签名（会话键，登录场景一次性使用，防重放）。
     */
    protected const SESSION_MATH_USED = 'captcha_math_used';

    /**
     * 图形验证码有效期（分钟）。
     */
    protected const TTL_MINUTES = 5;

    /**
     * 简单计算 token 有效期（分钟）。
     */
    protected const MATH_TTL_MINUTES = 10;

    /**
     * 各复杂程度的图形渲染参数。
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
     * 图形字符验证码字符集（剔除易混淆的 0/o/1/l/I/i）。
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
     * 登录验证码方式（默认简单计算）。
     */
    public function loginType(): string
    {
        return $this->normalizeType(Option::get('login_captcha_type', self::TYPE_MATH));
    }

    /**
     * 评论验证码方式（游客必填；默认简单计算）。
     */
    public function commentType(): string
    {
        return $this->normalizeType(Option::get('comment_captcha_type', self::TYPE_MATH));
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
     * 合法验证码方式列表。
     *
     * @return array<int, string>
     */
    public static function validTypes(): array
    {
        return [self::TYPE_MATH, self::TYPE_IMAGE, self::TYPE_IMAGE_MATH];
    }

    /**
     * 登录页所需的验证码 props（未开启返回 null）。
     * - math：题目文本 + 加密 token
     * - image / image_math：图片地址（GET /captcha）
     *
     * @return array{type: string, question?: string, token?: string, src?: string}|null
     */
    public function loginCaptchaProps(): ?array
    {
        if (! $this->isEnabled()) {
            return null;
        }

        $type = $this->loginType();

        if ($type === self::TYPE_MATH) {
            return ['type' => $type] + $this->generateMath();
        }

        return ['type' => $type, 'src' => '/captcha'];
    }

    /**
     * 评论表单所需的验证码 props（登录用户返回 null）。
     *
     * @return array{type: string, question?: string, token?: string, src?: string}|null
     */
    public function commentCaptchaProps(): ?array
    {
        $type = $this->commentType();

        if ($type === self::TYPE_MATH) {
            return ['type' => $type] + $this->generateMath();
        }

        return ['type' => $type, 'src' => '/comment-captcha'];
    }

    /**
     * 生成简单计算验证码：返回算式文本与加密 token（含答案与过期时间）。
     *
     * @return array{question: string, token: string}
     */
    public function generateMath(): array
    {
        ['question' => $question, 'answer' => $answer] = $this->buildMathQuestion();

        $token = Crypt::encrypt([
            'answer' => $answer,
            'expires' => Carbon::now()->addMinutes(self::MATH_TTL_MINUTES)->timestamp,
        ]);

        return ['question' => $question, 'token' => $token];
    }

    /**
     * 校验简单计算验证码（token + 答案）。
     *
     * @param  bool  $consume  一次性消费（登录场景传 true：同一 token 会话内只能成功用一次，
     *                         防止解出一次答案后重复用于爆破；评论保持无状态不消费）
     */
    public function verifyMath(?string $token, mixed $answer, bool $consume = false): bool
    {
        if ($token === null || $token === '' || $answer === null || $answer === '') {
            return false;
        }

        try {
            $payload = Crypt::decrypt($token);
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($payload) || (int) ($payload['expires'] ?? 0) < Carbon::now()->timestamp) {
            return false;
        }

        if ((int) $payload['answer'] !== (int) $answer) {
            return false;
        }

        if ($consume) {
            $signature = hash('sha256', (string) $token);
            /** @var array<int, string> $used */
            $used = Session::get(self::SESSION_MATH_USED, []);

            if (in_array($signature, $used, true)) {
                return false;
            }

            $used[] = $signature;
            Session::put(self::SESSION_MATH_USED, array_slice($used, -20));
        }

        return true;
    }

    /**
     * 生成图形验证码图片（scope 区分会话；type 区分字符/算式）。
     *
     * @return string PNG 图片字节
     */
    public function generateImage(string $scope, string $type): string
    {
        $complexity = $this->complexity();

        if ($type === self::TYPE_IMAGE_MATH) {
            ['question' => $question, 'answer' => $answer] = $this->buildMathQuestion();

            $this->storeSessionAnswer($scope, (string) $answer);

            return $this->render("{$question} = ?", $complexity, 20);
        }

        $code = $this->buildCode($complexity);

        $this->storeSessionAnswer($scope, $code);

        return $this->render($code, $complexity, 30);
    }

    /**
     * 校验并消费图形验证码（无论对错均失效，需重新获取）。
     * 忽略大小写与空格；过期或不存在视为失败。
     */
    public function verifyImage(string $scope, ?string $answer): bool
    {
        /** @var array{hash?: string, expires?: int}|mixed $stored */
        $stored = Session::pull(self::SESSION_PREFIX.$scope);

        if (! is_array($stored) || ! isset($stored['hash'], $stored['expires'])) {
            return false;
        }

        if (Carbon::now()->timestamp > (int) $stored['expires']) {
            return false;
        }

        $normalized = strtolower((string) preg_replace('/[^a-zA-Z0-9]/', '', (string) $answer));

        if ($normalized === '') {
            return false;
        }

        return hash_equals((string) $stored['hash'], hash('sha256', $normalized));
    }

    /**
     * 生成登录图形验证码（沿用旧入口：字符图形，scope=login）。
     *
     * @return string PNG 图片字节
     */
    public function generate(): string
    {
        return $this->generateImage(self::SCOPE_LOGIN, self::TYPE_IMAGE);
    }

    /**
     * 校验并消费登录图形验证码（沿用旧入口）。
     */
    public function verifyAndConsume(?string $answer): bool
    {
        return $this->verifyImage(self::SCOPE_LOGIN, $answer);
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
     * 生成一道简单计算题（与评论原有规则一致：+ - *，乘法 1-9，其余 1-20）。
     *
     * @return array{question: string, answer: int}
     */
    public function buildMathQuestion(): array
    {
        $operators = ['+', '-', '*'];
        $operator = $operators[random_int(0, 2)];

        $max = $operator === '*' ? 9 : 20;
        $a = random_int(1, $max);
        $b = random_int(1, $max);

        if ($operator === '-' && $b > $a) {
            [$a, $b] = [$b, $a];
        }

        $answer = match ($operator) {
            '+' => $a + $b,
            '-' => $a - $b,
            default => $a * $b,
        };

        return ['question' => "{$a} {$operator} {$b}", 'answer' => $answer];
    }

    /**
     * 把答案哈希写入会话（覆盖旧验证码），5 分钟有效。
     */
    protected function storeSessionAnswer(string $scope, string $answer): void
    {
        Session::put(self::SESSION_PREFIX.$scope, [
            'hash' => hash('sha256', strtolower($answer)),
            'expires' => Carbon::now()->addMinutes(self::TTL_MINUTES)->timestamp,
        ]);
    }

    /**
     * 渲染验证码图片：逐字符绘制到小块 → 旋转 → 贴主画布，再叠加干扰线与噪点。
     *
     * @param  int  $cellWidth  每个字符占位宽度（算式图片用窄格）
     */
    protected function render(string $text, string $complexity, int $cellWidth = 30): string
    {
        $config = self::COMPLEXITY_CONFIG[$this->normalizeComplexity($complexity)];
        $height = 48;
        $padding = 10;
        $width = $cellWidth * strlen($text) + $padding * 2;

        $image = imagecreatetruecolor($width, $height);

        // 统一的浅色底（与字符小块同色，保证旋转贴图无接缝）
        $background = imagecolorallocate($image, 247, 248, 250);

        imagefilledrectangle($image, 0, 0, $width - 1, $height - 1, $background);

        // 逐字符：独立小块绘制 → 随机旋转 → 贴回主画布
        $font = 5;
        $charWidth = imagefontwidth($font);
        $charHeight = imagefontheight($font);

        foreach (str_split($text) as $index => $char) {
            if ($char === ' ') {
                continue;
            }

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

    /**
     * 归一化验证码方式：非法值回退 math。
     */
    protected function normalizeType(mixed $type): string
    {
        $type = (string) $type;

        return in_array($type, self::validTypes(), true) ? $type : self::TYPE_MATH;
    }
}

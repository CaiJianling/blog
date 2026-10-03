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
 *
 * 图形方式按 2 倍画布渲染（IMAGE_HEIGHT），前端以一半高度显示，高分屏下字形不发虚。
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
     * 会话 scope：注册。
     */
    public const SCOPE_REGISTER = 'register';

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
     * 图形画布高度：按 2 倍尺寸绘制、前端以一半高度显示，高分屏下字形不发虚。
     */
    protected const IMAGE_HEIGHT = 96;

    /**
     * 渲染字体：TTF 随仓库分发（resources/fonts，SIL OFL 1.1），不依赖各机器的系统字体。
     * 用 Regular 而非 Bold——粗体在干扰点下过于显眼。
     */
    protected const FONT_FILE = 'LiberationSans-Regular.ttf';

    /**
     * 两种图形方式的渲染参数：cell 单字符占位宽；font 字号；maxRotate 旋转角上限（null 表示跟随复杂程度）。
     * 算式是一整串，用窄格并收紧旋转，避免相邻字符糊在一起。
     *
     * @var array<string, array{cell: int, font: int, maxRotate: int|null}>
     */
    protected const IMAGE_RENDER_CONFIG = [
        self::TYPE_IMAGE => ['cell' => 48, 'font' => 44, 'maxRotate' => null],
        self::TYPE_IMAGE_MATH => ['cell' => 38, 'font' => 46, 'maxRotate' => 12],
    ];

    /**
     * 各复杂程度的图形渲染参数。
     * length 字符数；rotate 最大旋转角；lines 干扰线；dots 噪点；jitter 垂直抖动。
     * 数值按 IMAGE_HEIGHT 画布标定，改画布尺寸需同步调整 dots/jitter。
     *
     * @var array<string, array{length: int, rotate: int, lines: int, dots: int, jitter: int}>
     */
    protected const COMPLEXITY_CONFIG = [
        self::COMPLEXITY_EASY => ['length' => 4, 'rotate' => 10, 'lines' => 2, 'dots' => 320, 'jitter' => 6],
        self::COMPLEXITY_MEDIUM => ['length' => 4, 'rotate' => 16, 'lines' => 4, 'dots' => 640, 'jitter' => 10],
        self::COMPLEXITY_HARD => ['length' => 5, 'rotate' => 22, 'lines' => 6, 'dots' => 1120, 'jitter' => 16],
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
     * 评论验证码方式（默认简单计算）。
     */
    public function commentType(): string
    {
        return $this->normalizeType(Option::get('comment_captcha_type', self::TYPE_MATH));
    }

    /**
     * 是否已开启评论验证码（默认开启，保持游客评论必填验证码的既有行为）。
     */
    public function commentEnabled(): bool
    {
        return Option::get('comment_captcha_enabled', '1') === '1';
    }

    /**
     * 是否已开启注册验证码。
     */
    public function registerEnabled(): bool
    {
        return Option::get('register_captcha_enabled', '0') === '1';
    }

    /**
     * 注册验证码方式（默认简单计算）。
     */
    public function registerType(): string
    {
        return $this->normalizeType(Option::get('register_captcha_type', self::TYPE_MATH));
    }

    /**
     * 当前复杂程度（登录 scope，未配置或非法值回退 medium）。
     */
    public function complexity(): string
    {
        return $this->complexityFor(self::SCOPE_LOGIN);
    }

    /**
     * 指定 scope（login/comment/register）的复杂程度，各自独立配置。
     */
    public function complexityFor(string $scope): string
    {
        $complexity = (string) Option::get($scope.'_captcha_complexity', self::COMPLEXITY_MEDIUM);

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
        if (! $this->commentEnabled()) {
            return null;
        }

        $type = $this->commentType();

        if ($type === self::TYPE_MATH) {
            return ['type' => $type] + $this->generateMath();
        }

        return ['type' => $type, 'src' => '/comment-captcha'];
    }

    /**
     * 注册表单所需的验证码 props（未开启返回 null）。
     *
     * @return array{type: string, question?: string, token?: string, src?: string}|null
     */
    public function registerCaptchaProps(): ?array
    {
        if (! $this->registerEnabled()) {
            return null;
        }

        $type = $this->registerType();

        if ($type === self::TYPE_MATH) {
            return ['type' => $type] + $this->generateMath();
        }

        return ['type' => $type, 'src' => '/register-captcha'];
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
        $complexity = $this->complexityFor($scope);
        $isMath = $type === self::TYPE_IMAGE_MATH;
        $render = self::IMAGE_RENDER_CONFIG[$isMath ? self::TYPE_IMAGE_MATH : self::TYPE_IMAGE];

        if ($isMath) {
            ['question' => $question, 'answer' => $answer] = $this->buildMathQuestion();

            $this->storeSessionAnswer($scope, (string) $answer);

            return $this->render(str_replace(' ', '', $question).'=?', $complexity, $render);
        }

        $code = $this->buildCode($complexity);

        $this->storeSessionAnswer($scope, $code);

        return $this->render($code, $complexity, $render);
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
     * 验证码字体路径（TTF 随仓库分发，保证各环境渲染一致）。
     */
    protected function fontPath(): string
    {
        return resource_path('fonts/'.self::FONT_FILE);
    }

    /**
     * 渲染验证码图片：逐字符用 TTF 绘制到小块 → 旋转 → 贴主画布，再叠加干扰线与噪点。
     *
     * @param  array{cell: int, font: int, maxRotate: int|null}  $render  单字符占位宽、字号与旋转角上限
     */
    protected function render(string $text, string $complexity, array $render): string
    {
        $config = self::COMPLEXITY_CONFIG[$this->normalizeComplexity($complexity)];
        $height = self::IMAGE_HEIGHT;
        $cellWidth = $render['cell'];
        $padding = intdiv($cellWidth, 3);
        $width = $cellWidth * strlen($text) + $padding * 2;

        $image = imagecreatetruecolor($width, $height);

        // 统一的浅色底（与字符小块同色，保证旋转贴图无接缝）
        $background = imagecolorallocate($image, 247, 248, 250);

        imagefilledrectangle($image, 0, 0, $width - 1, $height - 1, $background);

        // 逐字符：独立小块绘制 → 随机旋转 → 贴回主画布
        $font = $this->fontPath();
        $fontSize = $render['font'];
        $rotate = $render['maxRotate'] === null ? $config['rotate'] : min($config['rotate'], $render['maxRotate']);

        foreach (str_split($text) as $index => $char) {
            if ($char === ' ') {
                continue;
            }

            $cell = imagecreatetruecolor($cellWidth, $height);
            $cellBackground = imagecolorallocate($cell, 247, 248, 250);

            imagefilledrectangle($cell, 0, 0, $cellWidth - 1, $height - 1, $cellBackground);

            $color = imagecolorallocate($cell, random_int(30, 110), random_int(30, 110), random_int(30, 110));

            /** @var array<int, int> $metrics 字体可读时 GD 必定返回包围盒，仅字体文件损坏才会 false */
            $metrics = imagettfbbox($fontSize, 0, $font, $char);
            $x = (int) (intdiv($cellWidth - ($metrics[2] - $metrics[0]), 2) - $metrics[0]);
            $y = (int) (intdiv($height + ($metrics[1] - $metrics[7]), 2) + random_int(-$config['jitter'], $config['jitter']));

            imagettftext($cell, $fontSize, 0, $x, $y, $color, $font, $char);

            $angle = (float) random_int(-$rotate, $rotate);
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
        imagesetthickness($image, 2);

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
                random_int(2, 4),
                random_int(2, 4),
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

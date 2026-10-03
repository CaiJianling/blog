<?php

use App\Models\Option;
use App\Services\CaptchaService;

/**
 * 生成图形验证码并解码为 GdImage，供尺寸断言使用。
 *
 * @param  string  $type  image | image_math
 */
function decodeCaptchaImage(string $scope, string $type): GdImage
{
    $image = imagecreatefromstring(app(CaptchaService::class)->generateImage($scope, $type));

    if (! $image instanceof GdImage) {
        throw new RuntimeException('验证码 PNG 解码失败');
    }

    return $image;
}

test('captcha glyphs are painted with the bundled font', function () {
    $image = decodeCaptchaImage('login', 'image');

    // 字体文件缺失/损坏时 imagettftext 只会静默失败，画布上不会留下深色笔画
    $ink = 0;

    for ($x = 0; $x < imagesx($image); $x++) {
        for ($y = 0; $y < imagesy($image); $y++) {
            $rgb = imagecolorat($image, $x, $y);

            if (($rgb >> 16 & 0xFF) < 150 && ($rgb >> 8 & 0xFF) < 150 && ($rgb & 0xFF) < 150) {
                $ink++;
            }
        }
    }

    expect($ink)->toBeGreaterThan(500);
});

test('character captcha renders every glyph on a roomy cell', function (string $complexity, int $length) {
    Option::set('login_captcha_complexity', $complexity);

    $image = decodeCaptchaImage('login', 'image');

    // 画布按 2 倍尺寸绘制、前端以一半高度显示：高度与单字符占位宽共同决定可读性
    expect(imagesy($image))->toBeGreaterThanOrEqual(80)
        ->and(intdiv(imagesx($image), $length))->toBeGreaterThanOrEqual(45);
})->with([
    ['easy', 4],
    ['medium', 4],
    ['hard', 5],
]);

test('math captcha stays compact enough for the form column', function (string $complexity) {
    Option::set('comment_captcha_complexity', $complexity);

    $image = decodeCaptchaImage('comment', 'image_math');

    // 算式去掉空格后最长为 "20*20=?" 7 格，窄格渲染仍不超过 300
    expect(imagesy($image))->toBeGreaterThanOrEqual(80)
        ->and(imagesx($image))->toBeLessThanOrEqual(300);
})->with(['easy', 'medium', 'hard']);

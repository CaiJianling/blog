<?php

namespace App\Services;

class UserAgentInspector
{
    /**
     * 解析 User-Agent，返回浏览器、操作系统与设备类型。
     *
     * @return array{browser: ?string, os: ?string, device: ?string}
     */
    public function inspect(string $userAgent): array
    {
        return [
            'browser' => $this->detectBrowser($userAgent),
            'os' => $this->detectOs($userAgent),
            'device' => $this->detectDevice($userAgent),
        ];
    }

    /**
     * 按优先级识别主流浏览器（Edge/Opera 均携带 Chrome 标记，须先判断）。
     */
    private function detectBrowser(string $userAgent): ?string
    {
        return match (true) {
            str_contains($userAgent, 'Edg/') => 'Edge',
            str_contains($userAgent, 'OPR/') => 'Opera',
            str_contains($userAgent, 'SamsungBrowser/') => 'Samsung Internet',
            str_contains($userAgent, 'MicroMessenger/') => 'WeChat',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Chrome/') || str_contains($userAgent, 'Chromium/') => 'Chrome',
            str_contains($userAgent, 'Version/') && str_contains($userAgent, 'Safari') => 'Safari',
            str_contains($userAgent, 'Trident/') => 'Internet Explorer',
            str_contains($userAgent, 'MSIE') || str_contains($userAgent, 'rv:') && str_contains($userAgent, 'IE') => 'Internet Explorer',
            str_contains($userAgent, 'Safari') => 'Safari',
            default => null,
        };
    }

    /**
     * 识别操作系统（iOS 标记优先于 macOS，Android 优先于 Linux）。
     */
    private function detectOs(string $userAgent): ?string
    {
        return match (true) {
            str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad') || str_contains($userAgent, 'CPU OS') || str_contains($userAgent, 'iOS') => 'iOS',
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'Android') => 'Android',
            str_contains($userAgent, 'Mac OS X') || str_contains($userAgent, 'Macintosh') => 'macOS',
            str_contains($userAgent, 'CrOS') => 'ChromeOS',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };
    }

    /**
     * 识别设备类型。
     */
    private function detectDevice(string $userAgent): ?string
    {
        return match (true) {
            str_contains($userAgent, 'iPad') || str_contains($userAgent, 'Tablet') => 'tablet',
            str_contains($userAgent, 'Mobile') || str_contains($userAgent, 'Android') || str_contains($userAgent, 'iPhone') => 'mobile',
            default => 'desktop',
        };
    }
}

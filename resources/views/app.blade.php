<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        {{-- 站点图标：后台上传过就用上传的（URL 带版本参数，换图标不必等硬刷新），否则回退内置默认 --}}
        @if ($site_icon)
            <link rel="icon" href="{{ $site_icon['url'] }}">
            <link rel="apple-touch-icon" href="{{ $site_icon['url'] }}">
        @else
            <link rel="icon" href="/favicon.ico" sizes="any">
            <link rel="icon" href="/favicon.svg" type="image/svg+xml">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        @endif
        {{-- RSS 订阅发现：浏览器/阅读器可自动识别 /feed --}}
        <link rel="alternate" type="application/rss+xml" title="{{ config('app.name', 'Laravel') }} RSS" href="{{ url('/feed') }}">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])

        {{-- 浏览器 chrome 颜色：跟随主题主色（无主题时用内置默认蓝，JS 会随亮/暗模式再校正）--}}
        <meta name="theme-color" content="{{ $theme_color ?: \App\Http\Controllers\ThemeSettingController::DEFAULT_COLOR }}">

        <style id="theme-override">{!! ($theme_color ?? '') ? \App\Http\Controllers\ThemeSettingController::styleCss($theme_color) : '' !!}</style>

        {{-- 前台「用户自选主题色」存于浏览器，优先于后台全局主题。在覆盖样式之后立即执行，
             避免水合前闪出后台主题色（生成逻辑复用 lib/theme.ts，由 theme-boot 入口暴露）。--}}
        @vite('resources/js/theme-boot.ts')

        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>

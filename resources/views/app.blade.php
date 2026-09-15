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

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])

        {{-- 浏览器 chrome 颜色：跟随主题主色（无主题时用内置默认蓝，JS 会随亮/暗模式再校正）--}}
        <meta name="theme-color" content="{{ $theme_color ?: \App\Http\Controllers\ThemeSettingController::DEFAULT_COLOR }}">

        @if($theme_color ?? '')
            {{-- 站点主题色：由后台「主题设置」写入，覆盖 app.css 中由主色派生的 CSS 变量（浅色 + 深色 + 前景对比度）。
                 id 供前端保存后无刷新更新（见 lib/theme.ts applyThemeStyle）。--}}
            <style id="theme-override">{!! \App\Http\Controllers\ThemeSettingController::styleCss($theme_color) !!}</style>
        @endif

        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>

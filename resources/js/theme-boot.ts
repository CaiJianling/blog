/**
 * 首屏主题引导入口：在 React 水合前应用用户的浏览器主题色偏好。
 *
 * 后台全局主题由 Blade 的 `<style id="theme-override">` 注入；此入口在其之后
 * 运行，若浏览器存有用户自选色则覆盖它，避免水合前闪出后台主题色。
 * 生成逻辑复用 `lib/theme.ts`，与运行时的 applyThemeStyle() 保持同源。
 */
import { applyThemeStyle, syncThemeColorMeta } from '@/lib/theme';

const stored = typeof window !== 'undefined' ? localStorage.getItem('themeColor') : null;

if (stored) {
    applyThemeStyle(stored);
    syncThemeColorMeta();
}

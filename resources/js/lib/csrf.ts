/**
 * CSRF 请求头（取值方式与 Inertia 自带 XHR 客户端保持一致）。
 *
 * 优先使用 XSRF-TOKEN cookie：服务端在**每个响应**里都会重新下发该 cookie，
 * 始终与当前 session 同步。meta csrf-token 只在整页加载时渲染一次，
 * session 轮换（登录/改密）或多标签页场景下会陈旧，导致 "CSRF token mismatch"（419）。
 *
 * 返回 null 表示两种来源都取不到（理论上不会发生：cookie 随每个响应下发）。
 *
 * 浏览器里 document.cookie 读到的是解码后的值（服务端下发的 XSRF-TOKEN 为
 * URL 编码形态，浏览器存储时已解码），与 Inertia XHR 的取值方式一致。
 */
export function getCsrfHeaders(): Record<string, string> | null {
    const xsrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1];

    if (xsrf) {
        return { 'X-XSRF-TOKEN': xsrf };
    }

    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    if (meta) {
        return { 'X-CSRF-TOKEN': meta };
    }

    return null;
}

/**
 * 419 重试用的备用来源（与 getCsrfHeaders 的主来源互补）：
 * 主来源用了 XSRF cookie 时，这里退回 meta token。
 *
 * 两个来源都可能「陈旧」（cookie 陈旧 = 服务端已轮换会话但浏览器未应用新
 * Set-Cookie；meta 陈旧 = 整页加载后 session 被轮换）。419 发生在 CSRF
 * 中间件层、业务逻辑尚未执行，重试一次是安全的。
 */
export function getCsrfFallbackHeaders(): Record<string, string> | null {
    if (document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1]) {
        const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

        return meta ? { 'X-CSRF-TOKEN': meta } : null;
    }

    return null;
}

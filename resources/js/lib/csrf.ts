/**
 * CSRF 请求头（取值方式与 Inertia 自带 XHR 客户端保持一致）。
 *
 * 优先使用 XSRF-TOKEN cookie：服务端在**每个响应**里都会重新下发该 cookie，
 * 始终与当前 session 同步。meta csrf-token 只在整页加载时渲染一次，
 * session 轮换（登录/改密/记住登录自动续签）或多标签页场景下会陈旧，导致
 * "CSRF token mismatch"（419）。
 */

/**
 * 读取 XSRF-TOKEN cookie 的值。
 *
 * 服务端下发的值经过 URL 编码（结尾的 `=` 会以 `%3D` 出现），浏览器写入 cookie jar
 * 后不会再解码，`document.cookie` 读到的仍是 `%3D` 形态。原样放进 X-XSRF-TOKEN 时，
 * Laravel 的 Encrypter::decrypt 会因 base64 含非法字符抛 DecryptException，取到空
 * token 从而必然 419——必须 decodeURIComponent 后再发（Inertia 的 getCookie 即如此）。
 */
function readXsrfCookie(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfHeaders(): Record<string, string> | null {
    const xsrf = readXsrfCookie();

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
    if (readXsrfCookie()) {
        const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

        return meta ? { 'X-CSRF-TOKEN': meta } : null;
    }

    return null;
}

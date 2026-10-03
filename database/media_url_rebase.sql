-- ============================================================================
-- 站点地址变更后，把正文里写死的旧地址刷成新地址（SQLite 版）
-- 本库为 SQLite：database/database.sqlite
--
-- ★ 首选（不用碰 SQL，最稳）：
--     1. 改好 .env 的 APP_URL（及 options 里的 site_url/cms_url）并清缓存
--     2. php artisan media:resync          （先 --dry-run 预览）
--   该命令按【当前】Storage::disk('public')->url() 重新生成媒体基址
--   （scheme + 新域名 + /storage/uploads），把 articles/content、pages/content
--   里所有本地媒体 URL 归一化，无需知道旧域名，幂等可重跑。
--
-- ★ 仅当你坚持直接用 SQL、且只是【域名替换】（scheme 不变）时，用下面的 REPLACE。
--   注意：content 是 json_encode 落库的，斜杠被转义成 \/，所以不要按完整路径匹配，
--   直接替换“域名”这个连续子串最可靠（它不含反斜杠）。
-- ============================================================================

-- 把 旧域名 换成 新域名（按需改这两个值；只改域名、不改 http/https）
UPDATE `articles`
SET `content` = REPLACE(`content`, '旧域名.com', '新域名.com');

UPDATE `pages`
SET `content` = REPLACE(`content`, '旧域名.com', '新域名.com');

-- 校验：旧域名残留应为 0（注意用域名匹配，路径斜杠是转义的）
SELECT COUNT(*) AS 文章残留 FROM `articles` WHERE `content` LIKE '%旧域名.com%';
SELECT COUNT(*) AS 页面残留 FROM `pages`    WHERE `content` LIKE '%旧域名.com%';

-- ============================================================================
-- 补充
-- · 若同时改 http↔https（scheme 变化），SQL 里要动的就多了 `http:\/\/` /
--   `https:\/\/` 前缀（含转义反斜杠，容易写错）——这种情况直接用
--   php artisan media:resync 更稳。
-- · attachments 表存的是相对路径 file_path（uploads/年/月/文件），
--   前台访问 URL 由 Storage::disk('public')->url() 按当前站点地址动态生成，
--   换域名后无需改库；只有 articles/content、pages/content 里写死的 URL 需刷。
-- ============================================================================

# Blog

基于 **Laravel 13 + Inertia.js v3 + React 19** 的全栈个人站点 / 博客内容管理系统。

采用 Apple 设计语言，前台（文章、说说、归档、工具集、导航站、友链）与后台（`/admin` 内容管理与站点设置）共用一套代码，支持亮暗主题、四档界面特效、可自定义主题色、中俄双语 i18n，以及 WordPress 风格的数据模型与固定链接。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | Laravel | ^13.17 |
| PHP | — | ^8.3 |
| 前端框架 | React | ^19.2 |
| 页面桥接 | Inertia.js | v3（`@inertiajs/react` + `inertia-laravel`） |
| 构建工具 | Vite | ^8.0（含 `@inertiajs/vite` SSR 插件） |
| CSS | Tailwind CSS | ^4.0（`@theme` 令牌 + shadcn/Radix UI） |
| 动画 | Framer Motion | ^12.42 |
| 富文本编辑器 | BlockNote | ^0.52（JSON block 存储） |
| 国际化 | i18next + react-i18next | ^26 / ^17 |
| 认证 | Laravel Fortify + Passkeys + 2FA | ^1.37 |
| 类型安全路由 | Laravel Wayfinder | ^0.1（生成 `resources/js/routes`、`actions`） |
| 代码高亮 | highlight.js | ^11.12 |
| 静态分析 | Larastan（PHPStan v3）/ ESLint v9 | — |
| 格式化 | Laravel Pint / Prettier v3 | — |
| 测试 | Pest PHP | ^4.7 |
| 数据库 | SQLite（默认）/ MySQL / PostgreSQL | — |

## 站点结构

前台与后台按页面目录划分，由 `resources/js/app.tsx` 的 `layout` 解析器统一挂载布局，页面本身不 import 布局。

**前台公开站（`PublicLayout`）**

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Home | Hero 三层 Canvas（流体底色 + 可扰动网格 + 首字粒子点阵）、最新文章、精选工具、导航预览 |
| 固定链接结构 | Blog/Show | 文章详情：目录大纲滚动高亮、代码块行号/换行/复制/全屏、点赞、评论、上一篇下一篇、相关推荐 |
| `/blog` | Blog/Index | 双列瀑布流列表、分类胶囊、搜索（标题 / 内容 / 标题+内容三种范围）、博主信息侧栏 |
| `/moments` | Moment | 说说流与详情（短内容，与文章同表不同 `post_type`） |
| `/archive` | Archive | 按年归档，可混合文章与说说时间线 |
| `/tools` | Tools | 在线工具集目录 + 19 个纯前端工具 |
| `/nav` | Nav | 网址导航站（分类 + 链接 + 单链图文介绍页） |
| `/links` | Links | 友情链接 |
| `/feed` | RSS 2.0 | 最新 20 篇已发布文章 |
| `/{permalink}` | Page/Show | 独立页面；兜底路由按固定链接结构解析文章 |

**后台管理（`/admin` 前缀，`AppLayout` 侧边栏骨架）**

侧边栏分组：主页 · 仪表板 · 文章（全部/新建/分类/标签）· 页面 · 内容管理（导航/友链/工具/菜单）· 媒体 · 评论（含表情管理）· 说说 · 网站统计 · 用户管理 · 设置（站点/首页/AI/固定链接/主题）。

统计、用户、站点设置、主题、导航、工具、友链、表情、菜单、AI 等均受 `AdminMiddleware` 保护（仅 `administrator` 角色）。后台路径整体挂在 `/admin` 下，与前台兜底固定链接彻底隔离。

## 功能模块

### 内容管理
- **文章**：状态快捷筛选（全部 / 已发布 / 待审核 / 草稿 / 回收站）、批量操作（发布、审核、转草稿、回收站）、软删除与恢复、永久删除
- **说说**：短内容类型，复用 `articles` 表（`post_type = moment`），独立管理页与批量操作
- **页面**：层级式独立页面（`parent_id` / `sort`），与文章共用编辑器与固定链接结构
- **富文本**：BlockNote 编辑器，自定义代码块（20 种语言）、图片自动上传至媒体库、中英文界面随站点语言切换
- **特色图片**：文章封面图选择器（从媒体库挑选或直接上传）
- **SEO**：站点级 + 文章/页面级 `meta_title` / `meta_description` / `keywords`，输出 canonical、Open Graph、Twitter 卡片
- **阅读时间**：按纯文本字符数估算（约 400 字/分钟，最少 1 分钟）
- **分类与标签**：WordPress 式无限层级分类、内联创建表单、悬停删除标签

### 评论系统
- 状态流：待审 / 已通过 / 垃圾 / 回收站，支持批量审核
- Markdown 与纯文本两种渲染模式（HTML 一律 strip，防 XSS）
- 表情包：`smiley_groups` + `smileys`，`:code:` 语法替换为图片，支持打包导入
- 悄悄话（仅博主与本人可见）、楼中楼回复、回复邮件通知
- 评论编辑走「修订待审」流程（`edited_content` 非空即为待审修订）
- 图形/算术验证码、QQ 头像解析、引用来源链接

### 媒体库
- 拖拽 / 点击多图上传、网格与列表视图、复制链接、查看详情、批量删除
- **系统图像保护**：站点图标、AI 头像、博主头像、导航图标、友链图片、页面壁纸等以特殊 `parent_type` 存于附件库，后台只读、不可在媒体库误删

### 目录与导航
- **导航站**：分类 + 链接（品牌色、描述、图标、图文详情页、点击计数），`config/navigation.php` 提供初始数据，后台可增删排序
- **工具集**：分类 + 工具（内置 `/tools/{slug}` 与外链跳转、点击计数），19 个零依赖前端工具（JSON/XML/SQL 格式化、Base64、JWT 解析、哈希、正则、Diff、UUID、密码生成、单位/进制/时间戳转换、颜色转换、文本统计、Markdown 预览、图片转 Base64 等）
- **菜单管理**：`nav_menus`（slug 即挂点，`top` 驱动前台顶栏）+ `nav_menu_items`（页面 / 文章 / 分类 / 自定义链接，支持树形与 `auto_add_pages`）
- **友情链接**：WordPress 式 blogroll，可见性开关、图片、排序权重

### 站点统计
- `page_views` 明细：访问趋势（PV/UV 自绘 SVG 双折线）、流量来源（直接 / 站内 / 搜索 / 社交 / 外部）、设备与浏览器分布、访问途径排行
- **隐私友好**：访客 ID 为 Cookie 值 SHA256，IP 存 `sha256(ip|app.key)`，不落明文
- User-Agent 自研解析（浏览器 / 系统 / 设备类型），不引入第三方依赖
- 超期数据由计划任务清理（默认保留 180 天）

### 站点设置
- **站点**：标题、标语、站点图标、语言、时区、日期时间格式、周起始、注册开关与默认角色、邮箱验证要求
- **固定链接**：5 种预设（朴素 / 日期 / 按月 / 数字 / 文章名）+ 自定义结构，支持 `%year% %monthnum% %day% %hour% %minute% %second% %post_id% %postname% %category% %author%`；分类与标签前缀可配
- **主题**：站点主色 + 前台网页背景（不使用 / 自定义上传 / 必应每日壁纸）+ 默认毛玻璃浓度
- **首页 / 页脚 / 侧边栏**：文案、资源链接、联系方式、ICP（Markdown）、博主信息、自定义菜单
- **表情 / 菜单 / 导航 / 工具 / 友链 / AI** 各自独立设置页

### AI 能力
- **文章与页面 AI 生成**：`AiService` 双协议客户端，支持 `openai`（`/chat/completions` + Bearer）与 `anthropic`（`/messages` + `x-api-key`）两种接口格式，端点、密钥、模型全部存于 `options` 表而非 `.env`；可拉取 `/models` 列表
- 生成结果为严格 JSON（标题 / 摘要 / Markdown 正文 / SEO / 标签 / 分类），解析容错处理代码围栏等噪声，前端弹窗预览后再落库
- **前台 AI 小助手**：悬浮对话窗，`standard`（OpenAI 兼容）与 `fastgpt`（知识库，`chatId` 服务端续接会话）两种模式；密钥经后端代理不外泄；多会话存于 IndexedDB；按 IP 限流；游客可用

### 认证与安全
- Fortify：注册、登录、找回密码、邮箱验证、2FA（TOTP + 恢复码）、Passkeys
- 三档验证码方式：`math`（文本算术题，加密 token 无状态 10 分钟）、`image`（GD 渲染字符，一次性会话消费）、`image_math`（算术式渲染成图片）；三档复杂度（easy/medium/hard）
- 验证码按 scope 隔离：登录 / 注册 / 评论互不干扰
- 首个注册用户自动成为 `administrator`，其后按 `default_role`（限 subscriber / contributor / author）
- 用户状态（启用/禁用）后台开关，前端乐观更新失败自动回退
- 敏感接口与公开写接口全部按 IP 限流（点赞、小助手、验证码、评论）

### 外观与特效体系

四套互相独立、均为 `useSyncExternalStore` + Cookie 镜像（供服务端首屏读取）的偏好存储：

| Hook | 取值 | 作用 |
|------|------|------|
| `use-appearance` | `light` / `dark` / `system` | `.dark` class 与 `color-scheme`，Cookie `appearance` |
| `use-effects` | 1 关闭 / 2 开启 / 3 进阶 / 4 极致 | 液态玻璃作用范围（累积，见下） |
| `use-theme-color` | 用户自选主色（留空 = 跟随站点主题） | 派生亮/暗变体与 WCAG 前景色，注入 `<style id="theme-override">`，同步 `<meta name="theme-color">` 与 Inertia 进度条 |
| `use-glass-frost` / `use-page-filter` | 0–100 模糊、饱和度、亮度 | 玻璃浓度与整页滤镜 |

特效档位为**累积**关系：
- **开启**：`LiquidSwitch` + `LiquidSlider`
- **进阶**：+ 前台悬浮组件（设置面板、齿轮、AI 小助手、返回顶部 / 评论按钮）
- **极致**：+ 前台与后台顶栏玻璃材质

判定统一走 `useEffectsAtLeast(min)`。历史布尔字段 `effects_enabled` 迁移为「极致」。液态玻璃由 SVG displacement map（折射图 + 高光 + 边缘色散消除）实现真实液态变形，非简单 blur。

### 国际化
- `resources/js/locales/{zh,en}.json`，27 个命名空间，`fallbackLng: 'zh'`；`createInertiaApp` 在 i18next `initPromise` 后启动，避免文案闪烁
- 语言优先级：localStorage → `locale` Cookie → 用户资料；`use-locale` 写回 Cookie 与 `<html lang>`，`SetLocale` 中间件同步 Laravel 翻译
- 后端校验/认证文案见 `resources/lang/zh`、`resources/lang/en`
- BlockNote 编辑器与后台界面均随语言切换

## 数据模型（WordPress 风格）

| 表 | 用途 |
|----|------|
| `articles` | 文章与说说共用，`post_type` 区分（`post` / `moment`）；`content` 为 JSON block；`views` / `likes` / `comment_count` 为反范式计数列；`featured_image` 存附件 ID 而非路径 |
| `pages` | 独立页面，含 `parent_id` / `sort`，与文章共用固定链接结构 |
| `terms` / `term_taxonomy` / `term_relationships` | 词表三分离：`terms` 纯词汇，`term_taxonomy` 承担角色（`category` / `tag`、`parent` 层级、`count`），`term_relationships` 为复合主键无时间戳的多态关联（`object_type` = `article` / `page`） |
| `comments` | `status` 为字符串 `'1'`（已通过）/ `'0'`（待审）/ `'spam'` / `'trash'`，`object_type` 多态 |
| `attachments` | 媒体库，`parent_type` / `parent_id` 泛化关联；特殊 `parent_type` 即受保护系统图像 |
| `options` | WP 式 `option_name` / `option_value`(longtext) / `autoload` 键值仓库，无时间戳；站点信息、固定链接、AI 配置、验证码、背景、主题、SEO、页脚、侧边栏等全部走这里（`Option::get/set/getMany`，数组自动 JSON） |
| `nav_menus` / `nav_menu_items` | 菜单位与条目（树形、四种类型） |
| `nav_categories` / `nav_links` | 导航站分类与网址 |
| `tool_categories` / `tools` | 工具分组与工具（`url` 非空即外链） |
| `links` | 友情链接（`link_visible` = `Y`/`N`） |
| `smiley_groups` / `smileys` | 表情分组与表情（`code` 全局唯一） |
| `page_views` | 访问明细，无时间戳，`viewed_at` 记录 |
| `article_likes` | 点赞流水，`user_id` 可空 + `guest_id`，两个独立唯一索引保证「一人一赞」 |
| `users` | 追加 `role`、`is_active`、`nickname`、`locale`、`effects_level`(1–4)、`filter_saturation`、`filter_brightness`、2FA 与 passkeys 字段 |

## 项目结构

```
blog/
├── app/
│   ├── Actions/Fortify/            # 注册、密码重置（含昵称/角色策略）
│   ├── Concerns/                   # 密码与资料校验规则复用
│   ├── Console/Commands/PrunePageViews.php   # 访问统计清理
│   ├── Exceptions/AiRequestException.php
│   ├── Http/Controllers/
│   │   ├── (前台) HomeController / BlogController / MomentController /
│   │   │        ArchiveController / ToolController / NavController /
│   │   │        LinksController / FeedController / CommentPublicController /
│   │   │        ArticleLikeController / AssistantChatController / CaptchaController
│   │   ├── (后台) ArticleController / PageController / MomentsController /
│   │   │         CommentController / AttachmentController / UserController /
│   │   │         TermTaxonomyController / StatsController / MenuController /
│   │   │         OptionController / PermalinkController / ToolSettingController /
│   │   │         NavigationSettingController / LinksController /
│   │   │         ThemeSettingController / AiSettingController /
│   │   │         AssistantSettingController / SidebarSettingController /
│   │   │         HomeSettingController / FooterSettingController / SmileyController
│   │   └── Settings/               # 个人资料 · 安全 · 用户偏好
│   ├── Http/Middleware/            # AdminMiddleware / TrackPageViews / SetLocale /
│   │                               # HandleAppearance / HandleInertiaRequests /
│   │                               # Verify{Login,Register}Captcha / EnsureVerifiedEmailToLogin
│   ├── Models/                     # 见上「数据模型」
│   └── Services/
│       ├── AiService.php           # 双协议 LLM 客户端 + 文章/页面生成
│       ├── PermalinkService.php    # 固定链接生成与解析
│       ├── CommentService.php      # 评论渲染、表情替换、邮件通知
│       ├── CaptchaService.php      # 三方式 × 三 scope 验证码
│       ├── AttachmentService.php   # 附件存储 + 系统图像保护
│       ├── PageBackgroundService.php  # 壁纸（自定义 / 必应每日）
│       ├── MenuService.php         # 菜单位解析
│       ├── SmileyPackImporter.php  # 表情包导入
│       └── UserAgentInspector.php  # UA 解析
├── config/                         # navigation.php（导航站种子）· tools.php（工具清单）
│                                   # · fortify.php · inertia.php · 标准 Laravel 配置
├── database/
│   ├── migrations/                 # 34 个迁移（含 WP 式表结构与用户扩展字段）
│   └── seeders/                    # DatabaseSeeder · ToolsAndNavSeeder
├── resources/
│   ├── css/app.css                 # Apple 设计令牌 + 材质 + 排版 + 代码块样式
│   ├── js/
│   │   ├── app.tsx                 # createInertiaApp + layout 解析器
│   │   ├── i18n.ts                 # i18next 初始化
│   │   ├── theme-boot.ts           # 首屏前主题色注入
│   │   ├── components/
│   │   │   ├── LiquidGlass/        # 折射图生成、面板、边缘色散修复、Switch/Slider
│   │   │   ├── comments/           # 评论区（列表/发表/编辑/表情/验证码）
│   │   │   ├── stats/              # 自绘折线图、条形列表
│   │   │   ├── tools/              # 19 个前端工具 + 高亮组件
│   │   │   ├── ui/                 # shadcn 基础组件
│   │   │   ├── hero-canvas.tsx     # 三层 Canvas Hero
│   │   │   ├── ai-assistant-widget.tsx / ai-generate-dialog.tsx
│   │   │   ├── floating-settings-panel.tsx / floating-actions.tsx
│   │   │   ├── blocknote-editor.tsx / featured-image-picker.tsx / media-quick-upload.tsx
│   │   │   └── app-sidebar.tsx / nav-main.tsx / public-navbar.tsx / public-footer.tsx
│   │   ├── hooks/                  # use-appearance · use-effects · use-theme-color ·
│   │   │                           # use-glass-frost · use-page-filter · use-locale ·
│   │   │                           # use-article-like · use-two-factor-auth · use-clipboard …
│   │   ├── layouts/
│   │   │   ├── public-layout.tsx   # 前台：顶栏 + 页脚 + 壁纸层 + 悬浮组件
│   │   │   ├── app/                # 后台侧边栏骨架
│   │   │   ├── settings/           # 资料 / 安全 / 外观
│   │   │   └── auth/               # 认证页
│   │   ├── lib/                    # seo.tsx · blocknote-to-html.ts · markdown.ts ·
│   │   │                           # assistant-db.ts(IndexedDB) · code-highlight.ts · csrf.ts
│   │   ├── locales/{zh,en}.json    # 前端文案
│   │   ├── pages/                  # Home · Blog · Moment · Archive · Tools · Nav ·
│   │   │                           # Links · Page · Article · Comment · Media · Menus ·
│   │   │                           # Stats · User · settings · auth · dashboard
│   │   └── routes/ actions/        # Wayfinder 生成物（已 gitignore）
│   └── lang/{zh,en}/               # 后端校验与认证文案
├── routes/
│   ├── web.php                     # 前台 + /admin 后台 + 兜底固定链接
│   ├── settings.php                # 个人设置与偏好
│   └── console.php                 # 计划任务注册
└── tests/Feature/                  # 50+ Pest 测试（内容/评论/认证/AI/统计/设置/特效迁移）
```

## 环境要求

- PHP >= 8.3（需 `gd` 扩展用于验证码图形与图片处理）
- Node.js >= 20
- SQLite（默认，零配置）/ MySQL / PostgreSQL

## 快速开始

```bash
# 安装依赖
composer install
npm install

# 初始化环境
cp .env.example .env
php artisan key:generate
php artisan storage:link --force   # public/storage -> storage/app/public，媒体文件访问入口
php artisan migrate

# 构建前端资源
npm run build

# 启动开发服务器（PHP 服务 + Vite + queue + logs 一体）
php artisan dev
```

或使用一键设置命令：

```bash
composer run setup
```

`setup` 已包含 `php artisan storage:link --force`，新装与迁移都会重建媒体软链接。

### 迁移到新服务器

上传的图片走 `public/storage` 软链接访问，而 `public/storage` 本身在 `.gitignore` 里，因此换机器必须重建，否则 `/storage/...` 会被 nginx 判为 403 / 404：

```bash
cd /path/to/blog
sudo -u www php artisan storage:link --force    # 站点运行用户不是 www 时换成对应用户
ls -l public/storage                            # 确认指向本机 storage/app/public
```

同一次迁移还要检查这几项：

| 项目 | 说明 |
|------|------|
| `storage/app/public/` | 媒体文件本体，需与代码一起复制；属主要与站点运行用户一致（`chown -R www:www storage`），目录 755 / 文件 644 |
| `.env` 的 `APP_URL` | 公开磁盘 URL 与 RSS、邮件里的绝对链接都由它派生 |
| `public/.user.ini` | 宝塔写入的 `open_basedir` 带死路径，跟仓库一起复制过去会让 PHP 读不到文件，需删除或由面板按新目录重写 |
| 配置缓存 | `php artisan config:clear && php artisan optimize:clear`，避免 `bootstrap/cache` 里带着旧机器配置 |
| nginx 规则 | 不要把 `/storage` 加进「禁止访问目录」规则，它是前台资源的正常出口 |

首次注册的账号会自动获得 `administrator` 角色。

导航站与工具集初始数据：

```bash
php artisan db:seed --class=ToolsAndNavSeeder
```

Wayfinder 类型路由变更后需重新生成：

```bash
php artisan wayfinder:generate
```

## 开发命令

```bash
# 全部开发进程（Laravel 13 内置 dev 命令：server + vite + pail）
php artisan dev
composer run dev

# 前端构建 / 开发
npm run build
npm run build:ssr          # 含 SSR bundle
npm run dev

# 代码格式化
npm run format             # 前端 Prettier
composer run lint          # 后端 Pint

# 静态检查
npm run lint:check         # ESLint
npm run types:check        # TypeScript
composer run types:check   # PHPStan (Larastan)

# 测试
php artisan test           # Pest
composer run test          # config:clear + Pint --test + PHPStan + 全量测试
composer run ci:check      # ESLint + Prettier + tsc + composer run test

# 计划任务调度（本地需常驻时）
php artisan schedule:work
```

健康检查端点：`GET /up`。

## 计划任务

| 时间 | 任务 | 说明 |
|------|------|------|
| 每日 03:30 | `pageviews:prune` | 清理超期访问统计（默认保留 180 天） |
| 每日 06:10 | `PageBackgroundService::refreshBingWallpaper` | 仅当背景模式为 `bing` 时刷新必应壁纸，并删除上一张存储文件 |

后台访问统计页也会触发刷新，因此前台请求零外网依赖。

## 设计系统

设计令牌以 CSS 变量定义于 `resources/css/app.css`，全部映射进 Tailwind v4 的 `@theme`，因此变量改动即时反映到所有工具类。暗色通过 `@custom-variant dark (&:is(.dark *))` 切换。

| 变量 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `--foreground` | `#1d1d1f` | `#f5f5f7` | 主文字色 |
| `--muted-foreground` | `#555559` | `#a1a1a6` | 次要文字色 |
| `--background` | `#f5f5f7` | `#000000` | 页面背景 |
| `--card` | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.78)` | 卡片背景（毛玻璃） |
| `--primary` | `#0071e3` | `#0a84ff` | 主色（Apple Blue，可被站点/用户主题色覆盖） |
| `--border` | `rgba(60,60,67,0.18)` | `rgba(255,255,255,0.14)` | 边框 |

另有：圆角阶梯 `0.5 → 1.5rem`；`--shadow-apple-{xs,sm,md,lg,xl,card}` 阴影体系；SF 优先字体栈；材质工具类 `.material-thin / -standard / -thick`（blur 28/40/56px + saturate 180/200%）、`.apple-card`（blur 36 + inset 高光）、`.apple-press`（按压 `scale(0.96)`）、`.hover-glow` / `.glass-btn-glow`（基于 `color-mix` 的主题色辉光）；排版阶梯 `.text-display|title|headline|body|footnote`；`.article-content` / `.comment-content` 正文排版；带 macOS 红绿灯点的米色/暗色代码块；以及 `prefers-reduced-motion` 与 `prefers-reduced-transparency` 降级。

## License

MIT

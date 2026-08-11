# Blog

基于 Laravel 13 + Inertia.js v3 + React 19 构建的博客内容管理系统，采用 Apple 设计语言，支持暗色模式、i18n 国际化和液态玻璃特效。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端 | Laravel | ^13.17 |
| 前端框架 | React | ^19.2 |
| SSR 桥接 | Inertia.js | ^3.0 |
| 构建工具 | Vite | ^8.0 |
| CSS 框架 | Tailwind CSS | ^4.0 |
| 动画 | Framer Motion | ^12.42 |
| 富文本编辑器 | BlockNote | ^0.52 |
| UI 组件库 | Radix UI | - |
| 国际化 | i18next + react-i18next | - |
| 认证 | Laravel Fortify + Passkeys | - |
| 路由类型生成 | Laravel Wayfinder | ^0.1 |
| 测试 | Pest PHP | ^4.7 |

## 功能模块

### 文章管理
- 文章列表：状态快捷筛选（全部、已发布、待审核、草稿、回收站）
- 批量操作：多选后批量发布、审核、移至草稿箱、移至回收站
- 富文本编辑：BlockNote 编辑器，支持 i18n（中/英文切换）
- 创建/编辑页面：Apple 风格无框大标题输入，紧凑型侧边栏（发布、分类、标签、缩略图、摘要）
- 分类与标签：独立管理页，支持创建/编辑/删除，内联表单交互

### 页面管理
- 独立页面（Page）：区别于文章的独立内容类型
- 页面列表：与文章相同的工作流（发布、待审核、草稿、回收站）
- 创建/编辑：共享文章编辑器组件，一致的 Apple 设计风格

### 媒体库
- 附件上传：支持拖拽/点击上传图片和文件
- 媒体浏览：网格/列表视图切换，缩略图预览
- 附件管理：复制链接、查看详情、删除操作

### 用户管理
- 用户列表：搜索、状态/角色筛选
- 状态切换：乐观更新动画（点击即切换，失败自动回退）
- 角色权限：subscriber / contributor / author / editor / administrator
- 创建/编辑/删除用户

### 设置
- 个人资料编辑
- 安全设置（密码、2FA、Passkeys）
- 外观设置：亮色/暗色/跟随系统、特效开关、语言切换（中/英）

### UI 特效
- 液态玻璃开关（LiquidSwitch）：基于 SVG displacement map 实现的真实液态变形效果
- 毛玻璃材质（material-thick / material-standard）：分层背景模糊
- Apple 风格动画：弹窗中心缩放进出、按钮按压反馈、斑马纹表格
- 侧边栏折叠面板：Apple 风格紧凑型手风琴（chevron 旋转、弹性展开动画）

## 项目结构

```
blog/
├── app/
│   ├── Http/Controllers/
│   │   ├── ArticleController.php      # 文章 CRUD + 批量操作
│   │   ├── AttachmentController.php   # 附件上传/浏览/删除
│   │   ├── PageController.php         # 独立页面 CRUD
│   │   ├── TermTaxonomyController.php # 分类与标签 API
│   │   ├── UserController.php         # 用户管理 + 状态切换
│   │   └── Settings/                  # 个人资料 & 安全设置
│   ├── Models/
│   │   ├── Attachment.php             # 附件模型
│   │   └── Page.php                   # 独立页面模型
│   └── Services/
│       └── AttachmentService.php      # 附件存储服务
├── resources/
│   ├── css/
│   │   └── app.css                   # Apple 设计令牌（CSS 变量）
│   └── js/
│       ├── components/
│       │   ├── LiquidGlass/           # 液态玻璃组件（Filter、LiquidSwitch）
│       │   ├── ui/                    # 基础 UI 组件（dialog、button、table 等）
│       │   ├── blocknote-editor.tsx   # BlockNote 富文本编辑器
│       │   ├── appearance-tabs.tsx    # 主题切换分段控制器
│       │   ├── language-toggle.tsx    # 语言切换分段控制器
│       │   ├── nav-main.tsx           # 侧边栏主导航
│       │   ├── app-sidebar.tsx        # 侧边栏布局
│       │   ├── category-picker.tsx    # 分类选择器
│       │   ├── tag-picker.tsx         # 标签选择器（悬停删除）
│       │   └── taxonomy-form.tsx      # 分类/标签内联创建表单
│       ├── hooks/
│       │   ├── use-appearance.tsx     # 主题模式管理
│       │   ├── use-effects.tsx        # 特效开关管理
│       │   └── use-locale.tsx         # 语言切换管理
│       ├── layouts/
│       │   ├── app/                   # 主布局（含侧边栏）
│       │   ├── settings/              # 设置页布局（侧边 Tab）
│       │   └── auth/                  # 认证页布局
│       └── pages/
│           ├── Article/               # 文章列表/创建/编辑/分类/标签
│           ├── Page/                  # 页面列表/创建/编辑
│           ├── Media/                 # 媒体库上传/浏览
│           ├── User/                  # 用户管理
│           ├── settings/              # 资料/安全/外观
│           ├── auth/                  # 登录/注册/2FA/忘记密码
│           └── dashboard.tsx          # 仪表盘
├── routes/
│   └── web.php
├── tests/
│   ├── Feature/
│   │   ├── AttachmentControllerTest.php
│   │   └── TermTaxonomyControllerTest.php
├── composer.json
└── package.json
```

## 环境要求

- PHP >= 8.3
- Node.js >= 20
- MySQL / SQLite / PostgreSQL

## 快速开始

```bash
# 安装依赖
composer install
npm install

# 初始化环境
cp .env.example .env
php artisan key:generate
php artisan migrate

# 构建前端资源
npm run build

# 启动开发服务器
php artisan dev
```

或使用一键设置命令：

```bash
composer run setup
```

## 开发命令

```bash
# 前端开发（热更新）
composer run dev

# 前端构建
npm run build

# 后端开发服务器
php artisan dev

# 代码格式化
npm run format          # 前端 (Prettier)
composer run lint       # 后端 (Pint)

# 类型检查
npm run types:check     # TypeScript
composer run types:check  # PHPStan

# 测试
php artisan test        # Pest PHP
```

## 设计系统

项目使用 CSS 变量定义设计令牌，位于 `resources/css/app.css`：

| 变量 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `--foreground` | `#1d1d1f` | `#f5f5f7` | 主文字色 |
| `--muted-foreground` | `#555559` | `#a1a1a6` | 次要文字色 |
| `--background` | `#f5f5f7` | `#000000` | 页面背景 |
| `--card` | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.78)` | 卡片背景（毛玻璃） |
| `--primary` | `#0071e3` | `#0a84ff` | 主色（Apple Blue） |
| `--border` | `rgba(60,60,67,0.18)` | `rgba(255,255,255,0.14)` | 边框 |

## License

MIT

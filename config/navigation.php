<?php

/**
 * 导航站配置
 * 按分类组织常用网站，支持自定义图标颜色与描述。
 *
 * @return array<string, array<int, array{name: string, url: string, description: string, color: string}>>
 */
return [
    'AI 工具' => [
        ['name' => 'ChatGPT', 'url' => 'https://chat.openai.com', 'description' => 'OpenAI 智能对话助手', 'color' => '#10a37f'],
        ['name' => 'Claude', 'url' => 'https://claude.ai', 'description' => 'Anthropic AI 助手', 'color' => '#d97757'],
        ['name' => 'Gemini', 'url' => 'https://gemini.google.com', 'description' => 'Google 生成式 AI', 'color' => '#4285f4'],
        ['name' => '豆包', 'url' => 'https://www.doubao.com', 'description' => '字节跳动 AI 助手', 'color' => '#3370ff'],
        ['name' => '通义千问', 'url' => 'https://tongyi.aliyun.com', 'description' => '阿里通义大模型', 'color' => '#ff6a00'],
        ['name' => 'Kimi', 'url' => 'https://kimi.moonshot.cn', 'description' => '月之暗面长文本 AI', 'color' => '#7c3aed'],
        ['name' => 'Midjourney', 'url' => 'https://www.midjourney.com', 'description' => 'AI 绘画工具', 'color' => '#5b21b6'],
        ['name' => 'Perplexity', 'url' => 'https://www.perplexity.ai', 'description' => 'AI 搜索引擎', 'color' => '#22b8cf'],
        ['name' => 'DeepSeek', 'url' => 'https://chat.deepseek.com', 'description' => '深度求索 AI 助手', 'color' => '#4d6bfe'],
        ['name' => '智谱清言', 'url' => 'https://chatglm.cn', 'description' => '智谱 GLM 大模型对话', 'color' => '#3859ff'],
        ['name' => '文心一言', 'url' => 'https://yiyan.baidu.com', 'description' => '百度文心大模型', 'color' => '#4e6ef2'],
        ['name' => 'Hugging Face', 'url' => 'https://huggingface.co', 'description' => 'AI 模型与数据集社区', 'color' => '#ffd21e'],
        ['name' => 'Cursor', 'url' => 'https://cursor.com', 'description' => 'AI 代码编辑器', 'color' => '#00c4cc'],
    ],
    '搜索引擎' => [
        ['name' => 'Google', 'url' => 'https://www.google.com', 'description' => '全球最大搜索引擎', 'color' => '#4285f4'],
        ['name' => 'Bing', 'url' => 'https://www.bing.com', 'description' => '微软搜索引擎', 'color' => '#008373'],
        ['name' => '百度', 'url' => 'https://www.baidu.com', 'description' => '中文搜索引擎', 'color' => '#2932e1'],
        ['name' => 'DuckDuckGo', 'url' => 'https://duckduckgo.com', 'description' => '注重隐私的搜索引擎', 'color' => '#de5833'],
        ['name' => 'Yandex', 'url' => 'https://yandex.com', 'description' => '俄罗斯搜索引擎', 'color' => '#fc3f1d'],
        ['name' => '搜狗', 'url' => 'https://www.sogou.com', 'description' => '搜狗搜索', 'color' => '#ff6a00'],
        ['name' => '360 搜索', 'url' => 'https://www.so.com', 'description' => '奇虎 360 搜索', 'color' => '#01c203'],
        ['name' => 'Startpage', 'url' => 'https://www.startpage.com', 'description' => '隐私保护的 Google 代理搜索', 'color' => '#6573ff'],
    ],
    '视频网站' => [
        ['name' => 'YouTube', 'url' => 'https://www.youtube.com', 'description' => '全球视频平台', 'color' => '#ff0000'],
        ['name' => '哔哩哔哩', 'url' => 'https://www.bilibili.com', 'description' => '年轻人的视频社区', 'color' => '#fb7299'],
        ['name' => '抖音', 'url' => 'https://www.douyin.com', 'description' => '短视频平台', 'color' => '#161823'],
        ['name' => '优酷', 'url' => 'https://www.youku.com', 'description' => '阿里视频平台', 'color' => '#1989fa'],
        ['name' => '爱奇艺', 'url' => 'https://www.iqiyi.com', 'description' => '在线视频平台', 'color' => '#00be06'],
        ['name' => '腾讯视频', 'url' => 'https://v.qq.com', 'description' => '腾讯视频平台', 'color' => '#ff6022'],
        ['name' => '西瓜视频', 'url' => 'https://www.ixigua.com', 'description' => '字节中长视频平台', 'color' => '#fe2c55'],
        ['name' => '芒果TV', 'url' => 'https://www.mgtv.com', 'description' => '湖南卫视视频平台', 'color' => '#ff5f00'],
        ['name' => 'Twitch', 'url' => 'https://www.twitch.tv', 'description' => '游戏直播平台', 'color' => '#9146ff'],
    ],
    '动漫' => [
        ['name' => 'Bangumi', 'url' => 'https://bgm.tv', 'description' => '番组计划，动漫数据库', 'color' => '#f09199'],
        ['name' => 'MAL', 'url' => 'https://myanimelist.net', 'description' => 'MyAnimeList 动漫社区', 'color' => '#2e51a2'],
        ['name' => 'AniList', 'url' => 'https://anilist.co', 'description' => '动漫追踪社区', 'color' => '#31c48d'],
        ['name' => 'Crunchyroll', 'url' => 'https://www.crunchyroll.com', 'description' => '正版动漫流媒体', 'color' => '#f47521'],
        ['name' => 'Nyaa', 'url' => 'https://nyaa.si', 'description' => '动漫种子资源站', 'color' => '#24541c'],
        ['name' => '动漫花园', 'url' => 'https://share.dmhy.org', 'description' => '动漫字幕组资源', 'color' => '#2e8b57'],
        ['name' => 'AniDB', 'url' => 'https://anidb.net', 'description' => '动漫数据库', 'color' => '#4c559e'],
    ],
    '开发工具' => [
        ['name' => 'GitHub', 'url' => 'https://github.com', 'description' => '代码托管平台', 'color' => '#181717'],
        ['name' => 'GitLab', 'url' => 'https://gitlab.com', 'description' => 'DevOps 平台', 'color' => '#fc6d26'],
        ['name' => 'Gitee', 'url' => 'https://gitee.com', 'description' => '国内代码托管', 'color' => '#c71d23'],
        ['name' => 'Stack Overflow', 'url' => 'https://stackoverflow.com', 'description' => '程序员问答社区', 'color' => '#f48024'],
        ['name' => 'MDN', 'url' => 'https://developer.mozilla.org', 'description' => 'Web 开发文档', 'color' => '#000000'],
        ['name' => 'npm', 'url' => 'https://www.npmjs.com', 'description' => 'Node.js 包管理', 'color' => '#cb3837'],
        ['name' => '掘金', 'url' => 'https://juejin.cn', 'description' => '中文开发者技术社区', 'color' => '#1e80ff'],
        ['name' => 'CSDN', 'url' => 'https://www.csdn.net', 'description' => '程序员中文社区', 'color' => '#fc5531'],
        ['name' => 'SegmentFault', 'url' => 'https://segmentfault.com', 'description' => '思否开发者社区', 'color' => '#009a61'],
        ['name' => 'V2EX', 'url' => 'https://www.v2ex.com', 'description' => '创意工作者社区', 'color' => '#1a1a1a'],
        ['name' => '力扣', 'url' => 'https://leetcode.cn', 'description' => '算法刷题平台', 'color' => '#ffa116'],
        ['name' => 'CodePen', 'url' => 'https://codepen.io', 'description' => '前端在线编辑器', 'color' => '#0f0e17'],
        ['name' => 'Can I Use', 'url' => 'https://caniuse.com', 'description' => '浏览器兼容性查询', 'color' => '#0da9e6'],
        ['name' => '菜鸟教程', 'url' => 'https://www.runoob.com', 'description' => '编程基础教程', 'color' => '#09a57d'],
        ['name' => 'Docker Hub', 'url' => 'https://hub.docker.com', 'description' => '容器镜像仓库', 'color' => '#1d63ed'],
    ],
    '设计资源' => [
        ['name' => 'Figma', 'url' => 'https://www.figma.com', 'description' => '协作设计工具', 'color' => '#f24e1e'],
        ['name' => 'Dribbble', 'url' => 'https://dribbble.com', 'description' => '设计师作品社区', 'color' => '#ea4c89'],
        ['name' => 'Behance', 'url' => 'https://www.behance.net', 'description' => 'Adobe 设计社区', 'color' => '#1769ff'],
        ['name' => 'Unsplash', 'url' => 'https://unsplash.com', 'description' => '免费高清图片', 'color' => '#000000'],
        ['name' => 'Iconfont', 'url' => 'https://www.iconfont.cn', 'description' => '阿里图标库', 'color' => '#e86849'],
        ['name' => '站酷', 'url' => 'https://www.zcool.com.cn', 'description' => '中文设计师平台', 'color' => '#ffd012'],
        ['name' => '花瓣', 'url' => 'https://huaban.com', 'description' => '图片灵感采集', 'color' => '#ec4141'],
        ['name' => 'Pinterest', 'url' => 'https://www.pinterest.com', 'description' => '图片灵感社区', 'color' => '#e60023'],
        ['name' => 'Google Fonts', 'url' => 'https://fonts.google.com', 'description' => '免费网络字体库', 'color' => '#4285f4'],
        ['name' => 'Coolors', 'url' => 'https://coolors.co', 'description' => '配色方案生成器', 'color' => '#f7d000'],
    ],
];

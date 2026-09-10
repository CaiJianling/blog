<?php

/**
 * 在线工具配置
 * 按分类组织工具，每个工具包含标识、名称、描述、图标和路由键。
 *
 * @return array<string, array<int, array{slug: string, name: string, description: string, icon: string}>>
 */
return [
    '格式化' => [
        [
            'slug' => 'json-formatter',
            'name' => 'JSON 格式化',
            'description' => '格式化、压缩、校验 JSON 数据，支持错误定位。',
            'icon' => 'Braces',
        ],
        [
            'slug' => 'xml-formatter',
            'name' => 'XML 格式化',
            'description' => '格式化与压缩 XML，校验 XML 结构合法性。',
            'icon' => 'CodeXml',
        ],
        [
            'slug' => 'sql-formatter',
            'name' => 'SQL 格式化',
            'description' => '美化 SQL 语句，提升可读性。',
            'icon' => 'Database',
        ],
    ],
    '加密解密' => [
        [
            'slug' => 'hash-generator',
            'name' => '哈希生成 (MD5/SHA)',
            'description' => '生成 MD5、SHA1、SHA256、SHA512 等哈希值。',
            'icon' => 'Hash',
        ],
        [
            'slug' => 'base64',
            'name' => 'Base64 编解码',
            'description' => 'Base64 编码与解码，支持文本与文件。',
            'icon' => 'Binary',
        ],
        [
            'slug' => 'url-encoder',
            'name' => 'URL 编解码',
            'description' => 'URL encode / decode 在线处理。',
            'icon' => 'Link',
        ],
    ],
    '文本处理' => [
        [
            'slug' => 'text-counter',
            'name' => '字数统计',
            'description' => '统计字符数、单词数、行数与阅读时长。',
            'icon' => 'Type',
        ],
        [
            'slug' => 'regex-tester',
            'name' => '正则表达式测试',
            'description' => '在线测试正则表达式匹配与替换。',
            'icon' => 'Regex',
        ],
        [
            'slug' => 'diff-checker',
            'name' => '文本对比',
            'description' => '对比两段文本的差异。',
            'icon' => 'GitCompare',
        ],
    ],
    '编码转换' => [
        [
            'slug' => 'case-converter',
            'name' => '大小写转换',
            'description' => '驼峰、下划线、连字符等命名风格互转。',
            'icon' => 'CaseSensitive',
        ],
        [
            'slug' => 'unit-converter',
            'name' => '单位换算',
            'description' => '长度、重量、温度、存储单位换算。',
            'icon' => 'Ruler',
        ],
        [
            'slug' => 'timestamp',
            'name' => '时间戳转换',
            'description' => 'Unix 时间戳与日期时间互转。',
            'icon' => 'Clock',
        ],
    ],
];

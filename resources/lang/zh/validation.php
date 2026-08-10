<?php

return [

    /*
    |--------------------------------------------------------------------------
    | 验证错误信息
    |--------------------------------------------------------------------------
    |
    | 以下语言行包含 Validator 类使用的默认错误信息。部分规则有多种版本，
    | 例如 size 规则。您可以在这里调整这些信息。
    |
    */

    'accepted' => '必须接受 :attribute。',
    'accepted_if' => '当 :other 为 :value 时，必须接受 :attribute。',
    'active_url' => ':attribute必须是有效的 URL。',
    'after' => ':attribute必须是 :date 之后的一个日期。',
    'after_or_equal' => ':attribute必须是一个大于或等于 :date 的日期。',
    'alpha' => ':attribute只能包含字母。',
    'alpha_dash' => ':attribute只能包含字母、数字、破折号和下划线。',
    'alpha_num' => ':attribute只能包含字母和数字。',
    'any_of' => ':attribute无效。',
    'array' => ':attribute必须是一个数组。',
    'ascii' => ':attribute只能包含单字节字母数字字符和符号。',
    'base64' => ':attribute必须是有效的 Base64 字符串。',
    'before' => ':attribute必须是 :date 之前的一个日期。',
    'before_or_equal' => ':attribute必须是一个小于或等于 :date 的日期。',
    'between' => [
        'array' => ':attribute必须有 :min 到 :max 项。',
        'file' => ':attribute必须介于 :min 到 :max KB 之间。',
        'numeric' => ':attribute必须介于 :min 到 :max 之间。',
        'string' => ':attribute必须介于 :min 到 :max 个字符之间。',
    ],
    'boolean' => ':attribute字段必须为 true 或 false。',
    'can' => ':attribute字段包含未授权的值。',
    'confirmed' => ':attribute两次输入不一致。',
    'contains' => ':attribute缺少一个必要的值。',
    'current_password' => '密码错误。',
    'date' => ':attribute不是有效的日期。',
    'date_equals' => ':attribute必须等于 :date。',
    'date_format' => ':attribute与格式 :format 不符。',
    'decimal' => ':attribute必须有 :decimal 位小数。',
    'declined' => '必须拒绝 :attribute。',
    'declined_if' => '当 :other 为 :value 时，必须拒绝 :attribute。',
    'different' => ':attribute和 :other 必须不同。',
    'digits' => ':attribute必须是 :digits 位数字。',
    'digits_between' => ':attribute必须介于 :min 到 :max 位数字之间。',
    'dimensions' => ':attribute图片尺寸无效。',
    'distinct' => ':attribute存在重复值。',
    'doesnt_contain' => ':attribute不能包含以下任何值：:values。',
    'doesnt_end_with' => ':attribute不能以以下值结尾：:values。',
    'doesnt_start_with' => ':attribute不能以以下值开头：:values。',
    'email' => ':attribute必须是有效的邮箱地址。',
    'encoding' => ':attribute必须使用 :encoding 编码。',
    'ends_with' => ':attribute必须以以下值结尾：:values。',
    'enum' => '选择的 :attribute无效。',
    'exists' => '选择的 :attribute无效。',
    'extensions' => ':attribute文件必须为以下扩展名之一：:values。',
    'file' => ':attribute必须是文件。',
    'filled' => ':attribute字段必须有值。',
    'gt' => [
        'array' => ':attribute必须多于 :value 项。',
        'file' => ':attribute必须大于 :value KB。',
        'numeric' => ':attribute必须大于 :value。',
        'string' => ':attribute必须多于 :value 个字符。',
    ],
    'gte' => [
        'array' => ':attribute必须不少于 :value 项。',
        'file' => ':attribute必须大于或等于 :value KB。',
        'numeric' => ':attribute必须大于或等于 :value。',
        'string' => ':attribute必须不少于 :value 个字符。',
    ],
    'hex_color' => ':attribute必须是有效的十六进制颜色。',
    'image' => ':attribute必须是图片。',
    'in' => '选择的 :attribute无效。',
    'in_array' => ':attribute必须在 :other 中存在。',
    'in_array_keys' => ':attribute必须包含以下键中的至少一个：:values。',
    'integer' => ':attribute必须是整数。',
    'ip' => ':attribute必须是有效的 IP 地址。',
    'ipv4' => ':attribute必须是有效的 IPv4 地址。',
    'ipv6' => ':attribute必须是有效的 IPv6 地址。',
    'json' => ':attribute必须是有效的 JSON 字符串。',
    'list' => ':attribute必须是列表。',
    'lowercase' => ':attribute必须是小写。',
    'lt' => [
        'array' => ':attribute必须少于 :value 项。',
        'file' => ':attribute必须小于 :value KB。',
        'numeric' => ':attribute必须小于 :value。',
        'string' => ':attribute必须少于 :value 个字符。',
    ],
    'lte' => [
        'array' => ':attribute不能超过 :value 项。',
        'file' => ':attribute必须小于或等于 :value KB。',
        'numeric' => ':attribute必须小于或等于 :value。',
        'string' => ':attribute不能超过 :value 个字符。',
    ],
    'mac_address' => ':attribute必须是有效的 MAC 地址。',
    'max' => [
        'array' => ':attribute不能超过 :max 项。',
        'file' => ':attribute不能大于 :max KB。',
        'numeric' => ':attribute不能大于 :max。',
        'string' => ':attribute不能大于 :max 个字符。',
    ],
    'max_digits' => ':attribute不能超过 :max 位数字。',
    'mimes' => ':attribute必须是 :values 类型的文件。',
    'mimetypes' => ':attribute必须是 :values 类型的文件。',
    'min' => [
        'array' => ':attribute至少需要 :min 项。',
        'file' => ':attribute至少需要 :min KB。',
        'numeric' => ':attribute至少需要 :min。',
        'string' => ':attribute至少需要 :min 个字符。',
    ],
    'min_digits' => ':attribute至少需要 :min 位数字。',
    'missing' => ':attribute必须缺失。',
    'missing_if' => '当 :other 为 :value 时，:attribute必须缺失。',
    'missing_unless' => '除非 :other 为 :value，否则 :attribute必须缺失。',
    'missing_with' => '当 :values 存在时，:attribute必须缺失。',
    'missing_with_all' => '当 :values 存在时，:attribute必须缺失。',
    'multiple_of' => ':attribute必须是 :value 的倍数。',
    'not_in' => '选择的 :attribute无效。',
    'not_regex' => ':attribute格式无效。',
    'numeric' => ':attribute必须是数字。',
    'password' => [
        'letters' => ':attribute必须至少包含一个字母。',
        'mixed' => ':attribute必须至少包含一个大写字母和一个小写字母。',
        'numbers' => ':attribute必须至少包含一个数字。',
        'symbols' => ':attribute必须至少包含一个符号。',
        'uncompromised' => '该 :attribute已在数据泄露中出现，请更换 :attribute。',
    ],
    'present' => ':attribute字段必须存在。',
    'present_if' => '当 :other 为 :value 时，:attribute字段必须存在。',
    'present_unless' => '除非 :other 为 :value，否则 :attribute字段必须存在。',
    'present_with' => '当 :values 存在时，:attribute字段必须存在。',
    'present_with_all' => '当 :values 存在时，:attribute字段必须存在。',
    'prohibited' => ':attribute字段被禁止。',
    'prohibited_if' => '当 :other 为 :value 时，:attribute字段被禁止。',
    'prohibited_if_accepted' => '当 :other 被接受时，:attribute字段被禁止。',
    'prohibited_if_declined' => '当 :other 被拒绝时，:attribute字段被禁止。',
    'prohibited_unless' => '除非 :other 在 :values 中，否则 :attribute字段被禁止。',
    'prohibits' => ':attribute字段禁止 :other 存在。',
    'regex' => ':attribute格式无效。',
    'required' => ':attribute不能为空。',
    'required_array_keys' => ':attribute字段必须包含：:values。',
    'required_if' => '当 :other 为 :value 时，:attribute不能为空。',
    'required_if_accepted' => '当 :other 被接受时，:attribute不能为空。',
    'required_if_declined' => '当 :other 被拒绝时，:attribute不能为空。',
    'required_unless' => '除非 :other 在 :values 中，否则 :attribute不能为空。',
    'required_with' => '当 :values 存在时，:attribute不能为空。',
    'required_with_all' => '当 :values 存在时，:attribute不能为空。',
    'required_without' => '当 :values 不存在时，:attribute不能为空。',
    'required_without_all' => '当 :values 都不存在时，:attribute不能为空。',
    'same' => ':attribute和 :other 必须相同。',
    'size' => [
        'array' => ':attribute必须包含 :size 项。',
        'file' => ':attribute必须为 :size KB。',
        'numeric' => ':attribute必须为 :size。',
        'string' => ':attribute必须为 :size 个字符。',
    ],
    'starts_with' => ':attribute必须以以下值开头：:values。',
    'string' => ':attribute必须是字符串。',
    'timezone' => ':attribute必须是有效的时区。',
    'unique' => ':attribute已被占用。',
    'uploaded' => ':attribute上传失败。',
    'uppercase' => ':attribute必须是大写。',
    'url' => ':attribute必须是有效的 URL。',
    'ulid' => ':attribute必须是有效的 ULID。',
    'uuid' => ':attribute必须是有效的 UUID。',

    /*
    |--------------------------------------------------------------------------
    | 自定义验证错误信息
    |--------------------------------------------------------------------------
    |
    | 这里可以按 "属性名.规则名" 的约定为属性指定自定义验证信息。
    |
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | 自定义属性名
    |--------------------------------------------------------------------------
    |
    | 以下语言行用于将属性占位符替换为更友好的表述，例如把 "email" 替换为
    | "邮箱地址"，让错误信息更易读。
    |
    */

    'attributes' => [
        'name' => '姓名',
        'email' => '邮箱',
        'password' => '密码',
        'role' => '角色',
        'is_active' => '状态',
        'title' => '标题',
        'content' => '内容',
    ],

];

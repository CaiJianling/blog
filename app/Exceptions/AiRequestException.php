<?php

namespace App\Exceptions;

/**
 * AI 接口请求/响应异常：携带供前端"查看详情"展示的真实错误上下文。
 */
class AiRequestException extends \RuntimeException
{
    /**
     * @param  array<string, mixed>  $context  状态码、请求 URL、上游原始返回等诊断信息
     */
    public function __construct(
        string $message,
        protected array $context = [],
    ) {
        parent::__construct($message);
    }

    /**
     * @return array<string, mixed>
     */
    public function context(): array
    {
        return $this->context;
    }
}

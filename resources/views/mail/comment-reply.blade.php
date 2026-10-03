<x-mail::message>
# 您的评论收到了新回复

**{{ $articleTitle }}**

{{ $parent->author_name }}，您在文章《{{ $articleTitle }}》中的评论收到了新回复：

<x-mail::panel>
**{{ $reply->author_name }}** 回复道：

{{ $reply->content }}
</x-mail::panel>

<x-mail::button :url="$articleUrl">
查看回复
</x-mail::button>

谢谢,<br>
{{ config('app.name') }}
</x-mail::message>

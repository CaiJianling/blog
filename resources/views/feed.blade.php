@php echo '<?xml version="1.0" encoding="UTF-8"?>'; @endphp
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>{{ $siteTitle }}</title>
        <link>{{ $siteUrl }}</link>
        <description>{{ $siteDescription }}</description>
        <language>zh-cn</language>
        <lastBuildDate>{{ $updated }}</lastBuildDate>
        <atom:link href="{{ $feedUrl }}" rel="self" type="application/rss+xml" />
        @foreach ($items as $item)
            <item>
                <title>{{ $item['title'] }}</title>
                <link>{{ $item['url'] }}</link>
                <guid isPermaLink="false">{{ $item['guid'] }}</guid>
                <description>{{ $item['summary'] }}</description>
                @if (! empty($item['author']))
                    <author>{{ $item['author'] }}</author>
                @endif
                <pubDate>{{ $item['pubDate'] }}</pubDate>
            </item>
        @endforeach
    </channel>
</rss>

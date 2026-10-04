# Post Peek Privacy Policy

Last updated: October 4, 2026

Post Peek is a browser extension that opens links to x.com, twitter.com and bsky.app posts in a popup so you can read a single post without visiting the full site.

## What Post Peek collects

Nothing. Post Peek does not collect, store, transmit, or sell any personal information, browsing history, or usage data. There are no analytics, no telemetry, no accounts, and no servers run by the developer.

## What Post Peek does on your behalf

When you click an X post link, the extension requests that post's public content from X's syndication service (`cdn.syndication.twimg.com`), the same service that powers X's embedded posts. Images are loaded from `pbs.twimg.com`. Video is loaded from `video.twimg.com` only if you press play, except for GIFs, which loop on their own and are loaded when the post opens.

When you click a Bluesky post link, the extension requests that post's public content from Bluesky's public API (`public.api.bsky.app`), the same unauthenticated service Bluesky's own embedded posts use. Images are loaded from `cdn.bsky.app`. A video's thumbnail is loaded from `video.bsky.app` and `video.cdn.bsky.app` when the post opens, and the video itself only if you press play (a GIF is loaded when the post opens). Media that Bluesky labels as adult or graphic is not requested until you choose to show it. Posts whose authors have asked Bluesky not to show them to logged-out viewers, and posts Bluesky's moderators have hidden, are not displayed.

Every one of these requests is made anonymously:

- No cookies or other credentials are sent, so neither X nor Bluesky can tie the request to an account, even if you are logged in to either site in the same browser.
- Nothing in the request names the website you were reading when you clicked the link. No `Referer` header is sent. Images are fetched by the extension itself rather than by the page, and video plays in a sandboxed frame whose requests carry `Origin: null`, so the `Origin` header does not name the site either.

Each site still receives the post being requested and the standard connection information any web request carries, such as your IP address and browser version. That information is governed by [X's privacy policy](https://x.com/privacy) or [Bluesky's privacy policy](https://bsky.social/about/support/privacy-policy). If you do not want either site to see your IP address, use a VPN or do not click the link.

Fetched posts are kept in the extension's memory for up to five minutes so that reopening the same post does not repeat the request, and are then discarded. Post Peek writes nothing to disk itself, and it asks the browser not to cache the posts and images it fetches. Video is the exception: it is streamed by the browser's own player, which may keep parts of a video you play in its cache, as it does for video on any site. Clearing your browsing data removes it.

## What Post Peek does on the pages you visit

The extension runs on web pages so it can react when you click a post link. It does not scan, read, store, or transmit page content. It only inspects the address of the link you clicked. The dot marker next to openable links is drawn with a stylesheet and does not modify the page's links. It responds only to clicks you make yourself, not to clicks a page generates. The extension does not run inside frames, on x.com, twitter.com or bsky.app, or on local files.

A website can still tell that Post Peek is installed if it looks for it: the stylesheet that draws the dot marker is present on every page, even when dots are turned off.

## Where your settings live

Your three preferences (whether peeking is enabled, whether links are marked with a dot, and the popup theme) are stored in the browser's local extension storage on your device. They are not synced to a Google or Firefox account or sent anywhere. Uninstalling the extension deletes them.

## Permissions explained

- **storage**: saves your preferences on this device.
- **Access to `cdn.syndication.twimg.com` and `pbs.twimg.com`**: fetches the X post you clicked and its images. X video comes from `video.twimg.com`, which needs no permission: it plays in a sandboxed frame, like video on any web page.
- **Access to `public.api.bsky.app`, `cdn.bsky.app`, `video.bsky.app`, and `video.cdn.bsky.app`**: fetches the Bluesky post you clicked, its images and its video thumbnails.
- **Access to pages you visit**: needed to intercept clicks on post links, mark them with a dot, and show the popup. See the section above for what the extension does and does not do on those pages. You can restrict this to specific sites from the extension's details page in Chrome, or revoke it per site from the extensions button in Firefox. If you do restrict it, keep the hosts above allowed, or posts and their images will not load.

The Firefox build declares to addons.mozilla.org that it collects no data (`data_collection_permissions: none`), which is the same claim this policy makes.

## Changes

If this policy changes, the updated version will be published in the project repository with a new date at the top.

## Contact

Questions can be filed as an issue on the project's GitHub repository.

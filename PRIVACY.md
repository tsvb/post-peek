# Post Peek Privacy Policy

Last updated: September 6, 2026

Post Peek is a browser extension that opens links to x.com and twitter.com posts in a popup so you can read a single post without visiting the full site.

## What Post Peek collects

Nothing. Post Peek does not collect, store, transmit, or sell any personal information, browsing history, or usage data. There are no analytics, no telemetry, no accounts, and no servers run by the developer.

## What Post Peek does on your behalf

When you click a post link, the extension requests that post's public content from X's syndication service (`cdn.syndication.twimg.com`), the same service that powers X's embedded posts. Images are loaded from `pbs.twimg.com`. Video is loaded from `video.twimg.com` only if you press play.

Every one of these requests is made anonymously:

- No cookies or other credentials are sent, so X cannot tie the request to an X account, even if you are logged in to X in the same browser.
- No `Referer` header is sent, so X does not learn which website you were reading when you clicked the link.

X still receives the post ID being requested and the standard connection information any web request carries, such as your IP address and browser version. X's handling of that information is governed by [X's privacy policy](https://x.com/privacy). If you do not want X to see your IP address, use a VPN or do not click the link.

Fetched posts are kept in the extension's memory for up to five minutes so that reopening the same post does not repeat the request. Nothing is written to disk.

## What Post Peek does on the pages you visit

The extension runs on web pages so it can react when you click a post link. It does not scan, read, store, or transmit page content. It only inspects the address of the link you clicked. The dot marker next to openable links is drawn with a stylesheet and does not modify the page's links. The extension does not run inside frames, on x.com or twitter.com, or on local files.

## Where your settings live

Your three preferences (whether peeking is enabled, whether links are marked with a dot, and the popup theme) are stored in Chrome's local extension storage on your device. They are not synced to a Google account or sent anywhere. Uninstalling the extension deletes them.

## Permissions explained

- **storage**: saves your preferences on this device.
- **Access to `cdn.syndication.twimg.com`, `pbs.twimg.com`, and `video.twimg.com`**: fetches the post you clicked and its media.
- **Access to pages you visit**: needed to intercept clicks on post links, mark them with a dot, and show the popup. See the section above for what the extension does and does not do on those pages. You can restrict this to specific sites from the extension's details page in Chrome.

## Changes

If this policy changes, the updated version will be published in the project repository with a new date at the top.

## Contact

Questions can be filed as an issue on the project's GitHub repository.

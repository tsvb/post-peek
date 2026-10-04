# addons.mozilla.org listing

Copy each section into the matching field of the AMO Developer Hub
(https://addons.mozilla.org/developers/). Where a field matches the Chrome one,
the text is the same as `LISTING.md` with "Chrome" made browser-neutral.

## Before you start

- A Firefox account with the developer agreement accepted, at the Developer Hub.
- `npm run build`, which writes `dist/post-peek-<version>-firefox.zip`. Upload that
  zip, not the Chrome one: it carries the Firefox manifest with the add-on ID
  `post-peek@timvbs.com`, which is what ties every future update to this listing.
- A source archive, because AMO treats a build step that generates files (here, the
  manifest rewrite in `scripts/firefox-manifest.js`) as pre-processing and asks for
  the source the reviewer can rebuild from:

  ```bash
  git archive --format=zip -o dist/post-peek-<version>-source.zip v<version>
  ```

  The README's "Building for the stores" section is the build instruction; there are
  no dependencies, so there is no lockfile to include.

## Submission wizard

1. **Distribution**: On this site (listed).
2. **Upload**: `dist/post-peek-<version>-firefox.zip`. The validator should pass with
   no errors (the release workflow runs the same `web-ext lint`). It may warn that the
   data-collection key is unknown to Firefox for Android 140-141; that is expected.
3. **Source code**: choose Yes and upload the source zip from above. Notes to reviewer
   are in the section below.
4. **Listing details**: the fields that follow.

## Name

Post Peek

## Add-on URL slug

post-peek

## Summary (250 characters max)

Read one post and leave. Opens X and Bluesky post links in a popup on the page you are already reading, instead of sending you to the full site. No account needed, and no cookies or Referer are ever sent to either.

## Description

Post Peek lets you read a single X or Bluesky post without visiting x.com or bsky.app.

When someone links to a post, you usually want to see that one post, not land on the full site with its login prompts, sidebars, and endless feed. Post Peek opens the link in a small popup on the page you are already reading. Read it, close it, move on.

<b>What it does</b>

<ul>
<li>Marks every openable x.com, twitter.com, and bsky.app post link with a small blue dot, so you know before you click.</li>
<li>Opens the post in a popup: the text, photos, video, link previews, quoted posts, and reply context.</li>
<li>Shows likes, replies, and the date, with a button to open the post on X or Bluesky if you want the full thread.</li>
<li>Follows quoted posts and "Replying to" links inside the same popup.</li>
<li>Closes with Esc or a click outside the popup, returning focus to where you were.</li>
<li>Matches your system's light or dark theme, or set one in the settings.</li>
</ul>

<b>Privacy</b>

Post Peek never sends your cookies or login to X or Bluesky, and never tells either which site you were reading. Posts are fetched anonymously from the same public services that power each site's embedded posts, with no credentials and no Referer. Images are fetched by the extension itself rather than by the page, and video plays in a sandboxed frame, so no request carries the address or origin of the page you are on. Video is not fetched until you press play (GIFs, which loop on their own, load with the post). You do not need an account on either site.

Bluesky's choices are respected: posts whose authors hide them from logged-out viewers and posts Bluesky's moderators have hidden are not shown, and media labeled adult or graphic stays behind a click and is not fetched until you ask.

The extension never scans the pages you visit or touches their links. The dot marker is pure CSS, only the link you click is inspected, and only clicks you make yourself count. It exposes no web-accessible resources, and with the dot marker turned off it writes nothing to the page. A site that goes looking can still tell the extension is installed, because the dot stylesheet is present on every page.

The extension collects nothing. No analytics, no telemetry, no accounts, no servers of ours. Your only stored data is three settings (on/off, dot marker, theme) kept on your device in the browser's local extension storage, never synced.

<b>How to use</b>

Click any dotted link. Hold Ctrl, Cmd, Shift, or Alt while clicking, or middle-click, to open the link normally in a new tab instead. Click the toolbar icon to turn peeking off, hide the dots, or change the theme.

<b>Limits</b>

Posts from protected accounts, age-restricted posts, deleted posts, and Bluesky posts limited to signed-in viewers cannot be shown, so the popup shows a short message with a link to open them on X or Bluesky instead. Bluesky video needs HLS playback, which Firefox does not have built in, so a Bluesky video shows its thumbnail with a link to watch it on Bluesky. The extension does not run on x.com, twitter.com, or bsky.app themselves. Firefox 140 or newer is required.

Post Peek is open source under the MIT license:
https://github.com/tsvb/post-peek

Post Peek is an independent project inspired by Litterbox, the Safari extension for iOS and macOS by Zhenyi Tan (And a Dinosaur). Litterbox is the original, it is free, and if you use Safari you should use it instead:
https://andadinosaur.com/launch-litterbox

The popup, the marker on links that can be opened, and the cookie-free fetching are all Litterbox's ideas. Post Peek is a separate Chrome and Firefox implementation of them, written from scratch. It is not affiliated with, endorsed by, or supported by Litterbox, And a Dinosaur, X Corp., or Bluesky.

## Categories

- Firefox: Social & Communication; Privacy & Security
- Firefox for Android: leave unset. The extension is not tested there.

## Support

- Support email: the address on the Chrome listing.
- Support website: https://github.com/tsvb/post-peek/issues
- Homepage: https://timvanbenschoten.com/code/post-peek

## License

MIT License

## Privacy policy

Tick "This add-on has a privacy policy" and paste PRIVACY.md, or link it:
https://github.com/tsvb/post-peek/blob/main/PRIVACY.md

## Data collection

The manifest declares `data_collection_permissions: { required: ["none"] }`, so the
listing shows "This add-on does not collect data" automatically. There is nothing to
fill in.

## Notes to reviewer

Post Peek fetches the clicked post as JSON from cdn.syndication.twimg.com, the endpoint behind X's own embedded posts, or from public.api.bsky.app, the unauthenticated API behind Bluesky's, with credentials omitted and no Referer, and renders it with DOM APIs inside a closed shadow root. No remote code is loaded. pbs.twimg.com (X) and cdn.bsky.app, video.bsky.app, and video.cdn.bsky.app (Bluesky) serve the post's avatar, photos, link-card images, and video thumbnails (video.bsky.app redirects a thumbnail to video.cdn.bsky.app). The background script fetches every image itself and displays it inline, because a request made by the page would tell the media host which site the user is reading; that is why they are host permissions. Version 1.3.0 drops the video.twimg.com host permission, which video in a frame never needed. Video plays in a sandboxed srcdoc frame that contains markup only, no script. A GIF's frame carries sandbox="allow-scripts" only because that is what lifts the sandbox's block on autoplay; the frame's document still has no script, and without allow-same-origin its origin stays opaque. The content script runs on http and https pages because it has to intercept clicks on post links wherever the user is reading; it does not scan the DOM (the dot marker is a static stylesheet matched on href) and reads only the address of the clicked link.

Build: `node scripts/build-zip.js` with Node 24, no dependencies. It zips `manifest.json`, `icons/`, `src/`, `options/` unchanged, except that for the Firefox zip `manifest.json` is rewritten by `scripts/firefox-manifest.js` (background service worker becomes a background script, plus the gecko block). Everything else in the zip is byte-identical to the repository at the tagged commit.

Testing: serve the repository folder over HTTP (`python -m http.server 8000`) and open http://localhost:8000/test.html, which has post links for every accepted host and URL shape.

## Version notes

Paste into "Release notes" when uploading the version. For 1.3.0:

Bluesky support: bsky.app post links are dotted and open in the popup, with text, images, link cards, quoted posts and reply context. Bluesky's moderation choices are honored, and labeled media stays behind a click. Bluesky video shows its thumbnail with a link to watch on Bluesky, because Firefox has no built-in HLS playback.

Privacy fix: images and video no longer tell X or Bluesky which site you are reading. Images are now fetched by the extension itself, and video plays in a sandboxed frame, so no request carries the page's Origin or Referer. This affected X images and video in earlier versions.

Permissions: four hosts were added for Bluesky (public.api.bsky.app, cdn.bsky.app, video.bsky.app and video.cdn.bsky.app), and video.twimg.com was dropped because it was never needed. If you limited the add-on to specific sites, allow the four new hosts as well.

Also fixed: stray characters at the end of some X posts with emoji, HTML entities shown literally in X posts, Esc not closing the popup after a click on a video, and links staying intercepted in open tabs after the add-on was updated or removed.

## Assets

- Icon: `icons/icon128.png` (AMO accepts 128x128 PNG and scales it)
- Screenshots (1280x800), in this order so they read as before and after:
  1. `store/screenshot-2.png`: A small blue dot marks every X and Bluesky post link Post Peek
     can open, so you know before you click.
  2. `store/screenshot-1.png`: Click a link to an X post and it opens in place: text, media,
     date, and an Open on X button. Press Esc to close and keep reading.
  3. `store/screenshot-3.png`: Bluesky posts open the same way, with an Open on Bluesky button.
     No account needed on either site.

## Releasing updates

Every release tag builds the Firefox zip in the GitHub release. Upload it as a new
version from the listing's "Manage Status & Versions" page, attach the matching source
archive, and repeat the version notes from CHANGELOG.md.

## Published listing

https://addons.mozilla.org/firefox/addon/post-peek/

Submitted 13 September 2026 as 1.2.0 (add-on ID `post-peek@timvbs.com`, support email
postpeek@timvbs.com). Approved by Mozilla; confirmed public on 16 September 2026.

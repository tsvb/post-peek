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

Read one X post and leave. Opens x.com and twitter.com post links in a popup on the page you are already reading, instead of sending you to the full site. No account needed, and no cookies or Referer are ever sent to X.

## Description

Post Peek lets you read a single X post without visiting x.com.

When someone links to a post, you usually want to see that one post, not land on the full site with its login prompts, sidebars, and endless feed. Post Peek opens the link in a small popup on the page you are already reading. Read it, close it, move on.

<b>What it does</b>

<ul>
<li>Marks every openable x.com and twitter.com post link with a small blue dot, so you know before you click.</li>
<li>Opens the post in a popup: the text, photos, video, link previews, quoted posts, and reply context.</li>
<li>Shows likes, replies, and the date, with a button to open the post on X if you want the full thread.</li>
<li>Follows quoted posts and "Replying to" links inside the same popup.</li>
<li>Closes with Esc or a click outside the popup, returning focus to where you were.</li>
<li>Matches your system's light or dark theme, or set one in the settings.</li>
</ul>

<b>Privacy</b>

Post Peek never sends your cookies or login to X, and never tells X which site you were reading. Posts and media are fetched anonymously from the same public service that powers X's embedded posts, with credentials and the Referer stripped from every request. Video is not fetched until you press play. You do not need an X account.

The extension never scans the pages you visit or touches their links. The dot marker is pure CSS, and only the link you click is inspected. Websites have nothing to probe for: the extension exposes no web-accessible resources, and with the dot marker turned off it writes nothing to the page at all.

The extension collects nothing. No analytics, no telemetry, no accounts, no servers of ours. Your only stored data is three settings (on/off, dot marker, theme) kept on your device in the browser's local extension storage, never synced.

<b>How to use</b>

Click any dotted link. Hold Ctrl, Cmd, Shift, or Alt while clicking, or middle-click, to open the link normally in a new tab instead. Click the toolbar icon to turn peeking off, hide the dots, or change the theme.

<b>Limits</b>

Posts from protected accounts, age-restricted posts, and deleted posts cannot be embedded, so the popup shows a short message with a link to open them on X instead. The extension does not run on x.com or twitter.com themselves. Firefox 140 or newer is required.

Post Peek is open source under the MIT license:
https://github.com/tsvb/post-peek

Post Peek is an independent project inspired by Litterbox, the Safari extension for iOS and macOS by Zhenyi Tan (And a Dinosaur). Litterbox is the original, it is free, and if you use Safari you should use it instead:
https://andadinosaur.com/launch-litterbox

The popup, the marker on links that can be opened, and the cookie-free fetching are all Litterbox's ideas. Post Peek is a separate Chrome and Firefox implementation of them, written from scratch. It is not affiliated with, endorsed by, or supported by Litterbox, And a Dinosaur, or X Corp.

## Categories

- Firefox: Social & Communication; Privacy & Security
- Firefox for Android: leave unset. The extension is not tested there.

## Support

- Support email: the address on the Chrome listing.
- Support website: https://github.com/tsvb/post-peek/issues
- Homepage: https://github.com/tsvb/post-peek

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

Post Peek fetches the clicked post as JSON from cdn.syndication.twimg.com, the endpoint behind X's own embedded posts, with credentials omitted and no Referer, and renders it with DOM APIs inside a closed shadow root. No remote code is loaded. pbs.twimg.com and video.twimg.com serve the post's avatar, photos, and video; when a page's Content Security Policy blocks images from those hosts, the background script fetches the image and displays it inline, which is why they are host permissions. The content script runs on http and https pages because it has to intercept clicks on post links wherever the user is reading; it does not scan the DOM (the dot marker is a static stylesheet matched on href) and reads only the address of the clicked link.

Build: `node scripts/build-zip.js` with Node 24, no dependencies. It zips `manifest.json`, `icons/`, `src/`, `options/` unchanged, except that for the Firefox zip `manifest.json` is rewritten by `scripts/firefox-manifest.js` (background service worker becomes a background script, plus the gecko block). Everything else in the zip is byte-identical to the repository at the tagged commit.

Testing: serve the repository folder over HTTP (`python -m http.server 8000`) and open http://localhost:8000/test.html, which has post links for every accepted host and URL shape.

## Version notes (first version)

First Firefox release. Same features as the Chrome extension.

## Assets

- Icon: `icons/icon128.png` (AMO accepts 128x128 PNG and scales it)
- Screenshots: `store/screenshot-1.png`, `store/screenshot-2.png` (1280x800)

## Releasing updates

Every release tag builds the Firefox zip in the GitHub release. Upload it as a new
version from the listing's "Manage Status & Versions" page, attach the matching source
archive, and repeat the version notes from CHANGELOG.md.

## Published listing

https://addons.mozilla.org/firefox/addon/post-peek/

Submitted 13 September 2026 as 1.2.0 (add-on ID `post-peek@timvbs.com`, support email
postpeek@timvbs.com). The page is public once the first review is approved.

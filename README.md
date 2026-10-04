# Post Peek

Read one post and leave. A Chrome (Manifest V3) extension that opens x.com,
twitter.com and bsky.app post links in a popup instead of sending you to the full site.

Post Peek is an independent, open-source project inspired by the Safari extension
[Litterbox - Post Peeker](https://apps.apple.com/us/app/litterbox-post-peeker/id6805719216)
by And a Dinosaur. It is not affiliated with that project, with X Corp., or with Bluesky.

## Features

- Opens post links in a popup so you can read the one post and close it.
- Marks openable links with a small blue dot.
- Renders text, photos, video, link cards, quoted posts, and reply context.
- Uses the same syndication API that powers X's embed widgets, and Bluesky's public API.
- Never sends cookies, a Referer, or an Origin naming the page to X or Bluesky: posts and images are
  fetched by the extension itself and video plays in a sandboxed frame, so neither site can tie a peek
  to your account or learn which site you were reading. No account needed.
- Respects Bluesky authors who hide their posts from logged-out viewers and posts Bluesky's
  moderators have hidden, and keeps media labeled as adult or graphic behind a click.
- Never scans the page or touches its links. The dot is pure CSS; only the clicked link is inspected.
- Little for websites to probe: no web-accessible resources, no response to clicks a page fakes, and with dots turned off nothing is written to the page. (The dot stylesheet is always present, so a site that goes looking can still tell the extension is installed.)
- Settings stay on your device (`chrome.storage.local`, never synced).
- No data collection. See [PRIVACY.md](PRIVACY.md).

## Install from source

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick this folder.
2. Serve this folder over HTTP and open the test page, for example:

   ```bash
   python -m http.server 8000
   ```

   then visit `http://localhost:8000/test.html`. The extension deliberately does not run on `file://` pages.

## Usage

- Click a post link to peek. Ctrl/Cmd-, Shift-, Alt- or middle-click opens the link normally.
- Esc or clicking the backdrop closes the popup. Quoted posts and "Replying to" open in the same popup.
- Toolbar button: toggle peeking, the dot marker, and the popup theme.

## Building for the Chrome Web Store

```bash
npm run build
```

This writes `dist/post-peek-<version>.zip` containing only the runtime files
(`manifest.json`, `src/`, `options/`, `icons/`). To regenerate the icons: `npm run icons`.

## Releasing

1. Move the `Unreleased` notes in [CHANGELOG.md](CHANGELOG.md) under the new version.
2. Bump `version` in `manifest.json` and `package.json`, then commit.
3. Tag and push: `git tag v1.2.3 && git push origin v1.2.3`.

The [release workflow](.github/workflows/release.yml) checks that the tag matches the
manifest version, builds the zip, and attaches it to a GitHub release. Upload that same
zip to the Chrome Web Store.

## Layout

- `manifest.json` - MV3 manifest.
- `src/background.js` - service worker; fetches posts from `cdn.syndication.twimg.com` and `public.api.bsky.app`, and fetches every image the popup shows, so no image request comes from the page.
- `src/content.js` - intercepts clicks on post links and renders the popup inside a closed Shadow DOM, with video in a sandboxed frame.
- `src/content.css` - dot marker, matched purely on the link's `href`.
- `src/popup-css.js` - popup stylesheet embedded as a string (so nothing is web-accessible).
- `options/` - settings page (also the toolbar popup).
- `scripts/` - icon generator and zip builder.
- `test/` - dependency-free tests for the packaging and privacy invariants (`npm test`).
- `test.html` - page of links for checking dots and peeking by hand in the browser.

## License

[MIT](LICENSE)

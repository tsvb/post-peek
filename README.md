# Post Peek

Read one X post and leave. A Chrome (Manifest V3) extension that opens x.com and
twitter.com post links in a popup instead of sending you to the full site.

Post Peek is an independent, open-source project inspired by the Safari extension
[Litterbox - Post Peeker](https://apps.apple.com/us/app/litterbox-post-peeker/id6805719216)
by And a Dinosaur. It is not affiliated with that project or with X Corp.

## Features

- Opens post links in a popup so you can read the one post and close it.
- Marks openable links with a small blue dot.
- Renders text, photos, video, link cards, quoted posts, and reply context.
- Uses the same syndication API that powers X's embed widgets.
- Never sends cookies to X (every request uses `credentials: "omit"`). No account needed.
- No data collection. See [PRIVACY.md](PRIVACY.md).

## Install from source

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick this folder.
2. Open `test.html` in Chrome to try it. For `file://` pages, also enable "Allow access to file URLs" on the extension's details page.

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

1. Bump `version` in `manifest.json` and `package.json`, then commit.
2. Tag and push: `git tag v1.2.3 && git push origin v1.2.3`.

The [release workflow](.github/workflows/release.yml) checks that the tag matches the
manifest version, builds the zip, and attaches it to a GitHub release. Upload that same
zip to the Chrome Web Store.

## Layout

- `manifest.json` - MV3 manifest.
- `src/background.js` - service worker; fetches posts from `cdn.syndication.twimg.com` and proxies images when a page's CSP blocks `twimg.com`.
- `src/content.js` - marks links, intercepts clicks, renders the popup inside a closed Shadow DOM.
- `src/content.css` / `src/popup.css` - dot marker and popup styles.
- `options/` - settings page (also the toolbar popup).
- `scripts/` - icon generator and zip builder.

## License

[MIT](LICENSE)

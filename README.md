# Litterbox - Post Peeker (Chrome)

x.com without visiting x.com. A Chrome (Manifest V3) port of the Safari extension
[Litterbox - Post Peeker](https://apps.apple.com/us/app/litterbox-post-peeker/id6805719216).

- Opens x.com / twitter.com post links in a popup so you can read the one post and leave.
- Marks openable links with a small blue dot.
- Uses the same syndication API that powers X's embed widgets.
- Never sends cookies to X (every request uses `credentials: "omit"`). No account needed.

## Install (unpacked)

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick this folder.
2. Open `test.html` in Chrome to try it.

To regenerate the icons: `node scripts/make-icons.js`.

## Usage

- Click a post link to peek. Ctrl/Cmd-, Shift-, Alt- or middle-click opens the link normally.
- Esc or clicking the backdrop closes the popup. Quoted posts and "Replying to" open in the same popup.
- Toolbar button: toggle peeking, the dot marker, and the popup theme.

## Layout

- `manifest.json` - MV3 manifest.
- `src/background.js` - service worker; fetches posts from `cdn.syndication.twimg.com` and proxies images when a page's CSP blocks `twimg.com`.
- `src/content.js` - marks links, intercepts clicks, renders the popup inside a closed Shadow DOM.
- `src/content.css` / `src/popup.css` - dot marker and popup styles.
- `options/` - settings page (also the toolbar popup).

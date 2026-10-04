# Changelog

All notable changes to Post Peek. Versions follow [semantic versioning](https://semver.org/),
and each released version is a git tag and an upload to the Chrome Web Store and addons.mozilla.org.

## [Unreleased]

### Added

- A switch for each site in the settings. With "X posts" or "Bluesky posts" off, that
  site's links get no dot and open as any other link does. Both are on by default, and
  "Enable post peeking" still turns everything off at once.

## [1.3.0] - 2026-10-04

Bluesky support, and a privacy fix for images and video that affects every earlier version.

### Added

- Bluesky support: `bsky.app/profile/<handle or DID>/post/<id>` links are dotted and open
  in the popup, with text and links, images, video, link cards, quoted posts and reply
  context. Posts come from Bluesky's public API (`public.api.bsky.app`), fetched like X
  posts: no cookies, no Referer.
- Bluesky moderation is honored as bsky.app does for logged-out viewers. Posts are not
  shown if their authors asked to be hidden from logged-out viewers, or if Bluesky's
  moderators hid them (`!hide` on the post or the account). That covers reply context and
  quoted posts too, withheld in the service worker before they reach the page. Media and
  link cards labeled porn, sexual, nudity, graphic-media or gore, on the post or the
  account, stay behind a click, as does all of a post labeled `!warn`, and avatars with
  those labels are left out.
- New host permissions: `public.api.bsky.app`, `cdn.bsky.app`, `video.bsky.app`,
  `video.cdn.bsky.app`. They fall under the access to all sites the extension already has,
  so an update should not ask for anything new. If you limited the extension to specific
  sites, allow these four as well, or Bluesky posts and their images will not load. The
  extension no longer runs on `bsky.app` itself.
- Bluesky link text that names one site while the link opens another is followed by the
  site it really opens.
- Links to the addons.mozilla.org listing in README.md and `store/LISTING-FIREFOX.md`.
- `homepage_url` in the manifest: the project page,
  [timvanbenschoten.com/code/post-peek](https://timvanbenschoten.com/code/post-peek), which
  Chrome and Firefox link from the extension's details. The store listing notes use it as the
  homepage too, and GitHub releases made by the release workflow start with a "Project page" line.

### Changed

- Every image (avatars, photos, card thumbnails, video posters) is now fetched by the
  service worker instead of by the page. The media proxy also checks the host after
  redirects, returns only images, and keeps them out of the browser's disk cache.
- Bluesky GIFs loop on their own, as X GIFs already did, instead of waiting for play.
- Media behind a "Show" button is not requested until the button is pressed.
- The dot marker matches hosts only at the start of a link's address, so a post URL inside
  another site's query string is no longer dotted (it never opened in the popup).
- PRIVACY.md, the README and the store listing now say what is true of video caching, GIFs
  loading when a post opens, and a site's ability to detect the extension through its dot
  stylesheet. `store/LISTING.md` covers Bluesky and all six host permissions.
- The `video.twimg.com` host permission is gone. X video plays in the sandboxed frame,
  which needs no permission, and X serves no image from that host.
- The popup's host element is a plain `div` rather than a custom element. A page could
  define the custom element's name and read the popup through it, closed shadow root or
  not. The popup's styles now also hold against a page's own rules for divs.
- The dot marker matches a link's host in any case, as the click handler always has.
- The image proxy refuses anything over 20 MB, and a post quoted by a quoted Bluesky post
  is withheld in the service worker under the same rules as the quote itself.
- The release workflow pins `web-ext` to version 10 and no longer leaves its token in the
  checkout.
- The store screenshots show both networks: the links shot has a dotted X link and a dotted
  Bluesky link, and a third screenshot, `store/screenshot-3.png`, shows a Bluesky post open
  in the popup. `store/make-showcase.js` now gets its posts and images through the real
  service worker code, so the screenshots show what the extension renders.
- The addons.mozilla.org listing passed Mozilla's review and is public. README.md now points
  Firefox users straight to it instead of the release zip, and `store/LISTING-FIREFOX.md`
  records the approval.

### Fixed

- Images and video told X and Bluesky which site you were reading, through the `Origin`
  header that `crossorigin="anonymous"` adds to each request. This affected every X image
  and video since 1.0. Images now come through the service worker, and video plays in a
  sandboxed frame whose requests carry `Origin: null`.
- Playing a video also sent the page you were reading in the `Referer` header. `<video>`
  honors `referrerpolicy` only for its poster, not for the stream. The player's frame has
  a no-referrer policy, so playlists and segments carry no Referer. This affected X video
  in every earlier version.
- A page could dispatch a click on a post link itself, which revealed the extension even
  with dots off and made it fetch a post of the page's choosing. Only real clicks count now.
- After the extension was disabled, removed or updated, open tabs kept intercepting post
  links and showed "Post Peek was updated". The leftover script now steps aside and links
  open normally.
- On a page that replaced its `<body>`, clicks on post links were swallowed and no popup
  appeared.
- Bluesky video thumbnails were refused by the image proxy: `video.cdn.bsky.app` serves
  them as `application/octet-stream`. A mislabeled image is now recognized by its first bytes.
- X posts with an emoji and attached media showed a stray " h" at the end of the text.
- X post text showed `&amp;`, `&lt;` and `&gt;` literally.
- Expired posts stayed in the service worker's memory until the same post was requested
  again. They are now dropped after five minutes.
- Esc closes the popup after a click on a video's controls. The click moved keyboard focus
  into the player's sandboxed frame, where the popup could not see the key; the popup now
  takes focus back as soon as a click puts it there.
- The popup's footer left a dangling "·" after the date, with the counts on a line of their
  own. Date and counts now share a line and wrap between items in a narrow popup, and the
  "Open on" button no longer drops to a line of its own.
- A quoted Bluesky post whose address cannot be read is left out, instead of becoming a box
  that fails when clicked.
- The service worker requests an X post only for an id that is a number.
- A setting removed from storage no longer switches peeking off in open tabs.

### Known limitations

- Firefox has no built-in HLS playback, so a Bluesky video there shows its thumbnail with a
  link to watch it on Bluesky. X video plays in both browsers.

- After you Tab into a video player's controls, Esc does not close the popup: the
  sandboxed frame keeps its key presses to itself. Tab back out first, or use the close
  button. (After a click on the player, Esc works; see Fixed.) For the same reason, the
  player's own keyboard shortcuts, such as Space to pause, work only after you Tab into it.
- A video the page's Content Security Policy blocks shows an empty player rather than a
  "could not be loaded" message. The frame cannot report the failure without a script
  and a message the page could see and forge, and the page's policy cannot be read
  without making a request. "Open on X" or "Open on Bluesky" below the post still works.

### Repository

- `.gitattributes` keeps line endings as LF, and the tests normalize them, so a checkout
  made with `core.autocrlf=true` passes.
- Tests now run the real service worker functions against a stubbed `fetch` (withholding,
  cache eviction, the media proxy), exercise the click handler, and pin down that no image
  or video is ever loaded from the page directly.

## [1.2.0] - 2026-09-13

First release for Firefox. Requested in [#3](https://github.com/tsvb/post-peek/issues/3).

### Added

- Firefox support. `npm run build` now also writes `dist/post-peek-<version>-firefox.zip`,
  the same files with the manifest rewritten by `scripts/firefox-manifest.js`: Firefox has
  no background service workers, so `src/background.js` runs as an event page instead, and
  the manifest carries the add-on ID (`post-peek@timvbs.com`), a minimum of Firefox 140,
  and the `data_collection_permissions: none` declaration addons.mozilla.org requires. The
  checked-in `manifest.json` is unchanged, so the Chrome zip is byte-for-byte what it was.
- The popup stylesheet falls back to a `<style>` inside the closed shadow root when
  `adoptedStyleSheets` cannot be assigned. Firefox before 153 rejects that assignment from
  a content script (Firefox bug 1751346). The fallback is still invisible to the page;
  the one difference is that on those older Firefox versions a host page with a strict
  `style-src` policy can block it, leaving the popup unstyled there.
- The "reload this page" hint also recognises Firefox's wording when the extension has
  been updated under an open page.
- Tests for the Firefox manifest rewrite and the stylesheet fallback, and the release
  workflow runs `web-ext lint` (the addons.mozilla.org validator) on the Firefox zip and
  attaches both zips to the GitHub release.
- `store/LISTING-FIREFOX.md`, the addons.mozilla.org listing copy and submission notes,
  alongside the Chrome one.
- Install links to the published Chrome Web Store listing: an Add to Chrome button under
  the tagline, a store-version badge in place of the GitHub release badge, and an `Install`
  section that leads with the store and keeps loading unpacked as a subsection for
  development. The listing URL is also recorded in `store/LISTING.md`.
- README artwork in `media/`, rendered by `scripts/make-readme-media.js` (`npm run media`):
  a banner reusing the mark and gradient from the store tiles, and the two store
  screenshots cropped to their content. The store PNGs stay 1280x800 for the dashboard.
- The README leads with the banner, status badges, and the two store screenshots as a
  before/after pair.

### Changed

- Documentation credits [Litterbox](https://andadinosaur.com/launch-litterbox) by name,
  author, and launch post in README.md, the store listing, and the 1.0.0 changelog entry,
  naming which of this extension's ideas are Litterbox's - the popup, the marker on
  openable links, the cookie-free embed fetch, the link out to X, the name, and the
  tagline - and saying plainly that Post Peek is a from-scratch Chrome implementation of
  them rather than a port.
- Two feature lines were reworded away from Litterbox's own App Store copy, which they had
  been echoing almost verbatim.

## [1.1.4] - 2026-09-06

Repository and test changes only. The packaged extension - `manifest.json`, `src/`,
`options/`, `icons/` - is unchanged from 1.1.3 apart from the version string.

### Added

- Test suite (`npm test`, no dependencies) covering the packaging rules the Chrome Web
  Store enforces and the privacy invariants PRIVACY.md and the store listing claim:
  permissions, no web-accessible resources, the dot host list against `POST_RE`, the
  media allowlist, local-only settings, and cookie-free/Referer-free fetches.
- This changelog.

### Changed

- `test.html` covers every accepted host (including `m.x.com`), the `/statuses/`, `#!/`,
  query-string and fragment URL shapes, the hosts that must not be dotted, and links
  added after load, including one inside a shadow root. The dynamic-link button had been
  written to exercise the MutationObserver that 1.1.0 removed.

## [1.1.3] - 2026-09-06

### Fixed

- The dot marker's host list in `content.css` had drifted from `POST_RE` in `content.js`:
  nine peekable host variants were never dotted, `m.x.com` among them, so those links
  opened a popup with nothing having indicated they would. The list is now the full
  prefix/domain cross-product the regex accepts, so the two agree exactly.

## [1.1.2] - 2026-09-06

### Fixed

- Media URLs were checked for scheme but not host, and the video poster was not checked
  at all, so an image, avatar, card thumbnail, or poster pointing off `twimg.com` would
  have been fetched directly by the page, contradicting the manifest's host list and
  PRIVACY.md. `safeMediaUrl` now requires https and `pbs.twimg.com` or `video.twimg.com`
  for every media sink, matching the allowlist the service worker's proxy already
  enforced. Off-allowlist media fails closed. Post links are unaffected, since a post may
  legitimately link anywhere.
- Trimmed the manifest description to fit the Chrome Web Store's 132-character limit,
  which had been rejecting the upload since 1.0.0.

## [1.1.1] - 2026-09-06

### Fixed

- Dots no longer flash for users who have turned them off. The stylesheet applies at
  parse time but the setting arrives from an async storage read, so the off state used to
  show dots for the whole load window. The dot rule now requires `html[data-postpeek-dots]`,
  which is set only once dots are known to be on, and content scripts run at
  `document_start` so the on state lands before first paint. With dots off, nothing at all
  is written to the page - previously that setting was the one that wrote an attribute,
  making the more private choice the detectable one.

## [1.1.0] - 2026-09-06

### Changed

- Posts and media are fetched with no Referer as well as no cookies, so X cannot learn
  which page a peek came from. Video uses `preload="none"`, so `video.twimg.com` is only
  contacted after you press play.
- The content script no longer scans or mutates the page. The dot is matched purely on the
  link's `href` in CSS and the click handler inspects only the clicked link, removing the
  MutationObserver and the `data-postpeek` attributes previously written onto page links.
- The popup stylesheet is embedded as a string (`src/popup-css.js`) instead of being a
  web-accessible resource, so there is no `chrome-extension://` URL for a site to probe
  to detect the extension.
- Settings moved from `chrome.storage.sync` to `chrome.storage.local`, so they are never
  uploaded to a Google account. Existing synced settings migrate once on update and the
  synced copy is cleared.

### Removed

- The unused `abs.twimg.com` host permission and the `file://` content script matches.

### Security

- The media proxy is restricted to an exact host allowlist over https, and every href is
  validated before becoming a link, image, or video source.

## [1.0.0] - 2026-09-06

### Added

- First release: an independent Chrome MV3 take on
  [Litterbox](https://andadinosaur.com/launch-litterbox), the Safari extension by Zhenyi Tan
  (And a Dinosaur), written from scratch rather than ported - Litterbox is closed source.
  Clicking an x.com or twitter.com post link opens the post in a popup rendered in a closed
  Shadow DOM, using X's public syndication endpoint, the one behind X's own embedded posts.
  Renders text,
  photos, video, link cards, quoted posts, and reply context. Openable links get a small
  blue dot. Options page for toggling peeking, dots, and the popup theme.
- Dependency-free zip builder (`npm run build`) and icon generator (`npm run icons`),
  a release workflow that checks the tag against the manifest version and attaches the
  zip to a GitHub release, and Chrome Web Store listing copy, screenshots, and promo tiles.

[Unreleased]: https://github.com/tsvb/post-peek/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/tsvb/post-peek/releases/tag/v1.3.0
[1.2.0]: https://github.com/tsvb/post-peek/releases/tag/v1.2.0
[1.1.4]: https://github.com/tsvb/post-peek/releases/tag/v1.1.4
[1.1.3]: https://github.com/tsvb/post-peek/releases/tag/v1.1.3
[1.1.2]: https://github.com/tsvb/post-peek/releases/tag/v1.1.2
[1.1.1]: https://github.com/tsvb/post-peek/releases/tag/v1.1.1
[1.1.0]: https://github.com/tsvb/post-peek/releases/tag/v1.1.0
[1.0.0]: https://github.com/tsvb/post-peek/releases/tag/v1.0.0

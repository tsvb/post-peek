# Changelog

All notable changes to Post Peek. Versions follow [semantic versioning](https://semver.org/),
and each released version is a git tag and a Chrome Web Store upload.

## [Unreleased]

Repository documentation and artwork only. The packaged extension is unchanged.

### Added

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

[Unreleased]: https://github.com/tsvb/post-peek/compare/v1.1.4...HEAD
[1.1.4]: https://github.com/tsvb/post-peek/releases/tag/v1.1.4
[1.1.3]: https://github.com/tsvb/post-peek/releases/tag/v1.1.3
[1.1.2]: https://github.com/tsvb/post-peek/releases/tag/v1.1.2
[1.1.1]: https://github.com/tsvb/post-peek/releases/tag/v1.1.1
[1.1.0]: https://github.com/tsvb/post-peek/releases/tag/v1.1.0
[1.0.0]: https://github.com/tsvb/post-peek/releases/tag/v1.0.0

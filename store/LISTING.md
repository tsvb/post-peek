# Chrome Web Store listing

Copy each section into the matching field in the Developer Dashboard.

## Name

Post Peek

## Summary (132 characters max)

Read one post and leave. Opens X and Bluesky post links in a popup, not the full site. No account, no cookies sent to either.

## Category

Tools

## Language

English

## Detailed description

Post Peek lets you read a single X or Bluesky post without visiting x.com or bsky.app.

When someone links to a post, you usually want to see that one post, not land on the full site with its login prompts, sidebars, and endless feed. Post Peek opens the link in a small popup on the page you are already reading. Read it, close it, move on.

WHAT IT DOES

• Marks every openable x.com, twitter.com, and bsky.app post link with a small blue dot, so you know before you click.
• Opens the post in a popup: the text, photos, video, link previews, quoted posts, and reply context.
• Shows likes, replies, and the date, with a button to open the post on X or Bluesky if you want the full thread.
• Follows quoted posts and "Replying to" links inside the same popup.
• Closes with Esc or a click outside the popup, returning focus to where you were.
• Matches your system's light or dark theme, or set one in the settings.

PRIVACY

Post Peek never sends your cookies or login to X or Bluesky, and never tells either which site you were reading. Posts are fetched anonymously from the same public services that power each site's embedded posts, with no credentials and no Referer. Images are fetched by the extension itself rather than by the page, and video plays in a sandboxed frame, so no request carries the address or origin of the page you are on. Video is not fetched until you press play (GIFs, which loop on their own, load with the post). You do not need an account on either site.

Bluesky's choices are respected: posts whose authors hide them from logged-out viewers and posts Bluesky's moderators have hidden are not shown, and media labeled adult or graphic stays behind a click and is not fetched until you ask.

The extension never scans the pages you visit or touches their links. The dot marker is pure CSS, only the link you click is inspected, and only clicks you make yourself count. It exposes no web-accessible resources, and with the dot marker turned off it writes nothing to the page. A site that goes looking can still tell the extension is installed, because the dot stylesheet is present on every page.

The extension collects nothing. No analytics, no telemetry, no accounts, no servers of ours. Your only stored data is five settings (on/off, on/off for each of X and Bluesky, dot marker, theme) kept on your device in Chrome's local extension storage, never synced.

HOW TO USE

Click any dotted link. Hold Ctrl, Cmd, Shift, or Alt while clicking, or middle-click, to open the link normally in a new tab instead. Click the toolbar icon to turn peeking off, turn it off for X or Bluesky alone, hide the dots, or change the theme.

LIMITS

Posts from protected accounts, age-restricted posts, deleted posts, and Bluesky posts limited to signed-in viewers cannot be shown, so the popup shows a short message with a link to open them on X or Bluesky instead. The extension does not run on x.com, twitter.com, or bsky.app themselves.

Post Peek is open source under the MIT license:
https://github.com/tsvb/post-peek

Post Peek is an independent project inspired by Litterbox, the Safari extension for iOS and macOS by Zhenyi Tan (And a Dinosaur). Litterbox is the original, it is free, and if you use Safari you should use it instead:
https://andadinosaur.com/launch-litterbox

The popup, the marker on links that can be opened, and the cookie-free fetching are all Litterbox's ideas. Post Peek is a separate Chrome implementation of them, written from scratch. It is not affiliated with, endorsed by, or supported by Litterbox, And a Dinosaur, X Corp., or Bluesky.

## Privacy practices tab

One field per heading, in the order the Developer Dashboard shows them.

### Single purpose description

Opens links to x.com, twitter.com, and bsky.app posts in an on-page popup so users can read a single post without navigating to the site.

### storage justification

Stores the user's five preferences: whether peeking is enabled, whether it is enabled for X and for Bluesky, whether openable links are marked with a dot, and the popup theme. Nothing else is stored.

### Host permission justification

The dashboard has one box for every host permission and match pattern, so this covers all of them at once. Justifying only the syndication host leaves the broad content-script match unexplained, which is what an in-depth review asks about.

cdn.syndication.twimg.com fetches the public content of the X post the user clicked - the same endpoint that powers X's embedded posts, requested with credentials omitted so no cookies reach X. public.api.bsky.app does the same for Bluesky posts - the unauthenticated API Bluesky's own embeds use. pbs.twimg.com (X) and cdn.bsky.app, video.bsky.app, and video.cdn.bsky.app (Bluesky) serve the post's avatar, photos, link-card images, and video thumbnails; a Bluesky video thumbnail is requested from video.bsky.app, which redirects to video.cdn.bsky.app. The extension's service worker fetches every image itself, with no cookies and no Referer, and displays it inline; a request made by the page instead would tell the media host which site the user is reading, so this requires host access. Video itself needs no host permission: it plays in a sandboxed frame, and X's video host, video.twimg.com, is no longer requested. The content script runs on http and https pages because the extension must run on whatever page the user is reading to intercept clicks on post links and show the popup there. It does not scan the DOM: the dot marker is a static stylesheet matched on the link's href, and the click handler reads only the address of the link that was clicked. It does not read, store, or transmit page content, does not run in frames, and does not run on x.com, twitter.com, or bsky.app.

### Are you using remote code?

Select **No, I am not using remote code**. If the justification box is still required:

All code ships in the extension package. Post content is fetched as data (JSON) and rendered with DOM APIs; no scripts are downloaded or executed. Video plays in a sandboxed frame that contains markup only. A GIF's frame carries sandbox="allow-scripts" only because that is what lifts the sandbox's block on autoplay; the frame's document still has no script, and without allow-same-origin its origin stays opaque.

### Data usage

Leave every data type unchecked - the extension collects none of them - and tick all three certifications: no sale or transfer to third parties, no use unrelated to the single purpose, no use for creditworthiness or lending.

### Privacy policy URL

https://github.com/tsvb/post-peek/blob/main/PRIVACY.md

## Distribution tab

- Payments: Free of charge.
- Visibility: Public.
- Distribution: All regions.

## Publisher settings

These live on the account's Settings page, not the item, and both block Submit
until they are done:

- Trader declaration (EEA consumer law): non-trader, since the extension is free and not published in the course of a business.
- Contact email, verified by following the link Google mails. It is displayed publicly on the listing.

## Store assets

- Icon: `icons/icon128.png`
- Screenshots (1280x800), in this order so they read as before and after: `store/screenshot-2.png`
  (dotted links to an X post and a Bluesky post), `store/screenshot-1.png` (the X post open in the
  popup), `store/screenshot-3.png` (the Bluesky post open in the popup). Regenerate all three with
  `node store/make-showcase.js`.
- Small promo tile (440x280): `store/promo-small-440x280.png`
- Marquee promo tile (1400x560): `store/promo-marquee-1400x560.png`
- Upload package: run `npm run build`, then upload `dist/post-peek-<version>.zip`

## Support

- Homepage URL: https://timvanbenschoten.com/code/post-peek
- Support URL: https://github.com/tsvb/post-peek/issues
- Published listing: https://chromewebstore.google.com/detail/nkjjgbkfdaembjfandhlgfijhbigblnn

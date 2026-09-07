# Chrome Web Store listing

Copy each section into the matching field in the Developer Dashboard.

## Name

Post Peek

## Summary (132 characters max)

Read one X post and leave. Opens x.com and twitter.com post links in a popup. No account, no cookies sent to X.

## Category

Tools

## Language

English

## Detailed description

Post Peek lets you read a single X post without visiting x.com.

When someone links to a post, you usually want to see that one post, not land on the full site with its login prompts, sidebars, and endless feed. Post Peek opens the link in a small popup on the page you are already reading. Read it, close it, move on.

WHAT IT DOES

• Marks every openable x.com and twitter.com post link with a small blue dot, so you know before you click.
• Opens the post in a popup: the text, photos, video, link previews, quoted posts, and reply context.
• Shows likes, replies, and the date, with a button to open the post on X if you want the full thread.
• Follows quoted posts and "Replying to" links inside the same popup.
• Closes with Esc or a click outside the popup, returning focus to where you were.
• Matches your system's light or dark theme, or set one in the settings.

PRIVACY

Post Peek never sends your cookies or login to X, and never tells X which site you were reading. Posts and media are fetched anonymously from the same public service that powers X's embedded posts, with credentials and the Referer stripped from every request. Video is not fetched until you press play. You do not need an X account.

The extension never scans the pages you visit or touches their links. The dot marker is pure CSS, and only the link you click is inspected. Websites have nothing to probe for: the extension exposes no web-accessible resources, and with the dot marker turned off it writes nothing to the page at all.

The extension collects nothing. No analytics, no telemetry, no accounts, no servers of ours. Your only stored data is three settings (on/off, dot marker, theme) kept on your device in Chrome's local extension storage, never synced.

HOW TO USE

Click any dotted link. Hold Ctrl, Cmd, Shift, or Alt while clicking, or middle-click, to open the link normally in a new tab instead. Click the toolbar icon to turn peeking off, hide the dots, or change the theme.

LIMITS

Posts from protected accounts, age-restricted posts, and deleted posts cannot be embedded, so the popup shows a short message with a link to open them on X instead. The extension does not run on x.com or twitter.com themselves.

Post Peek is open source under the MIT license:
https://github.com/tsvb/post-peek

It is an independent project inspired by the Safari extension Litterbox - Post Peeker by And a Dinosaur. It is not affiliated with that project or with X Corp.

## Privacy practices tab

One field per heading, in the order the Developer Dashboard shows them.

### Single purpose description

Opens links to x.com and twitter.com posts in an on-page popup so users can read a single post without navigating to the site.

### storage justification

Stores the user's three preferences: whether peeking is enabled, whether openable links are marked with a dot, and the popup theme. Nothing else is stored.

### Host permission justification

The dashboard has one box for every host permission and match pattern, so this covers all of them at once. Justifying only the syndication host leaves the broad content-script match unexplained, which is what an in-depth review asks about.

cdn.syndication.twimg.com fetches the public content of the post the user clicked - the same endpoint that powers X's embedded posts, requested with credentials omitted so no cookies reach X. pbs.twimg.com and video.twimg.com load the post's avatar, photos, and video, anonymously and without a Referer; when a site's Content Security Policy blocks images from these hosts, the extension fetches the image itself and displays it inline, which requires host access. The content script runs on http and https pages because the extension must run on whatever page the user is reading to intercept clicks on post links and show the popup there. It does not scan the DOM: the dot marker is a static stylesheet matched on the link's href, and the click handler reads only the address of the link that was clicked. It does not read, store, or transmit page content, does not run in frames, and does not run on x.com or twitter.com.

### Are you using remote code?

Select **No, I am not using remote code**. If the justification box is still required:

All code ships in the extension package. Post content is fetched as data (JSON) and rendered with DOM APIs; no scripts are downloaded or executed.

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
- Screenshots (1280x800): `store/screenshot-1.png`, `store/screenshot-2.png`
- Small promo tile (440x280): `store/promo-small-440x280.png`
- Marquee promo tile (1400x560): `store/promo-marquee-1400x560.png`
- Upload package: run `npm run build`, then upload `dist/post-peek-<version>.zip`

## Support

- Homepage URL: https://github.com/tsvb/post-peek
- Support URL: https://github.com/tsvb/post-peek/issues

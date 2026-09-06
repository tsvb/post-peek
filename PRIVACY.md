# Post Peek Privacy Policy

Last updated: September 6, 2026

Post Peek is a browser extension that opens links to x.com and twitter.com posts in a popup so you can read a single post without visiting the full site.

## What Post Peek collects

Nothing. Post Peek does not collect, store, transmit, or sell any personal information, browsing history, or usage data. There are no analytics, no telemetry, and no accounts.

## What Post Peek does on your behalf

When you click a post link, the extension requests that post's public content from X's syndication service (`cdn.syndication.twimg.com`), the same service that powers X's embedded posts. Images and video are loaded from X's media servers (`pbs.twimg.com` and `video.twimg.com`).

These requests are made without cookies or any other credentials. X receives only the post ID being requested and the standard connection information any web request carries, such as your IP address. X's handling of that information is governed by [X's privacy policy](https://x.com/privacy).

## Where your settings live

Your preferences (whether peeking is enabled, whether links are marked with a dot, and the popup theme) are stored using Chrome's extension storage. If you are signed in to Chrome with sync enabled, Chrome may sync these settings across your devices. The extension developer never receives them.

## Permissions explained

- **storage**: saves your preferences.
- **Access to x.com and twitter.com media and syndication hosts**: fetches the post you clicked and its media.
- **Access to pages you visit**: needed to detect post links on the page, mark them with a dot, and show the popup. The extension only reads link addresses on the page. It does not read or transmit page content.

## Changes

If this policy changes, the updated version will be published in the project repository with a new date at the top.

## Contact

Questions can be filed as an issue on the project's GitHub repository.

// Derives the Firefox manifest from the Chrome one at build time, so the
// checked-in manifest.json stays exactly what the Chrome Web Store sees.
//
// Firefox differences:
// - No background service workers (Firefox bug 1573659). Firefox runs the same
//   file as a non-persistent background script (an event page) instead.
// - Manifest V3 needs a stable add-on ID for signing on addons.mozilla.org.
// - Since 3 November 2025 AMO requires a data-collection declaration. Post Peek
//   collects nothing, which is what "none" asserts (see PRIVACY.md).
// - strict_min_version 140.0: the current ESR, and the first release that
//   understands data_collection_permissions (web-ext lint warns below it).
//   It is also past Firefox 127, where MV3 host permissions became install-time
//   grants instead of an opt-in the user had to find in about:addons.
const GECKO_ID = 'post-peek@timvbs.com';
const STRICT_MIN_VERSION = '140.0';

function toFirefoxManifest(chromeManifest) {
  const m = JSON.parse(JSON.stringify(chromeManifest));
  const worker = m.background?.service_worker;
  if (!worker) throw new Error('expected background.service_worker in the Chrome manifest');
  m.background = { scripts: [worker] };
  m.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: STRICT_MIN_VERSION,
      data_collection_permissions: { required: ['none'] },
    },
  };
  return m;
}

module.exports = { toFirefoxManifest, GECKO_ID, STRICT_MIN_VERSION };

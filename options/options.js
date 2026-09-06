const defaults = { enabled: true, showDots: true, theme: 'auto' };
const $ = (id) => document.getElementById(id);

chrome.storage.local.get(defaults, (s) => {
  $('enabled').checked = s.enabled;
  $('showDots').checked = s.showDots;
  $('theme').value = s.theme;
});

$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$('showDots').addEventListener('change', (e) => chrome.storage.local.set({ showDots: e.target.checked }));
$('theme').addEventListener('change', (e) => chrome.storage.local.set({ theme: e.target.value }));

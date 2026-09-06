const defaults = { enabled: true, showDots: true, theme: 'auto' };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(defaults, (s) => {
  $('enabled').checked = s.enabled;
  $('showDots').checked = s.showDots;
  $('theme').value = s.theme;
});

$('enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }));
$('showDots').addEventListener('change', (e) => chrome.storage.sync.set({ showDots: e.target.checked }));
$('theme').addEventListener('change', (e) => chrome.storage.sync.set({ theme: e.target.value }));

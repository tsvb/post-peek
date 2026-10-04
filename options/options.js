const defaults = { enabled: true, peekX: true, peekBsky: true, showDots: true, theme: 'auto' };
const $ = (id) => document.getElementById(id);
const sites = ['peekX', 'peekBsky'];

// With peeking off altogether, the per-site switches have nothing to switch.
function syncSites() {
  for (const id of sites) {
    $(id).disabled = !$('enabled').checked;
    $(id).closest('label').classList.toggle('off', $(id).disabled);
  }
}

chrome.storage.local.get(defaults, (s) => {
  $('enabled').checked = s.enabled;
  for (const id of sites) $(id).checked = s[id];
  $('showDots').checked = s.showDots;
  $('theme').value = s.theme;
  syncSites();
});

$('enabled').addEventListener('change', (e) => { chrome.storage.local.set({ enabled: e.target.checked }); syncSites(); });
for (const id of sites) $(id).addEventListener('change', (e) => chrome.storage.local.set({ [id]: e.target.checked }));
$('showDots').addEventListener('change', (e) => chrome.storage.local.set({ showDots: e.target.checked }));
$('theme').addEventListener('change', (e) => chrome.storage.local.set({ theme: e.target.value }));

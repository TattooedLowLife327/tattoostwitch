import { functionApi } from './api.js';
import { updateScoreboardLabels } from './scoreboard.js';

let specialUsers = [];
let dubsPartnerName = '';
let dubsEnabled = false;

export async function loadSettings() {
  try {
    const res = await fetch(functionApi('/api/settings'), { cache: 'no-store' });
    const data = await res.json();
    specialUsers = data.specialUsers || [];
    document.getElementById('promo-minutes').value = data.promoMinutes || 15;
    document.getElementById('player1-name').value = data.player1Name || 'TATTOO';
    document.getElementById('player2-name').value = data.player2Name || 'OPEN';
    document.getElementById('pwa-background-url').value = data.pwaBackgroundUrl || 'images/background.png';
    document.getElementById('obs-background-url').value = data.obsBackgroundUrl || '';
    document.getElementById('dubs-partner').value = data.dubsPartner || '';
    dubsPartnerName = data.dubsPartner || '';
    const rawDubsEnabled = data.dubsEnabled;
    dubsEnabled = rawDubsEnabled === true || rawDubsEnabled === 'true';
    applyDubsUIState();
    renderSpecialUsers();
    updateScoreboardLabels();
    updatePWABackground();

    // Load mode display visibility (default to true if not set)
    const modeDisplayVisible = data.modeDisplayVisible !== 'false';
    updateModeVisibilityUI(modeDisplayVisible);
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function renderSpecialUsers() {
  const list = document.getElementById('special-users-list');
  if (specialUsers.length === 0) {
    list.innerHTML = '<div style="color: var(--muted); font-size: 14px; padding: 10px; text-align: center;">No special users added</div>';
    return;
  }
  list.innerHTML = specialUsers.map(user => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; margin-bottom: 8px;">
      <span style="color: var(--text); font-size: 14px;">${user}</span>
      <button onclick="window.settingsModule.removeSpecialUser('${user}')" style="background: #ff6b6b; border: none; color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
    </div>
  `).join('');
}

export function addSpecialUser() {
  const input = document.getElementById('new-special-user');
  const username = input.value.trim();
  if (!username) {
    alert('Please enter a username');
    return;
  }
  if (specialUsers.includes(username.toLowerCase())) {
    alert('User already in list');
    return;
  }
  specialUsers.push(username.toLowerCase());
  input.value = '';
  renderSpecialUsers();
}

export function removeSpecialUser(username) {
  specialUsers = specialUsers.filter(u => u !== username);
  renderSpecialUsers();
}

export async function saveSettings() {
  try {
    const promoMinutes = parseInt(document.getElementById('promo-minutes').value);
    const player1Name = document.getElementById('player1-name').value.trim() || 'TATTOO';
    const player2Name = document.getElementById('player2-name').value.trim() || 'OPEN';
    const pwaBackgroundUrl = document.getElementById('pwa-background-url').value.trim() || 'images/background.png';
    const obsBackgroundUrl = document.getElementById('obs-background-url').value.trim() || '';
    const dubsPartner = document.getElementById('dubs-partner').value.trim();
    const res = await fetch(functionApi('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialUsers,
        promoMinutes,
        player1Name,
        player2Name,
        pwaBackgroundUrl,
        obsBackgroundUrl,
        dubsPartner,
        dubsEnabled
      })
    });
    if (res.ok) {
      updateScoreboardLabels();
      updatePWABackground();
      dubsPartnerName = dubsPartner;
      alert('Settings saved!');
    } else {
      alert('Failed to save settings');
    }
  } catch (e) {
    alert('Failed to save settings');
  }
}

function updatePWABackground() {
  const bgUrl = document.getElementById('pwa-background-url').value.trim() || 'images/background.png';
  document.body.style.background = `url('${bgUrl}') center center / cover no-repeat fixed`;
}

function applyDubsUIState() {
  const toggle = document.getElementById('dubs-toggle');
  const partnerContainer = document.getElementById('dubs-partner-container');
  if (toggle) toggle.checked = dubsEnabled;
  if (partnerContainer) {
    partnerContainer.style.display = dubsEnabled ? 'block' : 'none';
  }
}

export function handleDubsToggle(checked) {
  const partnerValue = document.getElementById('dubs-partner').value.trim();
  if (checked && !partnerValue) {
    alert('Enter your partner name before enabling Dubs mode.');
    dubsEnabled = false;
    applyDubsUIState();
    return;
  }

  dubsEnabled = checked;
  applyDubsUIState();

  if (!checked) {
    persistDubsSettings(partnerValue, { silent: true });
  }
}

export async function saveDubsSettings() {
  const partnerValue = document.getElementById('dubs-partner').value.trim();
  await persistDubsSettings(partnerValue, { silent: false });
}

async function persistDubsSettings(partnerValue, { silent = false } = {}) {
  if (dubsEnabled && !partnerValue) {
    if (!silent) {
      alert('Enter your partner name before enabling Dubs mode.');
    }
    dubsEnabled = false;
    applyDubsUIState();
    return;
  }

  try {
    const res = await fetch(functionApi('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dubsEnabled,
        dubsPartner: partnerValue
      })
    });

    if (!res.ok) throw new Error('Failed to save');

    dubsPartnerName = partnerValue;
    applyDubsUIState();
    await loadSettings();
    if (!silent) {
      alert('Dubs settings saved!');
    }
  } catch (err) {
    if (!silent) {
      alert('Failed to save dubs settings');
    } else {
      console.error('[Dubs Settings] Failed to save:', err);
    }
  }
}

function updateModeVisibilityUI(isVisible) {
  const btn = document.getElementById('mode-visibility-btn');
  const status = document.getElementById('mode-visibility-status');

  if (isVisible) {
    btn.textContent = '👁️';
    status.textContent = 'Visible in OBS';
    status.style.color = '#4caf50';
  } else {
    btn.textContent = '👁️‍🗨️';
    status.textContent = 'Hidden in OBS';
    status.style.color = '#ff6b6b';
  }
}

export function getDubsEnabled() {
  return dubsEnabled;
}

export function getDubsPartnerName() {
  return dubsPartnerName;
}

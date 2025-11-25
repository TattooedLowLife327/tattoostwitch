import { functionApi, botApi } from './api.js';
import { updateScoreboardLabels } from './scoreboard.js';

let specialUsers = [];
let defaultMessages = [];
let dubsPartnerName = '';
let dubsEnabled = false;

export async function loadSettings() {
  try {
    const res = await fetch(functionApi('/api/settings'), { cache: 'no-store' });
    const data = await res.json();

    // Load special users from bot API
    try {
      const specialUsersRes = await fetch(botApi('/special-users'), { cache: 'no-store' });
      const specialUsersData = await specialUsersRes.json();
      specialUsers = specialUsersData.users || [];
      defaultMessages = specialUsersData.defaultMessages || [];
      renderSpecialUsers();
      renderDefaultMessages();
    } catch (e) {
      console.error('Failed to load special users:', e);
      specialUsers = [];
      defaultMessages = [];
    }

    document.getElementById('promo-minutes').value = data.promoMinutes || 15;
    document.getElementById('player1-name').value = data.player1Name || 'TATTOO';
    document.getElementById('player2-name').value = data.player2Name || 'OPEN';
    document.getElementById('dubs-partner').value = data.dubsPartner || '';
    dubsPartnerName = data.dubsPartner || '';
    const rawDubsEnabled = data.dubsEnabled;
    dubsEnabled = rawDubsEnabled === true || rawDubsEnabled === 'true';
    applyDubsUIState();
    updateScoreboardLabels();

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
  list.innerHTML = specialUsers.map(user => {
    // Handle both old format (string) and new format (object)
    const username = typeof user === 'string' ? user : user.username;
    const message = typeof user === 'string' ? null : user.message;

    const messageText = message
      ? `<div style="font-size: 12px; color: var(--muted); margin-top: 4px;">"${message}"</div>`
      : '<div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Uses random default</div>';

    return `
      <div style="padding: 8px 12px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: var(--text); font-size: 14px; font-weight: 500;">${username}</span>
          <button onclick="window.settingsModule.removeSpecialUser('${username}')" style="background: #ff6b6b; border: none; color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
        ${messageText}
      </div>
    `;
  }).join('');
}

function renderDefaultMessages() {
  const list = document.getElementById('default-messages-list');
  if (!list) return;

  if (defaultMessages.length === 0) {
    list.innerHTML = '<div style="color: var(--muted); font-size: 12px;">No default messages available</div>';
    return;
  }

  list.innerHTML = defaultMessages.map(msg => `
    <div style="color: var(--muted); font-size: 12px; padding: 4px 0;">"${msg}"</div>
  `).join('');
}

export async function addSpecialUser() {
  const input = document.getElementById('new-special-user');
  const messageInput = document.getElementById('new-special-user-message');
  const username = input.value.trim();
  const message = messageInput.value.trim();

  if (!username) {
    alert('Please enter a username');
    return;
  }

  // Handle both old format (string) and new format (object)
  const userExists = specialUsers.some(u => {
    const existingUsername = typeof u === 'string' ? u : u.username;
    return existingUsername === username.toLowerCase();
  });

  if (userExists) {
    alert('User already in list');
    return;
  }

  try {
    const res = await fetch(botApi('/special-users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.toLowerCase(),
        action: 'add',
        message: message || null
      })
    });

    if (res.ok) {
      const data = await res.json();
      specialUsers = data.users || [];
      input.value = '';
      messageInput.value = '';
      renderSpecialUsers();
      alert('Special user added!');
    } else {
      alert('Failed to add special user');
    }
  } catch (e) {
    console.error('Failed to add special user:', e);
    alert('Failed to add special user');
  }
}

export async function removeSpecialUser(username) {
  try {
    const res = await fetch(botApi('/special-users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        action: 'remove'
      })
    });

    if (res.ok) {
      const data = await res.json();
      specialUsers = data.users || [];
      renderSpecialUsers();
      alert('Special user removed!');
    } else {
      alert('Failed to remove special user');
    }
  } catch (e) {
    console.error('Failed to remove special user:', e);
    alert('Failed to remove special user');
  }
}

export async function saveSettings() {
  try {
    const promoMinutes = parseInt(document.getElementById('promo-minutes').value);
    const player1Name = document.getElementById('player1-name').value.trim() || 'TATTOO';
    const player2Name = document.getElementById('player2-name').value.trim() || 'OPEN';
    const dubsPartner = document.getElementById('dubs-partner').value.trim();
    const res = await fetch(functionApi('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoMinutes,
        player1Name,
        player2Name,
        dubsPartner,
        dubsEnabled
      })
    });
    if (res.ok) {
      updateScoreboardLabels();
      dubsPartnerName = dubsPartner;
      alert('Settings saved!');
    } else {
      alert('Failed to save settings');
    }
  } catch (e) {
    alert('Failed to save settings');
  }
}

function applyDubsUIState() {
  const toggle = document.getElementById('dubs-toggle');
  const partnerContainer = document.getElementById('dubs-partner-container');
  if (toggle) toggle.checked = dubsEnabled;
  // Always show partner input so user can enter name before enabling
  if (partnerContainer) {
    partnerContainer.style.display = 'block';
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

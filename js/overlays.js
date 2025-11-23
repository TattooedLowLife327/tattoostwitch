import { functionApi, botApi } from './api.js';
import { getDubsEnabled, getDubsPartnerName } from './settings.js';

export async function setMode(mode) {
  try {
    const res = await fetch(functionApi('/api/mode'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    await res.json();
    updateModeDisplay();
  } catch (e) {
    alert('Failed to set mode');
  }
}

export async function updateModeDisplay() {
  const shouldShowDubs = getDubsEnabled() === true || getDubsEnabled() === 'true';
  const partner = (getDubsPartnerName() || '').trim();
  try {
    const res = await fetch(functionApi('/api/mode'));
    const data = await res.json();
    const modeText = document.getElementById('mode-text');
    const modeNames = {
      'tourney': 'TOURNEY PLAY',
      'lobby': 'OPEN LOBBY',
      'cash': 'CASH SETS',
      'league': 'LEAGUE PLAY'
    };
    const apiMode = data.mode || 'tourney';
    const safeMode = (!shouldShowDubs && apiMode === 'dubs') ? 'tourney' : apiMode;

    const shouldCycleDubs = shouldShowDubs && partner;
    const baseModeText = modeNames[safeMode] || 'TOURNEY PLAY';

    if (shouldCycleDubs) {
      if (typeof window.__dubsToggle === 'undefined') {
        window.__dubsToggle = false;
      }
      window.__dubsToggle = !window.__dubsToggle;
      const showPartner = window.__dubsToggle;
      modeText.textContent = showPartner
        ? `DUBS: ${partner.toUpperCase()}`
        : baseModeText;
    } else if (shouldShowDubs) {
      modeText.textContent = 'DUBS MODE';
    } else {
      modeText.textContent = baseModeText;
    }
  } catch (e) {
    console.error('Failed to update mode display:', e);
  }
}

export async function toggleModeDisplayVisibility() {
  try {
    const settingsRes = await fetch(functionApi('/api/settings'));
    const currentSettings = await settingsRes.json();

    const currentlyVisible = currentSettings.modeDisplayVisible !== 'false';
    const newVisibility = !currentlyVisible;

    const res = await fetch(functionApi('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'modeDisplayVisible',
        value: newVisibility.toString()
      })
    });

    if (res.ok) {
      updateModeVisibilityUI(newVisibility);
      alert(`Mode Display ${newVisibility ? 'shown' : 'hidden'} in OBS`);
    } else {
      alert('Failed to toggle visibility');
    }
  } catch (e) {
    console.error('Failed to toggle mode display visibility:', e);
    alert('Failed to toggle visibility');
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

export async function checkModeVisibilityUpdate() {
  try {
    const response = await fetch(functionApi('/api/settings'), { cache: 'no-store' });
    const settings = await response.json();
    const modeDisplayVisible = settings.modeDisplayVisible !== 'false';
    updateModeVisibilityUI(modeDisplayVisible);
  } catch (e) {
    console.error('Failed to check mode visibility update:', e);
  }
}

export async function activateBRB(minutes) {
  try {
    await fetch(botApi('/api/screen-overlay'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'brb',
        isActive: true,
        durationMinutes: minutes
      })
    });
    alert(`BRB screen activated for ${minutes} minutes`);
  } catch (e) {
    alert('Failed to activate BRB screen');
  }
}

export async function activateTechDifficulties() {
  try {
    await fetch(botApi('/api/screen-overlay'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'tech_difficulties',
        isActive: true
      })
    });
    alert('Tech Difficulties screen activated');
  } catch (e) {
    alert('Failed to activate Tech Difficulties screen');
  }
}

export async function deactivateScreen() {
  try {
    await fetch(botApi('/api/screen-overlay'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: false
      })
    });
    alert('Screen overlay dismissed');
  } catch (e) {
    alert('Failed to dismiss screen');
  }
}

export async function triggerPromo(index = 0) {
  try {
    await fetch(botApi('/api/trigger-promo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });
    alert('Promo triggered');
  } catch (e) {
    console.error('Failed to trigger promo:', e);
    alert('Failed to trigger promo');
  }
}

// Check BRB status and update blur overlay
export async function checkBRBStatus() {
  try {
    const res = await fetch(botApi('/api/screen-overlay'), { cache: 'no-store' });
    const data = await res.json();
    const overlay = document.getElementById('brb-blur-overlay');

    if (overlay) {
      if (data.isActive && data.type === 'brb') {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  } catch (e) {
    console.error('Failed to check BRB status:', e);
  }
}

import { functionApi, botApi } from './api.js';

let scores = { player1: 0, player2: 0 };

// Get current admin name from the bot
async function getAdminName() {
  try {
    const res = await fetch(botApi('/api/admin/current'));
    const data = await res.json();
    return data.name || 'Admin';
  } catch {
    return 'Admin';
  }
}

// Announce score update in chat
async function announceScoreUpdate(player1, player2) {
  try {
    const adminName = await getAdminName();
    await fetch(botApi('/api/announce-score'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, player1, player2 })
    });
  } catch (e) {
    console.error('Failed to announce score:', e);
  }
}
let scoreboardSyncInterval = null;
let scoreboardSyncPromise = null;

export function setScoreDisplays(newPlayer1, newPlayer2) {
  scores.player1 = newPlayer1;
  scores.player2 = newPlayer2;
  document.getElementById('score1').textContent = newPlayer1;
  document.getElementById('score2').textContent = newPlayer2;
}

function normalizeScoreboardPayload(payload) {
  if (!payload) return null;
  // GET response shape: { player1: { score }, player2: { score } }
  if (payload.player1 || payload.player2) {
    return {
      player1: Number(payload.player1?.score ?? 0) || 0,
      player2: Number(payload.player2?.score ?? 0) || 0
    };
  }
  // POST response shape: DB row with snake_case columns
  if (
    Object.prototype.hasOwnProperty.call(payload, 'player1_score') ||
    Object.prototype.hasOwnProperty.call(payload, 'player2_score')
  ) {
    return {
      player1: Number(payload.player1_score ?? 0) || 0,
      player2: Number(payload.player2_score ?? 0) || 0
    };
  }
  return null;
}

export async function syncScoreboardFromServer(force = false) {
  if (!force && scoreboardSyncPromise) {
    return scoreboardSyncPromise;
  }

  scoreboardSyncPromise = (async () => {
    try {
      const res = await fetch(functionApi('/api/scoreboard'), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = normalizeScoreboardPayload(data);
      if (!normalized) return;
      const { player1, player2 } = normalized;
      if (player1 !== scores.player1 || player2 !== scores.player2) {
        setScoreDisplays(player1, player2);
      }
    } catch (e) {
      console.error('Failed to sync scoreboard:', e);
    } finally {
      scoreboardSyncPromise = null;
    }
  })();

  return scoreboardSyncPromise;
}

export async function updateScore(player, delta) {
  try {
    await syncScoreboardFromServer(true);
    const updatedScores = {
      player1: scores.player1,
      player2: scores.player2
    };
    updatedScores[player] = Math.max(0, updatedScores[player] + delta);
    setScoreDisplays(updatedScores.player1, updatedScores.player2);

    const res = await fetch(functionApi('/api/scoreboard'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedScores)
    });
    const responseData = await res.json().catch(() => null);

    if (res.ok) {
      const normalized = normalizeScoreboardPayload(responseData?.scoreboard || responseData);
      if (normalized) {
        setScoreDisplays(normalized.player1, normalized.player2);
        // Announce score update in chat
        announceScoreUpdate(normalized.player1, normalized.player2);
      } else {
        await syncScoreboardFromServer(true);
        announceScoreUpdate(scores.player1, scores.player2);
      }
    } else {
      console.error('Failed to update scoreboard:', responseData?.error || res.statusText);
      await syncScoreboardFromServer(true);
    }
  } catch (e) {
    console.error('Failed to update scoreboard:', e);
    await syncScoreboardFromServer(true);
  }
}

export async function resetScores() {
  const resetPayload = { player1: 0, player2: 0 };
  setScoreDisplays(0, 0);

  try {
    const res = await fetch(functionApi('/api/scoreboard'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resetPayload)
    });
    const responseData = await res.json().catch(() => null);
    if (res.ok) {
      const normalized = normalizeScoreboardPayload(responseData?.scoreboard || responseData);
      if (normalized) {
        setScoreDisplays(normalized.player1, normalized.player2);
      }
      // Announce score reset in chat
      announceScoreUpdate(0, 0);
    } else {
      console.error('Failed to reset scoreboard:', responseData?.error || res.statusText);
    }
  } catch (e) {
    console.error('Failed to reset scoreboard:', e);
  } finally {
    await syncScoreboardFromServer(true);
  }
}

export function updateScoreboardLabels() {
  const player1Name = document.getElementById('player1-name').value.trim() || 'TATTOO';
  const player2Name = document.getElementById('player2-name').value.trim() || 'OPEN';
  document.querySelector('.score-section:nth-child(1) label').textContent = `Player 1 (${player1Name})`;
  document.querySelector('.score-section:nth-child(2) label').textContent = `Player 2 (${player2Name})`;
}

export function toggleScoreboardEdit() {
  const editSection = document.getElementById('scoreboard-edit-section');
  editSection.classList.toggle('hidden');
}

export async function saveScoreboardNames() {
  try {
    const player1Name = document.getElementById('player1-name').value.trim() || 'TATTOO';
    const player2Name = document.getElementById('player2-name').value.trim() || 'OPEN';
    const partner = document.getElementById('dubs-partner').value.trim();

    // Get current settings first
    const settingsRes = await fetch(functionApi('/api/settings'));
    const currentSettings = await settingsRes.json();

    const res = await fetch(functionApi('/api/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialUsers: currentSettings.specialUsers || [],
        promoMinutes: currentSettings.promoMinutes || 15,
        player1Name,
        player2Name,
        pwaBackgroundUrl: currentSettings.pwaBackgroundUrl || 'images/background.png',
        obsBackgroundUrl: currentSettings.obsBackgroundUrl || '',
        dubsPartner: partner || currentSettings.dubsPartner || ''
      })
    });

    if (res.ok) {
      updateScoreboardLabels();
      alert('Player names saved!');
      toggleScoreboardEdit();
    } else {
      alert('Failed to save names');
    }
  } catch (e) {
    alert('Failed to save names');
  }
}

export function startScoreboardSync() {
  syncScoreboardFromServer();
  if (scoreboardSyncInterval) clearInterval(scoreboardSyncInterval);
  scoreboardSyncInterval = setInterval(syncScoreboardFromServer, 2000);
}

export function stopScoreboardSync() {
  if (scoreboardSyncInterval) {
    clearInterval(scoreboardSyncInterval);
    scoreboardSyncInterval = null;
  }
}

import { botApi, functionApi } from './api.js';

export async function updateFollowerCount() {
  try {
    const res = await fetch(botApi('/followers'));
    const data = await res.json();
    const count = data.total || 0;
    document.getElementById('follower-count').textContent = count;
  } catch (e) {
    console.error('Failed to update follower count:', e);
  }
}

export async function updateSubscriberCount() {
  try {
    const res = await fetch(botApi('/api/subscribers'));
    const data = await res.json();
    const count = data.total || 0;
    document.getElementById('subscriber-count').textContent = count;
  } catch (e) {
    console.error('Failed to update subscriber count:', e);
    document.getElementById('subscriber-count').textContent = '---';
  }
}

export async function checkConnection() {
  const connectionDot = document.querySelector('.connection-dot');
  const restartBtn = document.getElementById('restart-bot-btn');

  try {
    const response = await fetch(functionApi('/api/queue'));
    if (connectionDot) {
      connectionDot.className = 'connection-dot connected';
    }
    if (restartBtn) {
      restartBtn.classList.add('hidden');
    }
  } catch (e) {
    console.error('Connection failed:', e.message);
    if (connectionDot) {
      connectionDot.className = 'connection-dot disconnected';
    }
    if (restartBtn) {
      restartBtn.classList.remove('hidden');
    }
  }
}

export async function restartBot() {
  if (!confirm('Are you sure you want to restart the bot? This will disconnect all services temporarily.')) {
    return;
  }

  try {
    const res = await fetch(botApi('/api/restart-bot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      alert('Bot restart initiated. Please wait 10-15 seconds for the bot to come back online.');
    } else {
      alert('Failed to restart bot. Please restart manually.');
    }
  } catch (e) {
    console.error('Failed to restart bot:', e);
    alert('Failed to restart bot. Please restart manually.');
  }
}

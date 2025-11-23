import { functionApi } from './api.js';

let isPlaying = false;

export async function updatePendingQueue() {
  try {
    const res = await fetch(functionApi('/api/queue'));
    const data = await res.json();

    // Update now playing
    const now = data.now;
    if (now && now.title) {
      console.log('[NOW PLAYING]', now);
      document.getElementById('track-title').textContent = now.title;
      document.getElementById('track-artist').textContent = now.artist || '-';

      // Update album art
      const albumArtDiv = document.getElementById('album-art');
      if (now.albumArt) {
        console.log('[ALBUM ART]', now.albumArt);
        albumArtDiv.innerHTML = `<img src="${now.albumArt}" alt="Album Art" />`;
      } else {
        console.log('[ALBUM ART] Missing from API response');
        albumArtDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="white" style="width: 64px; height: 64px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>';
      }

      // Control music notes animation
      const musicNotes = document.getElementById('music-notes');
      if (now.isPlaying) {
        musicNotes.classList.remove('paused');
      } else {
        musicNotes.classList.add('paused');
      }

      // Show requester if song was requested, otherwise show playlist name
      let playlistText = '';
      if (now.requester) {
        playlistText = `SR: ${now.requester}`;
      } else if (now.playlistName) {
        playlistText = now.playlistName;
      }
      document.getElementById('track-playlist').textContent = playlistText;
      document.getElementById('play-pause-btn').textContent = now.isPlaying ? '⏸' : '▶';
      isPlaying = now.isPlaying !== false;
    } else {
      document.getElementById('track-title').textContent = 'No track playing';
      document.getElementById('track-artist').textContent = '-';
      document.getElementById('track-playlist').textContent = '';
      document.getElementById('play-pause-btn').textContent = '▶';
      isPlaying = false;
    }

    const pendingEl = document.getElementById('pending-queue');
    const pending = data.pending || [];

    if (pending.length === 0) {
      pendingEl.innerHTML = '<p style="color: var(--muted); text-align: center;">No pending requests</p>';
      return;
    }

    pendingEl.innerHTML = pending.map(song => `
      <div class="queue-item">
        <div class="title">${song.title}</div>
        <div class="info">${song.artist} - requested by ${song.requester}</div>
        <div class="btn-group">
          <button class="btn-small" onclick="window.musicModule.approveSong('${song.spotifyId}')">Approve</button>
          <button class="btn-small deny" onclick="window.musicModule.denySong('${song.spotifyId}')">Deny</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to fetch queue:', e);
  }
}

export async function togglePlayPause() {
  try {
    await fetch(functionApi('/api/play-pause'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isPlaying ? 'pause' : 'play' })
    });
    isPlaying = !isPlaying;
    document.getElementById('play-pause-btn').textContent = isPlaying ? '⏸' : '▶';
  } catch (e) {
    console.error('Failed to toggle play/pause:', e);
  }
}

export async function approveSong(spotifyId) {
  try {
    await fetch(functionApi('/api/approve-song'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyId })
    });
    updatePendingQueue();
  } catch (e) {
    alert('Failed to approve song');
  }
}

export async function denySong(spotifyId) {
  try {
    await fetch(functionApi('/api/deny-song'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyId })
    });
    updatePendingQueue();
  } catch (e) {
    alert('Failed to deny song');
  }
}

export async function skipSong() {
  try {
    await fetch(functionApi('/api/skip-song'), { method: 'POST' });
    alert('Song skipped');
  } catch (e) {
    alert('Failed to skip song');
  }
}

export async function resetBot() {
  if (!confirm('Are you sure you want to clear all pending and approved song queues? This cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(functionApi('/api/reset-queue'), { method: 'POST' });
    const data = await res.json();
    alert(`Bot reset! Cleared ${data.cleared.pending} pending and ${data.cleared.approved} approved songs.`);
    updatePendingQueue();
  } catch (e) {
    alert('Failed to reset bot');
  }
}

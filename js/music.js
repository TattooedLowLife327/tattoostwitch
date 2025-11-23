import { functionApi } from './api.js';

let isPlaying = false;

// Progress animation state (matching overlay implementation)
let currentProgress = 0;
let targetProgress = 0;
let currentDuration = 0;
let lastUpdateTime = Date.now();

const PLAY_SVG = `<svg width="50" height="50" viewBox="0 0 127 127" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_ii_play)">
<path d="M127 63.5C127 98.5701 98.5701 127 63.5 127C28.4299 127 0 98.5701 0 63.5C0 28.4299 28.4299 0 63.5 0C98.5701 0 127 28.4299 127 63.5ZM11.5884 63.5C11.5884 92.17 34.83 115.412 63.5 115.412C92.17 115.412 115.412 92.17 115.412 63.5C115.412 34.83 92.17 11.5884 63.5 11.5884C34.83 11.5884 11.5884 34.83 11.5884 63.5Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter1_ii_play)">
<path d="M46.5141 40.1403C46.5141 37.0031 49.9611 35.087 52.6256 36.743L90.0338 59.9927C92.5519 61.5577 92.5519 65.2223 90.0338 66.7873L52.6256 90.037C49.9611 91.6931 46.5142 89.777 46.5142 86.6397L46.5142 63.39L46.5141 40.1403Z" fill="#8b5cf6"/>
</g>
</svg>`;

const PAUSE_SVG = `<svg width="50" height="50" viewBox="0 0 127 127" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_ii_pause)">
<path d="M127 63.5C127 98.5701 98.5701 127 63.5 127C28.4299 127 0 98.5701 0 63.5C0 28.4299 28.4299 0 63.5 0C98.5701 0 127 28.4299 127 63.5ZM11.5884 63.5C11.5884 92.17 34.83 115.412 63.5 115.412C92.17 115.412 115.412 92.17 115.412 63.5C115.412 34.83 92.17 11.5884 63.5 11.5884C34.83 11.5884 11.5884 34.83 11.5884 63.5Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter1_ii_pause)">
<path d="M70.9994 40.5927C70.9895 38.9289 72.3355 37.5749 73.9993 37.5749L79.7844 37.5749C81.9935 37.5749 83.7844 39.3657 83.7844 41.5749L83.7844 84.5749C83.7844 86.784 81.9935 88.5749 79.7844 88.5749L74.2666 88.5749C72.6167 88.5749 71.2765 87.2426 71.2667 85.5927L70.9994 40.5927Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter2_ii_pause)">
<path d="M41.9994 40.5927C41.9895 38.9289 43.3355 37.5749 44.9993 37.5749L50.7844 37.5749C52.9935 37.5749 54.7844 39.3657 54.7844 41.5749L54.7844 84.5749C54.7844 86.784 52.9935 88.5749 50.7844 88.5749L45.2666 88.5749C43.6167 88.5749 42.2765 87.2426 42.2667 85.5927L41.9994 40.5927Z" fill="#8b5cf6"/>
</g>
</svg>`;

const SKIP_SVG = `<svg width="50" height="50" viewBox="0 0 127 127" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_ii_skip)">
<path d="M127 63.5C127 98.5701 98.5701 127 63.5 127C28.4299 127 0 98.5701 0 63.5C0 28.4299 28.4299 0 63.5 0C98.5701 0 127 28.4299 127 63.5ZM11.5884 63.5C11.5884 92.17 34.83 115.412 63.5 115.412C92.17 115.412 115.412 92.17 115.412 63.5C115.412 34.83 92.17 11.5884 63.5 11.5884C34.83 11.5884 11.5884 34.83 11.5884 63.5Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter1_ii_skip)">
<path d="M29.7723 39.919C29.7587 37.1405 33.2035 35.8381 35.0315 37.9306L54.2372 59.9148C55.5383 61.4041 55.5557 63.6208 54.2782 65.1304L35.2861 87.573C33.4855 89.7007 30.0097 88.4371 29.996 85.6498L29.7723 39.919Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter2_ii_skip)">
<path d="M56.7723 39.919C56.7587 37.1405 60.2035 35.8381 62.0315 37.9306L81.2372 59.9148C82.5383 61.4041 82.5557 63.6208 81.2782 65.1304L62.2861 87.573C60.4855 89.7007 57.0097 88.4371 56.996 85.6498L56.7723 39.919Z" fill="#8b5cf6"/>
</g>
<g filter="url(#filter3_ii_skip)">
<path d="M84.9994 40.5927C84.9895 38.9289 86.3355 37.5749 87.9993 37.5749L93.7844 37.5749C95.9935 37.5749 97.7844 39.3657 97.7844 41.5749L97.7844 84.5749C97.7844 86.784 95.9935 88.5749 93.7844 88.5749L88.2666 88.5749C86.6167 88.5749 85.2765 87.2426 85.2667 85.5927L84.9994 40.5927Z" fill="#8b5cf6"/>
</g>
</svg>`;

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
      const playPauseBtn = document.getElementById('play-pause-btn');
      playPauseBtn.innerHTML = now.isPlaying ? PAUSE_SVG : PLAY_SVG;
      isPlaying = now.isPlaying !== false;

      // Update progress state (matching overlay implementation)
      if (now.progress !== undefined && now.duration !== undefined && now.duration > 0) {
        const percentage = (now.progress / now.duration) * 100;
        targetProgress = percentage;
        currentProgress = percentage;
        currentDuration = now.duration;
        lastUpdateTime = Date.now();
      } else {
        targetProgress = 0;
        currentProgress = 0;
        currentDuration = 0;
      }
    } else {
      document.getElementById('track-title').textContent = 'No track playing';
      document.getElementById('track-artist').textContent = '-';
      document.getElementById('track-playlist').textContent = '';
      document.getElementById('play-pause-btn').innerHTML = PLAY_SVG;
      isPlaying = false;
      targetProgress = 0;
      currentProgress = 0;
      currentDuration = 0;

      // Stop music notes when no track playing
      const musicNotes = document.getElementById('music-notes');
      if (musicNotes) {
        musicNotes.classList.add('paused');
      }
    }

    const pendingEl = document.getElementById('pending-queue');
    const pending = data.pending || [];

    if (pending.length === 0) {
      pendingEl.innerHTML = '<p style="color: var(--muted); text-align: center;">No pending requests</p>';
      return;
    }

    pendingEl.innerHTML = pending.map(song => {
      let playlistText = '';
      if (song.requester) {
        playlistText = `SR: ${song.requester}`;
      } else if (song.playlistName) {
        playlistText = song.playlistName;
      }

      return `
        <div class="queue-item">
          <div class="title">${song.title}</div>
          <div class="info">${song.artist}${playlistText ? ' - ' + playlistText : ''}</div>
          <div class="btn-group">
            <button class="btn-small" onclick="window.musicModule.approveSong('${song.spotifyId}')">Approve</button>
            <button class="btn-small deny" onclick="window.musicModule.denySong('${song.spotifyId}')">Deny</button>
          </div>
        </div>
      `;
    }).join('');
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
    const playPauseBtn = document.getElementById('play-pause-btn');
    playPauseBtn.innerHTML = isPlaying ? PAUSE_SVG : PLAY_SVG;
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

// Smooth progress animation (matching overlay implementation)
function animateProgress() {
  const player = document.querySelector('.spotify-player');
  if (!player) {
    requestAnimationFrame(animateProgress);
    return;
  }

  if (isPlaying && currentDuration > 0) {
    // Calculate time elapsed since last update
    const now = Date.now();
    const elapsed = now - lastUpdateTime;
    lastUpdateTime = now;

    // Increment progress based on elapsed time
    const progressIncrement = (elapsed / currentDuration) * 100;
    currentProgress = Math.min(currentProgress + progressIncrement, 100);
  } else {
    // Smoothly interpolate to target when not playing
    currentProgress += (targetProgress - currentProgress) * 0.1;
  }

  player.style.setProperty('--progress', currentProgress);
  requestAnimationFrame(animateProgress);
}

// Start smooth animation loop
animateProgress();

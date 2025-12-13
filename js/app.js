// Main application initialization
import * as auth from './auth.js';
import * as music from './music.js';
import * as scoreboard from './scoreboard.js';
import * as settings from './settings.js';
import * as overlays from './overlays.js';
import * as stats from './stats.js';
import * as obs from './obs.js';
import { showAdminScreen, showLoginScreen, toggleMenu } from './ui.js';
import * as navigation from './navigation.js';

// Expose modules to window for onclick handlers
window.authModule = auth;
window.musicModule = music;
window.scoreboardModule = scoreboard;
window.settingsModule = settings;
window.overlaysModule = overlays;
window.statsModule = stats;
window.obsModule = obs;
window.navigation = navigation;

// Expose individual functions needed by HTML onclick handlers
window.login = auth.login;
window.logout = auth.logout;
window.confirmLogout = auth.confirmLogout;
window.hideLogoutModal = auth.hideLogoutModal;
window.confirmLogoutAction = auth.confirmLogoutAction;
window.showPinPad = auth.showPinPad;
window.hidePinPad = auth.hidePinPad;
window.handlePadBackgroundClick = auth.handlePadBackgroundClick;
window.appendPinDigit = auth.appendPinDigit;
window.backspacePinDigit = auth.backspacePinDigit;
window.clearPin = auth.clearPin;
window.submitPinPad = auth.submitPinPad;
window.bootAdmin = auth.bootAdmin;
window.checkoutAdmin = auth.checkoutAdmin;
window.addAdmin = auth.addAdmin;
window.removeAdmin = auth.removeAdmin;
window.checkIn = auth.checkIn;
window.checkOut = auth.checkOut;
window.requestPinChange = auth.requestPinChange;

window.togglePlayPause = music.togglePlayPause;
window.skipSong = music.skipSong;
window.resetBot = music.resetBot;

window.updateScore = scoreboard.updateScore;
window.resetScores = scoreboard.resetScores;
window.toggleScoreboardEdit = scoreboard.toggleScoreboardEdit;
window.saveScoreboardNames = scoreboard.saveScoreboardNames;

window.addSpecialUser = settings.addSpecialUser;
window.saveSettings = settings.saveSettings;
window.handleDubsToggle = settings.handleDubsToggle;
window.saveDubsSettings = settings.saveDubsSettings;

window.setMode = overlays.setMode;
window.toggleModeDisplayVisibility = overlays.toggleModeDisplayVisibility;
window.activateBRB = overlays.activateBRB;
window.activateTechDifficulties = overlays.activateTechDifficulties;
window.deactivateScreen = overlays.deactivateScreen;
window.triggerPromo = overlays.triggerPromo;
window.endStream = overlays.endStream;

window.connectToOBS = obs.connectToOBS;
window.saveOBSSettings = obs.saveOBSSettings;
window.getStoredOBSSettings = obs.getStoredOBSSettings;
window.isOBSConnected = obs.isOBSConnected;

window.saveOBSSettingsFromUI = function() {
  const ip = document.getElementById('obs-ip').value.trim();
  const port = document.getElementById('obs-port').value.trim();
  const password = document.getElementById('obs-password').value;
  obs.saveOBSSettings(ip || '192.168.1.134', port || '4455', password);
  const statusEl = document.getElementById('obs-status');
  statusEl.textContent = 'Settings saved';
  statusEl.style.color = '#10b981';
};

window.testOBSConnection = async function() {
  const statusEl = document.getElementById('obs-status');
  statusEl.textContent = 'Connecting...';
  statusEl.style.color = 'var(--muted)';

  // Save settings first
  window.saveOBSSettingsFromUI();

  try {
    await obs.connectToOBS();
    statusEl.textContent = 'Connected successfully!';
    statusEl.style.color = '#10b981';
  } catch (e) {
    statusEl.textContent = 'Connection failed: ' + e.message;
    statusEl.style.color = '#ef4444';
  }
};

window.loadOBSSettings = function() {
  const settings = obs.getStoredOBSSettings();
  document.getElementById('obs-ip').value = settings.ip || '';
  document.getElementById('obs-port').value = settings.port || '';
  document.getElementById('obs-password').value = settings.password || '';
};

window.restartBot = stats.restartBot;

window.toggleMenu = toggleMenu;

// Initialize navigation bar
function initializeNavigation() {
  // Remove existing navigation if present
  const existingNav = document.querySelector('.nav');
  if (existingNav) {
    existingNav.remove();
  }

  // Create and append new navigation
  const nav = navigation.createNavBar();
  document.body.appendChild(nav);

  // Show/hide floating settings button based on role
  const floatingSettingsBtn = document.getElementById('floating-settings-btn');
  if (floatingSettingsBtn) {
    if (auth.isOwner) {
      floatingSettingsBtn.classList.remove('hidden');
    } else {
      floatingSettingsBtn.classList.add('hidden');
    }
  }
}

function startUpdates() {
  music.updatePendingQueue();
  stats.checkConnection();
  overlays.updateModeDisplay();
  settings.loadSettings();
  overlays.checkModeVisibilityUpdate();
  stats.updateFollowerCount();
  // stats.updateSubscriberCount();
  scoreboard.syncScoreboardFromServer();
  auth.checkAdminStatus();
  window.loadOBSSettings();

  // Update check-in status for non-owner admins
  if (!auth.isOwner) {
    auth.updateMyCheckinStatus();
  }

  scoreboard.startScoreboardSync();

  setInterval(music.updatePendingQueue, 15000);
  setInterval(stats.checkConnection, 10000);
  setInterval(overlays.updateModeDisplay, 5000);
  setInterval(overlays.checkModeVisibilityUpdate, 5000);
  setInterval(stats.updateFollowerCount, 30000);
  // setInterval(stats.updateSubscriberCount, 30000);
  setInterval(auth.checkAdminStatus, 5000);

  // Poll check-in status for non-owner admins
  if (!auth.isOwner) {
    setInterval(auth.updateMyCheckinStatus, 5000);
  }
}

// Handle auth events
window.addEventListener('auth:login', () => {
  showAdminScreen();
  if (auth.isOwner) {
    document.getElementById('admin-management').classList.remove('hidden');
    auth.loadAdminList();
    document.getElementById('admin-checkin-section').classList.add('hidden');
  } else {
    document.getElementById('admin-checkin-section').classList.remove('hidden');
  }
  initializeNavigation();
  startUpdates();
});

window.addEventListener('auth:logout', () => {
  showLoginScreen();
  scoreboard.stopScoreboardSync();

  // Remove navigation on logout
  const existingNav = document.querySelector('.nav');
  if (existingNav) {
    existingNav.remove();
  }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated
  if (localStorage.getItem('authenticated') === 'true') {
    const pin = localStorage.getItem('userPin') || '';
    const role = localStorage.getItem('adminRole') || '';
    auth.setUserPin(pin);
    auth.setAdminRole(role);
    showAdminScreen();
    if (auth.isOwner) {
      document.getElementById('admin-management').classList.remove('hidden');
      auth.loadAdminList();
      document.getElementById('admin-checkin-section').classList.add('hidden');
    } else {
      document.getElementById('admin-checkin-section').classList.remove('hidden');
    }
    initializeNavigation();
    startUpdates();
  } else {
    showLoginScreen();
  }

  // Add Enter key listener for PIN input
  document.getElementById('pin-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      auth.login();
    }
  });

  // Show PIN pad when focusing the field
  const pinInputEl = document.getElementById('pin-input');
  pinInputEl.addEventListener('focus', auth.showPinPad);
  pinInputEl.addEventListener('click', auth.showPinPad);

  // DISABLE service worker for development - it's causing cache issues
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    });
  }
});

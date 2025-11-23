import { botApi } from './api.js';

export let userPin = '';
export let isOwner = false;
export let adminRole = '';

export function setUserPin(pin) {
  userPin = pin;
}

export function setAdminRole(role) {
  adminRole = role;
  isOwner = role === 'owner';
}

// PIN Pad functions
function hapticFeedback(duration = 10) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

export function showPinPad() {
  const overlay = document.getElementById('pin-pad-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    updatePinPadDisplay();
  }
}

export function hidePinPad() {
  const overlay = document.getElementById('pin-pad-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function handlePadBackgroundClick(event) {
  if (event.target.id === 'pin-pad-overlay') {
    hidePinPad();
  }
}

export function updatePinPadDisplay() {
  const input = document.getElementById('pin-input');
  const display = document.getElementById('pin-pad-display');
  if (!input || !display) return;
  const length = input.value.length;
  display.textContent = length > 0 ? '•'.repeat(length) : '••••';
}

export function appendPinDigit(digit) {
  hapticFeedback(10);
  const input = document.getElementById('pin-input');
  if (!input) return;
  input.value = (input.value || '') + digit;
  updatePinPadDisplay();
}

export function backspacePinDigit() {
  hapticFeedback(10);
  const input = document.getElementById('pin-input');
  if (!input || !input.value) return;
  input.value = input.value.slice(0, -1);
  updatePinPadDisplay();
}

export function clearPin() {
  hapticFeedback(15);
  const input = document.getElementById('pin-input');
  if (!input) return;
  input.value = '';
  updatePinPadDisplay();
}

export function submitPinPad() {
  hapticFeedback(20);
  hidePinPad();
  login();
}

// Admin functions
export async function login() {
  const pin = document.getElementById('pin-input').value;
  const errorEl = document.getElementById('login-error');

  try {
    const checkinRes = await fetch(botApi('/api/admin/checkin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, name: '' })
    });

    if (checkinRes.status === 409) {
      const data = await checkinRes.json();
      errorEl.textContent = `${data.currentAdmin.name} is currently active. Please wait.`;
      errorEl.classList.remove('hidden');
      return;
    }

    if (!checkinRes.ok) {
      errorEl.textContent = 'Incorrect PIN';
      errorEl.classList.remove('hidden');
      return;
    }

    const data = await checkinRes.json();
    setUserPin(pin);
    setAdminRole(data.admin?.role || '');
    localStorage.setItem('authenticated', 'true');
    localStorage.setItem('userPin', pin);
    localStorage.setItem('adminRole', adminRole);

    // Dispatch event so app.js can handle showing admin screen
    window.dispatchEvent(new CustomEvent('auth:login'));
  } catch (e) {
    console.error('Login error:', e);
    errorEl.textContent = 'Login failed. Please try again.';
    errorEl.classList.remove('hidden');
  }
}

export function confirmLogout() {
  const modal = document.getElementById('logout-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

export function hideLogoutModal() {
  const modal = document.getElementById('logout-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function confirmLogoutAction() {
  hideLogoutModal();
  logout();
}

export async function logout() {
  try {
    await fetch(botApi('/api/admin/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: userPin })
    });
  } catch (e) {
    console.error('Checkout error:', e);
  }

  localStorage.removeItem('authenticated');
  localStorage.removeItem('userPin');
  localStorage.removeItem('adminRole');

  // Dispatch event so app.js can handle hiding admin screen
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

export async function checkAdminStatus() {
  try {
    const res = await fetch(botApi('/api/admin/current'));
    const data = await res.json();

    const activeAdminSection = document.getElementById('active-admin-section');
    const nameEl = document.getElementById('current-admin-name');
    const sinceEl = document.getElementById('admin-since');

    // Only show the section if current user is owner AND a non-owner admin is checked in
    if (isOwner && data.active !== false && data.name && data.role !== 'owner') {
      nameEl.textContent = data.name;
      if (data.checkedInAt) {
        const since = new Date(data.checkedInAt);
        sinceEl.textContent = `Checked in at ${since.toLocaleTimeString()}`;
      }
      activeAdminSection.classList.remove('hidden');
    } else {
      // Hide the section if current user is not owner, no admin is checked in, or if the owner is the only one active
      activeAdminSection.classList.add('hidden');
    }
  } catch (e) {
    console.error('Failed to check admin status:', e);
  }
}

export async function bootAdmin() {
  if (!confirm('Boot the current admin?')) return;

  try {
    const res = await fetch(botApi('/api/admin/boot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: userPin })
    });

    if (res.ok) {
      alert('Admin booted successfully');
      checkAdminStatus();
    } else {
      alert('Failed to boot admin');
    }
  } catch (e) {
    alert('Failed to boot admin');
  }
}

export async function checkoutAdmin() {
  try {
    await fetch(botApi('/api/admin/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: userPin })
    });
    checkAdminStatus();
  } catch (e) {
    console.error('Checkout error:', e);
  }
}

export async function loadAdminList() {
  try {
    const res = await fetch(botApi(`/api/admin/list?pin=${userPin}`));
    const data = await res.json();

    const listEl = document.getElementById('admin-list');
    listEl.innerHTML = data.admins.map(admin => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px;">
        <div>
          <div style="font-weight: 600;">${admin.name}</div>
          <div style="color: var(--muted); font-size: 14px;">${admin.role === 'owner' ? '(Owner)' : ''}</div>
        </div>
        ${admin.pin !== userPin ? `<button class="btn-small" style="background: #ff6b6b;" onclick="removeAdmin('${admin.pin}')">Remove</button>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load admin list:', e);
  }
}

export async function addAdmin() {
  const name = document.getElementById('new-admin-name').value.trim();
  const pin = document.getElementById('new-admin-pin').value.trim();

  if (!name || !pin) {
    alert('Please enter both name and PIN');
    return;
  }

  if (pin.length < 4) {
    alert('PIN must be at least 4 digits');
    return;
  }

  try {
    const res = await fetch(botApi('/api/admin/add'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerPin: userPin, pin, name })
    });

    if (res.ok) {
      alert('Admin added successfully');
      document.getElementById('new-admin-name').value = '';
      document.getElementById('new-admin-pin').value = '';
      loadAdminList();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add admin');
    }
  } catch (e) {
    alert('Failed to add admin');
  }
}

export async function removeAdmin(pin) {
  if (!confirm('Remove this admin?')) return;

  try {
    const res = await fetch(botApi('/api/admin/remove'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerPin: userPin, pin })
    });

    if (res.ok) {
      alert('Admin removed successfully');
      loadAdminList();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to remove admin');
    }
  } catch (e) {
    alert('Failed to remove admin');
  }
}

// Admin check-in/check-out for non-owners
export async function checkIn() {
  try {
    console.log('[CHECK-IN] Attempting check-in with PIN:', userPin ? 'SET' : 'NOT SET');
    const res = await fetch(botApi('/api/admin/checkin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: userPin, name: '' })
    });

    console.log('[CHECK-IN] Response status:', res.status);

    if (res.status === 409) {
      const data = await res.json();
      console.log('[CHECK-IN] 409 Conflict:', data);
      alert(`${data.currentAdmin.name} is currently checked in. Please wait.`);
      return;
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[CHECK-IN] Failed with status', res.status, ':', errorData);
      alert(`Failed to check in: ${errorData.error || 'Unknown error'}`);
      return;
    }

    const data = await res.json();
    console.log('[CHECK-IN] Success:', data);
    updateMyCheckinStatus();
  } catch (e) {
    console.error('[CHECK-IN] Exception:', e);
    alert('Failed to check in');
  }
}

export async function checkOut() {
  try {
    const res = await fetch(botApi('/api/admin/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: userPin })
    });

    if (!res.ok) {
      alert('Failed to check out');
      return;
    }

    updateMyCheckinStatus();
  } catch (e) {
    console.error('Check-out error:', e);
    alert('Failed to check out');
  }
}

export async function updateMyCheckinStatus() {
  try {
    const res = await fetch(botApi('/api/admin/current'));
    const data = await res.json();

    const statusEl = document.getElementById('my-checkin-status');
    const timeEl = document.getElementById('my-checkin-time');
    const checkinBtnContainer = document.getElementById('checkin-btn-container');
    const checkoutBtnContainer = document.getElementById('checkout-btn-container');

    // Check if the current user is checked in
    const isCheckedIn = data.active !== false && data.pin === userPin;

    if (isCheckedIn) {
      statusEl.textContent = 'Checked In';
      if (data.checkedInAt) {
        const since = new Date(data.checkedInAt);
        timeEl.textContent = `Checked in at ${since.toLocaleTimeString()}`;
      }
      checkinBtnContainer.classList.add('hidden');
      checkoutBtnContainer.classList.remove('hidden');
    } else {
      statusEl.textContent = 'Not Checked In';
      timeEl.textContent = '';
      checkinBtnContainer.classList.remove('hidden');
      checkoutBtnContainer.classList.add('hidden');
    }
  } catch (e) {
    console.error('Failed to update check-in status:', e);
  }
}

export function requestPinChange() {
  alert('To request a PIN change, please contact the owner or a lead admin. Your current PIN cannot be changed from this interface for security reasons.');
}

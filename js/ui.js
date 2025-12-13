// UI helper functions
export function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active class from all buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Highlight selected button
  const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('active');
  }

  // Save current tab to localStorage
  localStorage.setItem('currentTab', tabName);
}

export function initializeTabs() {
  // Add click handlers to all tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Restore last active tab or default to dashboard
  const lastTab = localStorage.getItem('currentTab') || 'dashboard';
  switchTab(lastTab);
}

export function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-screen').classList.add('hidden');
}

export function showAdminScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-screen').classList.remove('hidden');
}

export function toggleMenu() {
  const dropdown = document.getElementById('menu-dropdown');
  dropdown.classList.toggle('hidden');
}

// Close menu when clicking outside
document.addEventListener('click', (event) => {
  const menuContainer = document.querySelector('.hamburger-menu-container');
  const dropdown = document.getElementById('menu-dropdown');

  if (menuContainer && dropdown && !menuContainer.contains(event.target)) {
    dropdown.classList.add('hidden');
  }
});

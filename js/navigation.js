// navigation.js - Animated neon nav bar component

export function createNavBar() {
  const nav = document.createElement('nav');
  nav.className = 'nav';

  const ul = document.createElement('ul');
  ul.className = 'nav__links';

  // Create the animated light bar
  const light = document.createElement('span');
  light.className = 'nav__light';
  ul.appendChild(light);

  // Define navigation items
  const navItems = [
    { icon: 'images/dashboardicon.svg', alt: 'Dashboard', dataTab: 'dashboard', active: true },
    { icon: 'images/musicnote.svg', alt: 'Music', dataTab: 'music' },
    { icon: 'images/obsicon.svg', alt: 'Overlays', dataTab: 'overlays' },
    { icon: 'images/helpicon.svg', alt: 'Help', dataTab: 'help' },
    { icon: 'images/powerbutton.svg', alt: 'Logout', isLogout: true }
  ];

  // Create nav items
  navItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav__item';

    const link = document.createElement('a');
    link.className = item.active ? 'nav__link active' : 'nav__link';
    if (item.isLogout) {
      link.classList.add('logout');
      link.onclick = () => window.confirmLogout();
      link.title = 'Logout';
    } else {
      link.dataset.tab = item.dataTab;
    }
    if (item.id) {
      link.id = item.id;
    }

    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.alt;
    img.style.height = '32px';

    link.appendChild(img);
    li.appendChild(link);
    ul.appendChild(li);
  });

  nav.appendChild(ul);

  // Initialize navigation behavior after a short delay
  setTimeout(() => initNavBehavior(nav), 60);

  return nav;
}

function initNavBehavior(navElement) {
  const navLinks = navElement.querySelectorAll('.nav__link');
  const navLight = navElement.querySelector('.nav__light');
  const navList = navElement.querySelector('.nav__links');

  function moveLight(activeLink) {
    const rectList = navList.getBoundingClientRect();
    const rectIcon = activeLink.querySelector('img').getBoundingClientRect();
    const itemWidth = activeLink.closest('.nav__item').offsetWidth;

    const width = itemWidth * 0.7;
    const center = (rectIcon.left - rectList.left) + rectIcon.width / 2;
    const left = center - width / 2;

    navLight.style.width = `${width}px`;
    navLight.style.left = `${left}px`;

    // LIGHT COLOR = PURPLE BY DEFAULT
    navLight.style.backgroundColor = 'var(--active-icon-color)';
    navLight.style.boxShadow = `0 0 6px var(--active-icon-color), 0 0 12px var(--active-icon-color)`;

    // BUT logout tab → RED
    if (activeLink.classList.contains('logout')) {
      navLight.style.backgroundColor = 'var(--logout-color)';
      navLight.style.boxShadow = `0 0 6px var(--logout-color), 0 0 12px var(--logout-color)`;
    }
  }

  function activateLink(link) {
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    moveLight(link);

    // Handle tab switching for non-logout links
    if (!link.classList.contains('logout')) {
      const tabName = link.dataset.tab;
      if (tabName) {
        // Switch tabs
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
          targetTab.classList.add('active');
        }
      }
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('mousedown', () => activateLink(link));
  });

  // Initialize the light position
  const active = navElement.querySelector('.nav__link.active') || navLinks[0];
  activateLink(active);

  // Handle window resize
  window.addEventListener('resize', () => {
    const active = navElement.querySelector('.nav__link.active');
    if (active) {
      moveLight(active);
    }
  });
}

// Export function to update active tab programmatically
export function setActiveTab(tabName) {
  const link = document.querySelector(`.nav__link[data-tab="${tabName}"]`);
  if (link) {
    link.click();
  }
}

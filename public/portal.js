(() => {
  'use strict';

  // DOM Elements
  const nicknameInput = document.getElementById('portalNickname');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const rememberCheckbox = document.getElementById('portalRemember');
  const avatarCube = document.getElementById('avatarCube');
  const avatarNameTag = document.getElementById('avatarNameTag');
  const btnLaunchArena = document.getElementById('btnLaunchArena');
  const btnLaunchPlox = document.getElementById('btnLaunchPlox');

  // Available Presets
  const COLOR_PALETTE = ['#38bdf8', '#4ade80', '#a855f7', '#f43f5e', '#f59e0b', '#ec4899'];

  // Initial State from LocalStorage
  let selectedColor = localStorage.getItem('arcade_pilot_color') || '#38bdf8';
  let pilotName = localStorage.getItem('arcade_pilot_name') || '';
  const isRemembered = localStorage.getItem('arcade_pilot_remember') !== 'false';

  // Generate random handle if none saved
  if (!pilotName) {
    const randomGuestId = Math.floor(100 + Math.random() * 900);
    pilotName = `Pilot_${randomGuestId}`;
  }

  // Populate UI
  nicknameInput.value = pilotName;
  if (rememberCheckbox) rememberCheckbox.checked = isRemembered;

  // Set active swatch
  colorSwatches.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === selectedColor);
    btn.addEventListener('click', () => {
      colorSwatches.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.dataset.color;
      updateAvatarPreview();
      saveProfile();
    });
  });

  // Update Avatar Preview
  function updateAvatarPreview() {
    const clean = nicknameInput.value.trim() || 'Pilot';
    avatarNameTag.textContent = clean;
    avatarCube.style.backgroundColor = selectedColor;
    avatarCube.style.boxShadow = `0 0 24px ${selectedColor}99`;
  }

  // Save Profile to Shared LocalStorage
  function saveProfile() {
    const clean = nicknameInput.value.trim() || 'Pilot';
    const remember = rememberCheckbox ? rememberCheckbox.checked : true;

    localStorage.setItem('arcade_pilot_remember', remember ? 'true' : 'false');
    if (remember) {
      localStorage.setItem('arcade_pilot_name', clean);
      localStorage.setItem('arcade_pilot_color', selectedColor);
      // Also update legacy game keys so existing scripts read them seamlessly
      localStorage.setItem('blockArena_name', clean);
      localStorage.setItem('blockArena_color', selectedColor);
    } else {
      localStorage.removeItem('arcade_pilot_name');
      localStorage.removeItem('arcade_pilot_color');
    }
  }

  // Listen to Typing
  nicknameInput.addEventListener('input', () => {
    updateAvatarPreview();
    saveProfile();
  });

  if (rememberCheckbox) {
    rememberCheckbox.addEventListener('change', saveProfile);
  }

  // Launch Handlers
  function launchGame(targetUrl) {
    const clean = nicknameInput.value.trim() || 'Pilot';
    saveProfile();
    // Redirect with clean pilot profile
    window.location.href = `${targetUrl}?name=${encodeURIComponent(clean)}&color=${encodeURIComponent(selectedColor)}&auto=1`;
  }

  if (btnLaunchArena) {
    btnLaunchArena.addEventListener('click', (e) => {
      e.preventDefault();
      launchGame('/arena.html');
    });
  }

  if (btnLaunchPlox) {
    btnLaunchPlox.addEventListener('click', (e) => {
      e.preventDefault();
      launchGame('/plox.html');
    });
  }

  // Initialize visual preview
  updateAvatarPreview();
})();

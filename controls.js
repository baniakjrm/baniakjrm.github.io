// Attack of The Kruptins - Controls and Input Handling

// ---------------- Control selection ----------------
let selectedControlScheme = null;
let gameInitialized = false;

function selectControls(scheme) {
  selectedControlScheme = scheme;
  
  // Hide the selection screen
  const selectionScreen = document.getElementById('control-selection');
  selectionScreen.classList.add('hidden');
  
  // Set up controls based on selection
  if (scheme === 'mobile') {
    setupMobileControls();
  } else {
    setupDesktopControls();
  }
  
  // Initialize the game
  if (!gameInitialized) {
    init();
    gameInitialized = true;
  }
}

function setupMobileControls() {
  // Force mobile mode regardless of device detection
  window.FORCE_MOBILE = true;
  
  // Add mobile controls class to body for CSS targeting
  document.body.classList.add('mobile-controls');
  
  // Set up mobile touch controls
  setupMobileTouchControls();
  createTouchUI();
  createMobileUpgradeButton(); // Always create upgrade button for mobile
}

function setupDesktopControls() {
  // Force desktop mode
  window.FORCE_MOBILE = false;
  
  // Desktop controls are now shown in the control selection screen
  // No help text needed here since we moved it to the selection UI
}

// ---------------- Input ----------------
const keys = new Set();
let pointerLocked = false;
let mouseLookDelta = 0;

// Mouse smoothing variables
let mouseLookBuffer = [];
const MOUSE_BUFFER_SIZE = 3;
const MAX_MOUSE_DELTA = 50; // Clamp extreme movements

// Debug god mode
let debugGodMode = false;

// --- Mouse pointer lock for desktop look ---
function requestPointerLock() {
  if (!window.FORCE_MOBILE) { // Use control selection instead of MOBILE detection
    // Use the standard requestPointerLock or browser-specific versions
    const element = canvas;
    const requestMethod = element.requestPointerLock || 
                         element.mozRequestPointerLock || 
                         element.webkitRequestPointerLock;
    
    if (requestMethod) {
      requestMethod.call(element);
    }
  }
}

// Request pointer lock on multiple user interactions
function setupCanvasEventListeners() {
  canvas.addEventListener('click', (e) => {
    requestPointerLock();
  });
  canvas.addEventListener('mousedown', (e) => {
    requestPointerLock();
  });
}

// Support multiple pointer lock event names for browser compatibility
function onPointerLockChange() {
  const locked = document.pointerLockElement === canvas ||
                 document.mozPointerLockElement === canvas ||
                 document.webkitPointerLockElement === canvas;
  pointerLocked = locked;
}

function setupPointerLockEvents() {
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mozpointerlockchange', onPointerLockChange);
  document.addEventListener('webkitpointerlockchange', onPointerLockChange);
}

// Mouse move for look (when pointer locked)
function setupMouseLookEvents() {
  document.addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      let movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      
      // Clamp extreme movements to prevent wonky behavior
      movementX = Math.max(-MAX_MOUSE_DELTA, Math.min(MAX_MOUSE_DELTA, movementX));
      
      // Add to smoothing buffer
      mouseLookBuffer.push(movementX);
      if (mouseLookBuffer.length > MOUSE_BUFFER_SIZE) {
        mouseLookBuffer.shift();
      }
      
      // Calculate smoothed movement (simple average)
      const smoothedMovement = mouseLookBuffer.reduce((sum, val) => sum + val, 0) / mouseLookBuffer.length;
      
      mouseLookDelta += smoothedMovement;
    }
  });
}

function setupKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyR') start_new_run();
    if (e.code === 'KeyU' && typeof toggleUpgradeMenu === 'function') toggleUpgradeMenu();
    //if (e.code === 'KeyG') toggleGodMode();
    // Prevent default behavior for WASD keys
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
}

// --- Touch control state ---
const touchFlags = { fwd:false, back:false, left:false, right:false };

// --- Multi-touch tracking for mobile controls ---
let activeTouches = {}; // id -> { type: 'joystick'|'look', ... }
const TAP_THRESHOLD = 200;
const DRAG_THRESHOLD = 10;

function setupMobileTouchControls() {
  // Helper to get joystick DOM element
  function getJoystickElem() {
    return document.getElementById('joystick');
  }

  // --- Touchstart: assign each touch to joystick or look/shoot ---
  document.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;
      const joystick = getJoystickElem();
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const screenMidX = window.innerWidth / 2;

      if (joystick && target && joystick.contains(target)) {
        // Joystick touch
        activeTouches[id] = {
          type: 'joystick',
          lastX: touch.clientX,
          lastY: touch.clientY
        };
        // Joystick logic will be handled in joystick event listeners
      } else if (touch.clientX > screenMidX) {
        // Right side: look/shoot
        activeTouches[id] = {
          type: 'look',
          startX: touch.clientX,
          lastX: touch.clientX,
          totalDrag: 0,
          startTime: performance.now()
        };
      }
    }
  }, { passive: false });

  // --- Touchmove: handle look/aim for right-side touches ---
  document.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;
      const t = activeTouches[id];
      if (!t) continue;
      if (t.type === 'look') {
        const dx = touch.clientX - t.lastX;
        t.totalDrag += Math.abs(dx);
        t.lastX = touch.clientX;
        // Simulate mouse look delta
        mouseLookDelta += dx * 1.5;
        e.preventDefault();
      }
      // Joystick handled in joystick's own listeners
    }
  }, { passive: false });

  // --- Touchend: handle tap-to-shoot for right-side touches ---
  document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;
      const t = activeTouches[id];
      if (!t) continue;
      if (t.type === 'look') {
        const duration = performance.now() - t.startTime;
        if (duration < TAP_THRESHOLD && t.totalDrag < DRAG_THRESHOLD) {
          spawnShot();
        }
      }
      delete activeTouches[id];
    }
  }, { passive: false });

  document.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const id = e.changedTouches[i].identifier;
      delete activeTouches[id];
    }
  }, { passive: false });
}

// --- Digital Joystick ---
function createTouchUI() {
  if (!window.FORCE_MOBILE && !MOBILE) return;
  
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.classList.add('force-mobile'); // Ensure it shows up

  // --- Digital Joystick ---
  const joystick = document.createElement('div');
  joystick.id = 'joystick';
  joystick.style.position = 'fixed';
  joystick.style.left = '3vw';
  joystick.style.bottom = '4vh';
  joystick.style.width = '28vw';
  joystick.style.height = '28vw';
  joystick.style.maxWidth = '220px';
  joystick.style.maxHeight = '220px';
  joystick.style.touchAction = 'none';
  joystick.style.pointerEvents = 'auto';
  joystick.style.display = 'flex';
  joystick.style.alignItems = 'center';
  joystick.style.justifyContent = 'center';

  // Outer circle
  const outer = document.createElement('div');
  outer.style.position = 'absolute';
  outer.style.left = '0';
  outer.style.top = '0';
  outer.style.width = '100%';
  outer.style.height = '100%';
  outer.style.background = 'rgba(128,128,128,0.20)';
  outer.style.borderRadius = '50%';
  outer.style.pointerEvents = 'none';

  // Inner (thumb) circle
  const inner = document.createElement('div');
  inner.style.position = 'absolute';
  inner.style.width = '38%';
  inner.style.height = '38%';
  inner.style.left = '31%';
  inner.style.top = '31%';
  inner.style.background = 'rgba(128,128,128,0.50)';
  inner.style.borderRadius = '50%';
  inner.style.pointerEvents = 'auto';
  inner.style.touchAction = 'none';
  inner.style.transition = 'left 0.08s, top 0.08s';

  joystick.appendChild(outer);
  joystick.appendChild(inner);
  ui.appendChild(joystick);

  // --- Joystick logic ---
  let joyActive = false, joyStart = null, joyCenter = null, joyRadius = null;
  let joyVec = { x: 0, y: 0 }; // 2D movement vector
  let joyTouchId = null;

  function getJoyCenterAndRadius() {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    return { cx, cy, r, rect };
  }

  function resetJoystick() {
    inner.style.left = '31%';
    inner.style.top = '31%';
    touchFlags.fwd = false;
    touchFlags.back = false;
    touchFlags.left = false;
    touchFlags.right = false;
    joyVec.x = 0; joyVec.y = 0;
    joyActive = false;
    joyTouchId = null;
  }

  function updateJoystick(touch) {
    if (!joyCenter) return;
    const dx = touch.clientX - joyCenter.cx;
    const dy = touch.clientY - joyCenter.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = joyRadius * 0.78;
    let ndx = dx, ndy = dy;
    let mag = dist / joyRadius;
    if (dist > maxDist) {
      ndx = dx * maxDist / dist;
      ndy = dy * maxDist / dist;
      mag = maxDist / joyRadius;
    }
    // Move thumb
    const left = 50 + (ndx / joyRadius) * 50 - 19;
    const top = 50 + (ndy / joyRadius) * 50 - 19;
    inner.style.left = `${left}%`;
    inner.style.top = `${top}%`;
    // 2D movement vector, normalized to [-1,1]
    joyVec.x = ndx / joyRadius;
    joyVec.y = ndy / joyRadius;
    // Set flags for legacy code (not used for movement now)
    touchFlags.fwd = joyVec.y < -0.22;
    touchFlags.back = joyVec.y > 0.22;
    touchFlags.left = joyVec.x < -0.22;
    touchFlags.right = joyVec.x > 0.22;
  }

  // Joystick event listeners (multi-touch aware)
  inner.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joyActive) return;
    const touch = e.changedTouches[0];
    joyActive = true;
    joyTouchId = touch.identifier;
    joyCenter = getJoyCenterAndRadius();
    joyRadius = joyCenter.r;
    updateJoystick(touch);
  }, { passive: false });

  joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // Find the first changed touch not already assigned
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (!joyActive) {
        joyActive = true;
        joyTouchId = touch.identifier;
        joyCenter = getJoyCenterAndRadius();
        joyRadius = joyCenter.r;
        updateJoystick(touch);
        break;
      }
    }
  }, { passive: false });

  joystick.addEventListener('touchmove', (e) => {
    if (!joyActive) return;
    // Find the touch with the joystick's id
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === joyTouchId) {
        e.preventDefault();
        updateJoystick(touch);
        break;
      }
    }
  }, { passive: false });

  joystick.addEventListener('touchend', (e) => {
    // If the joystick's touch ended, reset
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joyTouchId) {
        e.preventDefault();
        resetJoystick();
        break;
      }
    }
  }, { passive: false });

  joystick.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joyTouchId) {
        e.preventDefault();
        resetJoystick();
        break;
      }
    }
  }, { passive: false });
  resetJoystick();

  document.body.appendChild(ui);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Expose joyVec globally for movement
  window._mobileJoyVec = joyVec;
}

// Create mobile upgrade button (separate from touch UI)
function createMobileUpgradeButton() {
  // --- Mobile Upgrade Button ---
  const upgradeBtn = document.createElement('div');
  upgradeBtn.id = 'mobile-upgrade-btn';
  upgradeBtn.style.position = 'fixed';
  upgradeBtn.style.left = '12px'; // Move to top left corner
  upgradeBtn.style.top = '12px';
  upgradeBtn.style.width = '50px';
  upgradeBtn.style.height = '50px';
  upgradeBtn.style.background = 'rgba(255, 215, 0, 0.85)'; // Match UI styling
  upgradeBtn.style.border = '2px solid rgba(255, 255, 255, 0.8)';
  upgradeBtn.style.borderRadius = '50%';
  upgradeBtn.style.display = 'flex';
  upgradeBtn.style.alignItems = 'center';
  upgradeBtn.style.justifyContent = 'center';
  upgradeBtn.style.fontSize = '20px';
  upgradeBtn.style.fontWeight = '700';
  upgradeBtn.style.color = '#000';
  upgradeBtn.style.cursor = 'pointer';
  upgradeBtn.style.touchAction = 'manipulation';
  upgradeBtn.style.userSelect = 'none';
  upgradeBtn.style.pointerEvents = 'auto';
  upgradeBtn.style.zIndex = '1000';
  upgradeBtn.style.transition = 'all 0.2s ease';
  upgradeBtn.textContent = '↑';
  
  upgradeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    upgradeBtn.style.background = 'rgba(255, 215, 0, 1.0)';
    upgradeBtn.style.transform = 'scale(1.1)';
  });
  
  upgradeBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    upgradeBtn.style.background = 'rgba(255, 215, 0, 0.85)';
    upgradeBtn.style.transform = 'scale(1.0)';
    if (typeof toggleUpgradeMenu === 'function') {
      toggleUpgradeMenu();
    }
  });
  
  upgradeBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    upgradeBtn.style.background = 'rgba(255, 215, 0, 0.85)';
    upgradeBtn.style.transform = 'scale(1.0)';
  });
  
  upgradeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof toggleUpgradeMenu === 'function') {
      toggleUpgradeMenu();
    }
  });
  
  document.body.appendChild(upgradeBtn);
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupMouseShootEvents() {
  window.addEventListener('mousedown', (e) => { 
    if (e.button === 0) spawnShot(); 
  });
}

function toggleGodMode() {
  debugGodMode = !debugGodMode;
  const debugElement = document.getElementById('debug');
  if (debugGodMode) {
    debugElement.style.display = 'block';
  } else {
    debugElement.style.display = 'none';
  }
}

// Initialize all control events
function initializeControls() {
  setupCanvasEventListeners();
  setupPointerLockEvents();
  setupMouseLookEvents();
  setupKeyboardEvents();
  setupMouseShootEvents();
}

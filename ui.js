// Attack of The Kruptins - UI and HUD Elements

const killsBox = document.getElementById('kills');
const roomsBox = document.getElementById('rooms');
const creditsBox = document.getElementById('credits');
const livesBox = document.getElementById('lives');

const updateKillsUI = () => killsBox.textContent = String(kills);
const updateRoomsUI = () => roomsBox.textContent = String(roomsCleared);
const updateCreditsUI = () => creditsBox.textContent = String(credits);
const updateLivesUI = () => {
  if (typeof playerLives !== 'undefined') {
    livesBox.textContent = String(playerLives);
  }
};

// Damage vignette and invincibility system
let invincibilityTime = 0;
let vignetteFade = 0;
const INVINCIBILITY_DURATION = 2.0; // 2 seconds
const VIGNETTE_FADE_SPEED = 4.0; // How fast the vignette fades

function takeDamage() {
  if (invincibilityTime > 0) return; // Already invincible
  
  if (typeof loseLife === 'function') {
    const actualGameOver = loseLife();
    if (actualGameOver) {
      // No lives left, trigger game over
      if (typeof triggerGameOver === 'function') {
        triggerGameOver();
      }
    } else {
      // Still have lives, grant invincibility and show vignette
      invincibilityTime = INVINCIBILITY_DURATION;
      vignetteFade = 1.0; // Full red vignette
      if (typeof updateLivesUI === 'function') updateLivesUI();
    }
  }
}

function updateInvincibilitySystem(dt) {
  if (invincibilityTime > 0) {
    invincibilityTime -= dt;
    if (invincibilityTime < 0) invincibilityTime = 0;
  }
  
  if (vignetteFade > 0) {
    vignetteFade -= VIGNETTE_FADE_SPEED * dt;
    if (vignetteFade < 0) vignetteFade = 0;
  }
}

function drawDamageVignette() {
  if (vignetteFade <= 0) return;
  
  const alpha = Math.min(0.9, vignetteFade); // Increased from 0.8 to 0.9 for more visibility
  ctx.save();
  
  // Create radial gradient for vignette effect
  const centerX = W / 2;
  const centerY = H / 2;
  const maxRadius = Math.max(W, H) * 0.7; // Reduced from 0.8 to 0.7 for tighter effect
  
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
  gradient.addColorStop(0, `rgba(255, 0, 0, 0)`); // Transparent center
  gradient.addColorStop(0.4, `rgba(255, 0, 0, ${alpha * 0.4})`); // More red earlier (was 0.6, 0.3)
  gradient.addColorStop(0.7, `rgba(255, 0, 0, ${alpha * 0.7})`); // More intense middle area
  gradient.addColorStop(1, `rgba(255, 0, 0, ${alpha})`); // Full red at edges
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  
  ctx.restore();
}

function isPlayerInvincible() {
  return invincibilityTime > 0;
}

// Upgrade UI elements
let upgradeMenuOpen = false;
let upgradeMenuElement = null;
let livesDisplayElement = null;

// Game over handling
let gameOverCountdown = -1.0;

// Modified game over handling - now only triggers when no lives left
function triggerGameOver() { 
  if (debugGodMode) return; // Prevent game over in god mode
  gameOverCountdown = 1.2; 
}

function drawGameOverScreen(dt) {
  if (gameOverCountdown < 0) return false;
  
  gameOverCountdown -= dt;
  // draw faint last frame behind overlay by not clearing; then overlay:
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4040';
  ctx.font = 'bold 44px system-ui, Segoe UI, Roboto, Helvetica, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W/2, H/2);
  
  if (gameOverCountdown <= 0) {
    start_new_run();
    gameOverCountdown = -1;
  }
  
  return true; // Indicates game over screen is active
}

function updateHUD() {
  // HUD disabled - no room labels displayed
}

// Lives display functions are defined above with other UI functions

// Upgrade notification system
let upgradeNotificationVisible = false;
let upgradeNotificationTimer = 0;
let upgradeNotificationFlashTimer = 0;
let canAffordUpgrade = false;

function checkCanAffordUpgrade() {
  if (typeof UPGRADES === 'undefined' || typeof getUpgradeCost !== 'function') {
    return false;
  }
  return Object.keys(UPGRADES).some(upgradeKey => {
    const cost = getUpgradeCost(upgradeKey);
    return cost !== null && credits >= cost;
  });
}

function updateUpgradeNotification(dt) {
  const newCanAfford = checkCanAffordUpgrade();
  
  if (newCanAfford && !canAffordUpgrade) {
    // Just became able to afford upgrades, start timer
    upgradeNotificationTimer = 60; // 60 seconds
    upgradeNotificationVisible = true;
    upgradeNotificationFlashTimer = 0; // Reset flash timer
  } else if (!newCanAfford) {
    // Can no longer afford upgrades, hide notification
    upgradeNotificationVisible = false;
    upgradeNotificationTimer = 0;
  }
  
  canAffordUpgrade = newCanAfford;
  
  if (upgradeNotificationVisible && upgradeNotificationTimer > 0) {
    upgradeNotificationTimer -= dt;
    upgradeNotificationFlashTimer += dt;
    
    if (upgradeNotificationTimer <= 0) {
      upgradeNotificationTimer = 60; // Reset for next cycle
      upgradeNotificationFlashTimer = 0;
    }
  }
}

function drawUpgradeNotification() {
  if (!upgradeNotificationVisible || upgradeMenuOpen) return;
  
  // 60-second cycle: 3 flashes, pause, 3 flashes, pause
  const cycleTime = upgradeNotificationFlashTimer % 60;
  let shouldShow = false;
  
  // First set of 3 flashes (0-6 seconds): flash at 0.5s, 2s, 3.5s
  if (cycleTime >= 0.5 && cycleTime < 1.0) shouldShow = true;
  else if (cycleTime >= 2.0 && cycleTime < 2.5) shouldShow = true;
  else if (cycleTime >= 3.5 && cycleTime < 4.0) shouldShow = true;
  
  // Second set of 3 flashes (30-36 seconds): flash at 30.5s, 32s, 33.5s
  else if (cycleTime >= 30.5 && cycleTime < 31.0) shouldShow = true;
  else if (cycleTime >= 32.0 && cycleTime < 32.5) shouldShow = true;
  else if (cycleTime >= 33.5 && cycleTime < 34.0) shouldShow = true;
  
  if (!shouldShow) return;
  
  ctx.save();
  ctx.fillStyle = '#FFD700'; // Gold color
  ctx.font = 'bold 20px system-ui, Segoe UI, Roboto, Helvetica, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Press U to Open Upgrade Menu', W / 2, 40);
  ctx.restore();
}

// Upgrade menu functions
function createUpgradeMenu() {
  if (upgradeMenuElement) return upgradeMenuElement;
  
  const menu = document.createElement('div');
  menu.id = 'upgrade-menu';
  menu.className = 'upgrade-menu';
  
  const title = document.createElement('h2');
  title.textContent = 'Upgrades';
  menu.appendChild(title);
  
  const creditsDisplay = document.createElement('div');
  creditsDisplay.className = 'menu-credits';
  creditsDisplay.textContent = `Credits: ${credits}`;
  menu.appendChild(creditsDisplay);
  
  // Create upgrade buttons
  Object.keys(UPGRADES).forEach(upgradeKey => {
    const upgrade = UPGRADES[upgradeKey];
    const currentLevel = upgradelevels[upgradeKey];
    const cost = getUpgradeCost(upgradeKey);
    
    const upgradeDiv = document.createElement('div');
    upgradeDiv.className = 'upgrade-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'upgrade-name';
    nameSpan.textContent = `${upgrade.name} (${currentLevel}/${upgrade.maxLevel})`;
    
    const descSpan = document.createElement('div');
    descSpan.className = 'upgrade-desc';
    descSpan.textContent = upgrade.description;
    
    const button = document.createElement('button');
    button.className = 'upgrade-button';
    
    if (cost === null) {
      button.textContent = 'MAX LEVEL';
      button.disabled = true;
    } else if (credits >= cost) {
      button.textContent = `Buy (${cost})`;
      button.onclick = () => {
        if (purchaseUpgrade(upgradeKey)) {
          updateUpgradeMenu();
        }
      };
    } else {
      button.textContent = `Buy (${cost})`;
      button.disabled = true;
    }
    
    upgradeDiv.appendChild(nameSpan);
    upgradeDiv.appendChild(descSpan);
    upgradeDiv.appendChild(button);
    menu.appendChild(upgradeDiv);
  });
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.className = 'close-button';
  closeButton.onclick = closeUpgradeMenu;
  menu.appendChild(closeButton);
  
  upgradeMenuElement = menu;
  return menu;
}

function updateUpgradeMenu() {
  if (!upgradeMenuElement) return;
  
  // Update credits display
  const creditsDisplay = upgradeMenuElement.querySelector('.menu-credits');
  creditsDisplay.textContent = `Credits: ${credits}`;
  
  // Update each upgrade item
  const upgradeItems = upgradeMenuElement.querySelectorAll('.upgrade-item');
  Object.keys(UPGRADES).forEach((upgradeKey, index) => {
    const upgrade = UPGRADES[upgradeKey];
    const currentLevel = upgradelevels[upgradeKey];
    const cost = getUpgradeCost(upgradeKey);
    const item = upgradeItems[index];
    
    const nameSpan = item.querySelector('.upgrade-name');
    nameSpan.textContent = `${upgrade.name} (${currentLevel}/${upgrade.maxLevel})`;
    
    const button = item.querySelector('.upgrade-button');
    if (cost === null) {
      button.textContent = 'MAX LEVEL';
      button.disabled = true;
      button.onclick = null;
    } else if (credits >= cost) {
      button.textContent = `Buy (${cost})`;
      button.disabled = false;
      button.onclick = () => {
        if (purchaseUpgrade(upgradeKey)) {
          updateUpgradeMenu();
        }
      };
    } else {
      button.textContent = `Buy (${cost})`;
      button.disabled = true;
      button.onclick = null;
    }
  });
}

function openUpgradeMenu() {
  if (upgradeMenuOpen) return;
  
  // Exit pointer lock when opening menu
  if (document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement) {
    const exitMethod = document.exitPointerLock || 
                      document.mozExitPointerLock || 
                      document.webkitExitPointerLock;
    if (exitMethod) {
      exitMethod.call(document);
    }
  }
  
  // Disable touch events on mobile
  if (window.FORCE_MOBILE || (typeof MOBILE !== 'undefined' && MOBILE)) {
    document.body.style.touchAction = 'pan-y'; // Allow vertical scrolling only
    document.body.style.overflow = 'hidden';
  }
  
  const menu = createUpgradeMenu();
  document.body.appendChild(menu);
  updateUpgradeMenu();
  upgradeMenuOpen = true;
}

function closeUpgradeMenu() {
  if (!upgradeMenuOpen || !upgradeMenuElement) return;
  
  // Re-enable touch events on mobile
  if (window.FORCE_MOBILE || (typeof MOBILE !== 'undefined' && MOBILE)) {
    document.body.style.touchAction = '';
    document.body.style.overflow = '';
  }
  
  document.body.removeChild(upgradeMenuElement);
  upgradeMenuElement = null;
  upgradeMenuOpen = false;
}

function toggleUpgradeMenu() {
  if (upgradeMenuOpen) {
    closeUpgradeMenu();
  } else {
    openUpgradeMenu();
  }
}

// Export the update function for external use
window.updateUpgradeUI = updateUpgradeMenu;

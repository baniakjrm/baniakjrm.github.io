// Attack of The Kruptins - Persistent Storage & Upgrades
// Handles cookie-based saving/loading and upgrade system

// Upgrade definitions
const UPGRADES = {
  // Weapon upgrades
  fireRate: {
    name: 'Faster Reload',
    description: 'Reduces blaster cooldown time',
    maxLevel: 5,
    baseCost: 200,
    costMultiplier: 1.5,
    effect: (level) => 1.0 - (level * 0.15) // 1.0s -> 0.25s at max level
  },  projectileSpeed: {
    name: 'Rapid Fire',
    description: 'Increases projectile speed',
    maxLevel: 3,
    baseCost: 300,
    costMultiplier: 2.0,
    effect: (level) => 1.0 + (level * 0.4) // 140% projectile speed at max level
  },
  
  // Player upgrades
  moveSpeed: {
    name: 'Swift Movement',
    description: 'Increases movement speed',
    maxLevel: 4,
    baseCost: 240,
    costMultiplier: 1.8,
    effect: (level) => 1.0 + (level * 0.2) // 180% speed at max level
  },
  health: {
    name: 'Extra Lives',
    description: 'Start with additional lives',
    maxLevel: 3,
    baseCost: 400,
    costMultiplier: 2.5,
    effect: (level) => level // 0-3 extra lives
  }
};

// Current upgrade levels (will be loaded from cookies)
let upgradelevels = {
  fireRate: 0,
  projectileSpeed: 0,
  moveSpeed: 0,
  health: 0
};

// Player lives system
let playerLives = 1; // Base 1 life + upgrades
let maxLives = 1;

// Cookie management
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

// Save persistent data to cookies
function saveProgress() {
  setCookie('kruptins_credits', credits.toString());
  setCookie('kruptins_upgrades', JSON.stringify(upgradelevels));
  console.log('Progress saved to cookies');
}

// Load persistent data from cookies
function loadProgress() {
  // Load credits
  const savedCredits = getCookie('kruptins_credits');
  if (savedCredits !== null) {
    credits = parseInt(savedCredits, 10) || 0;
    updateCreditsUI();
  }
    // Load upgrades
  const savedUpgrades = getCookie('kruptins_upgrades');
  if (savedUpgrades !== null) {
    try {
      const parsed = JSON.parse(savedUpgrades);
      // Migrate old "damage" upgrade to new "projectileSpeed" upgrade
      if (parsed.damage !== undefined) {
        parsed.projectileSpeed = parsed.damage;
        delete parsed.damage;
        console.log('Migrated old damage upgrade to projectileSpeed upgrade');
      }
      upgradelevels = { ...upgradelevels, ...parsed };
    } catch (e) {
      console.warn('Failed to parse saved upgrades:', e);
    }
  }
  
  // Apply upgrade effects
  applyUpgrades();
  console.log('Progress loaded from cookies');
}

// Apply current upgrade effects to game
function applyUpgrades() {
  // Apply move speed upgrade
  window.MOVE_SPEED_MULTIPLIER = UPGRADES.moveSpeed.effect(upgradelevels.moveSpeed);
  
  // Apply fire rate upgrade
  window.BLASTER_COOLDOWN_MULTIPLIER = UPGRADES.fireRate.effect(upgradelevels.fireRate);
  
  // Apply projectile speed upgrade
  window.PROJECTILE_SPEED_MULTIPLIER = UPGRADES.projectileSpeed.effect(upgradelevels.projectileSpeed);
  
  // Apply health upgrade
  maxLives = 1 + UPGRADES.health.effect(upgradelevels.health);
  if (playerLives > maxLives) playerLives = maxLives; // Don't exceed new max
}

// Calculate cost for next level of an upgrade
function getUpgradeCost(upgradeKey) {
  const upgrade = UPGRADES[upgradeKey];
  const currentLevel = upgradelevels[upgradeKey];
  if (currentLevel >= upgrade.maxLevel) return null; // Max level reached
  
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
}

// Purchase an upgrade
function purchaseUpgrade(upgradeKey) {
  const cost = getUpgradeCost(upgradeKey);
  if (cost === null) return false; // Max level or invalid upgrade
  
  if (credits >= cost) {
    credits -= cost;
    upgradelevels[upgradeKey]++;
    updateCreditsUI();
    
    // Special handling for health upgrade - grant immediate extra life
    if (upgradeKey === 'health') {
      const oldMaxLives = maxLives;
      applyUpgrades(); // This updates maxLives
      // Grant the extra life immediately if we increased max lives
      if (maxLives > oldMaxLives) {
        playerLives = Math.min(playerLives + 1, maxLives);
        if (typeof updateLivesUI === 'function') updateLivesUI();
      }
    } else {
      applyUpgrades();
    }
    
    saveProgress(); // Auto-save after purchase
    updateUpgradeUI();
    return true;
  }
  return false;
}

// Reset all upgrades (for testing purposes)
function resetUpgrades() {
  upgradelevels = {
    fireRate: 0,
    projectileSpeed: 0,
    moveSpeed: 0,
    health: 0
  };
  credits = 0;
  updateCreditsUI();
  applyUpgrades();
  saveProgress();
  updateUpgradeUI();
}

// Lives management
function resetLives() {
  playerLives = maxLives;
}

function loseLife() {
  if (playerLives > 1) {
    playerLives--;
    return false; // Continue playing
  } else {
    playerLives = 0;
    return true; // Game over
  }
}

// Auto-save periodically and on page unload
setInterval(saveProgress, 30000); // Save every 30 seconds
window.addEventListener('beforeunload', saveProgress);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveProgress();
  }
});

// Load progress when the page loads
document.addEventListener('DOMContentLoaded', loadProgress);

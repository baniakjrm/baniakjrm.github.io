// Attack of The Kruptins - UI and HUD Elements

const killsBox = document.getElementById('kills');
const roomsBox = document.getElementById('rooms');
const creditsBox = document.getElementById('credits');

const updateKillsUI = () => killsBox.textContent = String(kills);
const updateRoomsUI = () => roomsBox.textContent = String(roomsCleared);
const updateCreditsUI = () => creditsBox.textContent = String(credits);

// Game over handling
let gameOverCountdown = -1.0;

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
  // HUD text (tile label)
  document.getElementById('hud').textContent = `${current_tile?.label || ''}`;
}

// Attack of The Kruptins - Core Game Engine

// ---------------- Canvas & timing ----------------
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
let W = canvas.width;
let H = canvas.height;
let HALF_H = (H / 2) | 0;
ctx.imageSmoothingEnabled = false;

// --- Mobile detection (now overrideable by control selection) ---
const MOBILE = window.FORCE_MOBILE !== undefined ? window.FORCE_MOBILE : (
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent) || 
  ('ontouchstart' in window) || 
  (navigator.maxTouchPoints > 0) ||
  (window.innerWidth <= 768 && window.innerHeight <= 1024)
);

// Force show touch UI for mobile devices detected by JavaScript
if (MOBILE) {
  document.addEventListener('DOMContentLoaded', () => {
    const touchUI = document.getElementById('touch-ui');
    if (touchUI) {
      touchUI.classList.add('force-mobile');
    }
  });
}

// ✱ Preserve internal res but stretch to biggest window area
function resizeToWindow() {
  const targetW = canvas.width, targetH = canvas.height;
  const scale = Math.min(window.innerWidth / targetW, window.innerHeight / targetH);
  canvas.style.width  = Math.round(targetW * scale) + 'px';
  canvas.style.height = Math.round(targetH * scale) + 'px';
}
window.addEventListener('resize', resizeToWindow);
resizeToWindow();

// Camera
let posX = 8.0, posY = 8.0;
let dirX = 1.0, dirY = 0.0;
let planeX = 0.0, planeY = 0.66;
const MOVE_SPEED = 3.2, ROT_SPEED = 1.0;

let zBuf = null;

// ---------------- Rendering ----------------
function fillRectColor(x, y, w, h, rgb) {
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(x, y, w, h);
}

function renderFrame() {
  // Sky/floor
  fillRectColor(0, 0, W, HALF_H, SKY);
  fillRectColor(0, HALF_H, W, HALF_H, FLOOR);

  // Walls + zBuffer
  for (let x=0; x<W; x++) {
    const cameraX = 2 * x / W - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    let mapX = posX | 0, mapY = posY | 0;
    const INF = 1e30;
    const deltaDistX = rayDirX !== 0 ? Math.abs(1.0 / rayDirX) : INF;
    const deltaDistY = rayDirY !== 0 ? Math.abs(1.0 / rayDirY) : INF;

    let stepX, stepY, sideDistX, sideDistY;
    if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1.0 - posX) * deltaDistX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1.0 - posY) * deltaDistY; }

    let hit = false, side = 0, tile_id = 0, guard = 0;
    while (!hit && guard++ < 4096) {
      if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
      if (mapY < 0 || mapY >= WORLD_H || mapX < 0 || mapX >= WORLD_W) { hit = true; tile_id = BOUNDARY_ID; break; }
      tile_id = WORLD[mapY][mapX];
      if (tile_id !== 0) hit = true;
    }

    let perpWallDist;
    if (side === 0) perpWallDist = (mapX - posX + (1 - stepX) / 2.0) / (rayDirX || 1e-9);
    else perpWallDist = (mapY - posY + (1 - stepY) / 2.0) / (rayDirY || 1e-9);
    if (!(perpWallDist > 0)) perpWallDist = 1e-6;

    const lineHeight = (H / perpWallDist) | 0;
    const drawStart = Math.max(0, ((-lineHeight / 2 + HALF_H) | 0));
    const drawEnd = Math.min(H - 1, ((lineHeight / 2 + HALF_H) | 0));

    let base = WALL_COLOR.get(tile_id) || [255,255,255];
    if (side === 1) base = [(base[0]*0.75)|0, (base[1]*0.75)|0, (base[2]*0.75)|0];
    const shade = Math.max(0.4, Math.min(1.0, 2.0 / (perpWallDist + 0.5)));
    const color = [(base[0]*shade)|0, (base[1]*shade)|0, (base[2]*shade)|0];

    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart + 1);

    if (!zBuf) zBuf = new Float32Array(W);
    zBuf[x] = perpWallDist;
  }

  // Sprites - combined depth sorting for proper occlusion
  drawSprites(zBuf);
}

function ensure_neighbors_visible() {
  const [t, d] = which_tile_contains(posX, posY);
  if (t && t !== current_tile && d !== null) enter_neighbor(d);
}

// Re-added neighbor transition logic
function enter_neighbor(direction) {
  const back_dir = back_side_of_current();
  let next_tile;
  if (direction === back_dir && prev_tile) next_tile = prev_tile;
  else {
    next_tile = current_tile.neighbors.get(direction);
    if (!next_tile) return;
  }

  const old_center = current_tile;

  // Despawn all remaining alive enemies from old center (progression but no kills)
  despawnEnemiesInTile(old_center);

  const oldNextOrigin = tile_positions.get(next_tile);
  const oldNextOx = oldNextOrigin[0];
  const oldNextOy = oldNextOrigin[1];

  prev_tile = old_center;
  const arrived_from = opposite(direction);

  generate_neighbors_for_center(next_tile, arrived_from);
  rebuild_world(next_tile, prev_tile, arrived_from);

  const [newNextOx, newNextOy] = tile_positions.get(next_tile);

  posX = posX - oldNextOx + newNextOx;
  posY = posY - oldNextOy + newNextOy;
  for (const s of shots) {
    s.x = s.x - oldNextOx + newNextOx;
    s.y = s.y - oldNextOy + newNextOy;
  }

  current_tile = next_tile;
  maybeSpawnEnemiesFor(current_tile);
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - loop.lastNow) / 1000 || 0.016);
  loop.lastNow = now;

  // Update blaster cooldown
  updateBlasterCooldown(dt);

  // If game-over, show overlay and countdown to reset
  if (drawGameOverScreen(dt)) {
    requestAnimationFrame(loop);
    return;
  }

  // --- Mouse look (desktop) or mobile look drag ---
  let rot = 0.0;
  if ((!window.FORCE_MOBILE && !MOBILE) && mouseLookDelta !== 0) {
    rot += (mouseLookDelta * 0.0025); // Sensitivity
    mouseLookDelta = 0;
  }
  if ((window.FORCE_MOBILE || MOBILE) && mouseLookDelta !== 0) {
    rot += (mouseLookDelta * 0.005); // Mobile sensitivity
    mouseLookDelta = 0;
  }

  if (rot !== 0.0) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const oldDirX = dirX;
    dirX = dirX * cos - dirY * sin;
    dirY = oldDirX * sin + dirY * cos;
    const oldPlaneX = planeX;
    planeX = planeX * cos - planeY * sin;
    planeY = oldPlaneX * sin + planeY * cos;
  }
  // --- Movement ---
  const speedMultiplier = window.MOVE_SPEED_MULTIPLIER || 1.0;
  let move = MOVE_SPEED * dt * 3 * speedMultiplier;
  let moveX = 0, moveY = 0;
  let isMoving = false;

  // Desktop: WASD (always check, not just when !MOBILE)
  // W/S: forward/back
  if (keys.has('KeyW')) {
    moveX += dirX;
    moveY += dirY;
    isMoving = true;
  }
  if (keys.has('KeyS')) {
    moveX -= dirX;
    moveY -= dirY;
    isMoving = true;
  }
  // A/D: strafe left/right (perpendicular to facing) - FIXED SWAP
  if (keys.has('KeyA')) {
    moveX += dirY;  // Changed from -dirY
    moveY += -dirX; // Changed from dirX
    isMoving = true;
  }
  if (keys.has('KeyD')) {
    moveX += -dirY; // Changed from dirY
    moveY += dirX;  // Changed from -dirX
    isMoving = true;
  }

  // Mobile joystick movement (if mobile controls selected and joystick active)
  if ((window.FORCE_MOBILE || MOBILE) && window._mobileJoyVec) {
    const jx = window._mobileJoyVec.x, jy = window._mobileJoyVec.y;
    if (Math.abs(jx) > 0.1 || Math.abs(jy) > 0.1) {
      isMoving = true;
      // Add to existing movement from keyboard (for debugging on desktop)
      const mag = Math.max(1, Math.sqrt(jx * jx + jy * jy));
      moveX += (dirX * -jy + -dirY * jx) / mag;
      moveY += (dirY * -jy + dirX * jx) / mag;
    }
  }

  // Apply movement if any input detected
  if (isMoving) {
    // Normalize if moving diagonally
    const mag = Math.max(1, Math.sqrt(moveX * moveX + moveY * moveY));
    const nx = posX + (moveX / mag) * move;
    const ny = posY + (moveY / mag) * move;
    if (can_move(nx, posY)) posX = nx;
    if (can_move(posX, ny)) posY = ny;
  }

  ensure_neighbors_visible();
  moveShots(dt);
  updateEnemies(dt);

  renderFrame();
  updateHUD();

  // Blaster sway
  const turning = (rot !== 0);
  const moving = isMoving;
  let yawSign = 0;
  if (turning) yawSign = rot > 0 ? 1 : -1;
  if (turning || moving) { 
    swayClock += dt; 
    if (yawSign !== 0) lastYawSign = yawSign; 
  } else { 
    swayClock = 0; 
    lastYawSign = 0; 
  }  drawBlaster(turning, moving, lastYawSign, swayClock);
  // Update and draw upgrade notification
  if (typeof updateUpgradeNotification === 'function') {
    updateUpgradeNotification(dt);
  }
  if (typeof drawUpgradeNotification === 'function') {
    drawUpgradeNotification();
  }

  // Update invincibility system
  if (typeof updateInvincibilitySystem === 'function') {
    updateInvincibilitySystem(dt);
  }
  
  // Draw damage vignette on top of everything
  if (typeof drawDamageVignette === 'function') {
    drawDamageVignette();
  }

  requestAnimationFrame(loop);
}
loop.lastNow = performance.now();

function init() {
  W = canvas.width; H = canvas.height; HALF_H = (H/2)|0;
  zBuf = new Float32Array(W);
  initializeControls();
  
  // Apply any loaded upgrades
  if (typeof applyUpgrades === 'function') {
    applyUpgrades();
  }
  
  start_new_run();
  requestAnimationFrame(loop);
}

// Re-added: run reset / fresh start
function start_new_run() {
  kills = 0; 
  if (typeof updateKillsUI === 'function') updateKillsUI();
  
  roomsCleared = 0; 
  if (typeof updateRoomsUI === 'function') updateRoomsUI();
  
  // Don't reset credits - they persist between deaths
  // credits = 0; updateCreditsUI();
  
  // Reset lives to max when starting new run
  if (typeof resetLives === 'function') {
    resetLives();
    if (typeof updateLivesUI === 'function') updateLivesUI();
  }
  
  clears = 0; maxDifficulty = 0.0;
  enemies.length = 0;
  shots.length = 0;
  enemyShots.length = 0; // Clear enemy shots
  gameOverCountdown = -1;
  blockingWalls.clear(); // Clear all blocking walls
  
  // Reset lives to maximum
  if (typeof resetLives === 'function') {
    resetLives();
    updateLivesUI();
  }

  current_tile = generate_tile(3);
  current_tile.kind = 'start';
  current_tile.open_sides = new Set([1,0,2]);
  current_tile.isStart = true;
  current_tile.variety = null; // Explicitly prevent pillars in start room
  current_tile.label = 'start (no rear door)';
  current_tile.spawned = true; // force no spawn in start room

  generate_neighbors_for_center(current_tile, 3);
  prev_tile = null;
  rebuild_world(current_tile, prev_tile, null);

  const [ox, oy] = tile_positions.get(current_tile);
  posX = ox + TILE * 0.5;
  posY = oy + TILE * 0.5;
  dirX = 1.0; dirY = 0.0;
  planeX = 0.0; planeY = 0.66;
}

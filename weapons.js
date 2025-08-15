// Attack of The Kruptins - Weapons and Projectiles

// --- Blaster overlay (HUD) ---
const blasterImg = new Image();
blasterImg.src = 'blaster.png';
const emptyBlasterImg = new Image();
emptyBlasterImg.src = 'empty.png';
let BLASTER_SCALE = 5.0;
const SWAY_DUR   = 0.35;
const SWAY_AMP_X = 18;
const SWAY_AMP_Y = 12;
const BLASTER_BLEED_X = SWAY_AMP_X + 6;
const BLASTER_BLEED_Y = 6;
let swayClock = 0, lastYawSign = 0, lastBlasterRect = null;

// Blaster cooldown system
let blasterCooldown = 0.0;
const BLASTER_COOLDOWN_TIME = 1.0; // 1 second

function drawBlaster(turning, moving, yawSign, clock) {
  const currentImg = blasterCooldown > 0 ? emptyBlasterImg : blasterImg;
  if (!currentImg.complete) return;
  const u = ((clock % SWAY_DUR) / SWAY_DUR);
  const parab = (turning || moving) ? (4 * u * (1 - u)) : 0;
  const dx = -yawSign * SWAY_AMP_X * parab;
  const dy = (turning || moving ? 1 : 0) * SWAY_AMP_Y * parab;
  const w = currentImg.width  * BLASTER_SCALE;
  const h = currentImg.height * BLASTER_SCALE;
  const baseX = W - w + BLASTER_BLEED_X;
  const baseY = H - h + BLASTER_BLEED_Y;
  const x = baseX + dx, y = baseY + dy;
  lastBlasterRect = { x, y, w, h };
  ctx.drawImage(currentImg, x, y, w, h);
}

// --------------- Projectiles (sprite-based) ---------------
const shotImg = new Image(); shotImg.src = 'blast.png';
const enemyBlastImg = new Image(); enemyBlastImg.src = 'enemyblast.png';
const shots = [];
const enemyShots = []; // Enemy projectiles
const SHOT_SPEED = 18.0;
const ENEMY_SHOT_SPEED = 12.0; // Slightly slower than player shots
const SHOT_TTL   = 1.2;
const SHOT_SCALE = 0.5; // half size

function spawnShot() {
  // Check if blaster is on cooldown
  if (blasterCooldown > 0) return;
  
  const forward = 0.80, rightOff = 0.2;
  const rx = -dirY, ry = dirX; // right vector
  const sx = posX + dirX * forward + rx * rightOff;
  const sy = posY + dirY * forward + ry * rightOff;
  shots.push({ x: sx, y: sy, vx: dirX * SHOT_SPEED, vy: dirY * SHOT_SPEED, t: 0 });
  
  // Start cooldown
  blasterCooldown = BLASTER_COOLDOWN_TIME;
}

function moveShots(dt) {
  // Player shots
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    let remain = dt;
    const STEP = 0.025;
    while (remain > 0) {
      const d = Math.min(STEP, remain);
      const nx = s.x + s.vx * d, ny = s.y + s.vy * d;
      if (!can_move(nx, ny)) { shots.splice(i, 1); break; }
      s.x = nx; s.y = ny; s.t += d; remain -= d;
      if (s.t > SHOT_TTL) { shots.splice(i, 1); break; }
    }
  }
  
  // Enemy shots
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    let remain = dt;
    const STEP = 0.025;
    while (remain > 0) {
      const d = Math.min(STEP, remain);
      const nx = s.x + s.vx * d, ny = s.y + s.vy * d;
      if (!can_move(nx, ny)) { enemyShots.splice(i, 1); break; }
      s.x = nx; s.y = ny; s.t += d; remain -= d;
      if (s.t > SHOT_TTL) { enemyShots.splice(i, 1); break; }
      
      // Check collision with player
      const playerDist = Math.hypot(s.x - posX, s.y - posY);
      if (playerDist < PLAYER_RADIUS) {
        if (!debugGodMode) triggerGameOver();
        enemyShots.splice(i, 1);
        break;
      }
    }
  }
}

function updateBlasterCooldown(dt) {
  if (blasterCooldown > 0) {
    blasterCooldown -= dt;
    if (blasterCooldown < 0) blasterCooldown = 0;
  }
}

function drawShots(zBuf) {
  if (!shotImg.complete || !enemyBlastImg.complete) return;
  
  // Draw player shots
  const playerOrder = shots.map((s, i) => ({ i, d: (s.x - posX) ** 2 + (s.y - posY) ** 2, type: 'player' }));
  // Draw enemy shots  
  const enemyOrder = enemyShots.map((s, i) => ({ i, d: (s.x - posX) ** 2 + (s.y - posY) ** 2, type: 'enemy' }));
  
  // Combine and sort by distance
  const allShots = [...playerOrder, ...enemyOrder].sort((a, b) => b.d - a.d);
  
  for (const o of allShots) {
    const shots_array = o.type === 'player' ? shots : enemyShots;
    const shot_img = o.type === 'player' ? shotImg : enemyBlastImg;
    const s = shots_array[o.i];
    
    const relX = s.x - posX, relY = s.y - posY;
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const transX = invDet * ( dirY * relX - dirX * relY);
    const transY = invDet * (-planeY * relX + planeX * relY);
    if (transY <= 0.0001) continue;

    const screenX = (W / 2) * (1 + transX / transY);
    const spriteH = Math.abs((H / transY) * SHOT_SCALE);
    const spriteW = spriteH;

    const drawStartY = Math.max(0, ((-spriteH / 2 + HALF_H) | 0));
    const drawEndY   = Math.min(H - 1, ((spriteH / 2 + HALF_H) | 0));
    const drawStartX = Math.max(0, ((-spriteW / 2 + screenX) | 0));
    const drawEndX   = Math.min(W - 1, ((spriteW / 2 + screenX) | 0));

    for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
      if (transY < zBuf[stripe]) {
        const u = (stripe - (-spriteW / 2 + screenX)) / spriteW;
        const texX = Math.max(0, Math.min(shot_img.width - 1, Math.floor(u * shot_img.width)));
        ctx.drawImage(shot_img, texX, 0, 1, shot_img.height, stripe, drawStartY, 1, drawEndY - drawStartY + 1);
      }
    }
  }
}

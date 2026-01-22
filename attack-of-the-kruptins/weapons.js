// Attack of The Kruptins - Weapons and Projectiles

// --- Blaster overlay (HUD) ---
const blasterImg = new Image();
blasterImg.src = 'graphics/blaster.png';
const emptyBlasterImg = new Image();
emptyBlasterImg.src = 'graphics/empty.png';
let BLASTER_SCALE = 5.0;
const SWAY_DUR   = 0.35;
const SWAY_AMP_X = 18;
const SWAY_AMP_Y = 12;
const BLASTER_BLEED_X = SWAY_AMP_X + 6;
const BLASTER_BLEED_Y = 6;
let swayClock = 0, lastYawSign = 0, lastBlasterRect = null;

// Blaster cooldown system
let blasterCooldown = 0.0;
const BLASTER_COOLDOWN_TIME = 1.4; // 1.4 seconds (slower start)

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
    // Apply invincibility opacity effect
  const isInvincible = (typeof isPlayerInvincible === 'function' && isPlayerInvincible());
  if (isInvincible) {
    ctx.save();
    // Flash between 20% and 80% opacity during invincibility
    const flashSpeed = 8.0; // Flashes per second
    const flashCycle = Math.sin(performance.now() / 1000 * flashSpeed * Math.PI);
    const opacity = 0.5 + 0.3 * flashCycle; // Ranges from 0.2 to 0.8
    ctx.globalAlpha = opacity;
  }
  
  ctx.drawImage(currentImg, x, y, w, h);
  
  if (isInvincible) {
    ctx.restore();
  }
}

// --------------- Projectiles (sprite-based) ---------------
const shotImg = new Image(); shotImg.src = 'graphics/blast.png';
const enemyBlastImg = new Image(); enemyBlastImg.src = 'graphics/enemyblast.png';
const shots = [];
const enemyShots = []; // Enemy projectiles
const SHOT_SPEED = 10.0; // Even slower starting speed
const ENEMY_SHOT_SPEED = 12.0; // Slightly slower than player shots
const SHOT_TTL   = 1.2;
const PLAYER_SHOT_SCALE = 0.25; // quarter size for player shots
const ENEMY_SHOT_SCALE = 0.5; // half size for enemy shots

function spawnShot() {
  // Check if blaster is on cooldown (with upgrade multiplier)
  if (blasterCooldown > 0) return;
  
  const forward = 0.80, rightOff = 0.2;
  const rx = -dirY, ry = dirX; // right vector
  const sx = posX + dirX * forward + rx * rightOff;
  const sy = posY + dirY * forward + ry * rightOff;
  
  // Apply projectile speed upgrade (only to player shots)
  const speedMultiplier = window.PROJECTILE_SPEED_MULTIPLIER || 1.0;
  const effectiveSpeed = SHOT_SPEED * speedMultiplier;
  
  shots.push({ x: sx, y: sy, vx: dirX * effectiveSpeed, vy: dirY * effectiveSpeed, t: 0 });
  // Play blaster SFX
  if (window.AudioManager && typeof window.AudioManager.playSfx === 'function') {
    window.AudioManager.playSfx('blast', 0.7);
  }
  
  // Start cooldown (apply upgrade multiplier)
  const cooldownMultiplier = window.BLASTER_COOLDOWN_MULTIPLIER || 1.0;
  blasterCooldown = BLASTER_COOLDOWN_TIME * cooldownMultiplier;
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
        if (!debugGodMode && typeof takeDamage === 'function') takeDamage();
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
    const shot_scale = o.type === 'player' ? PLAYER_SHOT_SCALE : ENEMY_SHOT_SCALE;
    const s = shots_array[o.i];
    
    const relX = s.x - posX, relY = s.y - posY;
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const transX = invDet * ( dirY * relX - dirX * relY);
    const transY = invDet * (-planeY * relX + planeX * relY);
    if (transY <= 0.0001) continue;

    const screenX = (W / 2) * (1 + transX / transY);
    const spriteH = Math.abs((H / transY) * shot_scale);
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

// Combined sprite rendering with proper depth sorting
function drawSprites(zBuf) {
  if (!shotImg.complete || !enemyBlastImg.complete) return;
  
  // Collect all sprites (shots and enemies) with their distances
  const allSprites = [];
  
  // Add player shots
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const d = (s.x - posX) ** 2 + (s.y - posY) ** 2;
    allSprites.push({ type: 'playerShot', data: s, index: i, distance: d });
  }
  
  // Add enemy shots
  for (let i = 0; i < enemyShots.length; i++) {
    const s = enemyShots[i];
    const d = (s.x - posX) ** 2 + (s.y - posY) ** 2;
    allSprites.push({ type: 'enemyShot', data: s, index: i, distance: d });
  }
  
  // Add enemies
  for (const e of enemies) {
    if ((e.state === 'alive' || e.state === 'dying') && e.canvas) {
      const d = (e.x - posX) ** 2 + (e.y - posY) ** 2;
      allSprites.push({ type: 'enemy', data: e, distance: d });
    }
  }
  
  // Sort by distance (far to near)
  allSprites.sort((a, b) => b.distance - a.distance);
  
  const currentTime = performance.now() / 1000;
  
  // Render all sprites in depth order
  for (const sprite of allSprites) {
    if (sprite.type === 'enemy') {
      // Render enemy
      const e = sprite.data;
      const relX = e.x - posX;
      const relY = e.y - posY;
      const invDet = 1.0 / (planeX * dirY - dirX * planeY);
      const transX = invDet * ( dirY * relX - dirX * relY);
      const transY = invDet * (-planeY * relX + planeX * relY);
      if (transY <= 0.0001) continue;

      const screenX = (W / 2) * (1 + transX / transY);
      let spriteH = Math.min(H * 0.8, Math.abs((H / transY) * ENEMY_SCALE));
      const originalSpriteH = spriteH; // Keep track of original height
      
      // Calculate original width before any squishing
      const aspect = e.canvas.width / e.canvas.height;
      const originalSpriteW = originalSpriteH * aspect;
      
      // Apply squishing effect for dying enemies (height only)
      if (e.state === 'dying') {
        // Squish from top down - reduce height as death progresses
        spriteH *= (1.0 - e.deathProgress);
      }
      
      // Width stays the same for dying enemies, only height changes
      const spriteW = originalSpriteW;
      
      // Adjust drawing position for squishing effect (anchor to bottom)
      let drawStartY, drawEndY;
      if (e.state === 'dying') {
        // For dying enemies, anchor to bottom - keep bottom edge at original position
        const bottomY = HALF_H + originalSpriteH / 2;
        drawStartY = Math.max(0, ((bottomY - spriteH) | 0));
        drawEndY = Math.min(H - 1, (bottomY | 0));
      } else {
        // Normal centered positioning
        drawStartY = Math.max(0, ((-spriteH / 2 + HALF_H) | 0));
        drawEndY = Math.min(H - 1, ((spriteH / 2 + HALF_H) | 0));
      }
      
      const drawStartX = Math.max(0, ((-spriteW / 2 + screenX) | 0));
      const drawEndX   = Math.min(W - 1, ((spriteW / 2 + screenX) | 0));

      // Determine which canvas to use
      let drawCanvas = e.canvas;
      
      if (e.state === 'dying') {
        // Lerp between colored and gray canvas based on death progress
        if (e.deathProgress < 1.0 && e.grayCanvas) {
          // Create a temporary canvas for color interpolation
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = e.canvas.width;
          tempCanvas.height = e.canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          
          // Draw colored version with decreasing opacity
          tempCtx.globalAlpha = 1.0 - e.deathProgress;
          tempCtx.drawImage(e.canvas, 0, 0);
          
          // Draw gray version with increasing opacity
          tempCtx.globalAlpha = e.deathProgress;
          tempCtx.drawImage(e.grayCanvas, 0, 0);
          
          tempCtx.globalAlpha = 1.0;
          drawCanvas = tempCanvas;
        } else {
          drawCanvas = e.grayCanvas || e.canvas;
        }
      } else if (e.type === 'ranged' && e.isTelegraphing && e.flashCanvas) {
        const telegraphTime = currentTime - e.telegraphStart;
        const flashCycle = (telegraphTime / FLASH_INTERVAL) % 2;
        if (flashCycle < 1) {
          drawCanvas = e.flashCanvas;
        }
      }

      for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
        if (transY < zBuf[stripe]) {
          const u = (stripe - (-spriteW / 2 + screenX)) / spriteW;
          const uu = e.flip ? (1 - u) : u;
          const texX = Math.max(0, Math.min(drawCanvas.width - 1, Math.floor(uu * drawCanvas.width)));
          ctx.drawImage(
            drawCanvas,
            texX, 0, 1, drawCanvas.height,
            stripe, drawStartY, 1, drawEndY - drawStartY + 1
          );
        }
      }
    } else {
      // Render shot (player or enemy)
      const s = sprite.data;
      const shot_img = sprite.type === 'playerShot' ? shotImg : enemyBlastImg;
      const shot_scale = sprite.type === 'playerShot' ? PLAYER_SHOT_SCALE : ENEMY_SHOT_SCALE;
      
      const relX = s.x - posX, relY = s.y - posY;
      const invDet = 1.0 / (planeX * dirY - dirX * planeY);
      const transX = invDet * ( dirY * relX - dirX * relY);
      const transY = invDet * (-planeY * relX + planeX * relY);
      if (transY <= 0.0001) continue;

      const screenX = (W / 2) * (1 + transX / transY);
      const spriteH = Math.abs((H / transY) * shot_scale);
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
}

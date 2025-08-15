// Attack of The Kruptins - Enemy System

const enemyImg = new Image(); enemyImg.src = 'enemy.png';
const rangedEnemyImg = new Image(); rangedEnemyImg.src = 'rangedenemy.png';
const ENEMY_RADIUS = 0.35;
const PLAYER_RADIUS = 0.35;
const ENEMY_SCALE = 0.9;

// Difficulty / progression
let kills = 0, clears = 0, maxDifficulty = 0.0;
let roomsCleared = 0; // New progression metric
let credits = 0; // New credits system

// Ranged enemy constants
const RANGED_FIRE_RATES = {
  green: 3.0,  // Fire every 3 seconds
  blue: 2.0,   // Fire every 2 seconds  
  red: 1.0     // Fire every 1 second
};
const TELEGRAPH_DURATION = 0.3; // Flash duration before firing
const FLASH_INTERVAL = 0.1; // Flash on/off interval

let enemies = []; // replaces single 'enemy'

// Color & speed mapping (d in [0,1]): Green->Blue->Red
function enemyColorForDifficulty(d) {
  if (d < 0.5) {
    const t = d / 0.5; // 0→1
    return [
      80,  // Add some red for lighter colors
      Math.round(180 + 75 * (1 - t)), // G: 255→180 (lighter green)
      Math.round(180 + 75 * t)        // B: 180→255 (lighter blue)
    ];
  } else {
    const t = (d - 0.5) / 0.5; // 0→1
    return [
      Math.round(180 + 75 * t),      // R: 180→255 (lighter red)
      80,  // Add some green for lighter colors
      Math.round(180 + 75 * (1 - t)) // B: 255→180 (lighter blue)
    ];
  }
}

function enemySpeedForDifficulty(d) {
  return 1.0 + 2.5 * d; // blue 1.0 → red 3.5
}

function getRangedEnemyFireRate(difficulty) {
  if (difficulty < 0.33) return RANGED_FIRE_RATES.green;
  if (difficulty < 0.66) return RANGED_FIRE_RATES.blue;
  return RANGED_FIRE_RATES.red;
}

// Tint helper
function makeTintedEnemyCanvas(color, isRanged = false) {
  const sourceImg = isRanged ? rangedEnemyImg : enemyImg;
  if (!sourceImg.complete || !sourceImg.naturalWidth) return null;
  const [r,g,b] = color;
  const c = document.createElement('canvas');
  c.width = sourceImg.width;
  c.height = sourceImg.height;
  const gctx = c.getContext('2d');

  // 1. Draw original grayscale
  gctx.drawImage(sourceImg, 0, 0);

  // 2. Multiply color to preserve shading
  gctx.globalCompositeOperation = 'multiply';
  gctx.fillStyle = `rgb(${r},${g},${b})`;
  gctx.fillRect(0, 0, c.width, c.height);

  // 3. Re-apply original alpha (mask)
  gctx.globalCompositeOperation = 'destination-in';
  gctx.drawImage(sourceImg, 0, 0);

  // Reset blend mode for later draws
  gctx.globalCompositeOperation = 'source-over';
  return c;
}

function makeWhiteFlashCanvas(isRanged = false) {
  const sourceImg = isRanged ? rangedEnemyImg : enemyImg;
  if (!sourceImg.complete || !sourceImg.naturalWidth) return null;
  const c = document.createElement('canvas');
  c.width = sourceImg.width;
  c.height = sourceImg.height;
  const gctx = c.getContext('2d');

  // Draw white version for flash
  gctx.drawImage(sourceImg, 0, 0);
  gctx.globalCompositeOperation = 'source-in';
  gctx.fillStyle = 'white';
  gctx.fillRect(0, 0, c.width, c.height);
  gctx.globalCompositeOperation = 'source-over';
  return c;
}

// Replace single spawn helper with multi-point provider
function getEnemySpawnPoints(tile_origin, tile) {
  const [ox, oy] = tile_origin;
  // 5 spawn points: center and 4 corners (moved further to corners)
  const points = [
    [ox + TILE * 0.50, oy + TILE * 0.50], // center
    [ox + TILE * 0.15, oy + TILE * 0.15], // moved from 0.25 to 0.15
    [ox + TILE * 0.85, oy + TILE * 0.15], // moved from 0.75 to 0.85
    [ox + TILE * 0.15, oy + TILE * 0.85], // moved from 0.25 to 0.85
    [ox + TILE * 0.85, oy + TILE * 0.85], // moved from 0.75 to 0.85
  ];
  // If center pillar, remove center spawn
  if (tile && tile.variety === 'center') {
    return points.slice(1); // corners only
  }
  return points;
}

// New enemy spawn validation functions
function isCoordinateInsideRoom(x, y, tile_origin) {
  const [ox, oy] = tile_origin;
  // Check if coordinate is within room bounds (excluding walls)
  return x > ox + 1 && x < ox + TILE - 1 && y > oy + 1 && y < oy + TILE - 1;
}

function isCoordinateFarFromPlayer(x, y, minDistance = 4.0) {
  const dx = x - posX;
  const dy = y - posY;
  return Math.sqrt(dx * dx + dy * dy) >= minDistance;
}

function isCoordinateNotObscuredByPillars(x, y, tile) {
  if (!tile || !tile.variety) return true; // No pillars to check
  
  const tile_origin = tile_positions.get(tile);
  if (!tile_origin) return true;
  
  const [ox, oy] = tile_origin;
  
  if (tile.variety === 'center') {
    // Check against center 5x5 pillar
    const px = (ox + (TILE/2)|0) - 2;
    const py = (oy + (TILE/2)|0) - 2;
    const pillarX1 = px, pillarY1 = py;
    const pillarX2 = px + 5, pillarY2 = py + 5;
    
    // Check if coordinate is inside pillar area (with small buffer)
    return !(x >= pillarX1 - 0.5 && x < pillarX2 + 0.5 && y >= pillarY1 - 0.5 && y < pillarY2 + 0.5);
  } else if (tile.variety === 'corners') {
    // Check against four 2x2 corner pillars
    const offsets = [
      [4, 4],
      [TILE - 6, 4],
      [4, TILE - 6],
      [TILE - 6, TILE - 6]
    ];
    
    for (const [dx, dy] of offsets) {
      const pillarX1 = ox + dx;
      const pillarY1 = oy + dy;
      const pillarX2 = pillarX1 + 2;
      const pillarY2 = pillarY1 + 2;
      
      // Check if coordinate is inside this pillar area (with small buffer)
      if (x >= pillarX1 - 0.5 && x < pillarX2 + 0.5 && y >= pillarY1 - 0.5 && y < pillarY2 + 0.5) {
        return false;
      }
    }
  }
  
  return true;
}

function generateRandomSpawnCoordinate(tile_origin) {
  const [ox, oy] = tile_origin;
  // Generate random coordinate within room bounds (excluding walls)
  const x = ox + 2 + Math.random() * (TILE - 4);
  const y = oy + 2 + Math.random() * (TILE - 4);
  return [x, y];
}

function attemptSpawnEnemy(tile, isRanged) {
  const tile_origin = tile_positions.get(tile);
  if (!tile_origin) return null;
  
  const MAX_ATTEMPTS = 50; // Prevent infinite loops
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [x, y] = generateRandomSpawnCoordinate(tile_origin);
    
    // Check all three conditions
    if (isCoordinateInsideRoom(x, y, tile_origin) &&
        isCoordinateFarFromPlayer(x, y, 7.0) &&
        isCoordinateNotObscuredByPillars(x, y, tile)) {
      
      // Valid spawn location found, create enemy
      if (isRanged) {
        // Ranged enemy progression: follows normal enemy timeline but starts after room 12
        let maxRangedDifficulty = 0;
        if (roomsCleared >= 12) {
          // Map rooms 12+ to 0-12 timeline for progression calculation
          const progressionRooms = roomsCleared - 12;
          maxRangedDifficulty = Math.min(1.0, progressionRooms / 12.0);
        } else {
          return null; // No ranged enemies before room 12
        }
        
        const difficulty = Math.random() * maxRangedDifficulty;
        const color = enemyColorForDifficulty(difficulty);
        const fireRate = getRangedEnemyFireRate(difficulty);
        const speed = enemySpeedForDifficulty(difficulty); // Use same speed scaling as normal enemies
        const tint = makeTintedEnemyCanvas(color, true);
        const flashCanvas = makeWhiteFlashCanvas(true);
        
        // Prevent firing for first 3 seconds after spawn
        const now = performance.now() / 1000;
        return {
          tile,
          x,
          y,
          anim: 0,
          flip: false,
          color,
          speed,
          difficulty,
          canvas: tint,
          flashCanvas,
          state: 'alive',
          type: 'ranged',
          lastShotTime: now + 3.0, // <-- cannot fire for first 3 seconds
          fireRate,
          telegraphStart: -1,
          isTelegraphing: false
        };
      } else {
        // Normal enemy progression: random difficulty based on rooms cleared
        // Max difficulty reaches 1.0 at 12 rooms cleared (green to red progression)
        const maxNormalDifficulty = Math.min(1.0, roomsCleared / 12.0);
        const difficulty = Math.random() * Math.max(0.05, maxNormalDifficulty);
        const color = enemyColorForDifficulty(difficulty);
        const speed = enemySpeedForDifficulty(difficulty);
        const tint = makeTintedEnemyCanvas(color, false);
        
        return {
          tile,
          x,
          y,
          anim: 0,
          flip: false,
          color,
          speed,
          difficulty,
          canvas: tint,
          state: 'alive',
          type: 'normal'
        };
      }
    }
  }
  
  // Failed to find valid spawn location after max attempts
  return null;
}

function progressAfterStateChange(wasKill) {
  clears++;
  if (wasKill) { kills++; updateKillsUI(); }
}

function killEnemy(e) {
  if (e.state !== 'alive') return;
  e.state = 'killed';
  
  // Award credits based on enemy type and difficulty
  let creditValue;
  if (e.type === 'ranged') {
    // Ranged: 60 credits for green (difficulty 0) to 120 credits for red (difficulty 1)
    creditValue = Math.round(60 + (e.difficulty * 60));
  } else {
    // Normal: 50 credits for green (difficulty 0) to 100 credits for red (difficulty 1)
    creditValue = Math.round(50 + (e.difficulty * 50));
  }
  
  credits += creditValue;
  updateCreditsUI();
  
  progressAfterStateChange(true);
  
  // Check if all enemies in this tile are defeated
  checkAndUpdateExitBlocks(e.tile);
}

function despawnEnemy(e) {
  if (e.state !== 'alive') return;
  e.state = 'spent';
  progressAfterStateChange(false);
  
  // Check if all enemies in this tile are defeated
  checkAndUpdateExitBlocks(e.tile);
}

function despawnEnemiesInTile(tile) {
  for (const e of enemies) if (e.tile === tile && e.state === 'alive') despawnEnemy(e);
  // Prune non-alive from active list
  enemies = enemies.filter(e => e.state === 'alive');
  
  // Remove any remaining blocks for this tile
  if (tile) {
    tile.hasActiveEnemies = false;
    removeExitBlocks(tile);
  }
}

function checkAndUpdateExitBlocks(tile) {
  if (!tile || !tile.hasActiveEnemies) return;
  
  // Count alive enemies in this tile
  const aliveCount = enemies.filter(e => e.tile === tile && e.state === 'alive').length;
  
  if (aliveCount === 0) {
    // All enemies defeated, remove blocks
    tile.hasActiveEnemies = false;
    removeExitBlocks(tile);
    
    // Increment rooms cleared counter
    roomsCleared++;
    updateRoomsUI();
  }
}

function getEnemyCountForRoom(roomsCleared) {
  let minCount, maxCount;
  
  if (roomsCleared <= 4) {
    minCount = 1; maxCount = 2;
  } else if (roomsCleared <= 9) {
    minCount = 2; maxCount = 3;
  } else if (roomsCleared <= 14) {
    minCount = 2; maxCount = 4;
  } else if (roomsCleared <= 18) {
    minCount = 3; maxCount = 5;
  } else if (roomsCleared <= 24) {
    minCount = 4; maxCount = 6;
  } else if (roomsCleared <= 29) {
    minCount = 5; maxCount = 7;
  } else if (roomsCleared <= 36) {
    minCount = 6; maxCount = 8;
  } else if (roomsCleared <= 40) {
    minCount = 7; maxCount = 9;
  } else if (roomsCleared <= 50) {
    minCount = 8; maxCount = 10;
  } else if (roomsCleared <= 60) {
    minCount = 9; maxCount = 11;
  } else if (roomsCleared <= 70) {
    minCount = 10; maxCount = 12;
  } else if (roomsCleared <= 80) {
    minCount = 11; maxCount = 13;
  } else {
    // For rooms beyond 80, continue the pattern: every 10 rooms shifts the range by 1
    const tierBeyond80 = Math.floor((roomsCleared - 81) / 10) + 1;
    minCount = 11 + tierBeyond80;
    maxCount = 13 + tierBeyond80;
  }
  
  // Return random count within the range
  return minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
}

function maybeSpawnEnemiesFor(tile) {
  if (!isRoom(tile) || tile.isStart || tile.spawned) return;
  tile.spawned = true;

  // Get enemy count based on progression (replaced fixed 1-5 random)
  const count = getEnemyCountForRoom(roomsCleared);

  // Check if ranged enemies should be introduced (at 12 rooms cleared)
  const canSpawnRanged = roomsCleared >= 12;

  for (let i = 0; i < count; i++) {
    // Determine enemy type
    let isRanged = false;
    if (canSpawnRanged && Math.random() < 0.4) { // 40% chance for ranged when unlocked
      isRanged = true;
    }
    
    const enemy = attemptSpawnEnemy(tile, isRanged);
    if (enemy) {
      enemies.push(enemy);
    }
    // If enemy is null, spawn failed but we continue trying to spawn remaining enemies
  }
  
  // Mark tile as having active enemies and create exit blocks only if enemies were spawned
  if (enemies.some(e => e.tile === tile)) {
    tile.hasActiveEnemies = true;
    createExitBlocks(tile);
  }
}

function updateEnemies(dt) {
  if (!enemies.length) return;
  const currentTime = performance.now() / 1000;
  
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.state !== 'alive') continue;

    // Update animation
    e.anim += dt;
    e.flip = Math.sin(e.anim * 8.0) > 0;
    
    if (e.type === 'ranged') {
      // Ranged enemy behavior
      const dx = posX - e.x, dy = posY - e.y;
      const dist = Math.hypot(dx, dy);
      
      // Movement (same as normal enemies but fixed speed)
      if (dist > 1e-4) {
        const step = e.speed * dt;
        const ux = dx / dist, uy = dy / dist;
        const nx = e.x + ux * step, ny = e.y + uy * step;
        if (can_move(nx, e.y)) e.x = nx;
        if (can_move(e.x, ny)) e.y = ny;
      }
      
      // Shooting logic
      if (!e.isTelegraphing && currentTime - e.lastShotTime >= e.fireRate) {
        // Start telegraphing
        e.isTelegraphing = true;
        e.telegraphStart = currentTime;
      }
      
      if (e.isTelegraphing) {
        const telegraphTime = currentTime - e.telegraphStart;
        if (telegraphTime >= TELEGRAPH_DURATION) {
          // Fire projectile
          if (dist > 1e-4) {
            const ux = dx / dist, uy = dy / dist;
            enemyShots.push({
              x: e.x,
              y: e.y,
              vx: ux * ENEMY_SHOT_SPEED,
              vy: uy * ENEMY_SHOT_SPEED,
              t: 0
            });
          }
          e.lastShotTime = currentTime;
          e.isTelegraphing = false;
          e.telegraphStart = -1;
        }
      }
      
      // Collision with player
      if (dist < (PLAYER_RADIUS + ENEMY_RADIUS)) triggerGameOver();
    } else {
      // Normal enemy behavior (unchanged)
      const dx = posX - e.x, dy = posY - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-4) {
        const step = e.speed * dt;
        const ux = dx / dist, uy = dy / dist;
        const nx = e.x + ux * step, ny = e.y + uy * step;
        if (can_move(nx, e.y)) e.x = nx;
        if (can_move(e.x, ny)) e.y = ny;
      }

      if (dist < (PLAYER_RADIUS + ENEMY_RADIUS)) {
        if (!debugGodMode) triggerGameOver();
      }
    }
  }

  // Shot collisions (player shots vs enemies)
  for (let si = shots.length - 1; si >= 0; si--) {
    const s = shots[si];
    let hit = false;
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (e.state !== 'alive') continue;
      const d2 = (s.x - e.x) ** 2 + (s.y - e.y) ** 2;
      if (d2 < ENEMY_RADIUS * ENEMY_RADIUS) {
        killEnemy(e);
        hit = true;
      }
    }
    if (hit) shots.splice(si,  1);
  }

  // Remove dead/spent enemies from list
  enemies = enemies.filter(e => e.state === 'alive');
}

// Replace drawEnemies with depth-sorted rendering
function drawEnemies(zBuf) {
  // Collect alive, drawable enemies with distance
  const list = [];
  const currentTime = performance.now() / 1000;
  
  for (const e of enemies) {
    if (e.state === 'alive' && e.canvas) {
      const d = (e.x - posX) * (e.x - posX) + (e.y - posY) * (e.y - posY);
      list.push({ e, d });
    }
  }
  // Sort far → near so near overwrites
  list.sort((a,b) => b.d - a.d);

  for (const { e } of list) {
    const relX = e.x - posX;
    const relY = e.y - posY;
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const transX = invDet * ( dirY * relX - dirX * relY);
    const transY = invDet * (-planeY * relX + planeX * relY);
    if (transY <= 0.0001) continue;

    const screenX = (W / 2) * (1 + transX / transY);
    const spriteH = Math.abs((H / transY) * ENEMY_SCALE);
    const aspect = e.canvas.width / e.canvas.height;
    const spriteW = spriteH * aspect;
    const drawStartY = Math.max(0, ((-spriteH / 2 + HALF_H) | 0));
    const drawEndY   = Math.min(H - 1, ((spriteH / 2 + HALF_H) | 0));
    const drawStartX = Math.max(0, ((-spriteW / 2 + screenX) | 0));
    const drawEndX   = Math.min(W - 1, ((spriteW / 2 + screenX) | 0));

    // Determine which canvas to use (normal, flashing, or telegraph)
    let drawCanvas = e.canvas;
    if (e.type === 'ranged' && e.isTelegraphing && e.flashCanvas) {
      const telegraphTime = currentTime - e.telegraphStart;
      // Flash twice during
      const flashCycle = (telegraphTime / FLASH_INTERVAL) % 2;
      if (flashCycle < 1) {
        drawCanvas = e.flashCanvas; // White flash
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
  }
}

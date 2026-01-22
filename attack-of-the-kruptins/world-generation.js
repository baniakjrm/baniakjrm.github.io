// Attack of The Kruptins - World Generation and Tile System

// Tile/grid settings
const TILE = 18, DOOR_W = 4, PATH_W = 3, BORDER = 2;
const GRID_SIDE = 3; // 3x3 grid: center + neighbors

// World data
let WORLD = [];
let WORLD_W = 0, WORLD_H = 0;

// Directions: 0=N,1=E,2=S,3=W
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const left_of = d => (d + 3) % 4, right_of = d => (d + 1) % 4, opposite = d => (d + 2) % 4;

// Colors
const SKY = [0,0,0], FLOOR = [0,0,0];
const WALL_COLOR = new Map(); // id -> [r,g,b]
const BOUNDARY_ID = 7;
WALL_COLOR.set(BOUNDARY_ID, [0,0,0]);

// Add gray color for blocking walls
const BLOCK_COLOR_ID = 999;
WALL_COLOR.set(BLOCK_COLOR_ID, [128, 128, 128]); // Gray color

// Store blocking wall positions for collision detection
let blockingWalls = new Map(); // tile -> array of {x, y, side} wall positions

class Tile {
  constructor(orient_dir, kind, open_sides, wall_id, color, label) {
    this.orient_dir = orient_dir;
    this.kind = kind;
    this.open_sides = new Set(open_sides);
    this.wall_id = wall_id;
    this.color = color;
    this.label = label;
    this.neighbors = new Map();
    // Enemy lifecycle for this tile: undefined -> (alive) -> killed/spent
    this.enemyState = undefined; // (legacy single-enemy state, no longer used)
    this.spawned = false;        // new: prevents multiple spawn waves
    this.exitBlocks = new Map(); // side -> true if blocked
    this.hasActiveEnemies = false; // tracks if enemies are active in this tile
    this.variety = null; // 'center' or 'corners' for room3/dead
  }
}

let current_tile = null, prev_tile = null;
const tile_positions = new Map();
let wall_id_counter = 10;

function hsvToRgb(h, s, v) {
  let r=0, g=0, b=0;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [ (r*255)|0, (g*255)|0, (b*255)|0 ];
}
const rand_rainbow = () => { const h = Math.random(), s = 0.9, v = 1.0; return hsvToRgb(h,s,v); };

function next_wall_id_with_color() {
  const wid = wall_id_counter++;
  const color = rand_rainbow();
  WALL_COLOR.set(wid, color);
  return [wid, color];
}

function generate_tile(orient_dir) {
  const kinds = ['room3', 'dead', 'straight', 'Lleft', 'Lright'];
  const weights = [0.30, 0.12, 0.28, 0.15, 0.15];
  let r = Math.random(), acc = 0, kind = kinds[0];
  for (let i=0;i<kinds.length;i++) { acc += weights[i]; if (r <= acc) { kind = kinds[i]; break; } }
  const forward = opposite(orient_dir), L = left_of(orient_dir), R = right_of(orient_dir);

  let open_sides, exits_label;
  if (kind === 'room3') { open_sides = new Set([orient_dir, forward, L, R]); exits_label = '3 exits'; }
  else if (kind === 'dead') { open_sides = new Set([orient_dir]); exits_label = 'dead end'; }
  else if (kind === 'straight') { open_sides = new Set([orient_dir, forward]); exits_label = 'straight'; }
  else if (kind === 'Lleft') { open_sides = new Set([orient_dir, L]); exits_label = 'L-left'; }
  else if (kind === 'Lright') { open_sides = new Set([orient_dir, R]); exits_label = 'L-right'; }
  else { open_sides = new Set([orient_dir]); exits_label = '?'; }

  const [wid, color] = next_wall_id_with_color();
  const label = `${kind} (${exits_label})`;
  const tile = new Tile(orient_dir, kind, open_sides, wid, color, label);

  // Assign room variety for room3/dead (not for start room)
  if ((kind === 'room3' || kind === 'dead')) {
    tile.variety = (Math.random() < 0.5) ? 'center' : 'corners';
  }
  return tile;
}

function empty_world() {
  WORLD_W = BORDER * 2 + TILE * GRID_SIDE;
  WORLD_H = WORLD_W;
  WORLD = new Array(WORLD_H);
  for (let y=0; y<WORLD_H; y++) WORLD[y] = new Array(WORLD_W).fill(0);
  for (let x=0; x<WORLD_W; x++) { WORLD[0][x] = BOUNDARY_ID; WORLD[WORLD_H-1][x] = BOUNDARY_ID; }
  for (let y=0; y<WORLD_H; y++) { WORLD[y][0] = BOUNDARY_ID; WORLD[y][WORLD_W-1] = BOUNDARY_ID; }
}

function carve_door(edge, ox, oy) {
  const cx = (ox + (TILE/2)|0), cy = (oy + (TILE/2)|0), half = (DOOR_W/2)|0;
  if (edge === 0) { const y = oy; for (let i=-half; i<=half; i++) WORLD[y][cx + i] = 0; }
  else if (edge === 2) { const y = oy + TILE - 1; for (let i=-half; i<=half; i++) WORLD[y][cx + i] = 0; }
  else if (edge === 1) { const x = ox + TILE - 1; for (let i=-half; i<=half; i++) WORLD[cy + i][x] = 0; }
  else if (edge === 3) { const x = ox; for (let i=-half; i<=half; i++) WORLD[cy + i][x] = 0; }
}

function draw_border_box(ox, oy, wid) {
  for (let x=ox; x<ox+TILE; x++) { WORLD[oy][x] = wid; WORLD[oy + TILE - 1][x] = wid; }
  for (let y=oy; y<oy+TILE; y++) { WORLD[y][ox] = wid; WORLD[y][ox + TILE - 1] = wid; }
}

function fill_interior(ox, oy, wid) {
  for (let y=oy+1; y<oy+TILE-1; y++) for (let x=ox+1; x<ox+TILE-1; x++) WORLD[y][x] = wid;
}

function carve_rect(x0, y0, x1, y1) {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  x0 = Math.max(1, x0); y0 = Math.max(1, y0);
  x1 = Math.min(WORLD_W-2, x1); y1 = Math.min(WORLD_H-2, y1);
  for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) WORLD[y][x] = 0;
}

function build_room(ox, oy, tile) {
  draw_border_box(ox, oy, tile.wall_id);
  // --- Add pillars for cover ---
  if (tile.variety === 'center') {
    // Center 5x5 pillar
    const px = (ox + (TILE/2)|0) - 2;
    const py = (oy + (TILE/2)|0) - 2;
    for (let y = py; y < py + 5; y++) {
      for (let x = px; x < px + 5; x++) {
        WORLD[y][x] = tile.wall_id;
      }
    }
  } else if (tile.variety === 'corners') {
    // Four 2x2 pillars near corners, moved 2 units closer to center
    // Offset from wall: 4 tiles (was 2)
    const offsets = [
      [4, 4],
      [TILE - 6, 4],
      [4, TILE - 6],
      [TILE - 6, TILE - 6]
    ];
    for (const [dx, dy] of offsets) {
      for (let y = oy + dy; y < oy + dy + 2; y++) {
        for (let x = ox + dx; x < ox + dx + 2; x++) {
          WORLD[y][x] = tile.wall_id;
        }
      }
    }
  }
  for (const side of tile.open_sides) carve_door(side, ox, oy);
}

function build_hall_straight(ox, oy, tile) {
  draw_border_box(ox, oy, tile.wall_id);
  fill_interior(ox, oy, tile.wall_id);
  const cx = (ox + (TILE/2)|0), cy = (oy + (TILE/2)|0);
  if (tile.orient_dir === 0 || tile.orient_dir === 2) carve_rect(cx - (PATH_W>>1), oy+1, cx + (PATH_W>>1), oy + TILE - 2);
  else carve_rect(ox+1, cy - (PATH_W>>1), ox + TILE - 2, cy + (PATH_W>>1));
  for (const side of tile.open_sides) carve_door(side, ox, oy);
}

function build_hall_L(ox, oy, tile, turn_to) {
  draw_border_box(ox, oy, tile.wall_id);
  fill_interior(ox, oy, tile.wall_id);
  const cx = (ox + (TILE/2)|0), cy = (oy + (TILE/2)|0);
  if (tile.orient_dir === 0 || tile.orient_dir === 2) carve_rect(cx - (PATH_W>>1), oy+1, cx + (PATH_W>>1), cy);
  else carve_rect(ox+1, cy - (PATH_W>>1), cx, cy + (PATH_W>>1));
  if (turn_to === 0 || turn_to === 2) carve_rect(cx - (PATH_W>>1), cy, cx + (PATH_W>>1), oy + TILE - 2);
  else carve_rect(cx, cy - (PATH_W>>1), ox + TILE - 2, cy + (PATH_W>>1));
  for (const side of tile.open_sides) carve_door(side, ox, oy);
}

function build_tile_at(ox, oy, tile) {
  if (tile.kind === 'room3' || tile.kind === 'dead') build_room(ox, oy, tile);
  else if (tile.kind === 'straight') build_hall_straight(ox, oy, tile);
  else if (tile.kind === 'Lleft') build_hall_L(ox, oy, tile, left_of(tile.orient_dir));
  else if (tile.kind === 'Lright') build_hall_L(ox, oy, tile, right_of(tile.orient_dir));
  else build_room(ox, oy, tile);
}

function grid_origin(tx, ty) { return [BORDER + tx * TILE, BORDER + ty * TILE]; }

function createExitBlocks(tile) {
  if (!tile || !isRoom(tile)) return;
  
  const origin = tile_positions.get(tile);
  if (!origin) return;
  
  const [ox, oy] = origin;
  const blocks = [];
  
  // Create blocks outside each exit (slightly beyond the door)
  for (const side of tile.open_sides) {
    const cx = ox + (TILE / 2) | 0;
    const cy = oy + (TILE / 2) | 0;
    const r = (DOOR_W / 2) | 0;
    const BLOCK_OFFSET = 2; // Distance outside the room
    
    let blockPositions = [];
    
    if (side === 0) { // North exit
      const blockY = oy - BLOCK_OFFSET;
      for (let i = -r; i <= r; i++) {
        const blockX = cx + i;
        if (blockX >= 0 && blockX < WORLD_W && blockY >= 0 && blockY < WORLD_H) {
          blockPositions.push({x: blockX, y: blockY, side});
        }
      }
    } else if (side === 2) { // South exit
      const blockY = oy + TILE - 1 + BLOCK_OFFSET;
      for (let i = -r; i <= r; i++) {
        const blockX = cx + i;
        if (blockX >= 0 && blockX < WORLD_W && blockY >= 0 && blockY < WORLD_H) {
          blockPositions.push({x: blockX, y: blockY, side});
        }
      }
    } else if (side === 1) { // East exit
      const blockX = ox + TILE - 1 + BLOCK_OFFSET;
      for (let i = -r; i <= r; i++) {
        const blockY = cy + i;
        if (blockX >= 0 && blockX < WORLD_W && blockY >= 0 && blockY < WORLD_H) {
          blockPositions.push({x: blockX, y: blockY, side});
        }
      }
    } else if (side === 3) { // West exit
      const blockX = ox - BLOCK_OFFSET;
      for (let i = -r; i <= r; i++) {
        const blockY = cy + i;
        if (blockX >= 0 && blockX < WORLD_W && blockY >= 0 && blockY < WORLD_H) {
          blockPositions.push({x: blockX, y: blockY, side});
        }
      }
    }
    
    blocks.push(...blockPositions);
  }
  
  blockingWalls.set(tile, blocks);
  
  // Actually place the blocks in the world
  for (const block of blocks) {
    WORLD[block.y][block.x] = BLOCK_COLOR_ID;
  }
  
  // Mark exits as blocked
  for (const side of tile.open_sides) {
    tile.exitBlocks.set(side, true);
  }
}

function removeExitBlocks(tile) {
  if (!tile) return;
  
  const blocks = blockingWalls.get(tile);
  if (!blocks) return;
  
  // Remove blocks from world
  for (const block of blocks) {
    if (block.x >= 0 && block.x < WORLD_W && block.y >= 0 && block.y < WORLD_H) {
      WORLD[block.y][block.x] = 0;
    }
  }
  
  // Clear blocking state
  tile.exitBlocks.clear();
  blockingWalls.delete(tile);
}

function rebuild_world(center, prev, back_side) {
  empty_world();
  tile_positions.clear();
  blockingWalls.clear(); // Clear blocking walls when rebuilding

  const [cx, cy] = grid_origin(1,1);
  build_tile_at(cx, cy, center);
  tile_positions.set(center, [cx, cy]);

  if (prev && back_side !== null && back_side !== undefined) {
    const tx = 1 + DX[back_side], ty = 1 + DY[back_side];
    if (0 <= tx && tx < GRID_SIDE && 0 <= ty && ty < GRID_SIDE) {
      const [ox, oy] = grid_origin(tx, ty);
      build_tile_at(ox, oy, prev);
      tile_positions.set(prev, [ox, oy]);
    }
  }
  for (const [side, neigh] of center.neighbors.entries()) {
    const tx = 1 + DX[side], ty = 1 + DY[side];
    if (0 <= tx && tx < GRID_SIDE && 0 <= ty && ty < GRID_SIDE) {
      const [ox, oy] = grid_origin(tx, ty);
      build_tile_at(ox, oy, neigh);
      tile_positions.set(neigh, [ox, oy]);
    }
  }
  
  // Recreate exit blocks for tiles with active enemies
  for (const [tile, origin] of tile_positions.entries()) {
    if (tile.hasActiveEnemies) {
      createExitBlocks(tile);
    }
  }
}

function generate_neighbors_for_center(center, back_side) {
  center.neighbors.clear();
  for (const side of center.open_sides) {
    if (back_side !== null && back_side !== undefined && side === back_side) continue;
    const neigh = generate_tile(opposite(side));
    center.neighbors.set(side, neigh);
  }
}

function back_side_of_current() {
  if (!prev_tile) return null;
  const c = tile_positions.get(current_tile), p = tile_positions.get(prev_tile);
  if (!c || !p) return null;
  const [cox, coy] = c, [pox, poy] = p;
  const dx = ((pox - cox) / TILE) | 0, dy = ((poy - coy) / TILE) | 0;
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return null;
}

function can_move(nx, ny) {
  const xi = nx | 0, yi = ny | 0;
  if (yi < 0 || yi >= WORLD_H || xi < 0 || xi >= WORLD_W) return false;
  return WORLD[yi][xi] === 0;
}

function which_tile_contains(x, y) {
  for (const [t, origin] of tile_positions.entries()) {
    const [ox, oy] = origin;
    if (ox < x && x < ox + TILE - 1 && oy < y && y < oy + TILE - 1) {
      if (t === current_tile) return [t, null];
      const [cox, coy] = tile_positions.get(current_tile);
      const dx = ((ox - cox) / TILE) | 0, dy = ((oy - coy) / TILE) | 0;
      let d = null;
      if (dx === 0 && dy === -1) d = 0;
      else if (dx === 1 && dy === 0) d = 1;
      else if (dx === 0 && dy === 1) d = 2;
      else if (dx === -1 && dy === 0) d = 3;
      
      // Check if the exit in this direction is blocked
      if (d !== null && current_tile.exitBlocks && current_tile.exitBlocks.has(d)) {
        return [null, null]; // Prevent transition if exit is blocked
      }
      
      return [t, d];
    }
  }
  return [null, null];
}

const isRoom = (tile) => tile && (tile.kind === 'room3' || tile.kind === 'dead' || tile.kind === 'start');

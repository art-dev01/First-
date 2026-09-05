"use strict";

// Simulation uses world units, independently of screen size and rendering.
function createTankEngine() {
  const WORLD = { width: 1600, height: 1040, border: 64 };
  const RADIUS = 25;
  const CELL = 40;
  const FIRE_DELAY = 0.42;
  const SPAWNS = [
    [160, 160],
    [1440, 160],
    [800, 140],
    [150, 850],
    [1450, 850],
    [520, 460],
    [1080, 460],
    [800, 650],
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function angleDifference(target, current) {
    return Math.atan2(Math.sin(target - current), Math.cos(target - current));
  }

  function approach(value, target, delta) {
    return value + clamp(target - value, -delta, delta);
  }

  function turnToward(current, target, speed) {
    return current + clamp(angleDifference(target, current), -speed, speed);
  }

  function random(state) {
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function createObstacles() {
    return [
      { x: 260, y: 210, w: 240, h: 80, height: 38, kind: "container", color: "rust" },
      { x: 1100, y: 210, w: 240, h: 80, height: 38, kind: "container", color: "green" },
      { x: 690, y: 230, w: 220, h: 70, height: 24, kind: "bunker" },
      { x: 260, y: 490, w: 100, h: 180, height: 34, kind: "container", color: "green" },
      { x: 1240, y: 490, w: 100, h: 180, height: 34, kind: "container", color: "rust" },
      { x: 660, y: 480, w: 280, h: 100, height: 35, kind: "bunker" },
      { x: 450, y: 750, w: 150, h: 80, height: 28, kind: "crates" },
      { x: 1000, y: 750, w: 150, h: 80, height: 28, kind: "crates" },
    ];
  }

  function makeTank(id, x, y, team, heavy = false) {
    const hp = team === "player" ? 100 : heavy ? 136 : 68;
    return {
      id,
      x,
      y,
      team,
      heavy,
      radius: RADIUS,
      angle: -Math.PI / 2,
      turret: -Math.PI / 2,
      speed: 0,
      hp,
      maxHp: hp,
      cooldown: 0,
      shield: 0,
      recoil: 0,
      hitFlash: 0,
      path: [],
      pathTimer: 0,
      thinkTimer: 0,
      tread: 0,
      stuckTime: 0,
    };
  }

  function createGame(seed = Date.now()) {
    const state = {
      mode: "ready",
      seed: seed >>> 0,
      time: 0,
      wave: 1,
      kills: 0,
      score: 0,
      obstacles: createObstacles(),
      bots: [],
      bullets: [],
      pickups: [],
      wrecks: [],
      events: [],
      player: makeTank(0, 800, 880, "player"),
      waveTimer: -1,
      nextId: 1,
    };
    spawnWave(state);
    state.events.length = 0;
    return state;
  }

  function circleHitsBox(x, y, radius, box) {
    const dx = x - clamp(x, box.x, box.x + box.w);
    const dy = y - clamp(y, box.y, box.y + box.h);
    return dx * dx + dy * dy < radius * radius;
  }

  function isOpen(state, x, y, radius = RADIUS) {
    return (
      x >= WORLD.border + radius &&
      x <= WORLD.width - WORLD.border - radius &&
      y >= WORLD.border + radius &&
      y <= WORLD.height - WORLD.border - radius &&
      !state.obstacles.some((box) => circleHitsBox(x, y, radius, box))
    );
  }

  function occupied(state, x, y, tank) {
    return [state.player, ...state.bots].some(
      (other) =>
        other.id !== tank.id &&
        other.hp > 0 &&
        Math.hypot(other.x - x, other.y - y) < other.radius + tank.radius,
    );
  }

  function moveTank(state, tank, dx, dy) {
    const x = clamp(
      tank.x + dx,
      WORLD.border + tank.radius,
      WORLD.width - WORLD.border - tank.radius,
    );
    const y = clamp(
      tank.y + dy,
      WORLD.border + tank.radius,
      WORLD.height - WORLD.border - tank.radius,
    );
    if (isOpen(state, x, tank.y, tank.radius) && !occupied(state, x, tank.y, tank)) {
      tank.x = x;
    }
    if (isOpen(state, tank.x, y, tank.radius) && !occupied(state, tank.x, y, tank)) {
      tank.y = y;
    }
  }

  // Slab intersection: returns the first contact along the entire bullet segment.
  function segmentBox(x1, y1, x2, y2, box, padding = 0) {
    let near = 0;
    let far = 1;
    const dimensions = [
      [x1, x2 - x1, box.x - padding, box.x + box.w + padding],
      [y1, y2 - y1, box.y - padding, box.y + box.h + padding],
    ];
    for (const [origin, delta, min, max] of dimensions) {
      if (Math.abs(delta) < 0.000001) {
        if (origin < min || origin > max) {
          return null;
        }
      } else {
        const a = (min - origin) / delta;
        const b = (max - origin) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) {
          return null;
        }
      }
    }
    return near;
  }

  function segmentCircle(x1, y1, x2, y2, target, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ox = x1 - target.x;
    const oy = y1 - target.y;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) {
      return 0;
    }
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const discriminant = b * b - 4 * a * c;
    if (a === 0 || discriminant < 0) {
      return null;
    }
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  function hasLineOfSight(state, from, to, padding = 2) {
    return !state.obstacles.some(
      (box) => segmentBox(from.x, from.y, to.x, to.y, box, padding) !== null,
    );
  }

  // Breadth-first navigation on an inflated obstacle grid keeps bots out of walls.
  function findPath(state, from, to) {
    const cols = WORLD.width / CELL;
    const rows = WORLD.height / CELL;
    const startX = clamp(Math.floor(from.x / CELL), 0, cols - 1);
    const startY = clamp(Math.floor(from.y / CELL), 0, rows - 1);
    const endX = clamp(Math.floor(to.x / CELL), 0, cols - 1);
    const endY = clamp(Math.floor(to.y / CELL), 0, rows - 1);
    const start = startY * cols + startX;
    const goal = endY * cols + endX;
    const previous = new Int32Array(cols * rows).fill(-1);
    const queue = [start];
    previous[start] = start;
    let nearest = start;
    let nearestDistance = Infinity;
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head];
      const cx = cell % cols;
      const cy = Math.floor(cell / cols);
      const distance = Math.abs(cx - endX) + Math.abs(cy - endY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = cell;
      }
      if (cell === goal) {
        break;
      }
      for (const [ox, oy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nx = cx + ox;
        const ny = cy + oy;
        const next = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || previous[next] !== -1) {
          continue;
        }
        if (!isOpen(state, nx * CELL + CELL / 2, ny * CELL + CELL / 2, RADIUS + 3)) {
          continue;
        }
        previous[next] = cell;
        queue.push(next);
      }
    }
    const path = [];
    let cell = nearest;
    while (cell !== start && previous[cell] !== -1) {
      path.push({
        x: (cell % cols) * CELL + CELL / 2,
        y: Math.floor(cell / cols) * CELL + CELL / 2,
      });
      cell = previous[cell];
    }
    return path.reverse();
  }

  function spawnWave(state) {
    const count = Math.min(3 + state.wave - 1, 8);
    state.bots = [];
    for (let index = 0; index < count; index += 1) {
      const candidates = SPAWNS.map(([x, y]) => ({ x, y })).filter(
        (point) =>
          isOpen(state, point.x, point.y) &&
          Math.hypot(point.x - state.player.x, point.y - state.player.y) > 280 &&
          !state.bots.some((bot) => Math.hypot(bot.x - point.x, bot.y - point.y) < 80),
      );
      let spawn = candidates[index % Math.max(1, candidates.length)];
      if (!spawn) {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const point = { x: 100 + random(state) * 1400, y: 100 + random(state) * 840 };
          if (
            isOpen(state, point.x, point.y) &&
            Math.hypot(point.x - state.player.x, point.y - state.player.y) > 280 &&
            !state.bots.some((bot) => Math.hypot(bot.x - point.x, bot.y - point.y) < 80)
          ) {
            spawn = point;
            break;
          }
        }
      }
      if (!spawn) {
        continue;
      }
      const tank = makeTank(
        state.nextId++,
        spawn.x,
        spawn.y,
        "enemy",
        state.wave >= 3 && index % 3 === 0,
      );
      tank.angle = Math.atan2(state.player.y - tank.y, state.player.x - tank.x);
      tank.turret = tank.angle;
      tank.cooldown = 1.5 + random(state) * 1.5;
      tank.shield = 1;
      state.bots.push(tank);
    }
    state.bullets = [];
    state.player.shield = 2;
    state.waveTimer = -1;
    state.events.push({ type: "wave", wave: state.wave, count: state.bots.length });
  }

  function start(state) {
    if (state.mode === "ready") {
      state.mode = "playing";
      state.events.push({ type: "wave", wave: state.wave, count: state.bots.length });
    }
  }

  function shoot(state, tank) {
    if (tank.cooldown > 0 || tank.hp <= 0 || state.mode !== "playing") {
      return false;
    }
    tank.cooldown =
      tank.team === "player" ? FIRE_DELAY : (tank.heavy ? 2 : 1.6) + random(state) * 0.5;
    tank.recoil = 1;
    const angle = tank.turret;
    const muzzle = { x: tank.x + Math.cos(angle) * 46, y: tank.y + Math.sin(angle) * 46 };
    state.events.push({ type: "shot", x: muzzle.x, y: muzzle.y, angle, team: tank.team });
    if (!hasLineOfSight(state, tank, muzzle, 4)) {
      state.events.push({ type: "impact", x: muzzle.x, y: muzzle.y });
      return true;
    }
    state.bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      previousX: muzzle.x,
      previousY: muzzle.y,
      vx: Math.cos(angle) * (tank.team === "player" ? 760 : 460),
      vy: Math.sin(angle) * (tank.team === "player" ? 760 : 460),
      team: tank.team,
      damage: tank.team === "player" ? 34 : tank.heavy ? 14 : 9,
      life: 2.5,
    });
    return true;
  }

  function damageTank(state, tank, amount) {
    if (tank.shield > 0 || tank.hp <= 0) {
      return;
    }
    tank.hp = Math.max(0, tank.hp - amount);
    tank.hitFlash = 1;
    state.events.push({ type: "damage", x: tank.x, y: tank.y, team: tank.team });
    if (tank.hp > 0) {
      return;
    }
    state.events.push({ type: "explosion", x: tank.x, y: tank.y, team: tank.team });
    if (tank.team === "player") {
      state.mode = "gameover";
      state.events.push({ type: "gameover" });
    } else {
      state.kills += 1;
      state.score += tank.heavy ? 200 : 100;
      state.wrecks.push({ x: tank.x, y: tank.y, angle: tank.angle });
      if (state.wrecks.length > 24) {
        state.wrecks.shift();
      }
      if (state.kills % 2 === 0 && state.pickups.length < 3) {
        state.pickups.push({ x: tank.x, y: tank.y, life: 25 });
      }
    }
  }

  function updateBullets(state, dt) {
    const survivors = [];
    for (const bullet of state.bullets) {
      const x2 = bullet.x + bullet.vx * dt;
      const y2 = bullet.y + bullet.vy * dt;
      let contact = 2;
      let target = null;
      for (const box of state.obstacles) {
        const t = segmentBox(bullet.x, bullet.y, x2, y2, box, 3);
        if (t !== null && t < contact) {
          contact = t;
        }
      }
      const enemies = bullet.team === "player" ? state.bots : [state.player];
      for (const tank of enemies) {
        if (tank.hp <= 0) {
          continue;
        }
        const t = segmentCircle(bullet.x, bullet.y, x2, y2, tank, tank.radius + 3);
        if (t !== null && t < contact) {
          contact = t;
          target = tank;
        }
      }
      if (contact <= 1) {
        state.events.push({
          type: "impact",
          x: bullet.x + (x2 - bullet.x) * contact,
          y: bullet.y + (y2 - bullet.y) * contact,
        });
        if (target) {
          damageTank(state, target, bullet.damage);
        }
        continue;
      }
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x = x2;
      bullet.y = y2;
      bullet.life -= dt;
      if (
        x2 < WORLD.border ||
        x2 > WORLD.width - WORLD.border ||
        y2 < WORLD.border ||
        y2 > WORLD.height - WORLD.border
      ) {
        state.events.push({ type: "impact", x: x2, y: y2 });
      } else if (bullet.life > 0) {
        survivors.push(bullet);
      }
    }
    state.bullets = survivors;
  }

  function updateBot(state, bot, dt) {
    const player = state.player;
    const distance = Math.hypot(player.x - bot.x, player.y - bot.y);
    const visible = hasLineOfSight(state, bot, player);
    const directRoute = hasLineOfSight(state, bot, player, RADIUS + 5);
    bot.pathTimer -= dt;
    if (!directRoute && bot.pathTimer <= 0) {
      bot.path = findPath(state, bot, player);
      bot.pathTimer = 0.75 + random(state) * 0.35;
    }
    while (bot.path.length && Math.hypot(bot.path[0].x - bot.x, bot.path[0].y - bot.y) < 20) {
      bot.path.shift();
    }
    const destination = directRoute ? player : bot.path[0] || player;
    const travelAngle = Math.atan2(destination.y - bot.y, destination.x - bot.x);
    const error = angleDifference(travelAngle, bot.angle);
    bot.angle = turnToward(bot.angle, travelAngle, dt * 2.1);
    let speed = Math.abs(error) < 0.8 ? (bot.heavy ? 85 : 115) + Math.min(state.wave * 4, 30) : 0;
    if (visible && distance < 280) {
      speed = distance < 160 ? -65 : 0;
    }
    bot.speed = approach(bot.speed, speed, dt * 350);
    const oldX = bot.x;
    const oldY = bot.y;
    moveTank(
      state,
      bot,
      Math.cos(bot.angle) * bot.speed * dt,
      Math.sin(bot.angle) * bot.speed * dt,
    );
    const travelled = Math.hypot(bot.x - oldX, bot.y - oldY);
    bot.tread += travelled;
    bot.stuckTime = travelled < 0.1 && Math.abs(bot.speed) > 30 ? bot.stuckTime + dt : 0;
    if (bot.stuckTime > 0.7) {
      bot.pathTimer = 0;
      bot.angle += dt * 3;
      moveTank(state, bot, Math.cos(bot.angle) * 70 * dt, Math.sin(bot.angle) * 70 * dt);
    }
    const lead = Math.min(distance / 460, 0.6) * 0.45;
    const aim = Math.atan2(
      player.y + Math.sin(player.angle) * player.speed * lead - bot.y,
      player.x + Math.cos(player.angle) * player.speed * lead - bot.x,
    );
    bot.turret = turnToward(bot.turret, aim, dt * 1.8);
    if (
      visible &&
      distance < 730 &&
      Math.abs(angleDifference(aim, bot.turret)) < 0.13 &&
      bot.shield <= 0
    ) {
      shoot(state, bot);
    }
  }

  function step(state, input, delta) {
    if (state.mode !== "playing") {
      return;
    }
    const dt = clamp(delta, 0, 0.05);
    state.time += dt;
    const player = state.player;
    for (const tank of [player, ...state.bots]) {
      tank.cooldown = Math.max(0, tank.cooldown - dt);
      tank.shield = Math.max(0, tank.shield - dt);
      tank.recoil = Math.max(0, tank.recoil - dt * 6);
      tank.hitFlash = Math.max(0, tank.hitFlash - dt * 5);
    }
    player.angle += (input.turn || 0) * 2.65 * dt;
    const throttle = clamp(input.throttle || 0, -1, 1);
    player.speed = approach(player.speed, throttle * (throttle > 0 ? 240 : 150), dt * 620);
    moveTank(
      state,
      player,
      Math.cos(player.angle) * player.speed * dt,
      Math.sin(player.angle) * player.speed * dt,
    );
    player.tread += player.speed * dt;
    if (input.aim && Number.isFinite(input.aim.x) && Number.isFinite(input.aim.y)) {
      player.turret = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
    } else if (input.turret) {
      player.turret += input.turret * dt * 2.8;
    } else {
      player.turret = turnToward(player.turret, player.angle, dt * 4);
    }
    if (input.fire) {
      shoot(state, player);
    }
    for (const bot of state.bots) {
      if (bot.hp > 0) {
        updateBot(state, bot, dt);
      }
    }
    updateBullets(state, dt);
    state.bots = state.bots.filter((bot) => bot.hp > 0);
    if (state.mode !== "playing") {
      return;
    }
    state.pickups = state.pickups.filter((pickup) => {
      pickup.life -= dt;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 42 && player.hp < 100) {
        player.hp = Math.min(100, player.hp + 35);
        state.events.push({ type: "repair", x: player.x, y: player.y });
        return false;
      }
      return pickup.life > 0;
    });
    if (state.bots.length === 0) {
      if (state.waveTimer < 0) {
        state.waveTimer = 3;
        state.events.push({ type: "clear" });
      }
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.wave += 1;
        player.hp = Math.min(100, player.hp + 20);
        state.score += 50;
        spawnWave(state);
      }
    }
  }

  return {
    WORLD,
    RADIUS,
    FIRE_DELAY,
    createGame,
    start,
    step,
    shoot,
    damageTank,
    findPath,
    isOpen,
    moveTank,
    segmentBox,
    segmentCircle,
    hasLineOfSight,
    clamp,
    angleDifference,
  };
}

const TankEngine = createTankEngine();
if (typeof module !== "undefined" && module.exports) {
  module.exports = TankEngine;
}

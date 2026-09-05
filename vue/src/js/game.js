"use strict";

function initializeTankGame() {
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d", { alpha: false });
  const ui = {};
  for (const id of [
    "overlay",
    "overlay-title",
    "overlay-description",
    "overlay-eyebrow",
    "overlay-hint",
    "play-button",
    "play-label",
    "restart-button",
    "pause-button",
    "sound-button",
    "sound-symbol",
    "briefing-controls",
    "wave-value",
    "kills-value",
    "score-value",
    "enemy-value",
    "health-value",
    "health-bar",
    "health-fill",
    "weapon-label",
    "reload-fill",
    "announcement",
    "damage-flash",
    "touch-controls",
  ]) {
    ui[id] = document.getElementById(id);
  }
  if (!ctx) {
    ui["overlay-title"].textContent = "CANVAS НЕДОСТУПЕН";
    ui["overlay-description"].textContent =
      "Открой игру в современном браузере с поддержкой Canvas.";
    ui["play-button"].disabled = true;
    return;
  }

  const E = TankEngine;
  const keys = new Set();
  const touch = new Set();
  const pointer = { x: 0, y: 0, active: false, down: false };
  const view = { width: 1, height: 1, ratio: 1, scale: 1, x: 0, y: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const squash = 0.76;
  const particles = [];
  const traces = [];
  let state = E.createGame();
  let lastFrame = 0;
  let shake = 0;
  let flash = 0;
  let announcementTime = 0;
  let dustTime = 0;
  let audioContext = null;
  let soundEnabled = false;
  const floor = makeFloor();

  function hash(value) {
    const number = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return number - Math.floor(number);
  }

  function makeFloor() {
    const surface = document.createElement("canvas");
    surface.width = E.WORLD.width;
    surface.height = E.WORLD.height;
    const pen = surface.getContext("2d");
    pen.fillStyle = "#344331";
    pen.fillRect(0, 0, surface.width, surface.height);
    for (let y = 0; y < surface.height; y += 80) {
      for (let x = 0; x < surface.width; x += 80) {
        const shade = 23 + Math.floor(hash(x + y * 7) * 4);
        pen.fillStyle = "hsl(87, 13%, " + shade + "%)";
        pen.fillRect(x + 1, y + 1, 78, 78);
        pen.strokeStyle = "#0b140d25";
        pen.strokeRect(x, y, 80, 80);
      }
    }
    pen.fillStyle = "#26322470";
    pen.fillRect(64, 330, 1472, 110);
    pen.fillRect(720, 64, 160, 912);
    pen.setLineDash([22, 22]);
    pen.strokeStyle = "#adb99535";
    pen.lineWidth = 3;
    pen.beginPath();
    pen.moveTo(90, 384);
    pen.lineTo(1510, 384);
    pen.moveTo(800, 100);
    pen.lineTo(800, 960);
    pen.stroke();
    pen.setLineDash([]);
    for (let i = 0; i < 2600; i += 1) {
      const x = hash(i + 5) * surface.width;
      const y = hash(i + 987) * surface.height;
      pen.fillStyle = i % 2 ? "#14221722" : "#ced6a712";
      pen.fillRect(x, y, hash(i + 3) * 4 + 1, 2);
    }
    pen.strokeStyle = "#bdcda451";
    pen.lineWidth = 2;
    pen.strokeRect(84, 84, 1432, 872);
    for (let i = 0; i < 12; i += 1) {
      const x = 125 + i * 120;
      pen.fillStyle = "#b6be902b";
      pen.fillRect(x, 90, 25, 6);
      pen.fillRect(x, 944, 25, 6);
    }
    pen.strokeStyle = "#cefa7836";
    pen.lineWidth = 2;
    pen.beginPath();
    pen.arc(800, 880, 72, 0, Math.PI * 2);
    pen.stroke();
    pen.setLineDash([6, 8]);
    pen.beginPath();
    pen.arc(800, 880, 82, 0, Math.PI * 2);
    pen.stroke();
    pen.setLineDash([]);
    pen.font = "700 1rem 'Courier New', monospace";
    pen.fillStyle = "#bac5a53d";
    pen.textAlign = "center";
    pen.fillText("ЗОНА ВЫСАДКИ", 800, 940);
    pen.font = "700 3rem 'Courier New', monospace";
    pen.fillStyle = "#c5cd9e19";
    pen.fillText("07", 140, 440);
    pen.fillText("N", 800, 185);
    for (let i = 0; i < 70; i += 1) {
      const x = 100 + hash(i + 84) * 1400;
      const y = 110 + hash(i + 127) * 820;
      if (x > 610 && x < 980) {
        continue;
      }
      pen.strokeStyle = "#66764b73";
      pen.lineWidth = 2;
      for (let blade = 0; blade < 5; blade += 1) {
        pen.beginPath();
        pen.moveTo(x + blade * 3, y);
        pen.lineTo(x + blade * 3 - 2, y - 6 - hash(blade + i) * 8);
        pen.stroke();
      }
    }
    return surface;
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    view.width = bounds.width;
    view.height = bounds.height;
    view.ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * view.ratio);
    canvas.height = Math.round(bounds.height * view.ratio);
    positionCamera();
  }

  function positionCamera() {
    if (view.width < 760) {
      view.scale = Math.max(0.48, Math.min(view.width / 760, (view.height - 150) / 600));
      const halfWidth = view.width / (2 * view.scale);
      const halfHeight = (view.height - 150) / (2 * view.scale * squash);
      const cx = E.clamp(state.player.x, halfWidth, E.WORLD.width - halfWidth);
      const cy = E.clamp(state.player.y, halfHeight, E.WORLD.height - halfHeight);
      view.x = view.width / 2 - cx * view.scale;
      view.y = view.height / 2 + 10 - cy * view.scale * squash;
    } else {
      view.scale = Math.min(
        (view.width - 80) / E.WORLD.width,
        (view.height - 180) / (E.WORLD.height * squash),
      );
      view.x = (view.width - E.WORLD.width * view.scale) / 2;
      view.y = (view.height - E.WORLD.height * view.scale * squash) / 2 + 12;
    }
  }

  function project(x, y, height = 0) {
    return {
      x: view.x + x * view.scale,
      y: view.y + y * view.scale * squash - height * view.scale,
    };
  }

  function unproject(x, y) {
    return { x: (x - view.x) / view.scale, y: (y - view.y) / (view.scale * squash) };
  }

  function polygon(points, color, stroke) {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function prism(x, y, width, depth, height, palette, angle = 0, base = 0) {
    const corners = [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [width / 2, depth / 2],
      [-width / 2, depth / 2],
    ];
    const world = corners.map(([cx, cy]) => ({
      x: x + cx * Math.cos(angle) - cy * Math.sin(angle),
      y: y + cx * Math.sin(angle) + cy * Math.cos(angle),
    }));
    const bottom = world.map((point) => project(point.x, point.y, base));
    const top = world.map((point) => project(point.x, point.y, height + base));
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      polygon(
        [bottom[index], bottom[next], top[next], top[index]],
        index % 2 ? palette.side : palette.front,
      );
    }
    polygon(top, palette.top, palette.outline || "#ffffff0b");
  }

  function localSurface(x, y, angle, height) {
    const center = project(x, y, height);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(view.scale, view.scale * squash);
    ctx.rotate(angle);
  }

  function drawObstacle(box) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    polygon(
      [
        project(box.x + 10, box.y + 8),
        project(box.x + box.w + 28, box.y + 12),
        project(box.x + box.w + 28, box.y + box.h + 25),
        project(box.x + 10, box.y + box.h + 25),
      ],
      "#0b120d6b",
    );
    let palette = { top: "#7b7e66", side: "#484f3e", front: "#5b634e" };
    if (box.kind === "container") {
      palette =
        box.color === "rust"
          ? { top: "#956c4f", side: "#533e2e", front: "#785039" }
          : { top: "#6c7e59", side: "#384b33", front: "#506443" };
    } else if (box.kind === "crates") {
      palette = { top: "#968663", side: "#5d5039", front: "#786747" };
    }
    prism(cx, cy, box.w, box.h, box.height, palette);
    localSurface(cx, cy, 0, box.height + 0.5);
    ctx.strokeStyle = "#1b231c4a";
    ctx.lineWidth = 3;
    if (box.kind === "container") {
      for (let x = -box.w / 2 + 12; x < box.w / 2 - 8; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, -box.h / 2 + 5);
        ctx.lineTo(x, box.h / 2 - 5);
        ctx.stroke();
        ctx.fillStyle = "#dde1b81a";
        ctx.fillRect(x + 2, -box.h / 2 + 5, 2, box.h - 10);
      }
      ctx.fillStyle = "#d7d3b5a8";
      ctx.font = "700 0.75rem 'Courier New', monospace";
      ctx.fillText(box.color === "rust" ? "IF–07" : "CARGO", -box.w / 2 + 14, 4);
    } else if (box.kind === "crates") {
      for (let x = -box.w / 2; x < box.w / 2; x += 50) {
        ctx.strokeRect(x + 4, -box.h / 2 + 4, 42, box.h - 8);
        ctx.beginPath();
        ctx.moveTo(x + 5, -box.h / 2 + 5);
        ctx.lineTo(x + 44, box.h / 2 - 5);
        ctx.stroke();
      }
    } else {
      ctx.strokeRect(-box.w / 2 + 7, -box.h / 2 + 7, box.w - 14, box.h - 14);
      ctx.fillStyle = "#aeb29945";
      ctx.fillRect(-box.w / 2 + 12, -box.h / 2 + 12, box.w - 24, 4);
      ctx.fillStyle = "#bdba7980";
      for (let x = -box.w / 2 + 14; x < box.w / 2 - 14; x += 20) {
        ctx.fillRect(x, box.h / 2 - 14, 10, 5);
      }
    }
    ctx.restore();
  }

  function drawTank(tank) {
    const ground = project(tank.x + 9, tank.y + 12);
    ctx.fillStyle = "#0b120da8";
    ctx.beginPath();
    ctx.ellipse(
      ground.x,
      ground.y,
      41 * view.scale,
      28 * view.scale * squash,
      tank.angle * 0.15,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (tank.shield > 0) {
      const center = project(tank.x, tank.y);
      ctx.strokeStyle = tank.team === "player" ? "#cefa7877" : "#e6b99855";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 43 * view.scale, 43 * view.scale * squash, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const player = tank.team === "player";
    const color =
      tank.hitFlash > 0.6 ? "#f9f3cc" : player ? "#bbdf7a" : tank.heavy ? "#b8a0cd" : "#dc9564";
    const shadow = player ? "#617c42" : tank.heavy ? "#62516f" : "#8c5135";
    for (const side of [-1, 1]) {
      const tx = tank.x - Math.sin(tank.angle) * side * 24;
      const ty = tank.y + Math.cos(tank.angle) * side * 24;
      prism(tx, ty, 65, 14, 9, { top: "#343d34", side: "#171e19", front: "#222b22" }, tank.angle);
      localSurface(tx, ty, tank.angle, 10);
      ctx.fillStyle = "#65715c";
      for (let x = -29; x < 30; x += 8) {
        const offset = ((tank.tread % 8) + 8) % 8;
        ctx.fillRect(x + offset - 4, -6, 3, 12);
      }
      ctx.restore();
    }
    prism(tank.x, tank.y, 60, 37, 12, { top: color, side: shadow, front: shadow }, tank.angle, 5);
    localSurface(tank.x, tank.y, tank.angle, 18);
    ctx.fillStyle = shadow;
    ctx.fillRect(-26, -14, 14, 28);
    ctx.fillStyle = "#1f302dcc";
    for (let x = -24; x < -12; x += 4) {
      ctx.fillRect(x, -11, 2, 22);
    }
    ctx.fillStyle = "#ecf4c76b";
    ctx.fillRect(19, -15, 5, 30);
    ctx.fillStyle = player ? "#eaffe3" : "#fbe1a8";
    ctx.fillRect(28, -16, 4, 5);
    ctx.fillRect(28, 11, 4, 5);
    ctx.restore();
    prism(
      tank.x,
      tank.y,
      tank.heavy ? 33 : 29,
      29,
      10,
      { top: color, side: shadow, front: shadow },
      tank.turret,
      18,
    );
    const recoil = tank.recoil * 7;
    const bx = tank.x + Math.cos(tank.turret) * (31 - recoil);
    const by = tank.y + Math.sin(tank.turret) * (31 - recoil);
    prism(
      bx,
      by,
      42,
      tank.heavy ? 11 : 8,
      7,
      { top: "#aeb8a0", side: "#46513f", front: "#606e54" },
      tank.turret,
      19,
    );
    localSurface(tank.x, tank.y, tank.turret, 29);
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(-3, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#eff3cc55";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-3, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f1f3d899";
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
    if (!player) {
      const label = project(tank.x, tank.y - 43, 18);
      const width = 42 * Math.max(view.scale, 0.7);
      ctx.fillStyle = "#0b110d99";
      ctx.fillRect(label.x - width / 2, label.y, width, 4);
      ctx.fillStyle = tank.heavy ? "#c8addd" : "#e9a073";
      ctx.fillRect(label.x - width / 2, label.y, (width * tank.hp) / tank.maxHp, 4);
    } else {
      const mark = project(tank.x, tank.y - 53, 21);
      polygon(
        [
          { x: mark.x - 4, y: mark.y - 5 },
          { x: mark.x + 4, y: mark.y - 5 },
          { x: mark.x, y: mark.y },
        ],
        "#d5ff8d",
      );
    }
  }

  function drawPickup(pickup) {
    const hover = 6 + Math.sin(state.time * 3) * 3;
    const point = project(pickup.x, pickup.y);
    ctx.fillStyle = "#cefa781f";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 30 * view.scale, 22 * view.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    prism(
      pickup.x,
      pickup.y,
      27,
      27,
      15,
      { top: "#b7df7b", side: "#5c7b45", front: "#799c50" },
      0,
      hover,
    );
    localSurface(pickup.x, pickup.y, 0, hover + 16);
    ctx.fillStyle = "#efffdd";
    ctx.fillRect(-3, -9, 6, 18);
    ctx.fillRect(-9, -3, 18, 6);
    ctx.restore();
  }

  function drawScene(timestamp) {
    positionCamera();
    ctx.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    ctx.fillStyle = "#182019";
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.save();
    if (!reducedMotion && shake > 0.1) {
      ctx.translate(Math.sin(timestamp * 0.07) * shake, Math.cos(timestamp * 0.09) * shake * 0.7);
    }
    ctx.drawImage(
      floor,
      view.x,
      view.y,
      E.WORLD.width * view.scale,
      E.WORLD.height * view.scale * squash,
    );
    for (const trace of traces) {
      localSurface(trace.x, trace.y, trace.angle, 0);
      ctx.globalAlpha = Math.min(0.24, trace.life / 15);
      ctx.fillStyle = "#101b13";
      ctx.fillRect(-3, -30, 6, 12);
      ctx.fillRect(-3, 18, 6, 12);
      ctx.restore();
    }
    for (const wreck of state.wrecks) {
      localSurface(wreck.x, wreck.y, wreck.angle, 0);
      ctx.fillStyle = "#17221ba3";
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#252c24";
      ctx.fillRect(-26, -22, 52, 44);
      ctx.fillStyle = "#424738";
      ctx.fillRect(-20, -15, 38, 30);
      ctx.restore();
    }
    const drawables = state.obstacles.map((box) => ({ y: box.y + box.h, type: "box", item: box }));
    for (const wall of [
      { x: 48, y: 48, w: 1504, h: 16 },
      { x: 48, y: 64, w: 16, h: 912 },
      { x: 1536, y: 64, w: 16, h: 912 },
      { x: 48, y: 976, w: 1504, h: 16 },
    ]) {
      drawables.push({ y: wall.y + wall.h, type: "wall", item: wall });
    }
    for (const tank of [state.player, ...state.bots]) {
      if (tank.hp > 0) {
        drawables.push({ y: tank.y + 20, type: "tank", item: tank });
      }
    }
    for (const pickup of state.pickups) {
      drawables.push({ y: pickup.y, type: "pickup", item: pickup });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const drawable of drawables) {
      if (drawable.type === "tank") {
        drawTank(drawable.item);
      } else if (drawable.type === "pickup") {
        drawPickup(drawable.item);
      } else if (drawable.type === "wall") {
        const wall = drawable.item;
        prism(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.w, wall.h, 20, {
          top: "#6a7059",
          front: "#454d3c",
          side: "#323d2f",
        });
      } else {
        drawObstacle(drawable.item);
      }
    }
    for (const bullet of state.bullets) {
      const end = project(bullet.x, bullet.y, 20);
      const start = project(bullet.x - bullet.vx * 0.035, bullet.y - bullet.vy * 0.035, 20);
      ctx.strokeStyle = bullet.team === "player" ? "#e8ff9f" : "#ffc48f";
      ctx.lineWidth = 3 * view.scale;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fffbe3";
      ctx.beginPath();
      ctx.arc(end.x, end.y, 3 * view.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const particle of particles) {
      const point = project(particle.x, particle.y, particle.z);
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0.2, particle.size * view.scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (state.mode === "playing" && pointer.active) {
      drawCrosshair(pointer.x, pointer.y);
    }
  }

  function drawCrosshair(x, y) {
    ctx.strokeStyle = state.player.cooldown > 0.1 ? "#d5dcbc99" : "#deffa6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13);
      ctx.lineTo(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9ffc4";
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  function burst(x, y, count, colors, speed, life, size, height = 12) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.25 + Math.random() * 0.75);
      const duration = life * (0.5 + Math.random() * 0.5);
      particles.push({
        x,
        y,
        z: height,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        vz: Math.random() * speed * 0.5,
        life: duration,
        maxLife: duration,
        size: size * (0.5 + Math.random()),
        color: colors[i % colors.length],
      });
    }
    if (particles.length > 650) {
      particles.splice(0, particles.length - 650);
    }
  }

  function announce(message, duration = 2.5) {
    ui.announcement.textContent = message;
    ui.announcement.classList.add("is-visible");
    announcementTime = duration;
  }

  function consumeEvents() {
    for (const event of state.events) {
      if (event.type === "shot") {
        burst(event.x, event.y, 7, ["#fffbd1", "#fccc6a", "#efa252"], 75, 0.18, 4, 24);
        if (event.team === "player") {
          shake = Math.max(shake, 1.2);
          playSound("shot");
        }
      } else if (event.type === "impact") {
        burst(event.x, event.y, 8, ["#f4d993", "#e8af65", "#8c9272"], 95, 0.35, 2);
      } else if (event.type === "damage") {
        if (event.team === "player") {
          flash = 1;
          shake = 3;
          playSound("hit");
        }
      } else if (event.type === "explosion") {
        burst(event.x, event.y, 36, ["#fff0ae", "#f7b34b", "#e8723d", "#73664b"], 200, 0.75, 6);
        burst(event.x, event.y, 18, ["#434c3d", "#59604b"], 80, 1.5, 12);
        shake = 5;
        playSound("explosion");
      } else if (event.type === "repair") {
        burst(event.x, event.y, 16, ["#d5ff91", "#95d477"], 70, 0.8, 3);
        announce("БРОНЯ ВОССТАНОВЛЕНА +35", 1.6);
        playSound("repair");
      } else if (event.type === "wave") {
        announce("ВОЛНА " + String(event.wave).padStart(2, "0") + " / ЦЕЛЕЙ: " + event.count);
      } else if (event.type === "clear") {
        announce("СЕКТОР ЧИСТ. НОВАЯ ВОЛНА ЧЕРЕЗ 3 СЕК.", 2.8);
      } else if (event.type === "gameover") {
        showOverlay("gameover");
      }
    }
    state.events.length = 0;
  }

  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z = Math.max(0, particle.z + particle.vz * dt);
      particle.vz -= dt * 160;
      particle.vx *= Math.exp(-dt * 2);
      particle.vy *= Math.exp(-dt * 2);
      if (particle.life <= 0) {
        particles.splice(i, 1);
      }
    }
    for (let i = traces.length - 1; i >= 0; i -= 1) {
      traces[i].life -= dt;
      if (traces[i].life <= 0) {
        traces.splice(i, 1);
      }
    }
    shake = Math.max(0, shake - dt * 15);
    flash = Math.max(0, flash - dt * 3.5);
    ui["damage-flash"].style.opacity = String(flash * 0.75);
    announcementTime -= dt;
    if (announcementTime <= 0) {
      ui.announcement.classList.remove("is-visible");
    }
    if (state.mode === "playing") {
      dustTime -= dt;
      if (dustTime <= 0) {
        dustTime = 0.07;
        for (const tank of [state.player, ...state.bots]) {
          if (Math.abs(tank.speed) > 30) {
            traces.push({ x: tank.x, y: tank.y, angle: tank.angle, life: 12 });
            burst(
              tank.x - Math.cos(tank.angle) * 28,
              tank.y - Math.sin(tank.angle) * 28,
              1,
              ["#abb18b"],
              9,
              0.65,
              4,
              1,
            );
          }
        }
        if (traces.length > 900) {
          traces.splice(0, traces.length - 900);
        }
      }
    }
  }

  function updateHud() {
    ui["wave-value"].textContent = String(state.wave).padStart(2, "0");
    ui["kills-value"].textContent = String(state.kills).padStart(2, "0");
    ui["score-value"].textContent = String(state.score).padStart(4, "0");
    ui["enemy-value"].textContent = "Противников: " + state.bots.length;
    ui["health-value"].textContent = String(Math.ceil(state.player.hp));
    ui["health-bar"].setAttribute("aria-valuenow", String(Math.ceil(state.player.hp)));
    ui["health-fill"].style.width = state.player.hp + "%";
    ui["health-fill"].style.background = state.player.hp < 30 ? "#f0916b" : "#cefa78";
    const loaded = E.clamp(1 - state.player.cooldown / E.FIRE_DELAY, 0, 1);
    ui["reload-fill"].style.width = loaded * 100 + "%";
    ui["weapon-label"].textContent =
      state.player.hp <= 0 ? "ТАНК ПОДБИТ" : loaded >= 1 ? "ОРУДИЕ ГОТОВО" : "ПЕРЕЗАРЯДКА";
  }

  function clearInput() {
    keys.clear();
    touch.clear();
    pointer.down = false;
  }

  function startBattle() {
    if (state.mode === "paused") {
      state.mode = "playing";
    } else {
      state = E.createGame();
      E.start(state);
      particles.length = 0;
      traces.length = 0;
      flash = 0;
      shake = 0;
    }
    clearInput();
    pointer.active = false;
    ui.overlay.hidden = true;
    ui["pause-button"].disabled = false;
    ui["touch-controls"].hidden = false;
    canvas.style.cursor = "crosshair";
    canvas.focus({ preventScroll: true });
    if (soundEnabled) {
      ensureAudio();
    }
    updateHud();
  }

  function restartBattle() {
    state.mode = "ready";
    startBattle();
  }

  function showOverlay(mode) {
    clearInput();
    ui.overlay.hidden = false;
    ui["touch-controls"].hidden = true;
    ui["briefing-controls"].hidden = true;
    canvas.style.cursor = "default";
    ui["restart-button"].hidden = mode !== "paused";
    ui["pause-button"].disabled = mode !== "paused";
    if (mode === "paused") {
      ui["overlay-eyebrow"].textContent = "БОЙ ПРИОСТАНОВЛЕН";
      ui["overlay-title"].innerHTML = "ПЕРЕДЫШКА.<br /><em>ТАНК НА ПОЗИЦИИ.</em>";
      ui["overlay-description"].textContent =
        "W / S — вперёд и назад, A / D — поворот. Мышь — башня, клик или пробел — выстрел. Q / E — поворот башни с клавиатуры.";
      ui["play-label"].textContent = "ПРОДОЛЖИТЬ";
      ui["overlay-hint"].textContent = "Enter или P — продолжить";
    } else {
      ui["overlay-eyebrow"].textContent = "СВЯЗЬ С ТАНКОМ ПОТЕРЯНА";
      ui["overlay-title"].innerHTML = "ТАНК ПОДБИТ.<br /><em>ЕЩЁ ОДИН БОЙ?</em>";
      ui["overlay-description"].textContent =
        "Счёт: " +
        state.score +
        ". Подбито танков: " +
        state.kills +
        ". Достигнута волна " +
        state.wave +
        ". Используй укрытия и подбирай зелёные ремонтные ящики.";
      ui["play-label"].textContent = "СНОВА В БОЙ";
      ui["overlay-hint"].textContent = "Enter или R — новый бой";
    }
    ui["play-button"].focus({ preventScroll: true });
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      showOverlay("paused");
    } else if (state.mode === "paused") {
      startBattle();
    }
  }

  function ensureAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      return;
    }
    if (!audioContext) {
      audioContext = new Audio();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  }

  function playSound(kind) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") {
      return;
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const repair = kind === "repair";
    const duration = kind === "explosion" ? 0.35 : repair ? 0.23 : 0.12;
    oscillator.type = repair ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(repair ? 440 : kind === "shot" ? 170 : 85, now);
    oscillator.frequency.exponentialRampToValueAtTime(repair ? 880 : 30, now + duration);
    gain.gain.setValueAtTime(repair ? 0.06 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
  }

  function updatePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }

  function getInput() {
    const forward = keys.has("KeyW") || keys.has("ArrowUp") || touch.has("forward");
    const backward = keys.has("KeyS") || keys.has("ArrowDown") || touch.has("backward");
    const left = keys.has("KeyA") || keys.has("ArrowLeft") || touch.has("left");
    const right = keys.has("KeyD") || keys.has("ArrowRight") || touch.has("right");
    // Aim on the gun's height plane so the cursor matches the visible shell path.
    let aim = pointer.active ? unproject(pointer.x, pointer.y + 20 * view.scale) : null;
    if (coarsePointer.matches && !pointer.active && state.bots.length) {
      const target = state.bots
        .filter((bot) => E.hasLineOfSight(state, state.player, bot))
        .sort(
          (a, b) =>
            Math.hypot(a.x - state.player.x, a.y - state.player.y) -
            Math.hypot(b.x - state.player.x, b.y - state.player.y),
        )[0];
      if (target) {
        aim = { x: target.x, y: target.y };
      }
    }
    return {
      throttle: Number(forward) - Number(backward),
      turn: Number(right) - Number(left),
      turret: Number(keys.has("KeyE")) - Number(keys.has("KeyQ")),
      aim,
      fire: keys.has("Space") || pointer.down || touch.has("fire"),
    };
  }

  function frame(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    E.step(state, getInput(), dt);
    consumeEvents();
    if (state.mode !== "paused") {
      updateEffects(dt);
    }
    drawScene(timestamp);
    updateHud();
    window.requestAnimationFrame(frame);
  }

  ui["play-button"].addEventListener("click", () => startBattle());
  ui["restart-button"].addEventListener("click", () => restartBattle());
  ui["pause-button"].addEventListener("click", () => togglePause());
  ui["sound-button"].addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      ensureAudio();
    }
    ui["sound-button"].setAttribute("aria-pressed", String(soundEnabled));
    ui["sound-button"].setAttribute(
      "aria-label",
      soundEnabled ? "Выключить звук" : "Включить звук",
    );
    ui["sound-button"].title = soundEnabled ? "Выключить звук" : "Включить звук";
    ui["sound-symbol"].setAttribute(
      "d",
      soundEnabled ? "M16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14" : "m16 9 6 6m0-6-6 6",
    );
    if (state.mode === "playing") {
      canvas.focus({ preventScroll: true });
    }
  });
  canvas.addEventListener("pointermove", (event) => updatePointer(event));
  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "playing" || event.button !== 0) {
      return;
    }
    event.preventDefault();
    updatePointer(event);
    canvas.focus({ preventScroll: true });
    pointer.down = event.pointerType !== "touch";
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", () => {
    pointer.down = false;
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.down = false;
  });
  canvas.addEventListener("lostpointercapture", () => {
    pointer.down = false;
  });
  canvas.addEventListener("pointerleave", () => {
    if (!pointer.down) {
      pointer.active = false;
    }
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("keydown", (event) => {
    if (!ui.overlay.hidden && event.code === "Tab") {
      const first = ui["play-button"];
      const last = ui["restart-button"].hidden ? first : ui["restart-button"];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (["Enter", "Space"].includes(event.code) && document.activeElement?.tagName === "BUTTON") {
      return;
    }
    if (event.code === "Enter" && state.mode !== "playing") {
      event.preventDefault();
      startBattle();
      return;
    }
    if (["KeyP", "Escape"].includes(event.code) && !event.repeat) {
      event.preventDefault();
      togglePause();
      return;
    }
    if (event.code === "KeyR" && !event.repeat) {
      event.preventDefault();
      restartBattle();
      return;
    }
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "KeyQ",
        "KeyE",
      ].includes(event.code) &&
      state.mode === "playing"
    ) {
      event.preventDefault();
      keys.add(event.code);
      if (["KeyQ", "KeyE"].includes(event.code)) {
        pointer.active = false;
      }
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    clearInput();
    if (state.mode === "playing") {
      togglePause();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") {
      togglePause();
    }
  });
  for (const button of document.querySelectorAll("[data-control]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (state.mode === "playing") {
        touch.add(button.dataset.control);
        button.setPointerCapture(event.pointerId);
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, () => touch.delete(button.dataset.control));
    }
  }
  new ResizeObserver(() => resize()).observe(canvas);
  resize();
  updateHud();
  ui["play-button"].focus({ preventScroll: true });
  window.requestAnimationFrame(frame);
}

initializeTankGame();

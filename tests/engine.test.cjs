const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/js/engine.js");

function runningGame(seed = 42) {
  const game = E.createGame(seed);
  E.start(game);
  return game;
}

function advance(game, seconds, input = {}) {
  for (let time = 0; time < seconds; time += 1 / 120) {
    E.step(game, input, 1 / 120);
  }
}

function targetGame() {
  const game = runningGame();
  const target = game.bots[0];
  target.x = 1020;
  target.y = 900;
  target.shield = 0;
  target.cooldown = 100;
  target.hp = 68;
  game.bots = [target];
  game.player.x = 800;
  game.player.y = 900;
  game.player.angle = 0;
  game.player.turret = 0;
  return { game, target };
}

test("ready and paused battles do not advance", () => {
  const game = E.createGame(3);
  const original = JSON.stringify(game);
  advance(game, 1, { throttle: 1, fire: true });
  assert.equal(JSON.stringify(game), original);
  E.start(game);
  game.mode = "paused";
  const paused = JSON.stringify(game);
  advance(game, 2, { turn: 1, fire: true });
  assert.equal(JSON.stringify(game), paused);
});

test("forward, reverse, and turning change tank motion", () => {
  const game = runningGame();
  advance(game, 0.3, { throttle: 1 });
  assert.ok(game.player.y < 860);
  const y = game.player.y;
  advance(game, 0.8, { throttle: -1 });
  assert.ok(game.player.y > y);
  const angle = game.player.angle;
  advance(game, 0.3, { turn: 1 });
  assert.ok(game.player.angle > angle + 0.5);
});

test("hulls cannot enter cover or leave arena boundaries", () => {
  const game = runningGame();
  game.player.shield = 1000;
  advance(game, 8, { throttle: 1 });
  assert.ok(game.player.y >= 580 + E.RADIUS);
  assert.ok(E.isOpen(game, game.player.x, game.player.y));
  game.player.x = 160;
  game.player.y = 160;
  game.player.angle = Math.PI;
  advance(game, 3, { throttle: 1 });
  assert.ok(game.player.x >= E.WORLD.border + E.RADIUS);
});

test("tank bodies cannot drive through one another", () => {
  const { game, target } = targetGame();
  game.player.x = target.x - E.RADIUS * 2;
  E.moveTank(game, game.player, 10, 0);
  assert.ok(Math.hypot(game.player.x - target.x, game.player.y - target.y) >= E.RADIUS * 2);
});

test("shell cooldown prevents unlimited fire", () => {
  const { game } = targetGame();
  assert.equal(E.shoot(game, game.player), true);
  assert.equal(E.shoot(game, game.player), false);
  advance(game, 0.2);
  assert.equal(E.shoot(game, game.player), false);
  advance(game, 0.23);
  assert.equal(E.shoot(game, game.player), true);
});

test("two accurate shells destroy a standard bot and award points", () => {
  const { game, target } = targetGame();
  advance(game, 1, { aim: { x: target.x, y: target.y }, fire: true });
  assert.equal(target.hp, 0);
  assert.equal(game.kills, 1);
  assert.equal(game.score, 100);
  assert.equal(game.wrecks.length, 1);
});

test("cover stops bullets even when a frame crosses its entire width", () => {
  const { game, target } = targetGame();
  game.player.x = 800;
  game.player.y = 650;
  target.x = 800;
  target.y = 400;
  target.speed = 0;
  assert.equal(E.hasLineOfSight(game, game.player, target), false);
  game.bullets.push({ x: 800, y: 650, vx: 0, vy: -6000, life: 1, team: "player", damage: 100 });
  E.step(game, {}, 0.05);
  assert.equal(target.hp, 68);
  assert.equal(game.bullets.length, 0);
});

test("a muzzle against a wall cannot spawn a shell beyond cover", () => {
  const { game } = targetGame();
  game.player.x = 800;
  game.player.y = 610;
  game.player.turret = -Math.PI / 2;
  E.shoot(game, game.player);
  assert.equal(game.bullets.length, 0);
});

test("segment tests include a target already overlapping the muzzle", () => {
  assert.equal(E.segmentCircle(5, 0, 10, 0, { x: 6, y: 0 }, 2), 0);
  assert.equal(E.segmentBox(0, 0, 0, 10, { x: 5, y: 3, w: 5, h: 5 }), null);
  assert.equal(E.segmentBox(0, 5, 100, 5, { x: 40, y: 0, w: 10, h: 10 }), 0.4);
});

test("pathfinding finds a clear route around the central bunker", () => {
  const game = runningGame();
  const path = E.findPath(game, { x: 800, y: 400 }, { x: 800, y: 880 });
  assert.ok(path.length > 10);
  assert.ok(path.every((point) => E.isOpen(game, point.x, point.y, E.RADIUS + 3)));
  assert.ok(path.some((point) => point.x < 635 || point.x > 965));
  assert.ok(Math.hypot(path.at(-1).x - 800, path.at(-1).y - 880) < 40);
});

test("bots move, fire, and remain outside cover over a sustained simulation", () => {
  const game = runningGame();
  game.player.shield = 1000;
  const starting = game.bots.map((bot) => ({ x: bot.x, y: bot.y }));
  for (let i = 0; i < 2400; i += 1) {
    E.step(game, {}, 1 / 120);
    for (const bot of game.bots) {
      assert.ok(Number.isFinite(bot.x) && Number.isFinite(bot.y));
      assert.ok(E.isOpen(game, bot.x, bot.y));
    }
  }
  assert.ok(
    game.bots.every(
      (bot, index) => Math.hypot(bot.x - starting[index].x, bot.y - starting[index].y) > 50,
    ),
  );
  assert.ok(game.events.some((event) => event.type === "shot" && event.team === "enemy"));
});

test("clearing a wave starts a larger wave and restores some armor", () => {
  const game = runningGame();
  for (const bot of game.bots) {
    bot.shield = 0;
    E.damageTank(game, bot, 1000);
  }
  game.player.hp = 40;
  advance(game, 3.2);
  assert.equal(game.wave, 2);
  assert.equal(game.bots.length, 4);
  assert.equal(game.player.hp, 60);
  assert.equal(game.score, 350);
  assert.ok(
    game.bots.every((bot) => Math.hypot(bot.x - game.player.x, bot.y - game.player.y) > 250),
  );
});

test("repair pickups heal only up to full armor", () => {
  const game = runningGame();
  game.player.hp = 85;
  game.pickups.push({ x: game.player.x, y: game.player.y, life: 20 });
  E.step(game, {}, 0.01);
  assert.equal(game.player.hp, 100);
  assert.equal(game.pickups.length, 0);
});

test("lethal damage ends the battle and freezes subsequent movement", () => {
  const game = runningGame();
  game.player.shield = 0;
  E.damageTank(game, game.player, 150);
  assert.equal(game.mode, "gameover");
  assert.equal(game.player.hp, 0);
  const y = game.player.y;
  advance(game, 1, { throttle: 1 });
  assert.equal(game.player.y, y);
  assert.equal(E.shoot(game, game.player), false);
});

test("identical seeds and input reproduce the same battle", () => {
  const a = runningGame(10);
  const b = runningGame(10);
  advance(a, 2, { throttle: 1, turn: 0.3 });
  advance(b, 2, { throttle: 1, turn: 0.3 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

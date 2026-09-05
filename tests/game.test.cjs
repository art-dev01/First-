const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise actual input handlers and animation code without a browser dependency.
function createRuntime(width = 1440, height = 900) {
  const handlers = new Map();
  const elements = new Map();
  let nextFrame;
  let clock = 0;
  let currentGame;
  let drawCalls = 0;
  const context2d = {};
  for (const method of [
    "fillRect",
    "strokeRect",
    "setLineDash",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "arc",
    "fill",
    "fillText",
    "save",
    "restore",
    "translate",
    "scale",
    "rotate",
    "closePath",
    "ellipse",
    "drawImage",
    "setTransform",
  ]) {
    function recordDraw(...args) {
      assert.ok(
        args.every((argument) => typeof argument !== "number" || Number.isFinite(argument)),
        method + " received invalid coordinates",
      );
      drawCalls += 1;
    }
    context2d[method] = recordDraw;
  }

  function element(id) {
    if (!elements.has(id)) {
      const node = {
        id,
        tagName: id.includes("button") ? "BUTTON" : id === "arena" ? "CANVAS" : "DIV",
        hidden: id === "restart-button",
        style: {},
        attributes: {},
        dataset: {},
        textContent: "",
        classList: { add() {}, remove() {} },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        addEventListener(type, listener) {
          handlers.set(id + ":" + type, listener);
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, width, height };
        },
        getContext() {
          return context2d;
        },
        setPointerCapture() {},
        focus() {
          document.activeElement = this;
        },
      };
      elements.set(id, node);
    }
    return elements.get(id);
  }

  const document = {
    activeElement: null,
    hidden: false,
    getElementById: element,
    createElement() {
      return {
        getContext() {
          return context2d;
        },
      };
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, listener) {
      handlers.set("document:" + type, listener);
    },
  };
  const window = {
    devicePixelRatio: 1,
    matchMedia() {
      return { matches: false };
    },
    requestAnimationFrame(callback) {
      nextFrame = callback;
    },
    addEventListener(type, listener) {
      handlers.set("window:" + type, listener);
    },
  };
  function ResizeObserver(callback) {
    function observe() {
      callback();
    }
    this.observe = observe;
  }
  const context = vm.createContext({ document, window, ResizeObserver, console });
  const root = path.join(__dirname, "..", "src", "js");
  vm.runInContext(fs.readFileSync(path.join(root, "engine.js"), "utf8"), context);
  const engine = vm.runInContext("TankEngine", context);
  const original = engine.createGame;
  function trackGame(seed) {
    currentGame = original(seed);
    return currentGame;
  }
  engine.createGame = trackGame;
  vm.runInContext(fs.readFileSync(path.join(root, "game.js"), "utf8"), context);

  function dispatch(target, type, data = {}) {
    const handler = handlers.get(target + ":" + type);
    assert.ok(handler, target + " has a " + type + " handler");
    handler({ preventDefault() {}, repeat: false, ...data });
  }
  function frames(count = 1) {
    for (let i = 0; i < count; i += 1) {
      clock += 1000 / 60;
      nextFrame(clock);
    }
  }
  return {
    element,
    dispatch,
    frames,
    engine,
    game() {
      return currentGame;
    },
    drawCalls() {
      return drawCalls;
    },
  };
}

test("the scene initializes and renders both desktop and narrow viewports", () => {
  for (const [width, height] of [
    [1440, 900],
    [375, 812],
    [812, 390],
  ]) {
    const runtime = createRuntime(width, height);
    runtime.frames(2);
    assert.equal(runtime.game().mode, "ready");
    assert.ok(runtime.drawCalls() > 100);
  }
});

test("start, movement, pause, resume, blur, and restart are wired to the simulation", () => {
  const runtime = createRuntime();
  runtime.dispatch("play-button", "click");
  assert.equal(runtime.game().mode, "playing");
  assert.equal(runtime.element("overlay").hidden, true);
  const y = runtime.game().player.y;
  runtime.dispatch("window", "keydown", { code: "KeyW" });
  runtime.frames(20);
  assert.ok(runtime.game().player.y < y);
  runtime.dispatch("window", "keydown", { code: "KeyP" });
  assert.equal(runtime.game().mode, "paused");
  const pausedY = runtime.game().player.y;
  runtime.frames(30);
  assert.equal(runtime.game().player.y, pausedY);
  runtime.dispatch("play-button", "click");
  assert.equal(runtime.game().mode, "playing");
  runtime.dispatch("window", "blur");
  assert.equal(runtime.game().mode, "paused");
  runtime.dispatch("restart-button", "click");
  assert.equal(runtime.game().wave, 1);
  assert.equal(runtime.game().player.hp, 100);
  assert.equal(runtime.game().player.y, 880);
});

test("mouse aiming uses the visible gun plane and pointer release stops fire", () => {
  const runtime = createRuntime();
  runtime.dispatch("play-button", "click");
  const player = runtime.game().player;
  const scale = Math.min((1440 - 80) / 1600, (900 - 180) / (1040 * 0.76));
  const screenX = (1440 - 1600 * scale) / 2 + (player.x + 200) * scale;
  const screenY = (900 - 1040 * scale * 0.76) / 2 + 12 + player.y * scale * 0.76 - 20 * scale;
  runtime.dispatch("arena", "pointermove", { clientX: screenX, clientY: screenY });
  runtime.frames(1);
  assert.ok(Math.abs(player.turret) < 0.001);
  runtime.dispatch("arena", "pointerdown", {
    clientX: screenX,
    clientY: screenY,
    pointerType: "mouse",
    pointerId: 1,
    button: 0,
  });
  runtime.frames(2);
  assert.ok(player.cooldown > 0);
  runtime.dispatch("arena", "pointerup");
  runtime.frames(40);
  assert.equal(player.cooldown, 0);
});

test("game over updates the visible HUD and restart starts a fresh battle", () => {
  const runtime = createRuntime();
  runtime.dispatch("play-button", "click");
  const game = runtime.game();
  game.player.shield = 0;
  runtime.engine.damageTank(game, game.player, 1000);
  runtime.frames(1);
  assert.equal(runtime.element("overlay").hidden, false);
  assert.equal(runtime.element("health-value").textContent, "0");
  assert.equal(runtime.element("play-label").textContent, "СНОВА В БОЙ");
  runtime.dispatch("play-button", "click");
  assert.equal(runtime.game().mode, "playing");
  assert.equal(runtime.game().player.hp, 100);
});

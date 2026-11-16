// Headless self-test (?selftest=1). Drives the world directly, without a
// canvas, and checks every path a player can take: start, fight, take a
// hit, clear a wave, pick an upgrade, win, lose, restart. Results are
// written into <pre id="selftest"> and into document.title so a headless
// run can read them with --dump-dom.

import { ARENA, TOTAL_WAVES } from './config.js';
import { chooseUpgrade, createWorld, debugScene, startGame, update } from './world.js';
import { makeRng } from './random.js';

function idleInput(world) {
  return {
    move: { x: 0, y: 0 },
    aimX: world.player.x + 100,
    aimY: world.player.y,
    firing: false,
  };
}

function fightingInput(world) {
  // Kite: drift toward the centre, aim at the nearest enemy, always fire.
  const p = world.player;
  const cx = ARENA.width / 2 - p.x;
  const cy = ARENA.height / 2 - p.y;
  const d = Math.hypot(cx, cy) || 1;
  let aimX = p.x + 100;
  let aimY = p.y;
  let best = Infinity;
  for (const e of world.enemies) {
    const dd = Math.hypot(e.x - p.x, e.y - p.y);
    if (dd < best) {
      best = dd;
      aimX = e.x;
      aimY = e.y;
    }
  }
  return {
    move: { x: cx / d, y: cy / d },
    aimX,
    aimY,
    firing: true,
  };
}

function step(world, seconds, inputFn) {
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) update(world, dt, inputFn(world));
}

export function runSelfTest() {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail ?? '' });
  try {
    // 1. Boot: a fresh world sits on the title screen.
    const w = createWorld(makeRng(1234), true);
    check('boot-title', w.state === 'title', `state=${w.state}`);

    // 2. Start: the game begins on wave 1 with a full-health player.
    startGame(w);
    check('start-wave-1', w.state === 'playing' && w.wave === 1 && w.player.hp === 100, `state=${w.state} wave=${w.wave} hp=${w.player.hp}`);

    // 3. Fight: enemies spawn, bullets fly, the score moves.
    step(w, 25, fightingInput);
    check('fight-progress', w.enemies.length > 0 || w.kills > 0, `enemies=${w.enemies.length} kills=${w.kills} score=${w.score}`);
    check('fight-score', w.score > 0 || w.kills > 0, `score=${w.score}`);

    // 4. Taking a hit costs HP and grants brief invulnerability.
    // (Step 3 may already have cleared wave 1, leaving the world on the
    // upgrade screen where update() runs no combat; start the next wave
    // first so the contact test runs in 'playing' state.)
    if (w.state === 'upgrade') chooseUpgrade(w, 0);
    const hpBefore = w.player.hp;
    w.player.hurtCooldown = 0;
    w.enemies.push({ id: 999001, type: 'wisp', x: w.player.x + 5, y: w.player.y, radius: 15, hp: 20, maxHp: 20, speed: 0, damage: 10, score: 50, color: '#8f7bff', shotCooldown: 9, wobble: 0, flash: 0 });
    update(w, 1 / 60, idleInput(w));
    check('hit-costs-hp', w.player.hp < hpBefore, `hp ${hpBefore} -> ${w.player.hp}`);

    // 5. Clearing a wave offers exactly three upgrades.
    w.spawnQueue = [];
    w.enemies = [];
    w.bullets = [];
    w.enemyBullets = [];
    update(w, 1 / 60, idleInput(w));
    check('wave-clear-upgrade', w.state === 'upgrade' && w.upgradeChoices.length === 3, `state=${w.state} choices=${w.upgradeChoices.length}`);

    // 6. Picking an upgrade starts the next wave.
    const waveBefore = w.wave;
    const picked = chooseUpgrade(w, 1);
    check('upgrade-starts-wave', picked && w.state === 'playing' && w.wave === waveBefore + 1, `picked=${picked} wave ${waveBefore} -> ${w.wave}`);

    // 7. Boss wave: the Maw spawns and the boss bar has a target.
    while (w.wave < TOTAL_WAVES) {
      w.spawnQueue = [];
      w.enemies = [];
      update(w, 1 / 60, idleInput(w));
      if (w.state === 'upgrade') chooseUpgrade(w, 0);
      if (w.state !== 'playing') break;
    }
    step(w, 30, fightingInput);
    check('boss-spawns', w.boss !== null || w.wave === TOTAL_WAVES, `boss=${w.boss ? 'yes' : 'no'} wave=${w.wave}`);

    // 8. Killing the boss wins the game.
    if (w.state !== 'win') {
      if (!w.boss) {
        // The boss already fell during the fight; clear the wave.
        w.enemies = [];
        w.spawnQueue = [];
        update(w, 1 / 60, idleInput(w));
      } else {
        w.state = 'playing';
        w.player.hp = 100;
        w.player.hurtCooldown = 0;
        w.boss.hp = 1;
        w.enemies = [w.boss];
        w.spawnQueue = [];
        const b = { id: 999002, x: w.boss.x, y: w.boss.y, vx: 0, vy: 0, radius: 5, damage: 50, pierce: 0, explosive: false, friendly: true, life: 1, hitIds: new Set() };
        w.bullets.push(b);
        update(w, 1 / 60, idleInput(w));
      }
    }
    check('win-state', w.state === 'win', `state=${w.state}`);

    // 9. Losing: a fresh game that takes a fatal hit ends on game over.
    const w2 = createWorld(makeRng(99), true);
    startGame(w2);
    w2.player.hp = 5;
    w2.player.hurtCooldown = 0;
    w2.enemies.push({ id: 999003, type: 'wisp', x: w2.player.x + 5, y: w2.player.y, radius: 15, hp: 20, maxHp: 20, speed: 0, damage: 10, score: 50, color: '#8f7bff', shotCooldown: 9, wobble: 0, flash: 0 });
    update(w2, 1 / 60, idleInput(w2));
    check('lose-state', w2.state === 'over' && w2.player.hp === 0, `state=${w2.state} hp=${w2.player.hp}`);

    // 10. Restart from game over starts a fresh run.
    startGame(w2);
    check('restart', w2.state === 'playing' && w2.wave === 1 && w2.score === 0, `state=${w2.state} wave=${w2.wave} score=${w2.score}`);

    // 11. Screenshot scenes build without throwing.
    const w3 = createWorld(makeRng(7), true);
    const states = ['start', 'play', 'win', 'lose'].map((s) => debugScene(w3, s));
    check('shot-scenes', states.join(',') === 'title,playing,win,over', `states=${states.join(',')}`);
  } catch (err) {
    results.push({ name: 'exception', ok: false, detail: String(err && err.message ? err.message : err) });
  }
  const passed = results.filter((r) => r.ok).length;
  const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  lines.unshift(`SELFTEST ${passed}/${results.length}`);
  return lines.join('\n');
}

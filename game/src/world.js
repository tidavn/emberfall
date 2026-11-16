// Emberfall world: the whole game state machine and its rules.
// DOM-free on purpose: the render module draws a world, the self-test
// drives one, and the live loop owns one. No canvas or audio is touched
// here except through the sfx callbacks the caller passes in.

import {
  ARENA,
  BOSS_WAVE,
  EMBER_SCORE,
  ENEMIES,
  HEART_HEAL,
  PLAYER,
  TOTAL_WAVES,
  UPGRADES,
  UPGRADE_CHOICES,
  WAVES,
  WAVE_CLEAR_BONUS,
} from './config.js';
import { burst, makeBullet, makeEnemy, makeFloatText, makePickup, makePlayer, moveBullet, moveEnemy, moveParticle } from './entities.js';
import { range, shuffle } from './random.js';
import { sfx } from './audio.js';

export const STATES = ['title', 'playing', 'upgrade', 'paused', 'over', 'win'];

export function createWorld(rng, quiet = false) {
  const world = {
    rng,
    quiet,
    state: 'title',
    player: makePlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    pickups: [],
    texts: [],
    wave: 0,
    score: 0,
    embers: 0,
    kills: 0,
    time: 0,
    timePlayed: 0,
    shake: 0,
    spawnQueue: [],
    spawnTimer: 0,
    upgradeChoices: [],
    boss: null,
    best: 0,
    flashRed: 0,
    // Ambient ash motes drifting across the arena, purely decorative.
    ash: [],
  };
  for (let i = 0; i < 40; i++) {
    world.ash.push({
      x: rng() * ARENA.width,
      y: rng() * ARENA.height,
      speed: range(rng, 6, 20),
      size: range(rng, 1, 2.4),
      drift: range(rng, -8, 8),
    });
  }
  try {
    world.best = Number(window.localStorage.getItem('emberfall-best') || 0) || 0;
  } catch {
    world.best = 0;
  }
  return world;
}

function sound(world, fn) {
  if (!world.quiet) fn();
}

function buildSpawnQueue(world, wave) {
  const comp = WAVES[wave - 1];
  const queue = [];
  for (const [type, count] of Object.entries(comp)) {
    for (let i = 0; i < count; i++) queue.push(type);
  }
  return shuffle(world.rng, queue);
}

export function startGame(world) {
  world.player = makePlayer();
  world.enemies = [];
  world.bullets = [];
  world.enemyBullets = [];
  world.particles = [];
  world.pickups = [];
  world.texts = [];
  world.wave = 0;
  world.score = 0;
  world.embers = 0;
  world.kills = 0;
  world.timePlayed = 0;
  world.boss = null;
  startWave(world);
}

export function startWave(world) {
  world.wave += 1;
  world.spawnQueue = buildSpawnQueue(world, world.wave);
  world.spawnTimer = 0.5;
  world.state = 'playing';
  sound(world, () => (world.wave === BOSS_WAVE ? sfx.boss() : sfx.wave()));
  world.texts.push(
    makeFloatText(ARENA.width / 2, ARENA.height / 2 - 120, world.wave === BOSS_WAVE ? 'THE ASHEN MAW AWAKENS' : `WAVE ${world.wave}`, '#ffc46b'),
  );
}

function offerUpgrades(world) {
  world.upgradeChoices = shuffle(world.rng, UPGRADES).slice(0, UPGRADE_CHOICES);
  world.state = 'upgrade';
  sound(world, () => sfx.upgrade());
}

export function chooseUpgrade(world, index) {
  const up = world.upgradeChoices[index];
  if (!up || world.state !== 'upgrade') return false;
  up.apply(world.player);
  world.texts.push(makeFloatText(world.player.x, world.player.y - 30, up.name, '#7dff9e'));
  startWave(world);
  return true;
}

function endGame(world, won) {
  world.state = won ? 'win' : 'over';
  sound(world, () => (won ? sfx.victory() : sfx.defeat()));
  if (world.score > world.best) {
    world.best = world.score;
    try {
      window.localStorage.setItem('emberfall-best', String(world.best));
    } catch {
      // Best score is a nicety, never a failure.
    }
  }
}

function killEnemy(world, enemy, awardScore) {
  const idx = world.enemies.indexOf(enemy);
  if (idx === -1) return;
  world.enemies.splice(idx, 1);
  world.kills += 1;
  if (awardScore) {
    world.score += enemy.score;
    world.texts.push(makeFloatText(enemy.x, enemy.y - 14, `+${enemy.score}`, '#ffd97a'));
  }
  burst(world.rng, world.particles, enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 16, 200);
  sound(world, () => sfx.kill());
  if (enemy === world.boss) world.boss = null;
  // Drops: embers often, a heart rarely.
  const roll = world.rng();
  if (roll < 0.45) world.pickups.push(makePickup('ember', enemy.x, enemy.y));
  else if (roll < 0.53) world.pickups.push(makePickup('heart', enemy.x, enemy.y));
}

function damageEnemy(world, enemy, amount) {
  enemy.hp -= amount;
  enemy.flash = 0.12;
  if (enemy.hp <= 0) killEnemy(world, enemy, true);
}

function explodeBolt(world, bullet) {
  for (const e of world.enemies.slice()) {
    const d = Math.hypot(e.x - bullet.x, e.y - bullet.y);
    if (d < 80 + e.radius) damageEnemy(world, e, Math.round(bullet.damage * 0.5));
  }
  burst(world.rng, world.particles, bullet.x, bullet.y, '#ffb347', 14, 180);
}

function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.hurtCooldown > 0 || world.state !== 'playing') return;
  p.hp -= amount;
  p.hurtCooldown = PLAYER.contactDamageCooldown;
  world.shake = 10;
  world.flashRed = 0.35;
  burst(world.rng, world.particles, p.x, p.y, '#ff4d6d', 12, 160);
  sound(world, () => sfx.hurt());
  if (p.hp <= 0) {
    p.hp = 0;
    burst(world.rng, world.particles, p.x, p.y, '#ffc46b', 50, 260);
    endGame(world, false);
  }
}

function firePlayer(world) {
  const p = world.player;
  const base = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  const n = p.multishot;
  for (let i = 0; i < n; i++) {
    const offset = (i - (n - 1) / 2) * 0.14;
    world.bullets.push(
      makeBullet(p.x + Math.cos(base) * (p.radius + 6), p.y + Math.sin(base) * (p.radius + 6), base + offset, p.bulletSpeed, p.bulletDamage, p.pierce, p.explosive, true),
    );
  }
  p.fireCooldown = p.fireInterval;
  sound(world, () => sfx.shoot());
}

function updatePlaying(world, dt, input) {
  const p = world.player;
  world.timePlayed += dt;

  // --- Player movement and aim ---
  const mv = input.move;
  p.x = Math.min(ARENA.width - p.radius, Math.max(p.radius, p.x + mv.x * p.speed * dt));
  p.y = Math.min(ARENA.height - p.radius, Math.max(p.radius, p.y + mv.y * p.speed * dt));
  p.aimX = input.aimX;
  p.aimY = input.aimY;
  p.bob += dt * 3;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
  if (input.firing && p.fireCooldown <= 0) firePlayer(world);

  // --- Spawning ---
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      const type = world.spawnQueue.shift();
      const e = makeEnemy(type, world.wave, world.rng);
      world.enemies.push(e);
      if (type === 'boss') world.boss = e;
      world.spawnTimer = 0.65;
    }
  }

  // --- Enemies ---
  for (const e of world.enemies.slice()) {
    moveEnemy(e, p, dt, world.time);
    if (e.type === 'spitter') {
      e.shotCooldown -= dt;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (e.shotCooldown <= 0 && d < ENEMIES.spitter.range) {
        const angle = Math.atan2(p.y - e.y, p.x - e.x);
        world.enemyBullets.push(
          makeBullet(e.x, e.y, angle, ENEMIES.spitter.orbSpeed, ENEMIES.spitter.orbDamage, 0, false, false),
        );
        e.shotCooldown = ENEMIES.spitter.shotInterval;
      }
    }
    if (e.type === 'boss') {
      e.shotCooldown -= dt;
      if (e.shotCooldown <= 0) {
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 + world.time;
          world.enemyBullets.push(makeBullet(e.x, e.y, angle, 150, 14, 0, false, false));
        }
        e.shotCooldown = 4;
        sound(world, () => sfx.boss());
      }
      // The Maw sheds wisps while it lives.
      if (world.rng() < dt * 0.25 && world.enemies.length < 40) {
        const w = makeEnemy('wisp', world.wave, world.rng);
        w.x = e.x + (world.rng() - 0.5) * 120;
        w.y = e.y + (world.rng() - 0.5) * 120;
        world.enemies.push(w);
      }
    }
  }
  // Gentle separation so enemies never stack into one blob.
  for (let i = 0; i < world.enemies.length; i++) {
    for (let j = i + 1; j < world.enemies.length; j++) {
      const a = world.enemies[i];
      const b = world.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (d > 0 && d < min) {
        const push = ((min - d) / 2) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // --- Player bullets ---
  for (const b of world.bullets.slice()) {
    moveBullet(b, dt);
    if (b.life <= 0 || b.x < -20 || b.x > ARENA.width + 20 || b.y < -20 || b.y > ARENA.height + 20) {
      world.bullets.splice(world.bullets.indexOf(b), 1);
      continue;
    }
    for (const e of world.enemies.slice()) {
      if (b.hitIds.has(e.id)) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d < e.radius + b.radius) {
        b.hitIds.add(e.id);
        damageEnemy(world, e, b.damage);
        if (b.explosive) explodeBolt(world, b);
        sound(world, () => sfx.hit());
        burst(world.rng, world.particles, b.x, b.y, '#ffd97a', 4, 120);
        if (b.pierce > 0 && b.hitIds.size <= b.pierce) continue;
        world.bullets.splice(world.bullets.indexOf(b), 1);
        break;
      }
    }
  }

  // --- Enemy bullets ---
  for (const b of world.enemyBullets.slice()) {
    moveBullet(b, dt);
    if (b.life <= 0 || b.x < -20 || b.x > ARENA.width + 20 || b.y < -20 || b.y > ARENA.height + 20) {
      world.enemyBullets.splice(world.enemyBullets.indexOf(b), 1);
      continue;
    }
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < p.radius + b.radius) {
      world.enemyBullets.splice(world.enemyBullets.indexOf(b), 1);
      hurtPlayer(world, b.damage);
    }
  }

  // --- Contact damage ---
  for (const e of world.enemies.slice()) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < p.radius + e.radius - 2) {
      hurtPlayer(world, e.damage);
      // Shove the enemy back a little so one touch is not a chain.
      const angle = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(angle) * 26;
      e.y += Math.sin(angle) * 26;
    }
  }

  // --- Pickups (magnet + collect) ---
  for (const pk of world.pickups.slice()) {
    pk.bob += dt * 4;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
    if (d < p.magnetRadius) {
      const pull = (1 - d / p.magnetRadius) * 420;
      pk.x += ((p.x - pk.x) / d) * pull * dt;
      pk.y += ((p.y - pk.y) / d) * pull * dt;
    }
    if (d < p.radius + pk.radius) {
      world.pickups.splice(world.pickups.indexOf(pk), 1);
      if (pk.kind === 'ember') {
        world.score += EMBER_SCORE;
        world.embers += 1;
        sound(world, () => sfx.pickup());
      } else {
        p.hp = Math.min(p.maxHp, p.hp + HEART_HEAL);
        world.texts.push(makeFloatText(p.x, p.y - 26, `+${HEART_HEAL} HP`, '#ff5c8a'));
        sound(world, () => sfx.heart());
      }
    }
  }

  // --- Wave cleared? ---
  if (world.state === 'playing' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.score += WAVE_CLEAR_BONUS;
    world.texts.push(makeFloatText(ARENA.width / 2, ARENA.height / 2 - 80, `WAVE CLEAR  +${WAVE_CLEAR_BONUS}`, '#7dff9e'));
    if (world.wave >= TOTAL_WAVES) endGame(world, true);
    else offerUpgrades(world);
  }
}

function updateAmbient(world, dt) {
  for (const a of world.ash) {
    a.y += a.speed * dt;
    a.x += a.drift * dt;
    if (a.y > ARENA.height + 4) {
      a.y = -4;
      a.x = world.rng() * ARENA.width;
    }
  }
  for (const pt of world.particles.slice()) {
    moveParticle(pt, dt);
    if (pt.life <= 0) world.particles.splice(world.particles.indexOf(pt), 1);
  }
  for (const t of world.texts.slice()) {
    t.life -= dt;
    t.y -= 26 * dt;
    if (t.life <= 0) world.texts.splice(world.texts.indexOf(t), 1);
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  if (world.flashRed > 0) world.flashRed -= dt;
}

export function update(world, dt, input) {
  world.time += dt;
  updateAmbient(world, dt);
  if (world.state === 'playing') updatePlaying(world, dt, input);
}

// --- Deterministic scenes for screenshots (?shot=...) ---
export function debugScene(world, name) {
  const p = world.player;
  if (name === 'start') {
    world.state = 'title';
  } else if (name === 'play') {
    startGame(world);
    world.wave = 3;
    world.score = 1250;
    world.embers = 18;
    p.hp = 80;
    p.x = 380;
    p.y = 320;
    p.aimX = 620;
    p.aimY = 220;
    const spots = [
      ['wisp', 620, 210],
      ['wisp', 700, 330],
      ['swift', 560, 420],
      ['bulwark', 760, 180],
      ['spitter', 820, 420],
      ['wisp', 250, 180],
      ['swift', 300, 460],
    ];
    for (const [type, x, y] of spots) {
      const e = makeEnemy(type, 3, world.rng);
      e.x = x;
      e.y = y;
      world.enemies.push(e);
    }
    for (let i = 0; i < 4; i++) {
      world.bullets.push(makeBullet(p.x + 40 + i * 26, p.y - 30 - i * 12, -0.5, 560, 12, 0, false, true));
    }
    world.pickups.push(makePickup('ember', 480, 380));
    world.pickups.push(makePickup('ember', 520, 410));
    world.pickups.push(makePickup('heart', 300, 300));
    burst(world.rng, world.particles, 620, 210, '#8f7bff', 12, 160);
    world.spawnQueue = [];
  } else if (name === 'win') {
    startGame(world);
    world.wave = 10;
    world.score = 9840;
    world.kills = 212;
    world.timePlayed = 512;
    world.embers = 96;
    endGame(world, true);
  } else if (name === 'lose') {
    startGame(world);
    world.wave = 7;
    world.score = 4310;
    world.kills = 118;
    world.timePlayed = 316;
    world.embers = 41;
    world.player.hp = 0;
    endGame(world, false);
  }
  return world.state;
}

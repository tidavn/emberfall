// Entity factories and per-entity updates. Entities are plain objects;
// world.js owns the lists and the rules that move them.

import { ARENA, ENEMIES, PLAYER, enemyHpScale, enemySpeedScale } from './config.js';
import { range } from './random.js';

let nextId = 1;

export function makePlayer() {
  return {
    id: nextId++,
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    multishot: 1,
    pierce: 0,
    explosive: false,
    magnetRadius: PLAYER.magnetRadius,
    fireCooldown: 0,
    hurtCooldown: 0,
    aimX: ARENA.width / 2 + 100,
    aimY: ARENA.height / 2,
    bob: 0,
  };
}

export function spawnEdgePosition(rng) {
  const side = Math.floor(rng() * 4);
  const margin = 30;
  if (side === 0) return { x: range(rng, margin, ARENA.width - margin), y: -margin };
  if (side === 1) return { x: range(rng, margin, ARENA.width - margin), y: ARENA.height + margin };
  if (side === 2) return { x: -margin, y: range(rng, margin, ARENA.height - margin) };
  return { x: ARENA.width + margin, y: range(rng, margin, ARENA.height - margin) };
}

export function makeEnemy(type, wave, rng) {
  const def = ENEMIES[type];
  const pos = spawnEdgePosition(rng);
  return {
    id: nextId++,
    type,
    x: pos.x,
    y: pos.y,
    radius: def.radius,
    hp: Math.round(def.hp * enemyHpScale(wave)),
    maxHp: Math.round(def.hp * enemyHpScale(wave)),
    speed: def.speed * enemySpeedScale(wave),
    damage: def.damage,
    score: def.score,
    color: def.color,
    shotCooldown: range(rng, 1, def.shotInterval ?? 2),
    wobble: range(rng, 0, Math.PI * 2),
    flash: 0,
  };
}

export function makeBullet(x, y, angle, speed, damage, pierce, explosive, friendly) {
  return {
    id: nextId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 5,
    damage,
    pierce,
    explosive,
    friendly,
    life: 1.6,
    hitIds: new Set(),
  };
}

export function makeParticle(x, y, vx, vy, life, size, color) {
  return { id: nextId++, x, y, vx, vy, life, maxLife: life, size, color };
}

export function burst(rng, list, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const v = range(rng, speed * 0.3, speed);
    list.push(
      makeParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, range(rng, 0.3, 0.8), range(rng, 2, 5), color),
    );
  }
}

export function makePickup(kind, x, y) {
  return { id: nextId++, kind, x, y, radius: 10, bob: Math.random() * Math.PI * 2 };
}

export function makeFloatText(x, y, text, color) {
  return { id: nextId++, x, y, text, color, life: 0.9, maxLife: 0.9 };
}

// --- Per-entity movement (pure position/velocity work, no rules) ---

export function moveEnemy(e, player, dt, time) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (e.type === 'spitter') {
    // Keep a firing distance: close in when far, back off when too near.
    const want = 300;
    const dir = dist > want + 40 ? 1 : dist < want - 60 ? -1 : 0;
    e.x += (dx / dist) * e.speed * dir * dt;
    e.y += (dy / dist) * e.speed * dir * dt;
    // A slow sideways drift so spitters never sit in a straight line.
    e.x += Math.cos(time * 0.7 + e.wobble) * 22 * dt;
    e.y += Math.sin(time * 0.9 + e.wobble) * 22 * dt;
  } else {
    // Chase, with a sinusoidal wobble so paths feel organic.
    const wob = Math.sin(time * 2 + e.wobble) * 0.35;
    const angle = Math.atan2(dy, dx) + wob;
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
  }
  if (e.flash > 0) e.flash -= dt;
}

export function moveBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
}

export function moveParticle(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.96;
  p.vy *= 0.96;
  p.life -= dt;
}

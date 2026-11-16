// Emberfall rendering: everything drawn on one canvas. The world holds the
// facts; this module only paints them. Layout helpers (card rectangles)
// are shared with main.js so clicks land where the art says they do.

import { ARENA, BOSS_WAVE, PALETTE, TOTAL_WAVES } from './config.js';

export function upgradeCardRects() {
  const w = 250;
  const h = 150;
  const gap = 24;
  const total = w * 3 + gap * 2;
  const x0 = (ARENA.width - total) / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, world) {
  const g = ctx.createRadialGradient(
    ARENA.width / 2, ARENA.height / 2, 80,
    ARENA.width / 2, ARENA.height / 2, 620,
  );
  g.addColorStop(0, PALETTE.background);
  g.addColorStop(1, PALETTE.backgroundEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  // Faint floor grid so motion reads.
  ctx.strokeStyle = PALETTE.floorGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= ARENA.width; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA.height);
  }
  for (let y = 0; y <= ARENA.height; y += 60) {
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA.width, y);
  }
  ctx.stroke();

  // Drifting ash motes.
  ctx.fillStyle = PALETTE.ash;
  for (const a of world.ash) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(a.y * 0.05);
    ctx.fillRect(a.x, a.y, a.size, a.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, world) {
  const p = world.player;
  const flicker = 0.85 + Math.sin(p.bob * 2) * 0.15;

  // Lantern glow.
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 130);
  glow.addColorStop(0, 'rgba(255, 196, 107, 0.34)');
  glow.addColorStop(1, 'rgba(255, 196, 107, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
  ctx.fill();

  // Hurt blink.
  if (p.hurtCooldown > 0 && Math.floor(p.hurtCooldown * 14) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  // Body: a little lantern spirit.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Eyes look toward the aim.
  const angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  const ex = Math.cos(angle) * 5;
  const ey = Math.sin(angle) * 5;
  ctx.fillStyle = '#241a08';
  ctx.beginPath();
  ctx.arc(p.x + ex - 4, p.y + ey - 2, 2.4, 0, Math.PI * 2);
  ctx.arc(p.x + ex + 4, p.y + ey - 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Aim tick.
  ctx.strokeStyle = `rgba(255, 196, 107, ${0.7 * flicker})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(angle) * (p.radius + 4), p.y + Math.sin(angle) * (p.radius + 4));
  ctx.lineTo(p.x + Math.cos(angle) * (p.radius + 14), p.y + Math.sin(angle) * (p.radius + 14));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx, e) {
  // Shadow body with a ragged edge.
  ctx.fillStyle = e.color;
  ctx.globalAlpha = e.flash > 0 ? 0.95 : 0.85;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (e.flash > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes.
  ctx.fillStyle = PALETTE.enemyEye;
  const look = Math.atan2(e.y - 300, e.x - 480);
  const ex = Math.cos(look) * 3;
  const ey = Math.sin(look) * 3;
  ctx.beginPath();
  ctx.arc(e.x + ex - e.radius * 0.32, e.y + ey - 2, 2.6, 0, Math.PI * 2);
  ctx.arc(e.x + ex + e.radius * 0.32, e.y + ey - 2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Horns for the boss, spikes for the bulwark.
  if (e.type === 'boss') {
    ctx.strokeStyle = '#ff8fa3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x - e.radius * 0.7, e.y - e.radius * 0.6);
    ctx.lineTo(e.x - e.radius * 1.05, e.y - e.radius * 1.25);
    ctx.moveTo(e.x + e.radius * 0.7, e.y - e.radius * 0.6);
    ctx.lineTo(e.x + e.radius * 1.05, e.y - e.radius * 1.25);
    ctx.stroke();
  }
  // Health bar for tough enemies.
  if (e.maxHp >= 60) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}

function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.bulletCore;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of world.enemyBullets) {
    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7f2';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx, world) {
  for (const pk of world.pickups) {
    const bobY = Math.sin(pk.bob) * 3;
    if (pk.kind === 'ember') {
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff0c8';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.heart;
      ctx.beginPath();
      ctx.arc(pk.x - 4, pk.y + bobY - 2, 5, 0, Math.PI * 2);
      ctx.arc(pk.x + 4, pk.y + bobY - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pk.x - 8.5, pk.y + bobY);
      ctx.lineTo(pk.x, pk.y + bobY + 8);
      ctx.lineTo(pk.x + 8.5, pk.y + bobY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts(ctx, world) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, 12, 12, 300, 64, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // HP bar.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, 24, 24, 180, 16, 8);
  ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#ff9d2e' : PALETTE.danger;
  const hpW = 180 * Math.max(0, p.hp / p.maxHp);
  if (hpW > 0) {
    roundRect(ctx, 24, 24, hpW, 16, 8);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, 212, 37);

  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`Wave ${Math.max(1, world.wave)} / ${TOTAL_WAVES}`, 24, 62);
  ctx.fillText(`Embers ${world.embers}`, 150, 62);

  // Score, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`Score ${world.score}`, ARENA.width - 16, 36);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  const left = world.spawnQueue.length + world.enemies.length;
  ctx.fillText(world.state === 'playing' ? `Shadows left: ${left}` : `Best ${world.best}`, ARENA.width - 16, 58);

  // Boss bar.
  if (world.boss) {
    const bw = 420;
    const bx = (ARENA.width - bw) / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, bx, ARENA.height - 34, bw, 14, 7);
    ctx.fill();
    ctx.fillStyle = PALETTE.enemyBoss;
    const w = bw * Math.max(0, world.boss.hp / world.boss.maxHp);
    if (w > 0) {
      roundRect(ctx, bx, ARENA.height - 34, w, 14, 7);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ASHEN MAW', ARENA.width / 2, ARENA.height - 40);
  }
}

function drawCentered(ctx, lines, y0, gap) {
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, ARENA.width / 2, y0 + i * gap);
  });
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  drawCentered(ctx, [
    { text: 'EMBERFALL', font: 'bold 72px system-ui, sans-serif', color: PALETTE.player },
    { text: 'Ashes of the Last Lantern', font: 'italic 22px Georgia, serif', color: PALETTE.text },
  ], 190, 56);
  drawCentered(ctx, [
    { text: 'The dark has swallowed every light but yours. Hold the arena', font: '17px system-ui, sans-serif', color: PALETTE.textDim },
    { text: 'through 10 waves of shadow — and face the Ashen Maw.', font: '17px system-ui, sans-serif', color: PALETTE.textDim },
  ], 300, 26);
  drawCentered(ctx, [
    { text: 'WASD / Arrows — move      Mouse — aim      Hold Click / Space — shoot', font: 'bold 16px system-ui, sans-serif', color: PALETTE.text },
    { text: 'P — pause      M — mute      R — restart', font: '15px system-ui, sans-serif', color: PALETTE.textDim },
  ], 380, 28);
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click or press Enter to begin', ARENA.width / 2, 470);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Best score: ${world.best}`, ARENA.width / 2, 505);
  }
}

function drawUpgrade(ctx, world, mouse) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  drawCentered(ctx, [
    { text: `WAVE ${world.wave} CLEAR`, font: 'bold 40px system-ui, sans-serif', color: PALETTE.good },
    { text: 'Choose one blessing before the next wave:', font: '18px system-ui, sans-serif', color: PALETTE.text },
  ], 170, 44);
  const rects = upgradeCardRects();
  world.upgradeChoices.forEach((up, i) => {
    const r = rects[i];
    const hover = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
    ctx.fillStyle = hover ? PALETTE.cardHover : PALETTE.card;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.cardBorder;
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Press ${i + 1}`, r.x + r.w / 2, r.y + 26);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(up.name, r.x + r.w / 2, r.y + 62, r.w - 20);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, up.blurb, r.x + r.w / 2, r.y + 96, r.w - 28, 20);
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.65)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  drawCentered(ctx, [
    { text: 'PAUSED', font: 'bold 48px system-ui, sans-serif', color: PALETTE.text },
    { text: 'Press P to resume', font: '18px system-ui, sans-serif', color: PALETTE.textDim },
  ], 280, 46);
}

function drawEnd(ctx, world, won) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.68)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  const title = won ? 'THE LIGHT ENDURES' : 'THE LIGHT GOES OUT';
  const color = won ? PALETTE.good : PALETTE.danger;
  drawCentered(ctx, [
    { text: title, font: 'bold 52px system-ui, sans-serif', color },
    { text: won ? 'You survived all ten waves. The lantern burns on.' : `The shadows took you on wave ${world.wave}.`, font: '19px Georgia, serif', color: PALETTE.text },
  ], 210, 52);
  drawCentered(ctx, [
    { text: `Score  ${world.score}`, font: 'bold 26px system-ui, sans-serif', color: PALETTE.text },
    { text: `Waves cleared  ${won ? TOTAL_WAVES : world.wave - 1}      Shadows banished  ${world.kills}`, font: '17px system-ui, sans-serif', color: PALETTE.textDim },
    { text: `Time  ${formatTime(world.timePlayed)}      Best  ${world.best}`, font: '17px system-ui, sans-serif', color: PALETTE.textDim },
  ], 330, 40);
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press R or click to play again', ARENA.width / 2, 480);
  ctx.globalAlpha = 1;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function render(ctx, world, mouse) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(ctx, world);
  if (world.state !== 'title') {
    drawPickups(ctx, world);
    for (const e of world.enemies) drawEnemy(ctx, e);
    drawBullets(ctx, world);
    if (world.state !== 'over' && world.state !== 'win') drawPlayer(ctx, world);
    drawParticles(ctx, world);
    drawFloatTexts(ctx, world);
    drawHud(ctx, world);
  }
  if (world.state === 'title') drawTitle(ctx, world);
  if (world.state === 'upgrade') drawUpgrade(ctx, world, mouse);
  if (world.state === 'paused') drawPaused(ctx);
  if (world.state === 'over') drawEnd(ctx, world, false);
  if (world.state === 'win') drawEnd(ctx, world, true);
  // Hurt vignette.
  if (world.flashRed > 0) {
    ctx.fillStyle = `rgba(255, 40, 70, ${world.flashRed * 0.5})`;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }
  ctx.restore();
}

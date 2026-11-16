// Emberfall configuration: arena, palette, tuning, enemies, waves, upgrades.
// One place for every number the rest of the game reads, so balance can be
// tuned without touching logic.

export const ARENA = { width: 960, height: 600 };

// Deep indigo night, warm amber lantern light. All art is drawn in code;
// no image or font files are loaded.
export const PALETTE = {
  background: '#0b0d1f',
  backgroundEdge: '#05060f',
  floorGrid: 'rgba(120, 140, 255, 0.05)',
  ash: 'rgba(200, 200, 220, 0.5)',
  player: '#ffc46b',
  playerCore: '#fff3d6',
  playerRing: '#ff9d2e',
  bullet: '#ffd97a',
  bulletCore: '#fff8e0',
  enemyWisp: '#8f7bff',
  enemySwift: '#ff7ad9',
  enemyBulwark: '#7a5cff',
  enemySpitter: '#5ce1e6',
  enemyBoss: '#ff4d6d',
  enemyEye: '#ffffff',
  ember: '#ffb347',
  heart: '#ff5c8a',
  text: '#f2ead8',
  textDim: '#9a94b8',
  hudPanel: 'rgba(10, 12, 30, 0.72)',
  hudBorder: 'rgba(255, 196, 107, 0.35)',
  card: 'rgba(16, 20, 48, 0.92)',
  cardHover: 'rgba(52, 44, 96, 0.95)',
  cardBorder: 'rgba(255, 196, 107, 0.55)',
  danger: '#ff4d6d',
  good: '#7dff9e',
};

export const PLAYER = {
  radius: 16,
  speed: 235, // px per second
  maxHp: 100,
  fireInterval: 0.22, // seconds between ember bolts
  bulletSpeed: 560,
  bulletDamage: 12,
  bulletRadius: 5,
  magnetRadius: 70,
  contactDamageCooldown: 0.6, // seconds of invulnerability after a hit
};

// Enemy types. hp / speed / radius / score / damage scale with the wave.
export const ENEMIES = {
  wisp: {
    name: 'Wisp',
    radius: 15,
    hp: 20,
    speed: 62,
    damage: 10,
    score: 50,
    color: PALETTE.enemyWisp,
  },
  swift: {
    name: 'Swift',
    radius: 11,
    hp: 12,
    speed: 132,
    damage: 8,
    score: 80,
    color: PALETTE.enemySwift,
  },
  bulwark: {
    name: 'Bulwark',
    radius: 26,
    hp: 70,
    speed: 38,
    damage: 18,
    score: 150,
    color: PALETTE.enemyBulwark,
  },
  spitter: {
    name: 'Spitter',
    radius: 14,
    hp: 24,
    speed: 55,
    damage: 6, // its orbs do the damage
    score: 120,
    color: PALETTE.enemySpitter,
    ranged: true,
    range: 320,
    shotInterval: 2.4,
    orbSpeed: 190,
    orbDamage: 12,
  },
  boss: {
    name: 'Ashen Maw',
    radius: 52,
    hp: 650,
    speed: 30,
    damage: 25,
    score: 2000,
    color: PALETTE.enemyBoss,
  },
};

// Waves: what spawns, in what mix. The spawner trickles them in over the
// wave so the arena never floods at once.
export const WAVES = [
  { wisp: 6 },
  { wisp: 8, swift: 3 },
  { wisp: 10, swift: 5, spitter: 1 },
  { wisp: 10, swift: 6, bulwark: 2, spitter: 2 },
  { wisp: 12, swift: 8, bulwark: 3, spitter: 2 },
  { wisp: 12, swift: 10, bulwark: 4, spitter: 4 },
  { wisp: 14, swift: 12, bulwark: 5, spitter: 4 },
  { wisp: 16, swift: 12, bulwark: 6, spitter: 6 },
  { wisp: 18, swift: 14, bulwark: 8, spitter: 6 },
  { wisp: 10, swift: 8, bulwark: 4, spitter: 4, boss: 1 },
];

export const TOTAL_WAVES = WAVES.length;

// Enemy hp grows a little every wave so later waves stay threatening.
export function enemyHpScale(wave) {
  return 1 + (wave - 1) * 0.12;
}
export function enemySpeedScale(wave) {
  return 1 + (wave - 1) * 0.03;
}

// Upgrades offered between waves. id, name, blurb, and the effect applied
// to the player's stats. The pool is sampled without replacement.
export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Embers',
    blurb: 'Fire 22% faster.',
    apply: (s) => { s.fireInterval *= 0.78; },
  },
  {
    id: 'heavy',
    name: 'Heavy Embers',
    blurb: '+45% bolt damage.',
    apply: (s) => { s.bulletDamage *= 1.45; },
  },
  {
    id: 'twin',
    name: 'Twin Flames',
    blurb: '+1 bolt per shot.',
    apply: (s) => { s.multishot += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    blurb: 'Bolts pierce +1 enemy.',
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'swift',
    name: 'Swift Steps',
    blurb: '+14% move speed.',
    apply: (s) => { s.speed *= 1.14; },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    blurb: 'Pickups fly to you from much further away.',
    apply: (s) => { s.magnetRadius *= 1.8; },
  },
  {
    id: 'heart',
    name: 'Kindled Heart',
    blurb: '+30 max health and heal 30 now.',
    apply: (s) => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 30); },
  },
  {
    id: 'burst',
    name: 'Burst Rounds',
    blurb: 'Bolts explode, hurting nearby shadows.',
    apply: (s) => { s.explosive = true; },
  },
  {
    id: 'haste',
    name: 'Haste Sigil',
    blurb: '+10% move speed and +10% fire rate.',
    apply: (s) => { s.speed *= 1.1; s.fireInterval *= 0.9; },
  },
];

export const UPGRADE_CHOICES = 3;
export const WAVE_CLEAR_BONUS = 250;
export const EMBER_SCORE = 10;
export const HEART_HEAL = 25;
export const BOSS_WAVE = 10;

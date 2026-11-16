// Screenshot scenes (?shot=start|play|win|lose) and the scripted demo
// driver that keeps the "play" shot alive: the player circles the arena
// and fires at the nearest shadow, so a still frame shows real action.

import { debugScene } from './world.js';

export function setupShot(world, name) {
  return debugScene(world, name);
}

// An input object for the demo driver: move in a slow circle, aim at the
// nearest enemy, always firing. Used only for the play screenshot.
export function demoInput(world, time) {
  const p = world.player;
  const angle = time * 0.55;
  const move = { x: Math.cos(angle), y: Math.sin(angle) * 0.8 };
  let aimX = p.x + 200;
  let aimY = p.y - 100;
  let best = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) {
      best = d;
      aimX = e.x;
      aimY = e.y;
    }
  }
  return { move, aimX, aimY, firing: true };
}

// Emberfall bootstrap: canvas, input, the game loop, and menu input.
// The world owns the rules; this file only wires input to the world and
// the world to the canvas.

import { createInput } from './input.js';
import { render, upgradeCardRects } from './render.js';
import { chooseUpgrade, createWorld, startGame, update } from './world.js';
import { demoInput, setupShot } from './shots.js';
import { runSelfTest } from './selftest.js';
import { isMuted, setMuted } from './audio.js';
import { makeRng } from './random.js';

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

// Self-test mode (?selftest=1): run the checks and print them, no loop.
if (params.has('selftest')) {
  const out = runSelfTest();
  const pre = document.createElement('pre');
  pre.id = 'selftest';
  pre.textContent = out;
  document.body.appendChild(pre);
  document.title = out.split('\n')[0];
} else {
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 20261116);
  const world = createWorld(makeRng(seed), shot !== null);
  if (shot) setupShot(world, shot);

  let last = performance.now();

  function liveInput() {
    return {
      move: input.moveVector(),
      aimX: input.mouseX || world.player.x + 100,
      aimY: input.mouseY || world.player.y,
      firing: input.mouseDown || input.held('Space'),
    };
  }

  function handleMenus(pressed, clicked) {
    if (world.state === 'title') {
      if (pressed.includes('Enter') || clicked) startGame(world);
      return;
    }
    if (world.state === 'upgrade') {
      for (const code of pressed) {
        if (code === 'Digit1') chooseUpgrade(world, 0);
        if (code === 'Digit2') chooseUpgrade(world, 1);
        if (code === 'Digit3') chooseUpgrade(world, 2);
      }
      if (clicked) {
        const rects = upgradeCardRects();
        rects.forEach((r, i) => {
          if (input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
            chooseUpgrade(world, i);
          }
        });
      }
      return;
    }
    if (world.state === 'playing' && pressed.includes('KeyP')) {
      world.state = 'paused';
      return;
    }
    if (world.state === 'paused' && pressed.includes('KeyP')) {
      world.state = 'playing';
      return;
    }
    if ((world.state === 'over' || world.state === 'win') && (pressed.includes('KeyR') || clicked)) {
      startGame(world);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const pressed = input.takePressed();
    if (pressed.includes('KeyM')) setMuted(!isMuted());
    const clicked = input.mouseClicked;
    input.clearClick();
    handleMenus(pressed, clicked);

    if (shot === 'play') update(world, dt, demoInput(world, world.time));
    else update(world, dt, liveInput());
    render(ctx, world, { x: input.mouseX, y: input.mouseY });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// Keyboard and mouse input. Tracks held keys, the mouse position in
// canvas coordinates, and edge-triggered presses (keys/clicks that fired
// once since the last read). The game polls this every frame; menus read
// the pressed queue.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      keys.add(event.code);
      pressed.push(event.code);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toCanvas(event);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = toCanvas(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseDown() { return mouseDown; },
    get mouseClicked() { return mouseClicked; },
    clearClick() { mouseClicked = false; },
    held(code) { return keys.has(code); },
    // True when any of the codes is held.
    anyHeld(codes) { return codes.some((c) => keys.has(c)); },
    // Returns and clears the presses since the last call.
    takePressed() {
      const out = pressed.splice(0, pressed.length);
      return out;
    },
    // Movement vector from WASD/arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
  };
}

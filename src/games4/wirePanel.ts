// The wiring under Zero Logic Escape Rooms. Nobody is told about it: you only
// get here by drawing a door in Draw and Swap, finding the way out of the
// hallway behind it, and getting dumped on this hub without a word. The ports
// poke out of the bottom edge of the card itself. Hook all three matching
// wires from one end of the card's underside to the other and a button drops
// down.
//
// The button doesn't take you anywhere. It switches the card between Zero
// Logic Escape Rooms and Zero Logic Escape Rooms 2, and you go in through the
// card like you would with any other game.

const KICKED_KEY = "games4-kicked-out";
const WIRED_KEY = "zero-logic-escape-rooms-wired";
const SEQUEL_KEY = "zero-logic-escape-rooms-showing-2";

export const PORT_COUNT = 6;
export const WIRES_NEEDED = 3;
export const WIRE_COLORS = ["#ff4fa3", "#ffe066", "#38d9a9"];

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value = true): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Nothing to remember it with, so the secret closes behind you.
  }
}

// Behind the Door calls this on its way out, so the hub knows you didn't
// arrive here the normal way.
export function markKickedOut(): void {
  writeFlag(KICKED_KEY);
}

export function wasKickedOut(): boolean {
  return readFlag(KICKED_KEY);
}

export function wiresAreDone(): boolean {
  return readFlag(WIRED_KEY);
}

/** Which of the two games the card is currently showing. */
export function showingSequel(): boolean {
  return readFlag(SEQUEL_KEY);
}

export function flipSequel(): void {
  writeFlag(SEQUEL_KEY, !showingSequel());
}

/**
 * Six ports along the bottom: three colours, twice each, shuffled so the
 * matching one is never the port next door. `rolls` is one random number per
 * swap, handed in so the shuffle can be tested.
 */
export function makePorts(rolls: number[]): string[] {
  const ports = WIRE_COLORS.flatMap((color) => [color, color]);
  for (let index = ports.length - 1; index > 0; index -= 1) {
    const roll = rolls[ports.length - 1 - index] ?? 0;
    const swap = Math.floor(roll * (index + 1)) % (index + 1);
    const held = ports[index] as string;
    ports[index] = ports[swap] as string;
    ports[swap] = held;
  }
  return ports;
}

/** The two ends of each colour, for showing wiring that is already done. */
export function matchedPairs(ports: string[]): [number, number][] {
  const seen = new Map<string, number>();
  const pairs: [number, number][] = [];
  ports.forEach((color, index) => {
    const first = seen.get(color);
    if (first === undefined) seen.set(color, index);
    else pairs.push([first, index]);
  });
  return pairs;
}

export function canConnect(ports: string[], a: number, b: number, wired: number[]): boolean {
  if (a === b) return false;
  if (wired.includes(a) || wired.includes(b)) return false;
  return ports[a] === ports[b];
}

interface Wire {
  a: number;
  b: number;
  color: string;
}

function portX(index: number): number {
  return ((index + 0.5) / PORT_COUNT) * 100;
}

function wirePath(a: number, b: number): string {
  const x1 = portX(a);
  const x2 = portX(b);
  // Out of one port, down into a slack loop, and back up into the other.
  return `M ${x1} 1 C ${x1} 26, ${x2} 26, ${x2} 1`;
}

/**
 * Hangs the panel under the card. `onChange` runs whenever the button is
 * pressed, so the hub can redraw the card as whichever game it now says.
 * Wiring that was finished on an earlier visit comes back already hooked up.
 */
export function mountWirePanel(host: HTMLElement, onChange: () => void): void {
  const ports = makePorts([Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]);
  const wired: number[] = [];
  const wires: Wire[] = [];
  let armed: number | null = null;

  const panel = document.createElement("div");
  panel.className = "wire-panel";
  panel.innerHTML = `
    <svg class="wire-lines" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path class="wire-live" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="wire-ports">
      ${ports
        .map(
          (color, index) =>
            `<button class="wire-port" type="button" data-port="${index}" style="--port:${color};left:${portX(index)}%" aria-label="Wire port ${index + 1}"></button>`
        )
        .join("")}
    </div>
    <p class="wire-note" aria-live="polite">${
      wiresAreDone() ? "Wired. The button switches it." : "All three. Same colour to same colour."
    }</p>
  `;
  host.appendChild(panel);

  const lines = panel.querySelector("svg") as SVGSVGElement;
  const live = panel.querySelector(".wire-live") as SVGPathElement;
  const note = panel.querySelector(".wire-note") as HTMLParagraphElement;

  const portButton = (index: number): HTMLButtonElement | null =>
    panel.querySelector(`[data-port="${index}"]`);

  const drawWire = (wire: Wire): void => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "wire-line");
    path.setAttribute("d", wirePath(wire.a, wire.b));
    path.setAttribute("stroke", wire.color);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    lines.appendChild(path);
  };

  const disarm = (): void => {
    if (armed !== null) portButton(armed)?.classList.remove("is-armed");
    armed = null;
    live.removeAttribute("d");
  };

  // While one end is in your hand, the wire follows the pointer.
  panel.addEventListener("pointermove", (event) => {
    if (armed === null) return;
    const box = lines.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.height) * 30;
    live.setAttribute("d", `M ${portX(armed)} 1 C ${portX(armed)} 26, ${x} ${y}, ${x} ${y}`);
    live.setAttribute("stroke", ports[armed] ?? "#fff");
  });

  panel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-port]");
    if (!button) return;
    const index = Number(button.dataset["port"]);
    if (wired.includes(index)) return;

    if (armed === null) {
      armed = index;
      button.classList.add("is-armed");
      note.textContent = "Now the other end.";
      return;
    }

    if (canConnect(ports, armed, index, wired)) {
      const wire: Wire = { a: armed, b: index, color: ports[index] as string };
      wires.push(wire);
      wired.push(wire.a, wire.b);
      drawWire(wire);
      portButton(wire.a)?.classList.add("is-wired");
      portButton(wire.b)?.classList.add("is-wired");
      disarm();
      const left = WIRES_NEEDED - wires.length;
      note.textContent =
        left <= 0 ? "Something came down." : left === 1 ? "One more wire." : `${left} more wires.`;
      if (left <= 0) addButton(true);
      return;
    }

    // Wrong colour, or you clicked the same port twice.
    button.classList.add("is-wrong");
    window.setTimeout(() => button.classList.remove("is-wrong"), 320);
    disarm();
    note.textContent = "Not that one.";
  });

  // The button that comes down out of the card. All it does is flip the card
  // between the two games, and it stays down while the card says the second.
  function addButton(dropping: boolean): void {
    if (panel.querySelector(".wire-button")) return;
    const button = document.createElement("button");
    button.className = `wire-button${dropping ? " is-dropping" : ""}${showingSequel() ? " is-pressed" : ""}`;
    button.type = "button";
    button.textContent = "▼";
    button.setAttribute("aria-label", "Switch between Zero Logic Escape Rooms and Zero Logic Escape Rooms 2");
    button.setAttribute("aria-pressed", String(showingSequel()));
    panel.appendChild(button);
    button.addEventListener("click", () => {
      writeFlag(WIRED_KEY);
      flipSequel();
      button.classList.toggle("is-pressed", showingSequel());
      button.setAttribute("aria-pressed", String(showingSequel()));
      note.textContent = showingSequel() ? "It says 2 now." : "Back to the first one.";
      onChange();
    });
  }

  // Wiring you did on another visit is still wired when you come back: the
  // two wires it took, not every pair on the strip.
  if (wiresAreDone()) {
    for (const [a, b] of matchedPairs(ports).slice(0, WIRES_NEEDED)) {
      const color = ports[a] ?? "#fff";
      wires.push({ a, b, color });
      wired.push(a, b);
      drawWire({ a, b, color });
      portButton(a)?.classList.add("is-wired");
      portButton(b)?.classList.add("is-wired");
    }
    addButton(false);
  }
}

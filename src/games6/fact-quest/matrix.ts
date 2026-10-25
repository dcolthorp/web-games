import { boing, chime, whoosh } from "../../shared/sfx";
import { FARMER, GEM, JESTER, MUSHROOM_MAN, PURPLE_SMITH, SMITH, VOID, WITCH, spriteImage } from "./sprites";

// THE MATRIX: where the strange map's portal takes Olly. It's a side-scroller
// in black space: walk left and right, jump onto wrecked houses, torn tents and
// broken fences, grab diamonds, and talk to the survivors who got sucked in
// too. People float in space in the background. A portal at the far right end
// leads back home. Falling off into space means a math battle with THE VOID:
// win and Olly climbs back up, lose and he's spat out at the very start.
// Partway along there's a weird vault; the key from the bunker's metal box
// opens it, and a beam of light blasts Olly out of the Matrix.

export interface MatrixQuestion {
  text: string;
  answer: number;
  remainder: number;
  isDiv: boolean;
  hint: string;
}

export interface MatrixApi {
  learner: string;
  newQuestion(): MatrixQuestion;
  recordAnswer(correct: boolean): void;
  // Olly's fight health and sword, from the world.
  fighter(): { health: number; sword: number; pigs: number };
  // Olly as he looks (cosmetics and all), and whether he has the vault key.
  look(): string;
  hasVaultKey(): boolean;
  muted(): boolean;
  addGems(gems: number): void;
  escape(): void;
  // The vault's beam of light blasted Olly out of the Matrix.
  beamOut(): void;
  leave(): void;
}

const VIEW_W = 960;
const VIEW_H = 576;
const GROUND_Y = 470;
const GRAVITY = 1900;
const JUMP = 760;
const SPEED = 230;
const EXIT_X = 6200;
const VAULT_X = 3330;
const START_X = 120;
const VOID_HP = 6;
const VOID_DAMAGE = 35;
// After losing to the Void, this many right answers to play again.
const RIGHT_TO_ESCAPE = 3;
const LEVEL_W = 6500;

// The ground, with holes into space between the pieces.
const GROUND: [number, number][] = [
  [0, 900], [1020, 1720], [1880, 2620], [2780, 3420], [3580, 4320], [4480, 5240], [5380, LEVEL_W],
];

// Everything you can land on from above. Debris floats; the rest stand on the
// ground.
type Kind = "house" | "tent" | "fence" | "debris";
const BLOCKS: { kind: Kind; x: number; w: number; top: number }[] = [
  { kind: "house", x: 300, w: 170, top: 350 },
  { kind: "tent", x: 600, w: 130, top: 395 },
  { kind: "fence", x: 800, w: 90, top: 430 },
  { kind: "debris", x: 925, w: 80, top: 400 },
  { kind: "fence", x: 1080, w: 140, top: 430 },
  { kind: "house", x: 1300, w: 190, top: 310 },
  { kind: "debris", x: 1560, w: 90, top: 230 },
  { kind: "debris", x: 1745, w: 110, top: 380 },
  { kind: "tent", x: 1950, w: 140, top: 390 },
  { kind: "house", x: 2180, w: 160, top: 330 },
  { kind: "house", x: 2380, w: 120, top: 260 },
  { kind: "debris", x: 2640, w: 120, top: 360 },
  { kind: "fence", x: 2850, w: 120, top: 430 },
  { kind: "house", x: 3050, w: 200, top: 300 },
  { kind: "debris", x: 3300, w: 80, top: 210 },
  { kind: "debris", x: 3450, w: 100, top: 370 },
  { kind: "tent", x: 3650, w: 150, top: 385 },
  { kind: "house", x: 3900, w: 180, top: 320 },
  { kind: "fence", x: 4150, w: 130, top: 430 },
  { kind: "debris", x: 4345, w: 110, top: 380 },
  { kind: "house", x: 4560, w: 160, top: 340 },
  { kind: "tent", x: 4800, w: 140, top: 395 },
  { kind: "house", x: 5000, w: 190, top: 300 },
  { kind: "debris", x: 5255, w: 110, top: 360 },
  { kind: "fence", x: 5480, w: 160, top: 430 },
  { kind: "tent", x: 5750, w: 140, top: 390 },
];

// A diamond above every wrecked thing, plus a few up high.
const DIAMONDS: [number, number][] = [
  ...BLOCKS.map((b): [number, number] => [b.x + b.w / 2, b.top - 46]),
  [960, 300], [1800, 280], [2700, 250], [3500, 260], [4400, 270], [5310, 250],
];

const SURVIVORS: { x: number; name: string; art: string; lines: string[] }[] = [
  {
    x: 530,
    name: "Old Pete",
    art: FARMER,
    lines: [
      "You got sucked in too? Welcome to THE MATRIX.",
      "Everything the portal swallows ends up here. Houses, tents... us.",
      "Jump on the wrecked houses. The ground has holes in it.",
    ],
  },
  {
    x: 1250,
    name: "Hammer Hank",
    art: SMITH,
    lines: ["My whole forge got sucked in. Now I just float sometimes.", "Grab the diamonds! They're real. I checked."],
  },
  {
    x: 2120,
    name: "Misty",
    art: WITCH,
    lines: ["I drank a potion to get home. Now I'm a little see-through.", "Those people floating in space? Don't wave. They wave back."],
  },
  {
    x: 3850,
    name: "Spore",
    art: MUSHROOM_MAN,
    lines: ["The mushrooms grow upside down here.", "I heard there's a way out at the very end. Keep going right!"],
  },
  {
    x: 4760,
    name: "Zag",
    art: JESTER,
    lines: ["I'm Zig's twin! Chaos? THIS is chaos!", "Ha! You jump like a cat. Oh wait, you ARE a cat."],
  },
  {
    x: 5680,
    name: "Violet",
    art: PURPLE_SMITH,
    lines: ["The way out is just ahead. The portal glows.", "Tell your world about us! ...Or don't. It's fine."],
  },
];

// The people floating in space far behind everything.
const FLOATERS = Array.from({ length: 16 }, (_, index) => ({
  x: (index * 517) % 2600,
  y: 40 + ((index * 151) % 320),
  size: 36 + ((index * 23) % 34),
  spin: ((index % 2) * 2 - 1) * (0.2 + (index % 5) * 0.08),
  art: [FARMER, SMITH, WITCH, JESTER, MUSHROOM_MAN, PURPLE_SMITH][index % 6]!,
}));

const STARS = Array.from({ length: 140 }, (_, index) => ({
  x: (index * 97) % 1900,
  y: (index * 61) % VIEW_H,
  r: (index % 3) * 0.6 + 0.6,
}));

export function startMatrix(root: HTMLElement, api: MatrixApi): () => void {
  const takenKey = `fact-quest-6-matrix-${api.learner}`;
  const vaultKey = `fact-quest-6-matrix-vault-${api.learner}`;
  const ollyArt = api.look();
  // As a Geometry Dash cube, Olly flips half a turn every jump, like in the
  // real game: spinning while he's in the air, landing flat.
  const isCube = ollyArt.includes("olly-cube");
  let cubeAngle = 0;
  let cubeTarget = 0;
  let vaultOpen = readFlag(vaultKey);
  let vaultSwing = vaultOpen ? 1 : -1;
  // The vault's beam of light, once it fires.
  let beaming = -1;
  // Diamonds stay picked up, so the Matrix isn't an endless gem machine.
  const taken = new Set<number>(readTaken());

  root.innerHTML = `
    <div class="world-top">
      <button class="text-link" type="button" data-leave>← Leave the quest</button>
      <span class="matrix-small">THE MATRIX</span>
      <div class="hud"><span title="Diamonds grabbed here"><img src="${spriteImage(GEM).src}" alt="" /> <b id="matrix-gems">0</b></span></div>
    </div>
    <div class="world-stage matrix-stage">
      <canvas width="${VIEW_W}" height="${VIEW_H}" aria-label="The Matrix. Left and right arrows walk, up or Space jumps, E talks."></canvas>
      <p class="world-toast" id="matrix-toast" hidden></p>
      <div class="world-overlay" id="matrix-overlay" hidden></div>
      <div class="matrix-intro" aria-hidden="true"><h1 class="matrix-title">THE MATRIX</h1></div>
    </div>
    <p class="world-help"><b>← →</b> or <b>A D</b> walk · <b>↑</b>, <b>W</b> or <b>Space</b> jump · <b>E</b> talk to survivors or open things</p>
  `;
  const canvas = root.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const toast = root.querySelector<HTMLElement>("#matrix-toast")!;
  const gemCount = root.querySelector<HTMLElement>("#matrix-gems")!;
  const intro = root.querySelector<HTMLElement>(".matrix-intro")!;
  const overlay = root.querySelector<HTMLElement>("#matrix-overlay")!;

  const sound = (play: () => void): void => {
    if (!api.muted()) play();
  };

  const olly = { x: START_X, y: GROUND_Y, vx: 0, vy: 0, onGround: true, facing: 1, walk: 0 };
  let safe = { x: START_X, y: GROUND_Y };
  let fighting = false;
  let grabbed = 0;
  let time = 0;
  let escaping = -1;
  let toastTimer = 0;
  // A survivor's speech bubble: who, which line, and for how long.
  let speech: { who: number; line: number; until: number } | null = null;
  const lineIndex = new Map<number, number>();
  const keys = new Set<string>();

  function readTaken(): number[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(takenKey) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function say(text: string): void {
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3000);
  }

  // Where Olly can stand at this x: the top of whatever's under his feet.
  function surfaces(x: number): number[] {
    const tops: number[] = [];
    if (GROUND.some(([from, to]) => x >= from && x <= to)) tops.push(GROUND_Y);
    for (const block of BLOCKS) if (x >= block.x && x <= block.x + block.w) tops.push(block.top);
    return tops;
  }

  function update(dt: number): void {
    time += dt;
    if (fighting) return;
    if (beaming >= 0) {
      beaming += dt;
      if (beaming > 2.8) {
        beaming = -1;
        api.beamOut();
      }
      return;
    }
    if (escaping >= 0) {
      escaping += dt;
      if (escaping > 1.4) {
        escaping = -1;
        api.escape();
      }
      return;
    }

    let move = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) move -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) move += 1;
    olly.vx = move * SPEED;
    if (move) {
      olly.facing = move;
      olly.walk += dt;
    }
    if ((keys.has("ArrowUp") || keys.has("w") || keys.has(" ")) && olly.onGround) {
      olly.vy = -JUMP;
      olly.onGround = false;
      cubeTarget += Math.PI * olly.facing;
      sound(() => whoosh(0.15));
    }
    // A full jump lasts 2 × JUMP / GRAVITY seconds; spin half a turn in that time.
    const spinStep = (Math.PI / ((2 * JUMP) / GRAVITY)) * dt;
    cubeAngle += Math.max(-spinStep, Math.min(spinStep, cubeTarget - cubeAngle));

    olly.x = Math.max(20, Math.min(LEVEL_W - 20, olly.x + olly.vx * dt));
    const before = olly.y;
    olly.vy += GRAVITY * dt;
    olly.y += olly.vy * dt;

    // Land on anything below that we fell onto from above.
    olly.onGround = false;
    if (olly.vy >= 0) {
      for (const top of surfaces(olly.x)) {
        if (before <= top + 1 && olly.y >= top) {
          olly.y = top;
          olly.vy = 0;
          olly.onGround = true;
          cubeAngle = cubeTarget;
          break;
        }
      }
    }
    if (olly.onGround && olly.y === GROUND_Y) safe = { x: olly.x, y: olly.y };

    // Fell into space: THE VOID wants a math battle.
    if (olly.y > VIEW_H + 200) {
      fightTheVoid();
      return;
    }

    DIAMONDS.forEach(([x, y], index) => {
      if (taken.has(index)) return;
      if (Math.abs(x - olly.x) < 22 && Math.abs(y - (olly.y - 20)) < 28) {
        taken.add(index);
        grabbed += 1;
        gemCount.textContent = String(grabbed);
        api.addGems(1);
        try {
          localStorage.setItem(takenKey, JSON.stringify([...taken]));
        } catch {
          // Nowhere to save.
        }
        sound(() => chime());
      }
    });

    if (speech && time > speech.until) speech = null;

    if (olly.x > EXIT_X - 30 && Math.abs(olly.y - GROUND_Y) < 60) {
      escaping = 0;
      sound(() => whoosh(1.2));
      say("The portal home! Here you go...");
    }
  }

  function nearSurvivor(): number {
    return SURVIVORS.findIndex((s) => Math.abs(s.x - olly.x) < 60 && Math.abs(olly.y - GROUND_Y) < 40);
  }

  function readFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  // E next to the vault: open it with the key from the bunker.
  function tryVault(): boolean {
    if (Math.abs(olly.x - VAULT_X) > 70 || Math.abs(olly.y - GROUND_Y) > 40) return false;
    if (vaultOpen) {
      // Still glowing inside: the beam fires again.
      beaming = 0;
      sound(() => whoosh(2.5));
      say("The light inside the vault blasts out again!");
    } else if (api.hasVaultKey()) {
      vaultOpen = true;
      vaultSwing = 0;
      beaming = 0;
      try {
        localStorage.setItem(vaultKey, "1");
      } catch {
        // Nowhere to save.
      }
      sound(() => whoosh(2.5));
      say("The weird key fits! CLUNK... the vault swings open... and a BEAM OF LIGHT shoots out!");
    } else {
      say("A huge, weird vault. It's locked tight. There must be a key somewhere...");
    }
    return true;
  }

  function talk(): void {
    if (tryVault()) return;
    const who = nearSurvivor();
    if (who < 0) return;
    const line = lineIndex.get(who) ?? 0;
    speech = { who, line, until: time + 4.5 };
    lineIndex.set(who, (line + 1) % SURVIVORS[who]!.lines.length);
  }

  // --- The Void ---------------------------------------------------------------

  function fightTheVoid(): void {
    fighting = true;
    keys.clear();
    olly.vy = 0;
    const fighter = api.fighter();
    const ollyMax = fighter.health;
    let ollyHp = ollyMax;
    let voidHp = VOID_HP;
    let current = api.newQuestion();
    let locked = false;
    // After losing: the Void sleeps while Olly earns his way back.
    let asleep = false;
    let wakeUpRight = 0;
    sound(() => whoosh(1));

    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="fight-card void-card">
        <div class="battle void-battle" id="void-battle">
          <div class="fighter hero">
            ${ollyArt}
            <span class="hp"><span id="void-olly-hp"></span></span>
            <small id="void-olly-hp-text"></small>
          </div>
          <span class="vs">VS</span>
          <div class="fighter monster" id="void-foe">
            <img class="monster-icon foe-art" src="${spriteImage(VOID).src}" alt="" />
            <strong>THE VOID</strong>
            <span class="hp"><span id="void-hp"></span></span>
          </div>
        </div>
        <p class="fight-msg" id="void-msg">You fell into space... and THE VOID caught you. Beat it with math to climb back out!</p>
        <div class="equation" id="void-question"></div>
        <form class="fight-form" autocomplete="off">
          <input class="answer-box" id="void-answer" inputmode="numeric" maxlength="4" placeholder="?" aria-label="Your answer" />
          <span class="remainder" id="void-remainder-wrap">
            <span class="r" aria-hidden="true">R</span>
            <input class="answer-box" id="void-remainder" inputmode="numeric" maxlength="3" placeholder="0" aria-label="Remainder" />
          </span>
          <button class="big-button" type="submit">⚔️ Attack!</button>
        </form>
        <div class="fight-tools"><button type="button" class="text-link" data-hint>A little hint?</button></div>
      </div>
    `;
    const battle = overlay.querySelector<HTMLElement>("#void-battle")!;
    const foeBox = overlay.querySelector<HTMLElement>("#void-foe")!;
    const message = overlay.querySelector<HTMLElement>("#void-msg")!;
    const questionBox = overlay.querySelector<HTMLElement>("#void-question")!;
    const answerInput = overlay.querySelector<HTMLInputElement>("#void-answer")!;
    const remainderInput = overlay.querySelector<HTMLInputElement>("#void-remainder")!;
    const remainderWrap = overlay.querySelector<HTMLElement>("#void-remainder-wrap")!;

    const showBars = (): void => {
      overlay.querySelector<HTMLElement>("#void-olly-hp")!.style.width = `${(ollyHp / ollyMax) * 100}%`;
      overlay.querySelector<HTMLElement>("#void-olly-hp-text")!.textContent = `${ollyHp} / ${ollyMax}`;
      overlay.querySelector<HTMLElement>("#void-hp")!.style.width = `${(voidHp / VOID_HP) * 100}%`;
    };
    const showQuestion = (): void => {
      questionBox.innerHTML = `${current.text} <span class="q">= ?</span>`;
      answerInput.value = "";
      remainderInput.value = "";
      remainderWrap.hidden = !current.isDiv;
      answerInput.focus();
    };
    const replay = (name: string): void => {
      battle.classList.remove("is-attack", "is-ouch");
      void battle.offsetWidth;
      battle.classList.add(name);
    };

    for (const input of [answerInput, remainderInput]) {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
      });
    }
    answerInput.addEventListener("keydown", (event) => {
      if (current.isDiv && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        remainderInput.focus();
      }
    });
    overlay.querySelector("[data-hint]")!.addEventListener("click", () => {
      message.textContent = `💡 ${current.hint}`;
      answerInput.focus();
    });

    overlay.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      if (locked) return;
      if (answerInput.value === "") {
        message.textContent = "Type a whole number first.";
        return;
      }
      const remainder = remainderInput.value === "" ? 0 : Number(remainderInput.value);
      const correct = Number(answerInput.value) === current.answer && (!current.isDiv || remainder === current.remainder);
      api.recordAnswer(correct);
      locked = true;
      if (asleep) {
        // Lost to the Void: it sleeps (no more biting) until Olly gets three
        // right, then he can play again.
        if (correct) wakeUpRight += 1;
        sound(() => (correct ? chime() : boing()));
        message.textContent = correct
          ? `Right! ${wakeUpRight} of ${RIGHT_TO_ESCAPE}. 😴 THE VOID is still asleep...`
          : `Not quite: ${current.text} = ${current.answer}${current.isDiv ? ` R${current.remainder}` : ""}. THE VOID is still asleep, keep trying! (${wakeUpRight} of ${RIGHT_TO_ESCAPE})`;
        window.setTimeout(() => {
          if (wakeUpRight >= RIGHT_TO_ESCAPE) endFight(false);
          else {
            locked = false;
            current = api.newQuestion();
            showQuestion();
          }
        }, 900);
        return;
      }
      if (correct) {
        voidHp = Math.max(0, voidHp - fighter.sword);
        replay("is-attack");
        sound(() => chime());
        message.textContent = voidHp > 0 ? `Hit! THE VOID shrinks a little.` : "THE VOID is beaten!";
      } else {
        ollyHp = Math.max(0, ollyHp - VOID_DAMAGE);
        replay("is-ouch");
        sound(() => boing());
        message.textContent = `THE VOID bites! It was ${current.text} = ${current.answer}${current.isDiv ? ` R${current.remainder}` : ""}.`;
      }
      foeBox.classList.toggle("is-beaten", voidHp === 0);
      showBars();
      window.setTimeout(() => {
        if (voidHp === 0) endFight(true);
        else if (ollyHp === 0) fallAsleep();
        else {
          locked = false;
          current = api.newQuestion();
          showQuestion();
        }
      }, voidHp === 0 ? 1100 : 900);
    });

    const fallAsleep = (): void => {
      asleep = true;
      wakeUpRight = 0;
      battle.classList.remove("is-attack", "is-ouch");
      foeBox.classList.add("is-asleep");
      overlay.querySelector("#void-olly-hp-text")!.textContent = "Out of health";
      message.textContent = `THE VOID beat you... and fell asleep 😴. It won't bite now. Get ${RIGHT_TO_ESCAPE} questions right to play again!`;
      locked = false;
      current = api.newQuestion();
      showQuestion();
    };

    const endFight = (won: boolean): void => {
      // Won: climb back out where Olly last stood safely. Lost: spat out at
      // the very start of the Matrix.
      const back = won ? safe : { x: START_X, y: GROUND_Y };
      olly.x = back.x;
      olly.y = back.y;
      olly.vy = 0;
      if (!won) safe = { x: START_X, y: GROUND_Y };
      overlay.hidden = true;
      overlay.innerHTML = "";
      fighting = false;
      say(won ? "You beat THE VOID and climbed back out!" : "You tiptoed away from the sleeping VOID... all the way back at the start!");
    };

    showBars();
    showQuestion();
  }

  // --- Drawing ----------------------------------------------------------------

  function drawImage(art: string, x: number, y: number, size: number, flip = false, spin = 0, gray = false): void {
    const image = spriteImage(art);
    if (!image.complete) return;
    ctx.save();
    ctx.translate(x, y);
    if (spin) ctx.rotate(spin);
    if (flip) ctx.scale(-1, 1);
    // The floating people: pale and ghostly, with a faint purple glow so they
    // show up against black space.
    if (gray) ctx.filter = "grayscale(0.6) brightness(1.5) drop-shadow(0 0 6px rgba(197, 155, 255, 0.8))";
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawBackground(camX: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, "#020008");
    sky.addColorStop(1, "#1a0a2e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#ffffff";
    for (const star of STARS) {
      const x = (((star.x - camX * 0.1) % 1900) + 1900) % 1900;
      if (x > VIEW_W) continue;
      ctx.globalAlpha = 0.4 + Math.sin(time * 2 + star.x) * 0.3;
      ctx.beginPath();
      ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.7;
    for (const floater of FLOATERS) {
      const x = (((floater.x - camX * 0.35) % 2600) + 2600) % 2600 - 100;
      if (x < -100 || x > VIEW_W + 100) continue;
      drawImage(floater.art, x, floater.y + Math.sin(time * 0.6 + floater.x) * 14, floater.size, false, time * floater.spin, true);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(from: number, to: number): void {
    ctx.fillStyle = "#3a2f45";
    ctx.beginPath();
    ctx.moveTo(from, GROUND_Y);
    ctx.lineTo(to, GROUND_Y);
    // A jagged, broken-off bottom.
    for (let x = to; x >= from; x -= 40) ctx.lineTo(x, GROUND_Y + 60 + ((x * 7) % 50));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9b4fe0";
    ctx.fillRect(from, GROUND_Y - 3, to - from, 4);
  }

  function drawBlock(block: (typeof BLOCKS)[number]): void {
    const { x, w, top } = block;
    if (block.kind === "house") {
      // A wrecked house: cracked walls, a roof sliding off, a broken window.
      ctx.fillStyle = "#7a5c45";
      ctx.fillRect(x, top, w, GROUND_Y - top);
      ctx.strokeStyle = "#3a2a1f";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, top, w, GROUND_Y - top);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, top);
      ctx.lineTo(x + w * 0.4, top + 40);
      ctx.lineTo(x + w * 0.33, top + 70);
      ctx.stroke();
      ctx.fillStyle = "#120a18";
      ctx.fillRect(x + w * 0.55, top + 30, 34, 28);
      ctx.strokeStyle = "#c9ced8";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.55, top + 30);
      ctx.lineTo(x + w * 0.55 + 20, top + 50);
      ctx.stroke();
      ctx.fillStyle = "#3d2a1d";
      ctx.fillRect(x + 16, GROUND_Y - 50, 28, 50);
      // The roof, broken and tilted on top.
      ctx.save();
      ctx.translate(x + w / 2, top);
      ctx.rotate(-0.08);
      ctx.fillStyle = "#8e2a2d";
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 6, 2);
      ctx.lineTo(-w * 0.1, -26);
      ctx.lineTo(w * 0.05, -14);
      ctx.lineTo(w * 0.15, -28);
      ctx.lineTo(w / 2 + 6, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (block.kind === "tent") {
      // A torn tent with a flat, saggy top.
      ctx.fillStyle = "#4f7a6e";
      ctx.beginPath();
      ctx.moveTo(x - 10, GROUND_Y);
      ctx.lineTo(x + 14, top);
      ctx.lineTo(x + w - 14, top);
      ctx.lineTo(x + w + 10, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#120a18";
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 14, GROUND_Y);
      ctx.lineTo(x + w / 2, top + 30);
      ctx.lineTo(x + w / 2 + 18, GROUND_Y);
      ctx.fill();
      ctx.strokeStyle = "#2c4840";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 30, top + 10);
      ctx.lineTo(x + 40, top + 30);
      ctx.lineTo(x + 34, top + 44);
      ctx.stroke();
    } else if (block.kind === "fence") {
      // Broken fence boards, some missing.
      ctx.fillStyle = "#8a6a3a";
      ctx.fillRect(x, top, w, 8);
      ctx.fillRect(x, top + 22, w * 0.6, 7);
      for (let post = x + 4; post < x + w; post += 26) {
        const short = (post * 13) % 3 === 0;
        ctx.fillRect(post, top - (short ? -6 : 6), 9, GROUND_Y - top + (short ? -6 : 6));
      }
    } else {
      // A chunk of somebody's house, floating in space.
      ctx.fillStyle = "#6b5440";
      ctx.fillRect(x, top, w, 18);
      ctx.fillStyle = "#4a3a2c";
      for (let rock = 0; rock < 4; rock += 1) {
        ctx.beginPath();
        ctx.arc(x + 12 + rock * (w / 4), top + 22 + (rock % 2) * 5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#9b4fe0";
      ctx.fillRect(x, top - 2, w, 3);
    }
  }

  // A big round vault door in a stone frame. Once opened it swings aside and
  // something glows inside.
  function drawVault(camX: number): void {
    if (VAULT_X - camX < -150 || VAULT_X - camX > VIEW_W + 150) return;
    if (vaultSwing >= 0 && vaultSwing < 1) vaultSwing = Math.min(1, vaultSwing + 0.02);
    const x = VAULT_X;
    const y = GROUND_Y - 60;
    ctx.fillStyle = "#2b2236";
    ctx.fillRect(x - 70, GROUND_Y - 130, 140, 130);
    ctx.strokeStyle = "#9b4fe0";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 70, GROUND_Y - 130, 140, 130);
    if (vaultOpen) {
      const glow = ctx.createRadialGradient(x, y, 5, x, y, 55);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      glow.addColorStop(1, "rgba(0, 229, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 55, 0, Math.PI * 2);
      ctx.fill();
    }
    // The door: squashes sideways as it swings open.
    const open = vaultOpen ? vaultSwing : 0;
    ctx.save();
    ctx.translate(x - 50 * open, y);
    ctx.scale(1 - open * 0.75, 1);
    ctx.fillStyle = "#8d94a3";
    ctx.strokeStyle = "#3d4250";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let spoke = 0; spoke < 4; spoke += 1) {
      const angle = spoke * (Math.PI / 2) + (vaultOpen ? 0.6 : 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
    }
    ctx.stroke();
    ctx.fillStyle = "#3d4250";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!vaultOpen && Math.abs(olly.x - VAULT_X) < 70) {
      ctx.fillStyle = "#d8f361";
      ctx.font = "bold 12px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("E: open", x, GROUND_Y - 140);
      ctx.textAlign = "start";
    }
  }

  function drawExit(camX: number): void {
    const x = EXIT_X;
    const y = GROUND_Y - 70;
    if (x - camX < -100 || x - camX > VIEW_W + 100) return;
    ctx.save();
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 70);
    glow.addColorStop(0, "rgba(255, 255, 255, 1)");
    glow.addColorStop(0.4, "rgba(155, 220, 120, 0.85)");
    glow.addColorStop(1, "rgba(155, 79, 224, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(time * 3);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#e9ffd9";
    ctx.font = "bold 14px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HOME", x, y - 82);
    ctx.textAlign = "start";
  }

  function drawSpeech(text: string, x: number, y: number): void {
    ctx.font = "bold 14px 'DM Sans', sans-serif";
    const width = Math.min(320, ctx.measureText(text).width + 24);
    // Wrap into lines that fit the bubble.
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > width - 24 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
    const height = lines.length * 18 + 16;
    const left = Math.max(10, Math.min(VIEW_W - width - 10, x - width / 2));
    const top = y - height - 14;
    ctx.fillStyle = "#fffdf3";
    ctx.strokeStyle = "#24242b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#24242b";
    lines.forEach((line, index) => ctx.fillText(line, left + 12, top + 22 + index * 18));
  }

  function draw(): void {
    const camX = Math.round(Math.max(0, Math.min(LEVEL_W - VIEW_W, olly.x - VIEW_W * 0.4)));
    drawBackground(camX);
    ctx.save();
    ctx.translate(-camX, 0);

    for (const [from, to] of GROUND) if (to > camX - 50 && from < camX + VIEW_W + 50) drawGround(from, to);
    for (const block of BLOCKS) if (block.x + block.w > camX - 50 && block.x < camX + VIEW_W + 50) drawBlock(block);
    drawVault(camX);
    drawExit(camX);

    DIAMONDS.forEach(([x, y], index) => {
      if (taken.has(index) || x < camX - 40 || x > camX + VIEW_W + 40) return;
      drawImage(GEM, x, y + Math.sin(time * 4 + x) * 4, 22);
    });

    SURVIVORS.forEach((survivor, index) => {
      if (survivor.x < camX - 60 || survivor.x > camX + VIEW_W + 60) return;
      drawImage(survivor.art, survivor.x, GROUND_Y - 22, 46, survivor.x > olly.x);
      ctx.fillStyle = "#c9b8e8";
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(survivor.name, survivor.x, GROUND_Y + 16);
      ctx.textAlign = "start";
      if (nearSurvivor() === index && (!speech || speech.who !== index)) {
        ctx.fillStyle = "#d8f361";
        ctx.font = "bold 12px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("E: talk", survivor.x, GROUND_Y - 54);
        ctx.textAlign = "start";
      }
    });

    const bounce = olly.onGround && olly.vx ? Math.abs(Math.sin(olly.walk * 12)) * 3 : 0;
    const shrink = escaping >= 0 ? Math.max(0.05, 1 - escaping) : 1;
    const spin = escaping >= 0 ? time * 10 : isCube ? cubeAngle : 0;
    drawImage(ollyArt, olly.x, olly.y - 22 - (isCube ? 0 : bounce), 48 * shrink, !isCube && olly.facing < 0, spin);

    if (speech) {
      const survivor = SURVIVORS[speech.who]!;
      ctx.restore();
      drawSpeech(`${survivor.name}: ${survivor.lines[speech.line]}`, survivor.x - camX, GROUND_Y - 50);
      ctx.save();
    }
    ctx.restore();

    if (escaping >= 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, escaping / 1.4)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (beaming >= 0) drawBeam(camX);
  }

  // The vault's beam: a pillar of light grows out of the vault, sweeps
  // sideways over everything, and the whole screen goes white.
  function drawBeam(camX: number): void {
    const x = VAULT_X - camX;
    const grow = Math.min(1, beaming / 0.8);
    const width = 20 + grow * 140;
    const beam = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    beam.addColorStop(0, "rgba(0, 229, 255, 0)");
    beam.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
    beam.addColorStop(1, "rgba(0, 229, 255, 0)");
    ctx.fillStyle = beam;
    ctx.fillRect(x - width / 2, 0, width, GROUND_Y - 60);
    if (beaming > 0.9) {
      const sweep = Math.min(1, (beaming - 0.9) / 0.8);
      ctx.fillStyle = `rgba(200, 250, 255, ${0.35 + sweep * 0.4})`;
      ctx.fillRect(0, GROUND_Y - 120 - sweep * 300, VIEW_W, 60 + sweep * 300);
    }
    if (beaming > 1.8) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, (beaming - 1.8) / 0.8)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // --- Running --------------------------------------------------------------

  let frame = 0;
  let last = performance.now();
  // Set once this is shut down. Something inside update() (like walking into
  // a portal) can shut it down mid-frame, so the loop must not carry on.
  let stopped = false;
  const loop = (now: number): void => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    if (stopped) return;
    draw();
    frame = requestAnimationFrame(loop);
  };

  const playKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "a", "d", "w", " "]);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (fighting || event.target instanceof HTMLInputElement) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (playKeys.has(key)) {
      keys.add(key);
      event.preventDefault();
    } else if (key === "e") {
      talk();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  };
  const onBlur = (): void => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  root.querySelector("[data-leave]")!.addEventListener("click", () => api.leave());
  intro.addEventListener("animationend", () => intro.remove());

  frame = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.clearTimeout(toastTimer);
  };
}

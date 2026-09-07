import { wornSkin } from "./shop";

const TILE = 32;
const ARENA = { x: 1, y: 1, w: 21, h: 13 };
const HIT_GRACE = 1.6;

interface Pillar { x: number; y: number; broken: boolean; rubble: number }

export function startBoss(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#world");
  const context = canvas?.getContext("2d") ?? null;
  const message = document.querySelector<HTMLElement>("#message");
  const banner = document.querySelector<HTMLDivElement>("#banner");
  const bannerTitle = document.querySelector<HTMLElement>("#banner-title");
  const bannerText = document.querySelector<HTMLElement>("#banner-text");
  const bannerButton = document.querySelector<HTMLButtonElement>("#banner-button");
  const pillarHud = document.querySelector<HTMLElement>("#pillar-count");
  const heartHud = document.querySelector<HTMLElement>("#heart-count");
  if (!canvas || !context) return;

  const showBanner = (show: boolean): void => {
    if (!banner) return;
    banner.hidden = !show;
    banner.style.display = show ? "flex" : "none";
  };
  showBanner(false);

  const skin = wornSkin();
  const say = (words: string): void => { if (message) message.textContent = words; };

  const startPillars = (): Pillar[] => [
    { x: 4.5, y: 4.5, broken: false, rubble: 0 },
    { x: 18.5, y: 4.5, broken: false, rubble: 0 },
    { x: 4.5, y: 10.5, broken: false, rubble: 0 },
    { x: 18.5, y: 10.5, broken: false, rubble: 0 },
    { x: 11.5, y: 7.5, broken: false, rubble: 0 },
  ];

  let pillars = startPillars();
  const player = { x: 11.5, y: 12.5, vx: 0, vy: 0, r: 0.34 };
  const boss = { x: 11.5, y: 3.5, size: 1.5, aim: 0, dashing: 0, cooldown: 3, stun: 0, dashX: 0, dashY: 0 };
  let hearts = 3 + skin.shield;
  let grace = 0;
  let clock = 0;
  let shake = 0;
  let dying = 0;
  let over = false;

  const broken = (): number => pillars.filter((p) => p.broken).length;

  const hud = (): void => {
    if (pillarHud) pillarHud.textContent = `${pillars.length - broken()} pillars`;
    if (heartHud) heartHud.textContent = "♥".repeat(Math.max(0, hearts));
  };

  const reset = (): void => {
    pillars = startPillars();
    player.x = 11.5; player.y = 12.5; player.vx = 0; player.vy = 0;
    boss.x = 11.5; boss.y = 3.5; boss.size = 1.5; boss.aim = 0; boss.dashing = 0; boss.cooldown = 3; boss.stun = 0; boss.dashX = 0; boss.dashY = 0;
    hearts = 3 + skin.shield;
    grace = 0; dying = 0; over = false;
    showBanner(false);
    hud();
    say("Stand in front of a pillar and let it charge. Then move.");
  };

  const finish = (won: boolean): void => {
    over = true;
    if (bannerTitle && bannerText) {
      bannerTitle.textContent = won ? "It came apart" : "It got you";
      bannerText.textContent = won
        ? "Five pillars down and nothing left holding it up."
        : "Three hits and you were out. It is still down here.";
      showBanner(true);
    }
  };

  const pressed = new Set<string>();
  const touched = new Set<string>();
  // Typing in the console is not playing the game: leave those keys alone,
  // or the space bar never reaches the box you are typing into.
  const typing = (target: EventTarget | null): boolean =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

  window.addEventListener("keydown", (event) => {
    if (typing(event.target)) return;
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    pressed.add(key);
  });
  window.addEventListener("keyup", (event) => pressed.delete(event.key.toLowerCase()));
  // Clicking into the console drops whatever you were holding, so you do not
  // walk into a wall while typing.
  window.addEventListener("focusin", (event) => { if (typing(event.target)) pressed.clear(); });
  window.addEventListener("blur", () => pressed.clear());
  document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
    const dir = button.dataset["move"] ?? "";
    const on = (e: Event): void => { e.preventDefault(); touched.add(dir); };
    const off = (): void => { touched.delete(dir); };
    button.addEventListener("pointerdown", on);
    button.addEventListener("pointerup", off);
    button.addEventListener("pointerleave", off);
    button.addEventListener("pointercancel", off);
  });
  bannerButton?.addEventListener("click", reset);
  const wants = (...n: string[]): boolean => n.some((k) => pressed.has(k) || touched.has(k));

  const hitPlayer = (): void => {
    if (clock < grace) return;
    hearts -= 1;
    grace = clock + HIT_GRACE;
    shake = 0.45;
    // Thrown to the far side rather than killed outright.
    player.x = player.x < 11.5 ? ARENA.x + ARENA.w - 1.5 : ARENA.x + 1.5;
    player.y = player.y < 7.5 ? ARENA.y + ARENA.h - 1.5 : ARENA.y + 1.5;
    player.vx = 0; player.vy = 0;
    hud();
    if (hearts <= 0) finish(false); else say(`Hit. ${hearts} left.`);
  };

  let last = performance.now();

  function update(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    shake = Math.max(0, shake - dt);
    if (over) return;

    if (dying > 0) {
      dying -= dt;
      if (dying <= 0) finish(true);
      return;
    }

    let dx = 0, dy = 0;
    if (wants("arrowleft", "a", "left")) dx -= 1;
    if (wants("arrowright", "d", "right")) dx += 1;
    if (wants("arrowup", "w", "up")) dy -= 1;
    if (wants("arrowdown", "s", "down")) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    const speed = 5.4 * skin.speed;
    player.vx += (dx * speed - player.vx) * 0.34;
    player.vy += (dy * speed - player.vy) * 0.34;
    player.x = Math.max(ARENA.x + 0.4, Math.min(ARENA.x + ARENA.w - 0.4, player.x + player.vx * dt));
    player.y = Math.max(ARENA.y + 0.4, Math.min(ARENA.y + ARENA.h - 0.4, player.y + player.vy * dt));

    pillars.forEach((pillar) => { if (pillar.rubble > 0) pillar.rubble -= dt; });

    // It gets faster and wilder with every pillar it loses.
    const rage = broken();
    const chase = 2.1 + rage * 0.62;
    boss.size = 1.5 - rage * 0.13;
    boss.cooldown -= dt;

    if (boss.stun > 0) {
      boss.stun -= dt;
    } else if (boss.dashing > 0) {
      // The lunge commits to the line it picked. Step aside and it carries
      // straight past you into whatever is behind you.
      boss.dashing -= dt;
      boss.x += boss.dashX * chase * 3.1 * dt;
      boss.y += boss.dashY * chase * 3.1 * dt;

      // A charge that lands on a pillar takes the pillar down with it.
      for (const pillar of pillars) {
        if (pillar.broken) continue;
        if (Math.hypot(boss.x - pillar.x, boss.y - pillar.y) > boss.size * 0.7 + 0.75) continue;
        pillar.broken = true;
        pillar.rubble = 0.6;
        boss.dashing = 0;
        boss.stun = 1.3;
        boss.cooldown = 2.2;
        shake = 0.7;
        hud();
        const left = pillars.length - broken();
        say(left > 0 ? `It smashed a pillar. ${left} to go.` : "That was the last one.");
        if (left === 0) { dying = 1.8; say("It is coming apart."); }
        break;
      }
    } else if (boss.aim > 0) {
      boss.aim -= dt;
      if (boss.aim <= 0) {
        const dxx = player.x - boss.x, dyy = player.y - boss.y;
        const len = Math.hypot(dxx, dyy) || 1;
        boss.dashX = dxx / len;
        boss.dashY = dyy / len;
        boss.dashing = 0.75;
        shake = 0.25;
      }
    } else {
      const dxx = player.x - boss.x, dyy = player.y - boss.y;
      const len = Math.hypot(dxx, dyy) || 1;
      boss.x += (dxx / len) * chase * dt;
      boss.y += (dyy / len) * chase * dt;
      if (boss.cooldown <= 0) { boss.aim = 0.7; boss.cooldown = 3.4 - rage * 0.45; }
    }
    boss.x = Math.max(ARENA.x + 0.6, Math.min(ARENA.x + ARENA.w - 0.6, boss.x));
    boss.y = Math.max(ARENA.y + 0.6, Math.min(ARENA.y + ARENA.h - 0.6, boss.y));

    if (boss.stun <= 0 && Math.hypot(player.x - boss.x, player.y - boss.y) < boss.size * 0.75 + 0.3) hitPlayer();
  }

  function draw(now: number): void {
    if (!canvas || !context) return;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 22 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 22 : 0;
    context.fillStyle = "#05000a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(sx, sy);

    const rage = broken();
    context.fillStyle = ["#140a14", "#170a12", "#1b0a10", "#20090e", "#26080c"][rage] ?? "#26080c";
    context.fillRect(ARENA.x * TILE, ARENA.y * TILE, ARENA.w * TILE, ARENA.h * TILE);
    context.strokeStyle = "#4a1020";
    context.lineWidth = 4;
    context.strokeRect(ARENA.x * TILE, ARENA.y * TILE, ARENA.w * TILE, ARENA.h * TILE);

    pillars.forEach((pillar) => {
      const px = pillar.x * TILE, py = pillar.y * TILE;
      if (pillar.broken) {
        context.fillStyle = "#2a1119";
        context.fillRect(px - 16, py + 14, 32, 8);
        if (pillar.rubble > 0) {
          // Chunks thrown out by the impact.
          context.fillStyle = "#6b5570";
          for (let i = 0; i < 7; i += 1) {
            const spread = (1 - pillar.rubble / 0.6) * 34;
            const angle = i * 0.9;
            context.fillRect(px + Math.cos(angle) * spread - 3, py + Math.sin(angle) * spread * 0.6 - 3, 6, 6);
          }
        }
        return;
      }
      context.fillStyle = "#6b5570";
      context.fillRect(px - 13, py - 26, 26, 52);
      context.fillStyle = "#8a6f90";
      context.fillRect(px - 13, py - 26, 26, 6);
    });

    // The keeper. A ring of held breath before it lunges.
    const bx = boss.x * TILE, by = boss.y * TILE;
    if (boss.aim > 0) {
      context.globalAlpha = 1 - boss.aim / 0.7;
      context.strokeStyle = "#ff3b3b";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(bx, by, boss.size * TILE + 18, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    const pulse = Math.sin(now / 180) * 2;
    context.fillStyle = boss.stun > 0 ? "#5e2733" : boss.dashing > 0 ? "#ff6b6b" : "#c01e2e";
    context.beginPath();
    context.arc(bx, by, boss.size * TILE + pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = boss.stun > 0 ? "#9a8a8a" : "#ffe9e9";
    const look = boss.stun > 0 ? now / 120 : Math.atan2(player.y - boss.y, player.x - boss.x);
    context.beginPath();
    context.arc(bx + Math.cos(look) * 9, by + Math.sin(look) * 9 - 4, 5, 0, Math.PI * 2);
    context.arc(bx + Math.cos(look) * 9, by + Math.sin(look) * 9 + 8, 5, 0, Math.PI * 2);
    context.fill();

    const flash = clock < grace && Math.floor(clock * 12) % 2 === 0;
    context.fillStyle = flash ? "#ff9d9d" : skin.colour;
    context.beginPath();
    context.arc(player.x * TILE, player.y * TILE, 11, 0, Math.PI * 2);
    context.fill();

    context.restore();

    // It is very dark down here.
    const px = player.x * TILE + sx, py = player.y * TILE + sy;
    const dark = context.createRadialGradient(px, py, 40, px, py, 210);
    dark.addColorStop(0, "rgb(0 0 0 / 0)");
    dark.addColorStop(1, "rgb(0 0 0 / .93)");
    context.fillStyle = dark;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function loop(now: number): void {
    update(now);
    draw(now);
    window.requestAnimationFrame(loop);
  }

  hud();
  say("Stand in front of a pillar and let it charge. Then move.");
  window.requestAnimationFrame(loop);
}

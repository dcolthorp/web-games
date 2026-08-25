/**
 * Farttopia proper: a city you walk around. Arrows walk, Space farts, E talks.
 * Farting is the verb the whole place runs on — it's how you help people, so
 * every quest is some arrangement of where and when you're allowed to let go.
 */

import { CITY, DUKE_PRICE, QUESTS, SCENES, type NPC, type Rect, type Scene } from "./city-data";
import { playCoin, playDoor, playFart, playTalk } from "./sfx";
import {
  claim,
  coinsEarned,
  createLog,
  offer,
  openQuests,
  record,
  resetProgress,
  statusOf,
  type QuestDef,
  type QuestLog,
} from "./quests";

const WALK_SPEED = 215;
const PLAYER_R = 14;
/** How close you have to be for a fart to count as aimed at someone. */
const FART_RANGE = 95;
const TALK_RANGE = 88;
const BUBBLE_MS = 6200;

type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };
type Bubble = { npc: NPC; text: string; left: number };

export type City = {
  enter(at?: string): void;
  update(dt: number): void;
  draw(): void;
  press(key: string): void;
};

export function createCity(
  context: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  hud: { coins: HTMLElement; quests: HTMLElement; place: HTMLElement },
  onTelescope: () => void,
  onFart: () => void,
): City {
  const questById = new Map(QUESTS.map((quest) => [quest.id, quest]));
  let log: QuestLog = createLog(QUESTS);
  let coins = 0;
  let duke = false;
  /** Patients only count once each, no matter how many times you fart on them. */
  let treated = new Set<string>();
  let lineIndex = new Map<string, number>();

  let scene: Scene = CITY;
  const player = { x: CITY.entrance.x, y: CITY.entrance.y, facing: 1, step: 0 };
  const camera = { x: 0, y: 0 };
  const puffs: Puff[] = [];
  let bubble: Bubble | null = null;
  let banner = "";
  let bannerLeft = 0;
  /** Stops the guards repeating themselves every single frame. */
  let refusalCooldown = 0;
  const keys = new Set<string>();

  window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  // ---- geometry helpers -------------------------------------------------

  function overlaps(x: number, y: number, rect: Rect): boolean {
    const nx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    return (x - nx) ** 2 + (y - ny) ** 2 < PLAYER_R ** 2;
  }

  function blocked(x: number, y: number): boolean {
    if (x < PLAYER_R || y < PLAYER_R || x > scene.w - PLAYER_R || y > scene.h - PLAYER_R) return true;
    for (const prop of scene.props) if (prop.solid && overlaps(x, y, prop.rect)) return true;
    for (const building of scene.buildings) if (overlaps(x, y, building.rect)) return true;
    if (scene.gate && !duke && overlaps(x, y, scene.gate.rect)) return true;
    return false;
  }

  /** You have to be standing at the eyepiece, not across the room. */
  function telescopeUnderfoot(): boolean {
    const scope = scene.props.find((prop) => prop.id === "telescope");
    if (!scope) return false;
    const { rect } = scope;
    const reach = { x: rect.x - 46, y: rect.y - 46, w: rect.w + 92, h: rect.h + 92 };
    return overlaps(player.x, player.y, reach);
  }

  /** The strip of road just west of the gate, where the guards stop you. */
  function approachTo(rect: Rect): Rect {
    return { x: rect.x - 52, y: rect.y, w: 52, h: rect.h };
  }

  function nearestGuard(): NPC | null {
    let best: NPC | null = null;
    let bestDistance = Infinity;
    for (const npc of scene.npcs) {
      if (!npc.id.startsWith("guard")) continue;
      const distance = (npc.x - player.x) ** 2 + (npc.y - player.y) ** 2;
      if (distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }
    return best;
  }

  function near(npc: NPC, range: number): boolean {
    return (npc.x - player.x) ** 2 + (npc.y - player.y) ** 2 < range ** 2;
  }

  // ---- moving between scenes -------------------------------------------

  function goTo(id: string, at: { x: number; y: number }): void {
    scene = SCENES[id] ?? CITY;
    player.x = at.x;
    player.y = at.y;
    puffs.length = 0;
    bubble = null;
    playDoor();
    hud.place.textContent = scene.name;
  }

  function checkDoors(): void {
    for (const building of scene.buildings) {
      if (!overlaps(player.x, player.y, building.door)) continue;
      const inside = SCENES[building.goesTo];
      if (inside) goTo(building.goesTo, inside.entrance);
      return;
    }
    const gate = scene.gate;
    if (gate) {
      if (duke && overlaps(player.x, player.y, gate.rect)) {
        const beyond = SCENES[gate.goesTo];
        if (beyond) {
          goTo(gate.goesTo, beyond.entrance);
          return;
        }
      }
      // Bumping into it is what sets the guard off.
      if (!duke && overlaps(player.x, player.y, approachTo(gate.rect)) && refusalCooldown <= 0) {
        const guard = nearestGuard();
        if (guard) {
          say(guard, gate.refusal);
          refusalCooldown = 4;
        }
      }
    }

    const exit = scene.exit;
    if (exit && overlaps(player.x, player.y, exit.rect)) goTo(exit.goesTo, exit.arrive);
  }

  // ---- talking ----------------------------------------------------------

  function say(npc: NPC, text: string): void {
    bubble = { npc, text, left: BUBBLE_MS / 1000 };
    playTalk();
  }

  function nextLine(npc: NPC): string {
    if (npc.lines.length === 0) return "...";
    const at = (lineIndex.get(npc.id) ?? 0) % npc.lines.length;
    lineIndex.set(npc.id, at + 1);
    return npc.lines[at]!;
  }

  function talkTo(npc: NPC): void {
    if (npc.id === "mayor") {
      if (duke) say(npc, "Your Grace. The city breathes easier for you.");
      else if (coins >= DUKE_PRICE) {
        duke = true;
        banner = "DUKE OF FARTTOPIA";
        bannerLeft = 7;
        playCoin();
        say(npc, `${DUKE_PRICE} coins! By the power vested in this nose, I name you DUKE OF FARTTOPIA.`);
      } else {
        say(npc, `Bring me ${DUKE_PRICE} coins and I'll make you a duke. You have ${coins}.`);
      }
      refreshHud();
      return;
    }

    if (npc.id.startsWith("guard") && scene.gate) {
      say(npc, duke ? scene.gate.welcome : scene.gate.refusal);
      return;
    }

    const def = npc.quest ? questById.get(npc.quest) : undefined;
    if (!def) {
      say(npc, nextLine(npc));
      return;
    }

    const status = statusOf(log, def.id);
    if (status === "unstarted") {
      offer(log, def.id);
      say(npc, def.ask);
    } else if (status === "active") {
      const state = log[def.id]!;
      say(npc, `${def.hint} (${Math.floor(state.progress)}/${def.goal} ${def.unit})`);
    } else if (status === "ready") {
      coins += claim(log, def);
      playCoin();
      say(npc, def.thanks);
    } else {
      say(npc, def.after);
    }
    refreshHud();
  }

  function talk(): void {
    let best: NPC | null = null;
    let bestDistance = Infinity;
    for (const npc of scene.npcs) {
      const distance = (npc.x - player.x) ** 2 + (npc.y - player.y) ** 2;
      if (distance < TALK_RANGE ** 2 && distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }
    if (best) talkTo(best);
  }

  // ---- farting ----------------------------------------------------------

  function fart(): void {
    if (telescopeUnderfoot()) {
      onTelescope();
      return;
    }
    playFart(0.7);
    onFart();
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 90;
      puffs.push({
        x: player.x,
        y: player.y + 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: 0.7 + Math.random() * 0.7,
        r: 6 + Math.random() * 12,
      });
    }

    // Where you are matters as much as the fart itself.
    if (scene.id === "gym") countTowards("gains", 1);
    if (scene.id === "bakery") {
      if (statusOf(log, "fresh-bread") === "active") {
        resetProgress(log, "fresh-bread");
        const baker = scene.npcs.find((npc) => npc.id === "baker");
        if (baker) say(baker, "AGAIN?! Right. Back to zero. Twenty seconds. Go.");
      }
    }

    for (const npc of scene.npcs) {
      if (!near(npc, FART_RANGE)) continue;
      if (npc.tag === "patient" && !treated.has(npc.id)) {
        if (countTowards("aromatherapy", 1)) treated.add(npc.id);
      }
      if (npc.tag === "cat") countTowards("lost-cat", 1);
    }
    refreshHud();
  }

  /** Returns whether the count actually landed — quests you haven't taken don't. */
  function countTowards(id: string, amount: number): boolean {
    const def = questById.get(id);
    if (!def || statusOf(log, id) !== "active") return false;
    const finished = record(log, def, amount);
    if (finished) {
      banner = `${def.title} — go and tell them`;
      bannerLeft = 4;
    }
    return true;
  }

  // ---- hud --------------------------------------------------------------

  function refreshHud(): void {
    hud.coins.textContent = `${coins} 🪙`;
    hud.place.textContent = duke ? `${scene.name} · DUKE` : scene.name;
    const open = openQuests(log, QUESTS);
    hud.quests.replaceChildren();
    if (open.length === 0) {
      const empty = document.createElement("li");
      empty.className = "quest-empty";
      empty.textContent =
        coinsEarned(log, QUESTS) === 0
          ? "Nobody has asked you for anything yet. Press E next to someone."
          : duke
            ? "You run this place now."
            : `Take your coins to Mayor Blowhard (${coins}/${DUKE_PRICE}).`;
      hud.quests.append(empty);
      return;
    }
    for (const def of open) {
      const state = log[def.id]!;
      const item = document.createElement("li");
      item.className = statusOf(log, def.id) === "ready" ? "quest quest-ready" : "quest";
      const title = document.createElement("strong");
      title.textContent = def.title;
      const detail = document.createElement("span");
      detail.textContent =
        statusOf(log, def.id) === "ready"
          ? `Done — go back to ${giverName(def)}`
          : `${def.hint} (${Math.floor(state.progress)}/${def.goal} ${def.unit})`;
      item.append(title, detail);
      hud.quests.append(item);
    }
  }

  function giverName(def: QuestDef): string {
    for (const other of Object.values(SCENES)) {
      const npc = other.npcs.find((candidate) => candidate.id === def.giver);
      if (npc) return npc.name;
    }
    return "them";
  }

  // ---- loop -------------------------------------------------------------

  function update(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
    if (keys.has("arrowright") || keys.has("d")) dx += 1;
    if (keys.has("arrowup") || keys.has("w")) dy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      const stepX = (dx / length) * WALK_SPEED * dt;
      const stepY = (dy / length) * WALK_SPEED * dt;
      if (!blocked(player.x + stepX, player.y)) player.x += stepX;
      if (!blocked(player.x, player.y + stepY)) player.y += stepY;
      if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
      player.step += dt * 9;
      checkDoors();
    } else {
      player.step = 0;
    }

    // The bakery quest is the only one that ticks by itself.
    if (scene.id === "bakery" && statusOf(log, "fresh-bread") === "active") {
      const before = Math.floor(log["fresh-bread"]!.progress);
      countTowards("fresh-bread", dt);
      if (Math.floor(log["fresh-bread"]!.progress) !== before) refreshHud();
    }

    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const puff = puffs[i]!;
      puff.life += dt;
      if (puff.life >= puff.max) {
        puffs.splice(i, 1);
        continue;
      }
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= 0.96;
      puff.vy *= 0.96;
      puff.r += dt * 16;
    }

    if (bubble) {
      bubble.left -= dt;
      if (bubble.left <= 0) bubble = null;
    }
    if (refusalCooldown > 0) refusalCooldown -= dt;
    if (bannerLeft > 0) {
      bannerLeft -= dt;
      if (bannerLeft <= 0) banner = "";
    }

    camera.x = Math.max(0, Math.min(scene.w - viewW, player.x - viewW / 2));
    camera.y = Math.max(0, Math.min(scene.h - viewH, player.y - viewH / 2));
  }

  // ---- drawing ----------------------------------------------------------

  function drawGround(): void {
    const gradient = context.createLinearGradient(0, 0, 0, viewH);
    gradient.addColorStop(0, scene.ground[0]);
    gradient.addColorStop(1, scene.ground[1]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, viewW, viewH);
  }

  function drawRect(rect: Rect, color: string, round: boolean, label?: string): void {
    const x = rect.x - camera.x;
    const y = rect.y - camera.y;
    if (x > viewW || y > viewH || x + rect.w < 0 || y + rect.h < 0) return;
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, rect.w, rect.h, round ? Math.min(rect.w, rect.h) / 2 : 6);
    context.fill();
    if (label) {
      context.font = `${Math.min(34, rect.h * 0.6)}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, x + rect.w / 2, y + rect.h / 2);
    }
  }

  function drawBuildings(): void {
    for (const building of scene.buildings) {
      const { rect } = building;
      const x = rect.x - camera.x;
      const y = rect.y - camera.y;
      context.fillStyle = "rgba(0, 0, 0, 0.25)";
      context.beginPath();
      context.roundRect(x + 6, y + 10, rect.w, rect.h, 10);
      context.fill();
      drawRect(rect, building.wall, false);
      drawRect({ ...rect, h: 54 }, building.roof, false);
      drawRect(building.door, "#3a2a1e", false);

      context.fillStyle = "#22103a";
      context.font = "900 20px 'Courier New', monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(building.name.toUpperCase(), x + rect.w / 2, y + 27);
    }
  }

  function drawGate(): void {
    const gate = scene.gate;
    if (!gate) return;
    const { rect } = gate;
    drawRect(rect, duke ? "#6d5a3a" : "#3d3648", false);
    const x = rect.x - camera.x;
    const y = rect.y - camera.y;
    // Bars stand across the road when it's shut, and fold to the edges when open.
    context.strokeStyle = duke ? "#ffd166" : "#9aa2b8";
    context.lineWidth = 5;
    context.lineCap = "round";
    for (let i = 0; i < 5; i += 1) {
      const along = y + 14 + i * ((rect.h - 28) / 4);
      context.beginPath();
      if (duke) {
        context.moveTo(x + 4, along);
        context.lineTo(x + 14, along);
      } else {
        context.moveTo(x + 4, along);
        context.lineTo(x + rect.w - 4, along);
      }
      context.stroke();
    }
  }

  function drawPuffs(): void {
    for (const puff of puffs) {
      const t = puff.life / puff.max;
      context.fillStyle = `rgba(164, 214, 106, ${(1 - t) * 0.5})`;
      context.beginPath();
      context.arc(puff.x - camera.x, puff.y - camera.y, puff.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawFigure(x: number, y: number, color: string, facing: number, bob: number, lying: boolean): void {
    context.save();
    context.translate(x, y);
    if (lying) context.rotate(-Math.PI / 2);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, -16, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(0, 6);
    context.moveTo(0, -4);
    context.lineTo(-9 * facing, 2);
    context.moveTo(0, -4);
    context.lineTo(9 * facing, 2);
    context.moveTo(0, 6);
    context.lineTo(-6, 18 - bob);
    context.moveTo(0, 6);
    context.lineTo(6, 18 + bob);
    context.stroke();
    context.restore();
  }

  function wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawBubble(): void {
    if (!bubble) return;
    const { npc, text } = bubble;
    context.font = "16px 'Courier New', monospace";
    const maxWidth = 320;
    const lines = wrapText(`${npc.name}: ${text}`, maxWidth);
    const width = Math.max(...lines.map((line) => context.measureText(line).width)) + 26;
    const height = lines.length * 21 + 20;
    let x = npc.x - camera.x - width / 2;
    let y = npc.y - camera.y - 46 - height;
    x = Math.max(8, Math.min(viewW - width - 8, x));
    y = Math.max(8, y);

    context.fillStyle = "rgba(22, 12, 34, 0.92)";
    context.strokeStyle = "#ffd166";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(x, y, width, height, 10);
    context.fill();
    context.stroke();

    context.fillStyle = "#fdf6ff";
    context.textAlign = "left";
    context.textBaseline = "top";
    lines.forEach((line, i) => context.fillText(line, x + 13, y + 12 + i * 21));
  }

  function drawPrompt(): void {
    const npc = scene.npcs.find((candidate) => near(candidate, TALK_RANGE));
    const label = npc
      ? `E — talk to ${npc.name}`
      : doorUnderfoot();
    if (!label) return;
    context.font = "900 15px 'Courier New', monospace";
    const width = context.measureText(label).width + 22;
    const x = viewW / 2 - width / 2;
    context.fillStyle = "rgba(22, 12, 34, 0.85)";
    context.beginPath();
    context.roundRect(x, viewH - 44, width, 28, 8);
    context.fill();
    context.fillStyle = "#ffec78";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, viewW / 2, viewH - 30);
  }

  function doorUnderfoot(): string {
    if (telescopeUnderfoot()) return "Space — look through the telescope";
    const gate = scene.gate;
    if (gate && overlaps(player.x, player.y, approachTo(gate.rect))) {
      return duke ? "The gate is open — walk through" : "The gate is shut";
    }
    for (const building of scene.buildings) {
      const close = { ...building.door, y: building.door.y + 20, h: building.door.h + 40 };
      if (overlaps(player.x, player.y, close)) return `Walk up into ${building.name}`;
    }
    return "";
  }

  function drawBanner(): void {
    if (!banner) return;
    context.font = "900 26px 'Courier New', monospace";
    const width = context.measureText(banner).width + 40;
    context.fillStyle = "rgba(255, 209, 102, 0.95)";
    context.beginPath();
    context.roundRect(viewW / 2 - width / 2, 18, width, 44, 10);
    context.fill();
    context.fillStyle = "#22103a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(banner, viewW / 2, 41);
  }

  function draw(): void {
    drawGround();
    for (const prop of scene.props) drawRect(prop.rect, prop.color, prop.round ?? false, prop.label);
    if (scene.exit) drawRect(scene.exit.rect, "#3a2a1e", false, "🚪");
    drawGate();
    drawBuildings();

    const bob = Math.sin(player.step) * 3;
    const cast = [...scene.npcs].sort((a, b) => a.y - b.y);
    for (const npc of cast) {
      if (npc.y > player.y) break;
      drawFigure(npc.x - camera.x, npc.y - camera.y, npc.color, 1, 0, npc.lying ?? false);
    }
    drawPuffs();
    drawFigure(player.x - camera.x, player.y - camera.y, "#f4f7ff", player.facing, bob, false);
    for (const npc of cast) {
      if (npc.y <= player.y) continue;
      drawFigure(npc.x - camera.x, npc.y - camera.y, npc.color, 1, 0, npc.lying ?? false);
    }

    drawBubble();
    drawPrompt();
    drawBanner();
  }

  function enter(at = "city"): void {
    scene = SCENES[at] ?? CITY;
    player.x = scene.entrance.x;
    player.y = scene.entrance.y;
    puffs.length = 0;
    bubble = null;
    refreshHud();
  }

  function press(key: string): void {
    if (key === " ") fart();
    if (key === "e") talk();
  }

  return { enter, update, draw, press };
}

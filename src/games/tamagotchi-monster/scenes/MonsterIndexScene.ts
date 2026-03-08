import type { Scene } from "../app/Scene";
import { NORMAL_STAGE_ORDER, type GrowthStage, type ColorTheme } from "../model/types";
import { MonsterIndexStore } from "../model/MonsterIndexStore";
import { drawNu11Background } from "../graphics/Nu11Background";
import { drawPet } from "../graphics/Sprites";
import { getStageName } from "../systems/growth";
import { isMillionaireMode, isNu11Mode } from "../systems/theme";
import { roundRectPath } from "../ui/roundRect";

const WHISPER_LINES = [
  "he still hears you.",
  "don't look behind the vent.",
  "the dark baby wants OUT.",
  "hush...he's underneath.",
  "he is hungry for light.",
  "you're not alone in this room.",
];

const NU11_EXCLUSIVE: GrowthStage[] = [
  "shadow",
  "specter",
  "wraith",
  "phantom",
  "revenant",
  "nightmare",
  "void_walker",
  "abyss",
  "eldritch",
  "corrupted",
  "xyy4",
];

const DARK_BABY_DURATION_SECONDS = 10;

export class MonsterIndexScene implements Scene {
  private store: MonsterIndexStore;
  private theme: ColorTheme;
  private onClose: () => void;
  private onTeleport?: (stage: GrowthStage) => void;

  private entries: Array<{
    stage: GrowthStage;
    discovered: boolean;
    name: string;
    kind: "secret" | "normal" | "rich" | "???";
  }> = [];
  private scrollOffset = 0;
  private selectedIndex = 0;
  private entryHeight = 80;
  private visibleEntries = 6;
  private listStartY = 100;

  private skullClicks = 0;
  private skullFallen = false;
  private skullFallOffset = 0;
  private ventHovered = false;
  private inDarkBabyScene = false;
  private darkBabyTimer = 0;
  private jumpscareActive = false;
  private jumpscareTimer = 0;
  private crashScreenActive = false;
  private crashButtonHovered = false;
  private crashErrorCode = "0xDB-0001";

  private activeWhisper: string | null = null;
  private whisperAge = 0;
  private whisperDuration = 0;
  private timeUntilNextWhisper = randRange(7, 15);
  private glitchActive = false;
  private glitchElapsed = 0;
  private glitchDuration = 0;
  private timeUntilNextGlitch = randRange(4, 10);

  constructor(opts: {
    store: MonsterIndexStore;
    theme: ColorTheme;
    onClose: () => void;
    onTeleport?: (stage: GrowthStage) => void;
  }) {
    this.store = opts.store;
    this.theme = opts.theme;
    this.onClose = opts.onClose;
    this.onTeleport = opts.onTeleport;
    this.entries = this.storeEntries();
  }

  private storeEntries(): Array<{
    stage: GrowthStage;
    discovered: boolean;
    name: string;
    kind: "secret" | "normal" | "rich" | "???";
  }> {
    const allEntries = this.store.getEntries();
    const entries = isMillionaireMode(this.theme)
      ? allEntries.filter((entry) => NORMAL_STAGE_ORDER.includes(entry.stage))
      : allEntries;
    return entries.map((entry) => {
      const kind: "secret" | "normal" | "rich" | "???" = entry.discovered
        ? isMillionaireMode(this.theme)
          ? "rich"
          : NU11_EXCLUSIVE.includes(entry.stage)
            ? "secret"
            : "normal"
        : "???";
      return {
        ...entry,
        name: entry.discovered ? getStageName(entry.stage, this.theme) : "???",
        kind,
      };
    });
  }

  private isAllDiscovered(): boolean {
    return this.entries.length > 0 && this.entries.every((e) => e.discovered);
  }

  private isDarkBabyUnlocked(): boolean {
    if (isMillionaireMode(this.theme)) return false;
    if (isNu11Mode(this.theme)) return this.isAllDiscovered();
    return NORMAL_STAGE_ORDER.every((stage) =>
      this.entries.some((entry) => entry.stage === stage && entry.discovered)
    );
  }

  private isAtBottom(): boolean {
    const maxScroll = Math.max(0, this.entries.length - this.visibleEntries);
    return this.scrollOffset >= maxScroll;
  }

  update(dt: number): void {
    if (isMillionaireMode(this.theme)) return;
    if (this.crashScreenActive) return;
    if (!this.inDarkBabyScene && !this.jumpscareActive) {
      this.updateAmbient(dt);
    }

    if (this.skullFallen && this.skullFallOffset < 200) {
      this.skullFallOffset += dt * 400;
    }

    if (this.inDarkBabyScene && !this.jumpscareActive) {
      this.darkBabyTimer += dt;
      if (this.darkBabyTimer >= DARK_BABY_DURATION_SECONDS) {
        this.jumpscareActive = true;
        this.jumpscareTimer = 0;
      }
    }

    if (this.jumpscareActive) {
      this.jumpscareTimer += dt;
      if (this.jumpscareTimer >= 1) {
        this.resolveDarkBabyCatch();
      }
    }
  }

  private updateAmbient(dt: number): void {
    if (!this.isDarkBabyUnlocked()) {
      this.activeWhisper = null;
      return;
    }
    if (this.activeWhisper) {
      this.whisperAge += dt;
      if (this.whisperAge >= this.whisperDuration) this.activeWhisper = null;
    }
    this.timeUntilNextWhisper -= dt;
    if (this.timeUntilNextWhisper <= 0) {
      this.activeWhisper =
        WHISPER_LINES[Math.floor(Math.random() * WHISPER_LINES.length)] ?? WHISPER_LINES[0] ?? null;
      this.whisperAge = 0;
      this.whisperDuration = randRange(3, 5);
      this.timeUntilNextWhisper = randRange(8, 14);
    }

    if (this.glitchActive) {
      this.glitchElapsed += dt;
      if (this.glitchElapsed >= this.glitchDuration) {
        this.glitchActive = false;
        this.timeUntilNextGlitch = randRange(4, 9);
      }
    } else {
      this.timeUntilNextGlitch -= dt;
      if (this.timeUntilNextGlitch <= 0) {
        this.glitchActive = true;
        this.glitchElapsed = 0;
        this.glitchDuration = randRange(0.6, 1.2);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.crashScreenActive) {
      drawCrashScreen(ctx, this.crashButtonHovered, this.crashErrorCode);
      return;
    }
    if (this.jumpscareActive) {
      drawJumpscare(ctx, this.jumpscareTimer);
      return;
    }
    if (this.inDarkBabyScene) {
      drawDarkBaby(ctx, this.darkBabyTimer);
      return;
    }

    if (isNu11Mode(this.theme)) {
      const bgStage = this.isAllDiscovered() ? "eldritch" : "shadow";
      drawNu11Background(ctx, 800, 600, bgStage, undefined, undefined, performance.now() / 1000);
    } else {
      ctx.fillStyle = "rgb(20,20,30)";
      ctx.fillRect(0, 0, 800, 600);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillStyle = this.isAllDiscovered() ? "rgb(100,255,100)" : "rgb(200,200,220)";
    ctx.fillText(this.isAllDiscovered() ? "gooooooooooooooooooood job!" : "MONSTER INDEX", 400, 30);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgb(150,150,170)";
    ctx.fillText("UP/DOWN to scroll, Q to exit", 400, 70);

    const visibleEnd = Math.min(this.scrollOffset + this.visibleEntries, this.entries.length);
    for (let i = this.scrollOffset; i < visibleEnd; i += 1) {
      const entry = this.entries[i];
      if (!entry) continue;
      const y = this.listStartY + (i - this.scrollOffset) * this.entryHeight;
      const selected = i === this.selectedIndex;
      if (selected) {
        ctx.fillStyle = isNu11Mode(this.theme) ? "rgba(70,80,110,0.6)" : "rgb(40,40,60)";
        ctx.strokeStyle = isNu11Mode(this.theme) ? "rgb(110,130,170)" : "rgb(80,80,120)";
        ctx.lineWidth = 2;
        roundRectPath(ctx, 50, y - 5, 700, this.entryHeight - 10, 8);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = "rgb(100,100,120)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`#${String(i + 1).padStart(2, "0")}`, 70, y + 10);

      if (entry.discovered) {
        if (isNu11Mode(this.theme) && entry.stage === "baby") {
          drawMissingPoster(ctx, 120, y);
        } else {
          drawPet(ctx, entry.stage, 160, y + this.entryHeight / 2 - 10, 40, { theme: this.theme });
          ctx.font = "20px system-ui, sans-serif";
          ctx.fillStyle =
            entry.kind === "secret"
              ? "rgb(255,100,100)"
              : entry.kind === "rich"
                ? "rgb(255,215,120)"
                : "rgb(200,200,220)";
          ctx.fillText(entry.name, 220, y + 8);
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillStyle =
            entry.kind === "secret"
              ? "rgb(255,80,80)"
              : entry.kind === "rich"
                ? "rgb(120,200,120)"
                : "rgb(100,200,100)";
          ctx.fillText(`kind: ${entry.kind}`, 220, y + 40);
          ctx.fillStyle = "rgb(80,80,100)";
          ctx.fillText(`[${entry.stage}]`, 600, y + 25);
        }
      } else {
        ctx.font = "32px system-ui, sans-serif";
        ctx.fillStyle = "rgb(80,80,100)";
        ctx.fillText("?", 150, y + 5);
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillText("???", 220, y + 8);
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("kind: ???", 220, y + 40);
      }
    }

    if (this.scrollOffset > 0) {
      ctx.textAlign = "center";
      ctx.fillText("^", 400, this.listStartY - 25);
    }
    if (this.scrollOffset + this.visibleEntries < this.entries.length) {
      ctx.textAlign = "center";
      ctx.fillText("v", 400, this.listStartY + this.visibleEntries * this.entryHeight);
    }

    const discoveredCount = this.entries.filter((e) => e.discovered).length;
    const totalCount = this.entries.length;
    const normalTotal = this.entries.filter((e) => e.kind === "normal").length;
    const secretTotal = this.entries.filter((e) => e.kind === "secret").length;
    const normalDiscovered = this.entries.filter((e) => e.discovered && e.kind === "normal").length;
    const secretDiscovered = this.entries.filter((e) => e.discovered && e.kind === "secret").length;

    ctx.textAlign = "center";
    ctx.fillStyle = "rgb(150,150,170)";
    ctx.font = "12px system-ui, sans-serif";
    if (isMillionaireMode(this.theme)) {
      ctx.fillText(`Discovered: ${discoveredCount}/${totalCount}`, 400, 540);
    } else {
      ctx.fillText(
        `Discovered: ${discoveredCount}/${totalCount}  |  Normal: ${normalDiscovered}/${normalTotal}  |  Secret: ${secretDiscovered}/${secretTotal}`,
        400,
        540
      );
    }

    if (this.isDarkBabyUnlocked() && this.isAtBottom()) {
      this.drawSkullAndVent(ctx);
    }

    if (this.isDarkBabyUnlocked() && this.activeWhisper) {
      ctx.fillStyle = "rgb(160,40,40)";
      ctx.font = "18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.activeWhisper, 400, 480);
    }

    if (this.isDarkBabyUnlocked() && this.glitchActive) {
      ctx.fillStyle = "rgba(255,0,0,0.1)";
      ctx.fillRect(0, 0, 800, 600);
      for (let i = 0; i < 30; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * 800, Math.random() * 600, 20 + Math.random() * 40, 2);
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.crashScreenActive) {
      const button = this.getCrashButtonRect();
      this.crashButtonHovered = x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h;
      return;
    }
    if (this.skullFallen && this.isDarkBabyUnlocked() && this.isAtBottom()) {
      const vent = this.getVentRect();
      this.ventHovered = x >= vent.x && x <= vent.x + vent.w && y >= vent.y && y <= vent.y + vent.h;
    } else {
      this.ventHovered = false;
    }
  }

  onPointerDown(x: number, y: number): void {
    if (this.crashScreenActive) {
      const button = this.getCrashButtonRect();
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
        window.location.assign("../../");
      }
      return;
    }
    if (this.inDarkBabyScene || this.jumpscareActive) return;
    if (this.isDarkBabyUnlocked() && this.isAtBottom()) {
      if (!this.skullFallen) {
        const skull = this.getSkullRect();
        if (x >= skull.x && x <= skull.x + skull.w && y >= skull.y && y <= skull.y + skull.h) {
          this.skullClicks += 1;
          if (this.skullClicks >= 5) this.skullFallen = true;
          return;
        }
      } else {
        const vent = this.getVentRect();
        if (x >= vent.x && x <= vent.x + vent.w && y >= vent.y && y <= vent.y + vent.h) {
          this.enterDarkBabyScene();
          return;
        }
      }
    }
    const clicked = this.getEntryAtPos(x, y);
    if (clicked !== null) this.tryTeleport(clicked);
  }

  onPointerUp(): void {}

  onKeyDown(e: KeyboardEvent): void {
    if (this.crashScreenActive) return;
    if (e.key === "q" || e.key === "Escape") {
      this.onClose();
      return;
    }
    if (this.inDarkBabyScene || this.jumpscareActive) return;
    if (e.key === "ArrowUp") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.adjustScroll();
    } else if (e.key === "ArrowDown") {
      this.selectedIndex = Math.min(this.entries.length - 1, this.selectedIndex + 1);
      this.adjustScroll();
    } else if (e.key === "Enter" || e.key === " ") {
      this.tryTeleport(this.selectedIndex);
    } else if (e.key.toLowerCase() === "e") {
      if (this.skullFallen) {
        this.enterDarkBabyScene();
      }
    }
  }

  private enterDarkBabyScene(): void {
    this.inDarkBabyScene = true;
    this.darkBabyTimer = 0;
    this.jumpscareActive = false;
    this.jumpscareTimer = 0;
    this.crashScreenActive = false;
    this.crashButtonHovered = false;
  }

  private resolveDarkBabyCatch(): void {
    this.inDarkBabyScene = false;
    this.darkBabyTimer = 0;
    this.jumpscareActive = false;
    this.jumpscareTimer = 0;
    this.crashErrorCode = makeCrashErrorCode();
    this.crashScreenActive = true;
    this.crashButtonHovered = false;
  }

  private getEntryAtPos(x: number, y: number): number | null {
    if (x < 50 || x > 750) return null;
    if (y < this.listStartY) return null;
    const slot = Math.floor((y - this.listStartY) / this.entryHeight);
    if (slot < 0 || slot >= this.visibleEntries) return null;
    const index = this.scrollOffset + slot;
    if (index >= this.entries.length) return null;
    return index;
  }

  private tryTeleport(index: number): void {
    if (index < 0 || index >= this.entries.length) return;
    const entry = this.entries[index];
    if (!entry) return;
    if (isMillionaireMode(this.theme) && !NORMAL_STAGE_ORDER.includes(entry.stage)) return;
    if (isNu11Mode(this.theme) && entry.stage === "baby") {
      return;
    }
    if (entry.discovered && this.onTeleport) {
      this.onTeleport(entry.stage);
      this.onClose();
    }
  }

  private adjustScroll(): void {
    if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + this.visibleEntries) {
      this.scrollOffset = this.selectedIndex - this.visibleEntries + 1;
    }
  }

  private getSkullRect() {
    return { x: 400 - 30, y: 600 - 140, w: 60, h: 60 };
  }

  private getVentRect() {
    return { x: 400 - 40, y: 600 - 150, w: 80, h: 50 };
  }

  private getCrashButtonRect() {
    return { x: 400 - 150, y: 460, w: 300, h: 56 };
  }

  private drawSkullAndVent(ctx: CanvasRenderingContext2D): void {
    const vent = this.getVentRect();
    const skull = this.getSkullRect();
    if (this.skullFallen) {
      ctx.fillStyle = "rgb(10,10,15)";
      ctx.fillRect(vent.x, vent.y, vent.w, vent.h);
      ctx.strokeStyle = "rgb(50,50,60)";
      ctx.strokeRect(vent.x, vent.y, vent.w, vent.h);
      for (let i = 0; i < 4; i += 1) {
        const y = vent.y + 10 + i * 10;
        ctx.strokeStyle = "rgb(30,30,40)";
        ctx.beginPath();
        ctx.moveTo(vent.x + 5, y);
        ctx.lineTo(vent.x + vent.w - 5, y);
        ctx.stroke();
      }
      ctx.fillStyle = this.ventHovered ? "rgb(230,70,70)" : "rgb(200,50,50)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("click vent or press E", 400, vent.y - 25);
    }
    let skullY = skull.y + skull.h / 2;
    if (this.skullFallen) skullY += this.skullFallOffset;
    if (skullY > 650) return;
    ctx.fillStyle = "rgb(200,190,180)";
    ctx.beginPath();
    ctx.arc(skull.x + skull.w / 2, skullY, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(20,20,30)";
    ctx.beginPath();
    ctx.arc(skull.x + skull.w / 2 - 8, skullY - 5, 7, 0, Math.PI * 2);
    ctx.arc(skull.x + skull.w / 2 + 8, skullY - 5, 7, 0, Math.PI * 2);
    ctx.fill();
    if (this.skullClicks > 0 && !this.skullFallen) {
      ctx.strokeStyle = "rgb(100,90,80)";
      for (let i = 0; i < this.skullClicks; i += 1) {
        ctx.beginPath();
        ctx.moveTo(skull.x + 5 + i * 8, skullY - 20 + (i % 3) * 5);
        ctx.lineTo(skull.x + 10 + i * 8, skullY - 10 + (i % 3) * 5);
        ctx.stroke();
      }
    }
  }
}

function drawMissingPoster(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 300;
  const h = 70;
  const paper = ctx.createLinearGradient(x, y, x, y + h);
  paper.addColorStop(0, "rgb(250,235,210)");
  paper.addColorStop(1, "rgb(226,200,172)");
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 2);
  ctx.lineTo(x + w - 6, y + 4);
  ctx.lineTo(x + w - 2, y + 14);
  ctx.lineTo(x + w - 4, y + h - 6);
  ctx.lineTo(x + w - 14, y + h - 2);
  ctx.lineTo(x + 10, y + h - 4);
  ctx.lineTo(x + 2, y + h - 12);
  ctx.lineTo(x + 4, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,90,70,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "rgb(90,70,60)";
  for (let i = 0; i < 10; i += 1) {
    const px = x + 10 + (i * 27) % w;
    const py = y + 10 + ((i * 19) % h);
    ctx.beginPath();
    ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(x + 40, y + 36);
  const photoGrad = ctx.createLinearGradient(-20, -18, 20, 18);
  photoGrad.addColorStop(0, "rgb(200,190,185)");
  photoGrad.addColorStop(1, "rgb(150,140,135)");
  ctx.fillStyle = photoGrad;
  ctx.beginPath();
  ctx.rect(-22, -18, 44, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,70,60,0.6)";
  ctx.stroke();
  ctx.fillStyle = "rgba(40,30,30,0.5)";
  ctx.beginPath();
  ctx.ellipse(-6, -2, 6, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x + 210, y + 40);
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(200,40,40,0.7)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DO NOT APPROACH", 0, 0);
  ctx.restore();

  ctx.fillStyle = "rgb(110,70,70)";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("MISSING", x + 90, y + 8);
  ctx.fillStyle = "rgb(90,70,60)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("Have you seen me?", x + 92, y + 48);
}

function drawDarkBaby(ctx: CanvasRenderingContext2D, timer: number): void {
  ctx.fillStyle = "rgb(5,5,10)";
  ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = "rgb(120,80,80)";
  ctx.font = "20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("The vent breathes.", 400, 60);
  ctx.fillText("Something watches you...", 400, 90);
  const pulse = 1 + 0.1 * (timer % 1);
  ctx.fillStyle = "rgb(30,10,10)";
  ctx.beginPath();
  ctx.arc(400, 320, 120 * pulse, 0, Math.PI * 2);
  ctx.fill();
  const remainingSeconds = Math.max(0, Math.ceil(DARK_BABY_DURATION_SECONDS - timer));
  ctx.fillStyle = "rgb(200,80,80)";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(`${remainingSeconds} seconds`, 400, 520);
}

function drawJumpscare(ctx: CanvasRenderingContext2D, timer: number): void {
  const flash = Math.floor(timer * 32) % 2 === 0;
  ctx.fillStyle = flash ? "rgb(255,245,245)" : "rgb(90,0,0)";
  ctx.fillRect(0, 0, 800, 600);
  const shake = Math.max(0, 10 - timer * 10);
  const ox = (Math.random() * 2 - 1) * shake;
  const oy = (Math.random() * 2 - 1) * shake;
  const cx = 400 + ox;
  const cy = 300 + oy;

  const faceGrad = ctx.createRadialGradient(cx, cy - 40, 20, cx, cy, 220);
  faceGrad.addColorStop(0, "rgb(250,230,230)");
  faceGrad.addColorStop(0.5, "rgb(120,15,15)");
  faceGrad.addColorStop(1, "rgb(15,0,0)");
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 210, 170, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy - 145);
  ctx.quadraticCurveTo(cx - 200, cy - 240, cx - 60, cy - 225);
  ctx.moveTo(cx + 120, cy - 145);
  ctx.quadraticCurveTo(cx + 200, cy - 240, cx + 60, cy - 225);
  ctx.stroke();

  ctx.fillStyle = "rgb(255,30,30)";
  ctx.beginPath();
  ctx.ellipse(cx - 65, cy - 30, 35, 28, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 65, cy - 30, 35, 28, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(10,0,0)";
  ctx.beginPath();
  ctx.ellipse(cx - 60, cy - 26, 16, 12, -0.15, 0, Math.PI * 2);
  ctx.ellipse(cx + 60, cy - 26, 16, 12, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(30,0,0)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 70, 95, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(255,200,200)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const x = cx - 78 + i * 17;
    const yTop = cy + 26 + (i % 2 === 0 ? 0 : 8);
    const yBottom = cy + 118 + (i % 2 === 0 ? -10 : 0);
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x + 8, yBottom);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 55; i += 1) {
    ctx.fillRect(Math.random() * 800, Math.random() * 600, 18 + Math.random() * 32, 2);
  }
}

function drawCrashScreen(ctx: CanvasRenderingContext2D, buttonHovered: boolean, errorCode: string): void {
  ctx.fillStyle = "rgb(8,8,12)";
  ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = "rgba(130,0,0,0.18)";
  ctx.fillRect(20, 20, 760, 560);
  ctx.strokeStyle = "rgb(140,20,20)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 760, 560);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgb(255,90,90)";
  ctx.font = "26px monospace";
  ctx.fillText("FATAL ERROR", 56, 54);

  ctx.fillStyle = "rgb(220,220,220)";
  ctx.font = "16px monospace";
  ctx.fillText("dark_baby_exception: memory corruption in nursery.sys", 56, 110);
  ctx.fillText("render thread terminated unexpectedly", 56, 140);
  ctx.fillText("reason: THE DARK BABY FOUND YOU", 56, 170);
  ctx.fillText(`code: ${errorCode}`, 56, 200);
  ctx.fillText("recovery required to continue", 56, 230);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 28; i += 1) {
    ctx.fillRect(56, 280 + i * 7, 520 + ((i * 37) % 150), 1);
  }

  const buttonX = 400 - 150;
  const buttonY = 460;
  const buttonW = 300;
  const buttonH = 56;
  ctx.fillStyle = buttonHovered ? "rgb(210,65,65)" : "rgb(165,40,40)";
  ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
  ctx.strokeStyle = "rgb(240,150,150)";
  ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgb(255,245,245)";
  ctx.font = "18px monospace";
  ctx.fillText("Return to Main Menu", 400, buttonY + buttonH / 2);
}

function makeCrashErrorCode(): string {
  const value = Math.floor(Math.random() * 0x10000);
  return `0xDB-${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function randRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

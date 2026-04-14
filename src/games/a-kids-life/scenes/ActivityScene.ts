import { drawBackground, drawCharacter, drawTopHud } from "../graphics/draw";
import type { ActivityId, FamilySave, Milestone } from "../model/types";
import { getActivityById } from "../systems/activities";
import { addCareStars } from "../systems/aging";
import { applyNeedBoosts } from "../systems/needs";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";

type Orb = { x: number; y: number; vx: number; vy: number; alive: boolean };

export class ActivityScene implements Scene {
  private readonly activity;
  private readonly backButton;
  private readonly finishButton;
  private progress = 0;
  private time = 0;
  private dragging = false;
  private dragX = 320;
  private picked = 0;
  private readonly orbs: Orb[] = Array.from({ length: 8 }, (_, index) => ({
    x: 270 + index * 72,
    y: 300 + (index % 2) * 70,
    vx: 40 + index * 8,
    vy: 30 + (index % 3) * 10,
    alive: true,
  }));

  constructor(
    private readonly opts: {
      save: FamilySave;
      activityId: ActivityId;
      onDone: (milestone: Milestone | null) => void;
      onCancel: () => void;
    }
  ) {
    this.activity = getActivityById(this.opts.activityId);
    this.backButton = new Button(44, 36, 140, 58, "Back", "cream", () => this.opts.onCancel());
    this.finishButton = new Button(1018, 36, 140, 58, "Done", "mint", () => this.complete());
  }

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    if (!this.activity || this.activity.miniGame !== "collect") {
      return;
    }

    for (const orb of this.orbs) {
      if (!orb.alive) {
        continue;
      }
      orb.x += orb.vx * dtSeconds;
      orb.y += orb.vy * dtSeconds;
      if (orb.x < 240 || orb.x > 960) {
        orb.vx *= -1;
      }
      if (orb.y < 220 || orb.y > 560) {
        orb.vy *= -1;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const person = this.opts.save.people[this.opts.save.activePersonId];
    if (!person || !this.activity) {
      return;
    }

    drawBackground(ctx, person.lifeStage, this.opts.save.homeStyle, this.time);
    drawTopHud(ctx, this.opts.save, person);
    drawCharacter(ctx, person, { x: 190, y: 468, size: 150, time: this.time, highlight: true });

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.strokeStyle = "#d7b0c0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(260, 150, 680, 450, 36);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#674f61";
    ctx.textAlign = "center";
    ctx.font = `800 44px "Trebuchet MS", sans-serif`;
    ctx.fillText(this.activity.label, 600, 208);
    ctx.font = `700 22px "Trebuchet MS", sans-serif`;
    ctx.globalAlpha = 0.76;
    ctx.fillText(this.activity.roomHint, 600, 240);
    ctx.globalAlpha = 1;

    this.drawMiniGame(ctx);

    ctx.fillStyle = "#f4d2de";
    ctx.beginPath();
    ctx.roundRect(362, 544, 480, 26, 13);
    ctx.fill();
    ctx.fillStyle = this.activity.accent;
    ctx.beginPath();
    ctx.roundRect(362, 544, 480 * this.progress, 26, 13);
    ctx.fill();

    this.backButton.draw(ctx);
    this.finishButton.draw(ctx, { pulse: this.progress >= 1 ? 0.24 : 0 });
  }

  private drawMiniGame(ctx: CanvasRenderingContext2D): void {
    if (!this.activity) {
      return;
    }

    switch (this.activity.miniGame) {
      case "tap-fill":
        this.drawTapFill(ctx);
        break;
      case "hold-fill":
        this.drawHoldFill(ctx);
        break;
      case "drag-track":
        this.drawDragTrack(ctx);
        break;
      case "timing":
        this.drawTiming(ctx);
        break;
      case "pick-three":
        this.drawPickThree(ctx);
        break;
      case "collect":
        this.drawCollect(ctx);
        break;
    }
  }

  private drawTapFill(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fee8b1";
    for (let index = 0; index < 5; index += 1) {
      const x = 380 + (index % 3) * 120;
      const y = 320 + Math.floor(index / 3) * 120;
      ctx.beginPath();
      ctx.arc(x, y, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHoldFill(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#ffd9e4";
    ctx.beginPath();
    ctx.roundRect(430, 286, 340, 170, 44);
    ctx.fill();
    ctx.fillStyle = "#865c70";
    ctx.textAlign = "center";
    ctx.font = `800 34px "Trebuchet MS", sans-serif`;
    ctx.fillText("Hold", 600, 382);
  }

  private drawDragTrack(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#c4b0d8";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(360, 390);
    ctx.lineTo(840, 390);
    ctx.stroke();

    ctx.fillStyle = "#7ec9ff";
    ctx.beginPath();
    ctx.arc(this.dragX, 390, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTiming(ctx: CanvasRenderingContext2D): void {
    const marker = 360 + ((Math.sin(this.time * 3) + 1) / 2) * 480;
    ctx.fillStyle = "#d7f1d1";
    ctx.beginPath();
    ctx.roundRect(500, 348, 190, 36, 18);
    ctx.fill();
    ctx.strokeStyle = "#c8b6d8";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(360, 366);
    ctx.lineTo(840, 366);
    ctx.stroke();
    ctx.fillStyle = "#85607a";
    ctx.beginPath();
    ctx.arc(marker, 366, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPickThree(ctx: CanvasRenderingContext2D): void {
    const labels = ["🍎", "🥛", "🥕", "🍞", "🍓"];
    for (let index = 0; index < labels.length; index += 1) {
      const x = 360 + index * 100;
      const selected = index < this.picked;
      ctx.fillStyle = selected ? "#d8f3e7" : "#fff8eb";
      ctx.strokeStyle = selected ? "#78af92" : "#cdb7bf";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x, 290, 82, 120, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6e5467";
      ctx.textAlign = "center";
      ctx.font = `800 42px "Trebuchet MS", sans-serif`;
      ctx.fillText(labels[index] ?? "🍎", x + 41, 364);
    }
  }

  private drawCollect(ctx: CanvasRenderingContext2D): void {
    for (const orb of this.orbs) {
      if (!orb.alive) {
        continue;
      }
      ctx.fillStyle = this.activity?.accent ?? "#9fd";
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  onPointerMove(x: number, y: number): void {
    this.backButton.handlePointerMove(x, y);
    this.finishButton.handlePointerMove(x, y);

    if (this.dragging && this.activity?.miniGame === "drag-track") {
      this.dragX = Math.max(360, Math.min(840, x));
      this.progress = Math.max(this.progress, (this.dragX - 360) / 480);
    }
  }

  onPointerDown(x: number, y: number): void {
    this.backButton.handlePointerDown(x, y);
    this.finishButton.handlePointerDown(x, y);

    if (!this.activity) {
      return;
    }

    if (this.activity.miniGame === "tap-fill") {
      this.progress = Math.min(1, this.progress + 0.2);
    } else if (this.activity.miniGame === "hold-fill" && x >= 430 && x <= 770 && y >= 286 && y <= 456) {
      this.dragging = true;
    } else if (this.activity.miniGame === "drag-track" && Math.abs(x - this.dragX) < 40 && Math.abs(y - 390) < 40) {
      this.dragging = true;
    } else if (this.activity.miniGame === "timing") {
      const marker = 360 + ((Math.sin(this.time * 3) + 1) / 2) * 480;
      if (marker >= 500 && marker <= 690) {
        this.progress = Math.min(1, this.progress + 0.34);
      }
    } else if (this.activity.miniGame === "pick-three") {
      if (y >= 290 && y <= 410) {
        for (let index = 0; index < 5; index += 1) {
          const left = 360 + index * 100;
          if (x >= left && x <= left + 82) {
            this.picked = Math.min(3, this.picked + 1);
            this.progress = this.picked / 3;
          }
        }
      }
    } else if (this.activity.miniGame === "collect") {
      for (const orb of this.orbs) {
        if (!orb.alive) {
          continue;
        }
        const dx = x - orb.x;
        const dy = y - orb.y;
        if (dx * dx + dy * dy < 24 * 24) {
          orb.alive = false;
          this.progress = Math.min(1, this.progress + 0.18);
        }
      }
    }

    if (this.activity.miniGame === "hold-fill") {
      this.progress = Math.min(1, this.progress + 0.14);
    }
  }

  onPointerUp(x: number, y: number): void {
    this.backButton.handlePointerUp(x, y);
    this.finishButton.handlePointerUp(x, y);
    this.dragging = false;

    if (this.progress >= 1) {
      this.complete();
    }
  }

  private complete(): void {
    if (!this.activity) {
      this.opts.onDone(null);
      return;
    }

    const person = this.opts.save.people[this.opts.save.activePersonId];
    if (!person) {
      this.opts.onDone(null);
      return;
    }

    applyNeedBoosts(person, this.activity.boosts);
    this.opts.save.hearts += this.activity.heartReward;
    const milestone = addCareStars(this.opts.save, person, this.activity.starReward);
    this.opts.onDone(milestone);
  }
}

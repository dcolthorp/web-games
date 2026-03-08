import type { Scene } from "../app/Scene";
import type { GrowthStage, PlayOutcome, ColorTheme } from "../model/types";
import { PLAY_ANIMATION_DURATION_SECONDS } from "../systems/config";
import { getActivityById, determinePlayOutcome, getOutcomeMessage, isSpookyStage } from "../systems/play";
import { getBackgroundColor, getTextColor, getAccentColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { drawPet } from "../graphics/Sprites";
import { drawNu11Background } from "../graphics/Nu11Background";
import { Button } from "../ui/Button";

export class PlayActivityScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private activityId: string;
  private onComplete: (outcome: PlayOutcome) => void;
  private activity = getActivityById("baby", "peek_a_boo");
  private outcome: PlayOutcome | null = null;
  private outcomeMessage = "";
  private animationTime = 0;
  private phase: "playing" | "outcome" | "done" = "playing";
  private outcomeDuration = 2;
  private continueButton: Button | null = null;

  constructor(opts: {
    stage: GrowthStage;
    theme: ColorTheme;
    activityId: string;
    onComplete: (outcome: PlayOutcome) => void;
  }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.activityId = opts.activityId;
    this.onComplete = opts.onComplete;
    this.activity = getActivityById(this.stage, this.activityId, this.theme);
  }

  private createContinueButton(): void {
    this.continueButton = new Button({
      x: 400 - 100,
      y: 480,
      width: 200,
      height: 50,
      text: "Continue",
      stage: this.stage,
      onClick: () => {
        if (this.outcome) this.onComplete(this.outcome);
      },
    });
  }

  update(dt: number): void {
    this.animationTime += dt;
    if (this.phase === "playing") {
      if (this.animationTime >= PLAY_ANIMATION_DURATION_SECONDS) {
        this.outcome = determinePlayOutcome();
        this.outcomeMessage = getOutcomeMessage(this.outcome, this.stage, this.theme);
        this.phase = "outcome";
        this.animationTime = 0;
      }
    } else if (this.phase === "outcome") {
      if (this.animationTime >= this.outcomeDuration) {
        this.phase = "done";
        this.createContinueButton();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (isNu11Mode(this.theme)) {
      drawNu11Background(ctx, 800, 600, this.stage, undefined, undefined, performance.now() / 1000);
    } else {
      ctx.fillStyle = rgb(getBackgroundColor(this.stage, this.theme));
      ctx.fillRect(0, 0, 800, 600);
    }

    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.font = "32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (this.activity) ctx.fillText(`Playing: ${this.activity.name}`, 400, 40);

    const bounce = Math.abs(Math.sin(this.animationTime * 3)) * 20;
    const petX = 400;
    const petY = 260 - (this.phase === "playing" ? bounce : 0);

    drawPet(ctx, this.stage, petX, petY, this.phase === "playing" ? 120 : 100, { theme: this.theme });

    if (this.phase === "playing") {
      drawPlayEffects(ctx, petX, petY, this.animationTime, isSpookyStage(this.stage, this.theme));
    } else {
      if (this.outcome) drawOutcomeIndicator(ctx, this.outcome, petX + 60, petY - 60);
      ctx.fillStyle = rgb(getAccentColor(this.stage, this.theme));
      ctx.font = "22px system-ui, sans-serif";
      ctx.fillText(this.outcomeMessage, 400, 380);
    }

    if (this.phase === "done" && this.continueButton) {
      this.continueButton.draw(ctx);
      ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Press SPACE or click to continue", 400, 540);
    }
  }

  onPointerMove(x: number, y: number): void {
    this.continueButton?.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.continueButton?.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.continueButton?.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === " " && this.phase === "done" && this.outcome) {
      this.onComplete(this.outcome);
    }
  }
}

function drawPlayEffects(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  spooky: boolean
): void {
  for (let i = 0; i < 6; i += 1) {
    const angle = t * 3 + i * (Math.PI / 3);
    const dist = 80 + Math.sin(t * 5 + i) * 20;
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    ctx.fillStyle = spooky ? "rgb(100,200,100)" : "rgb(255,200,100)";
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOutcomeIndicator(ctx: CanvasRenderingContext2D, outcome: PlayOutcome, x: number, y: number): void {
  if (outcome === "success") {
    ctx.fillStyle = "rgb(255,215,0)";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (outcome === "minor_ouchie") {
    ctx.fillStyle = "rgb(255,182,193)";
    ctx.fillRect(x - 12, y - 4, 24, 8);
  } else if (outcome === "bigger_injury") {
    ctx.fillStyle = "rgb(255,50,50)";
    ctx.fillRect(x - 4, y - 14, 8, 28);
    ctx.fillRect(x - 14, y - 4, 28, 8);
  } else {
    ctx.fillStyle = "rgb(255,255,240)";
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

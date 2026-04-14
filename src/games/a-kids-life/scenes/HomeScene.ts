import { STAGE_THRESHOLDS } from "../constants";
import { drawBackground, drawCharacter, drawNeedBar, drawTopHud, drawPortraitChip } from "../graphics/draw";
import type { ActivityId, FamilySave } from "../model/types";
import { getRecommendedActivities, getMoodBubble } from "../systems/visualHints";
import { getVisibleNeeds } from "../systems/needs";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";

export class HomeScene implements Scene {
  private readonly activityButtons: Button[];
  private readonly familyButton: Button;
  private readonly roomButton: Button;
  private readonly homeButton: Button;
  private time = 0;

  constructor(
    private readonly opts: {
      save: FamilySave;
      onOpenActivity: (id: ActivityId) => void;
      onOpenFamily: () => void;
      onOpenSaveSelect: () => void;
      onOpenRoom: () => void;
    }
  ) {
    const person = opts.save.people[opts.save.activePersonId];
    const recommendations = person ? getRecommendedActivities(person) : [];
    this.activityButtons = recommendations.map((activity, index) => {
      return new Button(300 + index * 210, 620, 182, 100, activity.label, index === 0 ? "pink" : index === 1 ? "sky" : "mint", () =>
        this.opts.onOpenActivity(activity.id)
      );
    });
    this.familyButton = new Button(40, 620, 182, 96, "Family", "plum", () => this.opts.onOpenFamily());
    this.roomButton = new Button(978, 620, 182, 96, "Room", "gold", () => this.opts.onOpenRoom());
    this.homeButton = new Button(978, 124, 160, 58, "Saves", "cream", () => this.opts.onOpenSaveSelect());
  }

  update(dtSeconds: number): void {
    this.time += dtSeconds;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const person = this.opts.save.people[this.opts.save.activePersonId];
    if (!person) {
      return;
    }

    drawBackground(ctx, person.lifeStage, this.opts.save.homeStyle, this.time);
    drawTopHud(ctx, this.opts.save, person);

    const visibleNeeds = getVisibleNeeds(person.lifeStage);
    visibleNeeds.forEach((need, index) => {
      drawNeedBar(ctx, need, person.needs[need], 62, 146 + index * 48, 236);
    });

    const progressMax = STAGE_THRESHOLDS[person.lifeStage];
    ctx.fillStyle = "#765566";
    ctx.font = `700 18px "Trebuchet MS", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${person.ageProgress}/${progressMax}`, 78, 350);

    drawCharacter(ctx, person, {
      x: 640,
      y: 460,
      size: 210,
      mood: person.mood,
      bubble: getMoodBubble(person),
      highlight: true,
      time: this.time,
    });

    const family = Object.values(this.opts.save.people);
    family.slice(0, 5).forEach((member, index) => {
      drawPortraitChip(ctx, member, 420 + index * 78, 156, 58, member.id === person.id);
    });

    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.strokeStyle = "#d8b2b7";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(788, 190, 306, 192, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6f5262";
    ctx.textAlign = "left";
    ctx.font = `800 26px "Trebuchet MS", sans-serif`;
    ctx.fillText("Now", 818, 228);
    ctx.font = `700 20px "Trebuchet MS", sans-serif`;
    const first = this.activityButtons[0]?.label ?? "Play";
    const second = this.activityButtons[1]?.label ?? "Love";
    const third = this.activityButtons[2]?.label ?? "Rest";
    ctx.fillText(`Try ${first}`, 818, 274);
    ctx.fillText(`Then ${second}`, 818, 308);
    ctx.fillText(`Or ${third}`, 818, 342);

    this.homeButton.draw(ctx);
    this.familyButton.draw(ctx, { icon: "🌳" });
    this.roomButton.draw(ctx, { icon: "🧸" });

    this.activityButtons.forEach((button, index) => {
      button.draw(ctx, { pulse: index === 0 ? 0.22 + Math.sin(this.time * 4) * 0.08 : 0 });
    });
  }

  onPointerMove(x: number, y: number): void {
    for (const button of [this.homeButton, this.familyButton, this.roomButton, ...this.activityButtons]) {
      button.handlePointerMove(x, y);
    }
  }

  onPointerDown(x: number, y: number): void {
    for (const button of [this.homeButton, this.familyButton, this.roomButton, ...this.activityButtons]) {
      button.handlePointerDown(x, y);
    }
  }

  onPointerUp(x: number, y: number): void {
    for (const button of [this.homeButton, this.familyButton, this.roomButton, ...this.activityButtons]) {
      button.handlePointerUp(x, y);
    }
  }
}

import { SAVE_TITLES } from "../constants";
import { SaveStore } from "../model/storage";
import type { FamilySave, KidGender } from "../model/types";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";
import { SIMPLE_FONT } from "../constants";

type FieldName = "title" | "baby";

export class NewSaveScene implements Scene {
  private titleText = SAVE_TITLES[Math.floor(Math.random() * SAVE_TITLES.length)] ?? "Happy Home";
  private babyText = "Mia";
  private gender: KidGender = "girl";
  private activeField: FieldName = "baby";
  private boyButton: Button;
  private girlButton: Button;
  private backButton: Button;
  private playButton: Button;
  private randomButton: Button;

  constructor(
    private readonly opts: {
      store: SaveStore;
      onCancel: () => void;
      onCreate: (save: FamilySave) => void;
    }
  ) {
    this.boyButton = new Button(358, 410, 190, 90, "Boy", "sky", () => this.setGender("boy"));
    this.girlButton = new Button(652, 410, 190, 90, "Girl", "pink", () => this.setGender("girl"));
    this.backButton = new Button(324, 612, 180, 76, "Back", "cream", () => this.opts.onCancel());
    this.playButton = new Button(694, 612, 180, 76, "Play", "mint", () => this.createSave());
    this.randomButton = new Button(510, 612, 180, 76, "Random", "gold", () => this.randomizeName());
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fff7ef";
    ctx.fillRect(0, 0, 1200, 760);

    ctx.fillStyle = "#6a5163";
    ctx.textAlign = "center";
    ctx.font = `800 52px ${SIMPLE_FONT}`;
    ctx.fillText("New Family", 600, 94);
    ctx.font = `700 22px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.76;
    ctx.fillText("Pick a baby. Give a name.", 600, 128);
    ctx.globalAlpha = 1;

    this.drawField(ctx, 292, 180, 616, 82, "Home", this.titleText, this.activeField === "title");
    this.drawField(ctx, 292, 290, 616, 82, "Baby", this.babyText, this.activeField === "baby");

    this.boyButton.draw(ctx, { icon: "🧢", pulse: this.gender === "boy" ? 0.3 : 0 });
    this.girlButton.draw(ctx, { icon: "🎀", pulse: this.gender === "girl" ? 0.3 : 0 });

    ctx.fillStyle = "#7e6072";
    ctx.font = `700 18px ${SIMPLE_FONT}`;
    ctx.fillText("Tap a box. Type a name.", 600, 548);

    this.backButton.draw(ctx);
    this.randomButton.draw(ctx, { icon: "🎲" });
    this.playButton.draw(ctx, { icon: "✨" });
  }

  private drawField(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    active: boolean
  ): void {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = active ? "#f096ad" : "#ccb4be";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8d6b7b";
    ctx.textAlign = "left";
    ctx.font = `700 18px ${SIMPLE_FONT}`;
    ctx.fillText(label, x + 24, y + 28);
    ctx.fillStyle = "#624959";
    ctx.font = `800 32px ${SIMPLE_FONT}`;
    ctx.fillText(value || "Type", x + 24, y + 60);
  }

  onPointerMove(x: number, y: number): void {
    for (const button of [this.boyButton, this.girlButton, this.backButton, this.randomButton, this.playButton]) {
      button.handlePointerMove(x, y);
    }
  }

  onPointerDown(x: number, y: number): void {
    for (const button of [this.boyButton, this.girlButton, this.backButton, this.randomButton, this.playButton]) {
      button.handlePointerDown(x, y);
    }

    if (x >= 292 && x <= 908 && y >= 180 && y <= 262) {
      this.activeField = "title";
    } else if (x >= 292 && x <= 908 && y >= 290 && y <= 372) {
      this.activeField = "baby";
    }
  }

  onPointerUp(x: number, y: number): void {
    for (const button of [this.boyButton, this.girlButton, this.backButton, this.randomButton, this.playButton]) {
      button.handlePointerUp(x, y);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.createSave();
      return;
    }

    if (event.key === "Backspace") {
      if (this.activeField === "title") {
        this.titleText = this.titleText.slice(0, -1);
      } else {
        this.babyText = this.babyText.slice(0, -1);
      }
      return;
    }

    if (event.key.length === 1 && /^[a-zA-Z0-9 ]$/.test(event.key)) {
      if (this.activeField === "title" && this.titleText.length < 14) {
        this.titleText += event.key;
      }
      if (this.activeField === "baby" && this.babyText.length < 10) {
        this.babyText += event.key;
      }
    }
  }

  private setGender(gender: KidGender): void {
    this.gender = gender;
    this.randomizeName();
  }

  private randomizeName(): void {
    this.babyText = this.opts.store.randomBabyName(this.gender);
  }

  private createSave(): void {
    const save = this.opts.store.createSave({
      title: this.titleText.trim() || "Happy Home",
      babyName: this.babyText.trim() || this.opts.store.randomBabyName(this.gender),
      gender: this.gender,
    });

    this.opts.onCreate(save);
  }
}

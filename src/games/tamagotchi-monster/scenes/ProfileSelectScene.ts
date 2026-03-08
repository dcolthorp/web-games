import type { Scene } from "../app/Scene";
import type { Profile } from "../model/types";
import { LESCHAT_PROFILE_NAME, ProfileStore } from "../model/ProfileStore";
import { getBackgroundColor, getTextColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button, IconButton } from "../ui/Button";
import { drawPet } from "../graphics/Sprites";
import { drawNu11Background } from "../graphics/Nu11Background";

export class ProfileSelectScene implements Scene {
  private profileStore: ProfileStore;
  private onProfileSelected: (profile: Profile) => void;
  private onOpenSettings?: (profile: Profile) => void;

  private isCreating = false;
  private newProfileName = "";
  private errorMessage = "";
  private statusMessage = "";

  private profileButtons: Button[] = [];
  private settingsButtons: IconButton[] = [];
  private createButton: Button | null = null;
  private backButton: Button | null = null;
  private confirmButton: Button | null = null;

  constructor(opts: {
    profileStore: ProfileStore;
    onProfileSelected: (profile: Profile) => void;
    onOpenSettings?: (profile: Profile) => void;
  }) {
    this.profileStore = opts.profileStore;
    this.onProfileSelected = opts.onProfileSelected;
    this.onOpenSettings = opts.onOpenSettings;
    this.refreshProfiles();
  }

  isCreatingProfile(): boolean {
    return this.isCreating;
  }

  refreshProfiles(): void {
    const profiles = this.profileStore.listProfiles().map((summary) => {
      const profile = this.profileStore.loadProfile(summary.id);
      return profile ?? null;
    });
    this.profileButtons = [];
    this.settingsButtons = [];
    const startY = 150;
    const buttonWidth = 200;
    const buttonHeight = 50;
    const settingsSize = 36;
    profiles.forEach((profile, index) => {
      if (!profile) return;
      const y = startY + index * (buttonHeight + 20);
      const button = new Button({
        x: 400 - buttonWidth / 2 - (settingsSize / 2 + 5),
        y,
        width: buttonWidth,
        height: buttonHeight,
        text: profile.name,
        stage: profile.pet.stage,
        onClick: () => this.onProfileSelected(profile),
      });
      this.profileButtons.push(button);
      const settingsButton = new IconButton({
        x: button.x - settingsSize - 10,
        y: y + buttonHeight / 2 - settingsSize / 2,
        size: settingsSize,
        iconType: "settings",
        stage: profile.pet.stage,
        onClick: () => this.onOpenSettings?.(profile),
      });
      this.settingsButtons.push(settingsButton);
    });

    const createY = startY + profiles.length * (buttonHeight + 20) + 40;
    this.createButton = new Button({
      x: 400 - buttonWidth / 2,
      y: createY,
      width: buttonWidth,
      height: buttonHeight,
      text: "+ New Profile",
      stage: "baby",
      onClick: () => this.startCreating(),
    });

    this.backButton = new Button({
      x: 400 - buttonWidth - 10,
      y: 500,
      width: buttonWidth,
      height: buttonHeight,
      text: "Cancel",
      stage: "baby",
      onClick: () => this.cancelCreating(),
    });
    this.confirmButton = new Button({
      x: 400 + 10,
      y: 500,
      width: buttonWidth,
      height: buttonHeight,
      text: "Create",
      stage: "baby",
      onClick: () => this.confirmCreate(),
    });
  }

  private startCreating(): void {
    this.isCreating = true;
    this.newProfileName = "";
    this.errorMessage = "";
    this.statusMessage = "";
  }

  private cancelCreating(): void {
    this.isCreating = false;
    this.newProfileName = "";
    this.errorMessage = "";
  }

  private confirmCreate(): void {
    const name = this.newProfileName.trim().toUpperCase();
    if (!name) {
      this.errorMessage = "Please enter a name";
      return;
    }
    if (name.length > 12) {
      this.errorMessage = "Name too long (max 12 chars)";
      return;
    }
    if (name === LESCHAT_PROFILE_NAME) {
      this.profileStore.awakenLeschat();
      this.profileStore.deleteProfilesByName(name);
      const profile = this.profileStore.createProfile(name);
      this.profileStore.deleteProfile(profile.id);
      this.isCreating = false;
      this.newProfileName = "";
      this.errorMessage = "";
      this.statusMessage = "LESCHAT deleted itself. A chat icon has appeared.";
      this.refreshProfiles();
      return;
    }
    try {
      const profile = this.profileStore.createProfile(name);
      this.isCreating = false;
      this.statusMessage = "";
      this.refreshProfiles();
      this.onProfileSelected(profile);
    } catch (error) {
      this.errorMessage = (error as Error).message;
    }
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const stage = "baby";
    if (isNu11Mode()) {
      drawNu11Background(ctx, 800, 600, stage, undefined, undefined, performance.now() / 1000);
    } else {
      ctx.fillStyle = rgb(getBackgroundColor(stage));
      ctx.fillRect(0, 0, 800, 600);
    }
    ctx.fillStyle = rgb(getTextColor(stage));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (this.isCreating) {
      ctx.font = "42px system-ui, sans-serif";
      ctx.fillText("Create Profile", 400, 100);
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillText("Enter a name (max 12 chars)", 400, 160);
      drawInputBox(ctx, this.newProfileName, 220);
      if (this.errorMessage) {
        ctx.fillStyle = "rgb(255,100,100)";
        ctx.fillText(this.errorMessage, 400, 270);
      }
      this.backButton?.draw(ctx);
      this.confirmButton?.draw(ctx);
      return;
    }

    ctx.font = "48px system-ui, sans-serif";
    ctx.fillText("Tamagotchi Monster", 400, 40);
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("Select Profile", 400, 90);

    const profiles = this.profileStore.listProfiles();
    this.profileButtons.forEach((button, idx) => {
      this.settingsButtons[idx]?.draw(ctx);
      button.draw(ctx);
      const profile = this.profileStore.loadProfile(profiles[idx]?.id ?? "");
      if (profile) {
        drawPet(ctx, profile.pet.stage, button.x + button.width + 50, button.y + button.height / 2, 40, {
          theme: profile.colorTheme,
        });
      }
    });
    this.createButton?.draw(ctx);
    if (this.statusMessage) {
      ctx.fillStyle = "rgb(255,120,120)";
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillText(this.statusMessage, 400, 560);
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.isCreating) {
      this.backButton?.handlePointerMove(x, y);
      this.confirmButton?.handlePointerMove(x, y);
      return;
    }
    this.profileButtons.forEach((b) => b.handlePointerMove(x, y));
    this.settingsButtons.forEach((b) => b.handlePointerMove(x, y));
    this.createButton?.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    if (this.isCreating) {
      this.backButton?.handlePointerDown(x, y);
      this.confirmButton?.handlePointerDown(x, y);
      return;
    }
    this.profileButtons.forEach((b) => b.handlePointerDown(x, y));
    this.settingsButtons.forEach((b) => b.handlePointerDown(x, y));
    this.createButton?.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    if (this.isCreating) {
      this.backButton?.handlePointerUp(x, y);
      this.confirmButton?.handlePointerUp(x, y);
      return;
    }
    this.profileButtons.forEach((b) => b.handlePointerUp(x, y));
    this.settingsButtons.forEach((b) => b.handlePointerUp(x, y));
    this.createButton?.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (!this.isCreating) return;
    if (e.key === "Enter") {
      this.confirmCreate();
      return;
    }
    if (e.key === "Escape") {
      this.cancelCreating();
      return;
    }
    if (e.key === "Backspace") {
      this.newProfileName = this.newProfileName.slice(0, -1);
      return;
    }
    if (e.key.length === 1) {
      const char = e.key;
      if (/^[a-zA-Z0-9 ]$/.test(char) && this.newProfileName.length < 12) {
        this.newProfileName += char.toUpperCase();
      }
    }
  }
}

function drawInputBox(ctx: CanvasRenderingContext2D, value: string, y: number): void {
  ctx.strokeStyle = "rgb(200,200,200)";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(200, y, 400, 50);
  ctx.strokeRect(200, y, 400, 50);
  ctx.fillStyle = "rgb(230,230,230)";
  ctx.font = "24px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value || "NAME", 400, y + 25);
}

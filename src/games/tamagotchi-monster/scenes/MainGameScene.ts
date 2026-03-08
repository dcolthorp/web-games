import type { Scene } from "../app/Scene";
import type { ColorTheme, GrowthStage, Profile, PlayOutcome } from "../model/types";
import { MonsterIndexStore } from "../model/MonsterIndexStore";
import { CURS3D_PROFILE_NAME, ProfileStore } from "../model/ProfileStore";
import { AnimationController } from "../graphics/AnimationController";
import { ParticleSystem } from "../graphics/ParticleSystem";
import { DecorationManager } from "../graphics/DecorationManager";
import { GlitchManager, type GlitchType } from "../graphics/Glitch";
import { drawPet } from "../graphics/Sprites";
import { drawMoneyBackground } from "../graphics/MoneyBackground";
import { drawNu11Background } from "../graphics/Nu11Background";
import { HUD } from "../ui/HUD";
import { Button, IconButton } from "../ui/Button";
import {
  getBackgroundColor,
  getTransitionBackground,
  getCurrentTheme,
  isMillionaireMode,
  isNu11Mode,
} from "../systems/theme";
import { getConditionIndicator } from "../systems/medical";
import { feedPet } from "../systems/feeding";
import { brushTeeth } from "../systems/dental";
import { outcomeToCondition, getOutcomeCarePoints } from "../systems/play";
import { checkEvolution } from "../systems/growth";
import { applyMetabolism } from "../systems/metabolism";
import { applyBandAid, completeDoctorVisit, completeDentistVisit, canPlay, interactEgg, setCondition } from "../systems/pet";
import { rgb } from "../systems/utils";

export class MainGameScene implements Scene {
  readonly profile: Profile;
  private profileStore: ProfileStore;
  private monsterIndexStore: MonsterIndexStore;
  private onSwitchProfile: () => void;
  private onOpenFeeding: () => void;
  private onOpenDental: () => void;
  private onOpenPlay: () => void;
  private onOpenBandAid: () => void;
  private onOpenDoctor: () => void;
  private onOpenDentist: () => void;
  private onOpenLeschatChat: () => void;
  private leschatAwakened: boolean;
  private isCurs3dProfile: boolean;

  private animation = new AnimationController();
  private particles = new ParticleSystem();
  private decorations = new DecorationManager(800, 600);
  private hud = new HUD();
  private glitchManager: GlitchManager | null = null;

  private isEvolving = false;
  private evolutionFromStage: GrowthStage | null = null;
  private evolutionProgress = 0;
  private isGlitchHatching = false;

  private petX = 400;
  private petY = 350;
  private petSize = 120;

  private feedButton: IconButton;
  private playButton: IconButton;
  private brushButton: IconButton;
  private switchButton: Button;
  private chatButton: IconButton;
  private bandAidButton: Button | null = null;
  private doctorButton: Button | null = null;
  private dentistButton: Button | null = null;

  constructor(opts: {
    profile: Profile;
    profileStore: ProfileStore;
    monsterIndexStore: MonsterIndexStore;
    onSwitchProfile: () => void;
    onOpenFeeding: () => void;
    onOpenDental: () => void;
    onOpenPlay: () => void;
    onOpenBandAid: () => void;
    onOpenDoctor: () => void;
    onOpenDentist: () => void;
    onOpenLeschatChat: () => void;
    leschatAwakened: boolean;
  }) {
    this.profile = opts.profile;
    this.profileStore = opts.profileStore;
    this.monsterIndexStore = opts.monsterIndexStore;
    this.onSwitchProfile = opts.onSwitchProfile;
    this.onOpenFeeding = opts.onOpenFeeding;
    this.onOpenDental = opts.onOpenDental;
    this.onOpenPlay = opts.onOpenPlay;
    this.onOpenBandAid = opts.onOpenBandAid;
    this.onOpenDoctor = opts.onOpenDoctor;
    this.onOpenDentist = opts.onOpenDentist;
    this.onOpenLeschatChat = opts.onOpenLeschatChat;
    this.leschatAwakened = opts.leschatAwakened;
    this.isCurs3dProfile = this.profile.name.toUpperCase() === CURS3D_PROFILE_NAME;

    this.decorations.setStage(this.profile.pet.stage);
    if (isNu11Mode(getCurrentTheme())) {
      this.glitchManager = new GlitchManager([30, 60]);
    }

    const buttonY = 520;
    const spacing = 70;
    this.feedButton = new IconButton({
      x: this.petX - spacing * 2 - 30,
      y: buttonY,
      size: 60,
      iconType: "food",
      stage: this.profile.pet.stage,
      onClick: () => this.handleFeedClick(),
    });
    this.playButton = new IconButton({
      x: this.petX - 30,
      y: buttonY,
      size: 60,
      iconType: "play",
      stage: this.profile.pet.stage,
      onClick: () => this.handlePlayClick(),
    });
    this.brushButton = new IconButton({
      x: this.petX + spacing * 2 - 30,
      y: buttonY,
      size: 60,
      iconType: "brush",
      stage: this.profile.pet.stage,
      onClick: () => this.handleBrushClick(),
    });
    this.chatButton = new IconButton({
      x: this.petX + spacing * 3 - 30,
      y: buttonY,
      size: 60,
      iconType: "chat",
      stage: this.profile.pet.stage,
      onClick: () => this.handleLeschatClick(),
    });
    this.switchButton = new Button({
      x: 650,
      y: 20,
      width: 130,
      height: 40,
      text: "Switch",
      stage: this.profile.pet.stage,
      onClick: this.onSwitchProfile,
      fontSize: 20,
    });

    this.updateConditionButtons();
  }

  private handleFeedClick(): void {
    if (this.profile.pet.stage === "egg" || this.isEvolving) return;
    if (!this.animation.isPlayingAnimation()) this.onOpenFeeding();
  }

  private handlePlayClick(): void {
    if (!canPlay(this.profile.pet) || this.isEvolving) return;
    if (!this.animation.isPlayingAnimation()) this.onOpenPlay();
  }

  private handleBrushClick(): void {
    if (this.profile.pet.stage === "egg" || this.isEvolving) return;
    if (!this.animation.isPlayingAnimation()) this.onOpenDental();
  }

  private handleLeschatClick(): void {
    if (!this.canOpenLeschatChat()) return;
    if (!this.animation.isPlayingAnimation()) this.onOpenLeschatChat();
  }

  private canOpenLeschatChat(): boolean {
    if (!this.leschatAwakened || this.isEvolving) return false;
    return this.profile.pet.stage !== "egg" && this.profile.pet.stage !== "baby";
  }

  private updateConditionButtons(): void {
    this.bandAidButton = null;
    this.doctorButton = null;
    this.dentistButton = null;
    if (this.profile.pet.condition === "none") return;
    const indicator = getConditionIndicator(this.profile.pet.condition, this.profile.pet.stage, getCurrentTheme());
    const buttonY = 430;
    if (this.profile.pet.condition === "minor_ouchie") {
      this.bandAidButton = new Button({
        x: 300,
        y: buttonY,
        width: 200,
        height: 50,
        text: indicator.buttonText,
        stage: this.profile.pet.stage,
        onClick: this.onOpenBandAid,
      });
    } else if (this.profile.pet.condition === "bigger_injury") {
      this.doctorButton = new Button({
        x: 300,
        y: buttonY,
        width: 200,
        height: 50,
        text: indicator.buttonText,
        stage: this.profile.pet.stage,
        onClick: this.onOpenDoctor,
      });
    } else if (this.profile.pet.condition === "dental_problem") {
      this.dentistButton = new Button({
        x: 300,
        y: buttonY,
        width: 200,
        height: 50,
        text: indicator.buttonText,
        stage: this.profile.pet.stage,
        onClick: this.onOpenDentist,
      });
    }
  }

  private updateButtonThemes(): void {
    this.feedButton.setStage(this.profile.pet.stage);
    this.playButton.setStage(this.profile.pet.stage);
    this.brushButton.setStage(this.profile.pet.stage);
    this.chatButton.setStage(this.profile.pet.stage);
    this.switchButton.setStage(this.profile.pet.stage);
    this.updateConditionButtons();
  }

  private save(): void {
    this.profileStore.saveProfile(this.profile);
  }

  feedPet(foodId: string): void {
    if (feedPet(this.profile.pet, foodId, getCurrentTheme())) {
      this.animation.play("eat");
      this.particles.spawnEatingEffect(this.petX, this.petY - 30, this.profile.pet.stage);
      this.tryEvolution();
      this.save();
    }
  }

  brushTeeth(): void {
    if (brushTeeth(this.profile.pet)) {
      this.animation.play("brush");
      this.particles.spawnBrushEffect(this.petX, this.petY, this.profile.pet.stage);
      this.tryEvolution();
      this.save();
    }
  }

  handlePlayOutcome(outcome: PlayOutcome): void {
    if (outcome === "success") {
      this.profile.pet.carePoints += getOutcomeCarePoints(outcome);
      this.animation.play("happy");
      this.particles.spawnSparkles(this.petX, this.petY, 10, this.profile.pet.stage);
    } else {
      const condition = outcomeToCondition(outcome);
      if (condition !== "none") {
        setCondition(this.profile.pet, condition);
        this.updateConditionButtons();
      }
    }
    this.tryEvolution();
    this.save();
  }

  applyBandAid(): void {
    if (applyBandAid(this.profile.pet)) {
      this.animation.play("happy");
      this.particles.spawnSparkles(this.petX, this.petY, 5, this.profile.pet.stage);
      this.updateConditionButtons();
      this.tryEvolution();
      this.save();
    }
  }

  completeDoctorVisit(): void {
    if (completeDoctorVisit(this.profile.pet)) {
      this.animation.play("happy");
      this.particles.spawnSparkles(this.petX, this.petY, 8, this.profile.pet.stage);
      this.updateConditionButtons();
      this.tryEvolution();
      this.save();
    }
  }

  completeDentistVisit(): void {
    if (completeDentistVisit(this.profile.pet)) {
      this.animation.play("happy");
      this.particles.spawnSparkles(this.petX, this.petY, 8, this.profile.pet.stage);
      this.updateConditionButtons();
      this.tryEvolution();
      this.save();
    }
  }

  private tryEvolution(): void {
    const oldStage = this.profile.pet.stage;
    if (checkEvolution(this.profile.pet, getCurrentTheme())) {
      this.monsterIndexStore.discover(this.profile.pet.stage);
      this.startEvolution(oldStage);
    }
  }

  private startEvolution(fromStage: GrowthStage): void {
    this.isEvolving = true;
    this.evolutionFromStage = fromStage;
    this.evolutionProgress = 0;
    this.animation.play("evolve");
    this.particles.spawnEvolutionEffect(this.petX, this.petY, this.profile.pet.stage);
  }

  private endEvolution(): void {
    this.isEvolving = false;
    this.evolutionFromStage = null;
    this.decorations.setStage(this.profile.pet.stage);
    this.updateButtonThemes();
    this.save();
  }

  syncStage(): void {
    this.decorations.setStage(this.profile.pet.stage);
    this.updateButtonThemes();
  }

  onPointerMove(x: number, y: number): void {
    this.feedButton.handlePointerMove(x, y);
    this.playButton.handlePointerMove(x, y);
    this.brushButton.handlePointerMove(x, y);
    this.chatButton.handlePointerMove(x, y);
    this.switchButton.handlePointerMove(x, y);
    this.bandAidButton?.handlePointerMove(x, y);
    this.doctorButton?.handlePointerMove(x, y);
    this.dentistButton?.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.feedButton.handlePointerDown(x, y);
    this.playButton.handlePointerDown(x, y);
    this.brushButton.handlePointerDown(x, y);
    this.chatButton.handlePointerDown(x, y);
    this.switchButton.handlePointerDown(x, y);
    this.bandAidButton?.handlePointerDown(x, y);
    this.doctorButton?.handlePointerDown(x, y);
    this.dentistButton?.handlePointerDown(x, y);

    if (this.profile.pet.stage === "egg" && !this.isEvolving) {
      const petRect = {
        x: this.petX - this.petSize / 2,
        y: this.petY - this.petSize / 2,
        w: this.petSize,
        h: this.petSize * 1.3,
      };
      if (x >= petRect.x && x <= petRect.x + petRect.w && y >= petRect.y && y <= petRect.y + petRect.h) {
        this.interactWithEgg();
      }
    }
  }

  onPointerUp(x: number, y: number): void {
    this.feedButton.handlePointerUp(x, y);
    this.playButton.handlePointerUp(x, y);
    this.brushButton.handlePointerUp(x, y);
    this.chatButton.handlePointerUp(x, y);
    this.switchButton.handlePointerUp(x, y);
    this.bandAidButton?.handlePointerUp(x, y);
    this.doctorButton?.handlePointerUp(x, y);
    this.dentistButton?.handlePointerUp(x, y);
  }

  private interactWithEgg(): void {
    if (isNu11Mode(getCurrentTheme()) && this.glitchManager) {
      this.glitchManager.trigger("static" as GlitchType, 0.1);
    }
    const hatched = interactEgg(this.profile.pet, getCurrentTheme());
    this.particles.spawnSparkles(this.petX, this.petY, 3, "egg");
    if (hatched) {
      this.monsterIndexStore.discover("egg");
      this.monsterIndexStore.discover(this.profile.pet.stage);
      if (isNu11Mode(getCurrentTheme()) && this.glitchManager) {
        this.isGlitchHatching = true;
        this.glitchManager.startSequence(2);
      } else {
        this.startEvolution("egg");
      }
    }
    this.save();
  }

  update(dt: number): void {
    this.animation.update(dt);
    this.particles.update(dt);
    this.decorations.update(dt);
    if (this.glitchManager) {
      this.glitchManager.update(dt);
      if (this.isGlitchHatching && this.glitchManager.isSequenceComplete()) {
        this.isGlitchHatching = false;
        this.startEvolution("egg");
      }
    }
    if (this.isEvolving) {
      this.evolutionProgress = this.animation.getEvolveProgress();
      if (this.animation.isEvolveComplete()) this.endEvolution();
    }

    const prevCondition = this.profile.pet.condition;
    applyMetabolism(this.profile.pet, dt);
    if (this.profile.pet.condition !== prevCondition) {
      this.updateConditionButtons();
    }

    this.hud.update(this.profile.pet, this.profile.pet.stage);

    if (Math.random() < 0.02) {
      this.particles.spawnAmbient(this.profile.pet.stage);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const theme = getCurrentTheme();
    if (isMillionaireMode(theme)) {
      drawMoneyBackground(
        ctx,
        800,
        600,
        this.profile.pet.stage,
        this.isEvolving ? this.evolutionFromStage ?? undefined : undefined,
        this.isEvolving ? this.evolutionProgress : undefined
      );
    } else if (isNu11Mode(theme)) {
      const evolveFrom = this.isEvolving ? this.evolutionFromStage ?? undefined : undefined;
      const evolveProgress = this.isEvolving ? this.evolutionProgress : undefined;
      drawNu11Background(ctx, 800, 600, this.profile.pet.stage, evolveFrom, evolveProgress, performance.now() / 1000);
    } else {
      const bg =
        this.isEvolving && this.evolutionFromStage
          ? getTransitionBackground(this.evolutionFromStage, this.profile.pet.stage, this.evolutionProgress, theme)
          : getBackgroundColor(this.profile.pet.stage, theme);
      ctx.fillStyle = rgb(bg);
      ctx.fillRect(0, 0, 800, 600);
    }

    this.decorations.draw(ctx);

    const petY = this.petY + this.animation.getBounceOffset();
    const size = this.petSize * this.animation.getScaleFactor();
    if (this.isCurs3dProfile && this.profile.pet.stage !== "egg") {
      drawCurs3dPet(ctx, this.petX, petY, size, this.animation.getWobble());
    } else {
      drawPet(ctx, this.profile.pet.stage, this.petX, petY, size, {
        wobble: this.animation.getWobble(),
        blink: this.animation.getIsBlinking(),
        theme: getCurrentTheme(),
      });
    }

    this.particles.draw(ctx);
    if (this.glitchManager) this.glitchManager.draw(ctx, 800, 600);

    this.hud.draw(ctx, this.profile.pet.stage, this.profile.name, this.profile.pet);

    if (this.profile.pet.stage !== "egg" && !this.isEvolving) {
      this.feedButton.draw(ctx);
      if (canPlay(this.profile.pet)) this.playButton.draw(ctx);
      this.brushButton.draw(ctx);
      if (this.canOpenLeschatChat()) this.chatButton.draw(ctx);
    }

    if (this.profile.pet.condition !== "none" && !this.isEvolving) {
      const indicator = getConditionIndicator(this.profile.pet.condition, this.profile.pet.stage, getCurrentTheme());
      if (indicator.message) {
        ctx.fillStyle = rgb(indicator.color ?? [255, 255, 255]);
        ctx.font = "18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(indicator.message, 400, 400);
      }
      this.bandAidButton?.draw(ctx);
      this.doctorButton?.draw(ctx);
      this.dentistButton?.draw(ctx);
    }

    this.switchButton.draw(ctx);

    if (this.isEvolving) {
      ctx.fillStyle = "white";
      ctx.font = "28px system-ui, sans-serif";
      ctx.textAlign = "center";
      const msg = this.evolutionFromStage === "egg" ? "Hatching!" : `Evolving to ${this.profile.pet.stage}!`;
      ctx.fillText(msg, 400, 120);
    }

    if (this.profile.pet.stage === "egg" && !this.isEvolving && !this.isGlitchHatching) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click the egg to hatch!", 400, 480);
    }
  }
}

function drawCurs3dPet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  wobble: number
): void {
  const t = performance.now() / 1000;
  const bodyJitterX = Math.sin(wobble * 1.6 + t * 2.5) * 4;
  const bodyJitterY = Math.cos(wobble * 1.2 + t * 2.2) * 3;

  ctx.save();
  ctx.translate(x + bodyJitterX, y + bodyJitterY);

  const redBody = ctx.createRadialGradient(-size * 0.2, -size * 0.28, size * 0.12, 0, 0, size * 0.78);
  redBody.addColorStop(0, "rgb(255,95,95)");
  redBody.addColorStop(0.62, "rgb(215,20,40)");
  redBody.addColorStop(1, "rgb(125,0,0)");
  ctx.fillStyle = redBody;
  ctx.strokeStyle = "rgb(60,0,0)";
  ctx.lineWidth = Math.max(3, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.66, -size * 0.06, -size * 0.22, -size * 0.44);
  ctx.quadraticCurveTo(0, -size * 0.64, size * 0.22, -size * 0.44);
  ctx.quadraticCurveTo(size * 0.66, -size * 0.06, size * 0.42, size * 0.28);
  ctx.quadraticCurveTo(0, size * 0.64, -size * 0.42, size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawWigglingBlackFace(ctx, size, t);
  ctx.restore();
}

function drawWigglingBlackFace(ctx: CanvasRenderingContext2D, size: number, t: number): void {
  const faceJitterX = Math.sin(t * 14.5) * 3.5;
  const faceJitterY = Math.cos(t * 11.7) * 3.5;

  ctx.save();
  ctx.translate(faceJitterX, faceJitterY);
  ctx.strokeStyle = "rgb(0,0,0)";
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.lineWidth = Math.max(2.5, size * 0.022);

  const eyeY = -size * 0.16;
  ctx.beginPath();
  ctx.arc(-size * 0.14, eyeY, size * 0.052, 0, Math.PI * 2);
  ctx.arc(size * 0.14, eyeY, size * 0.052, 0, Math.PI * 2);
  ctx.fill();

  const mouthY = size * 0.14;
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, mouthY);
  ctx.quadraticCurveTo(0, mouthY + size * 0.2, size * 0.3, mouthY);
  ctx.stroke();

  const toothCount = 7;
  for (let i = 0; i < toothCount; i += 1) {
    const toothX = -size * 0.24 + (i / (toothCount - 1)) * size * 0.48;
    const toothHeight = size * (i % 2 === 0 ? 0.08 : 0.05);
    ctx.beginPath();
    ctx.moveTo(toothX, mouthY + 1);
    ctx.lineTo(toothX, mouthY + toothHeight);
    ctx.stroke();
  }

  ctx.restore();
}

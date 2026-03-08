export type AnimationType = "idle" | "eat" | "brush" | "happy" | "evolve";

export class AnimationController {
  currentAnimation: AnimationType = "idle";
  animationTimer = 0;
  blinkTimer = 0;
  isBlinking = false;
  wobblePhase = 0;
  private evolveJustCompleted = false;

  eatDuration = 1.5;
  brushDuration = 2.0;
  happyDuration = 1.0;
  evolveDuration = 3.0;
  blinkInterval = 3.0;
  blinkDuration = 0.15;

  update(dt: number): void {
    this.animationTimer += dt;
    this.wobblePhase += dt * 3;

    this.blinkTimer += dt;
    if (this.isBlinking) {
      if (this.blinkTimer >= this.blinkDuration) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    } else if (this.blinkTimer >= this.blinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    if (this.currentAnimation === "eat" && this.animationTimer >= this.eatDuration) {
      this.currentAnimation = "idle";
      this.animationTimer = 0;
    } else if (this.currentAnimation === "brush" && this.animationTimer >= this.brushDuration) {
      this.currentAnimation = "idle";
      this.animationTimer = 0;
    } else if (this.currentAnimation === "happy" && this.animationTimer >= this.happyDuration) {
      this.currentAnimation = "idle";
      this.animationTimer = 0;
    } else if (this.currentAnimation === "evolve" && this.animationTimer >= this.evolveDuration) {
      this.currentAnimation = "idle";
      this.animationTimer = 0;
      this.evolveJustCompleted = true;
    }
  }

  play(type: AnimationType): void {
    this.currentAnimation = type;
    this.animationTimer = 0;
    this.evolveJustCompleted = false;
  }

  isPlayingAnimation(): boolean {
    return this.currentAnimation !== "idle";
  }

  getWobble(): number {
    return this.wobblePhase;
  }

  getIsBlinking(): boolean {
    return this.isBlinking;
  }

  getEatProgress(): number {
    if (this.currentAnimation !== "eat") return 0;
    return Math.min(1, this.animationTimer / this.eatDuration);
  }

  getBrushProgress(): number {
    if (this.currentAnimation !== "brush") return 0;
    return Math.min(1, this.animationTimer / this.brushDuration);
  }

  getEvolveProgress(): number {
    if (this.currentAnimation !== "evolve") return 0;
    return Math.min(1, this.animationTimer / this.evolveDuration);
  }

  isEvolveComplete(): boolean {
    if (this.evolveJustCompleted) {
      this.evolveJustCompleted = false;
      return true;
    }
    return false;
  }

  getBounceOffset(): number {
    if (this.currentAnimation === "happy") return Math.sin(this.animationTimer * 15) * 10;
    if (this.currentAnimation === "idle") return Math.sin(this.animationTimer * 2) * 3;
    return 0;
  }

  getScaleFactor(): number {
    if (this.currentAnimation !== "evolve") return 1;
    const progress = this.getEvolveProgress();
    if (progress < 0.5) return 1 + Math.sin(progress * 20) * 0.1;
    return 1 + (progress - 0.5) * 0.3;
  }
}


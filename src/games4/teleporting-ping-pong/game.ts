export const WIDTH = 960;
export const HEIGHT = 600;
const TABLE_TOP = 440;
const TABLE_LEFT = 80;
const TABLE_RIGHT = 880;
const NET_X = 480;
const NET_TOP = 400;
const GRAVITY = 1400;
const BALL_RADIUS = 8;
const PADDLE_RADIUS = 34;
const SERVE_BOUNCE_SPEED = 560;
const CPU_SPEED = 470;

// Swing speeds are in canvas pixels per second.
const TELEPORT_POWER = 2300;
// The block party trick: a ball that's low and bouncing teleports with a smaller swing.
const LOW_BALL_TELEPORT_POWER = 1500;
const LOW_BALL_HEIGHT = 70;
const MATRIX_POWER = 3600;

const BULB_COLORS = ["#ff5a5f", "#ffd166", "#06d6a0", "#4d9dff", "#c77dff"];
const MATRIX_GLYPHS = "01<>/{}[]#$%&*+=?";

export type Side = "left" | "right";
// "solo" plays the CPU. In a tournament the "host" runs the real game and the "guest" just shows it.
export type MatchMode = "solo" | "host" | "guest";
type Phase = "serve" | "rally" | "point" | "gameOver";
type MessageKind = "none" | "serve" | "teleport" | "matrix" | "point";
// Why the side that lost the point lost it.
type PointReason = "short" | "out" | "missed" | "confused";
// x, y, count, color, speed, life
type Burst = [number, number, number, string, number, number];

const PADDLE_COLORS: Record<Side, string> = { left: "#ff5a5f", right: "#4d9dff" };
const LABEL_COLORS: Record<Side, string> = { left: "#ff8a8d", right: "#8fc1ff" };

interface Paddle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  cooldown: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface MatchSnapshot {
  ball: { x: number; y: number; vx: number; vy: number; visible: boolean };
  paddles: Record<Side, { x: number; y: number }>;
  score: Record<Side, number>;
  teleports: Record<Side, number>;
  phase: Phase;
  server: Side;
  messageKind: MessageKind;
  messageTimer: number;
  pointWinner: Side;
  pointReason: PointReason;
  matrixTimer: number;
  bursts: Burst[];
}

export interface MatchOptions {
  mode: MatchMode;
  localSide: Side;
  names: Record<Side, string>;
  winScore: number;
  onTeleport?: () => void;
  onGameOver?: (winner: Side) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function otherSide(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function sideOf(x: number): Side {
  return x < NET_X ? "left" : "right";
}

function paddleMinX(side: Side): number {
  return side === "left" ? 20 : NET_X + PADDLE_RADIUS + 6;
}

function paddleMaxX(side: Side): number {
  return side === "left" ? NET_X - PADDLE_RADIUS - 6 : WIDTH - 20;
}

function makePaddle(x: number): Paddle {
  return { x, y: 340, prevX: x, prevY: 340, cooldown: 0 };
}

// Picks a velocity that lands the ball at targetX, slowing the shot down until it clears the net.
function aimedVelocity(x: number, y: number, targetX: number, speed: number): { vx: number; vy: number } {
  const landingY = TABLE_TOP - BALL_RADIUS;
  let shotSpeed = speed;
  while (true) {
    const time = Math.max(0.2, Math.abs(targetX - x) / shotSpeed);
    const vx = (targetX - x) / time;
    const vy = (landingY - y - 0.5 * GRAVITY * time * time) / time;
    const netTime = (NET_X - x) / vx;
    const netY = y + vy * netTime + 0.5 * GRAVITY * netTime * netTime;
    const clearsNet = netTime <= 0 || netTime >= time || netY < NET_TOP - BALL_RADIUS * 2;
    if (clearsNet || shotSpeed <= 300) return { vx, vy };
    shotSpeed *= 0.85;
  }
}

export class PingPongMatch {
  gameOverHint = "";
  gameOverNote = "";

  private readonly ctx: CanvasRenderingContext2D;
  private readonly mode: MatchMode;
  private readonly localSide: Side;
  private readonly names: Record<Side, string>;
  private readonly winScore: number;
  private readonly onTeleport: () => void;
  private readonly onGameOver: (winner: Side) => void;

  private ball = { x: 300, y: 320, vx: 0, vy: 0, visible: true };
  private readonly trail: { x: number; y: number }[] = [];
  private readonly paddles: Record<Side, Paddle> = { left: makePaddle(220), right: makePaddle(780) };
  private readonly pointer = { x: 220, y: 340 };
  // The other player's paddle: where it should be, and how hard they're swinging.
  private remote = { x: 780, y: 340, power: 0 };
  private swingSamples: { time: number; speed: number }[] = [];
  private readonly particles: Particle[] = [];
  private pendingBursts: Burst[] = [];
  private score: Record<Side, number> = { left: 0, right: 0 };
  private teleports: Record<Side, number> = { left: 0, right: 0 };
  private server: Side = "left";
  private phase: Phase = "serve";
  private phaseTimer = 0;
  private lastHitter: Side | null = null;
  private bouncesOnReceiverSide = 0;
  private teleportTimer = 0;
  private matrixTimer = 0;
  private matrixDrops: number[] = [];
  private cpuConfusedTimer = 0;
  private localPower = 0;
  private shownPower = 0;
  private messageKind: MessageKind = "none";
  private messageTimer = 0;
  private pointWinner: Side = "left";
  private pointReason: PointReason = "missed";
  private elapsed = 0;
  private gameOverReported = false;

  constructor(ctx: CanvasRenderingContext2D, options: MatchOptions) {
    this.ctx = ctx;
    this.mode = options.mode;
    this.localSide = options.localSide;
    this.names = { ...options.names };
    this.winScore = options.winScore;
    this.onTeleport = options.onTeleport ?? (() => {});
    this.onGameOver = options.onGameOver ?? (() => {});
    const localPaddle = this.paddles[this.localSide];
    this.pointer.x = localPaddle.x;
    this.pointer.y = localPaddle.y;
    const otherPaddle = this.paddles[otherSide(this.localSide)];
    this.remote = { x: otherPaddle.x, y: otherPaddle.y, power: 0 };
    this.startServe();
  }

  isOver(): boolean {
    return this.phase === "gameOver";
  }

  setName(side: Side, name: string): void {
    this.names[side] = name;
  }

  setLocalPointer(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  // Snaps the paddle to the pointer without counting it as a swing, like after unpausing.
  settleLocalPaddle(): void {
    const paddle = this.paddles[this.localSide];
    paddle.x = clamp(this.pointer.x, paddleMinX(this.localSide), paddleMaxX(this.localSide));
    paddle.y = clamp(this.pointer.y, 120, HEIGHT - 20);
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
    this.swingSamples = [];
    this.localPower = 0;
  }

  getLocalPaddle(): { x: number; y: number; power: number } {
    const paddle = this.paddles[this.localSide];
    return { x: paddle.x, y: paddle.y, power: this.localPower };
  }

  setRemotePaddle(x: unknown, y: unknown, power: unknown): void {
    if (typeof x !== "number" || typeof y !== "number" || typeof power !== "number") return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(power)) return;
    this.remote = { x, y, power: clamp(power, 0, 10000) };
  }

  takeSnapshot(): MatchSnapshot {
    const bursts = this.pendingBursts;
    this.pendingBursts = [];
    return {
      ball: { ...this.ball },
      paddles: {
        left: { x: this.paddles.left.x, y: this.paddles.left.y },
        right: { x: this.paddles.right.x, y: this.paddles.right.y },
      },
      score: { ...this.score },
      teleports: { ...this.teleports },
      phase: this.phase,
      server: this.server,
      messageKind: this.messageKind,
      messageTimer: this.messageTimer,
      pointWinner: this.pointWinner,
      pointReason: this.pointReason,
      matrixTimer: this.matrixTimer,
      bursts,
    };
  }

  applySnapshot(snapshot: MatchSnapshot): void {
    if (!snapshot || !snapshot.ball || !snapshot.paddles || !snapshot.score || !snapshot.teleports) return;
    const localTeleportsBefore = this.teleports[this.localSide];
    if (snapshot.matrixTimer > 0 && this.matrixTimer <= 0) this.startMatrixRain();

    this.ball = { ...snapshot.ball, visible: snapshot.ball.visible === true };
    const otherPaddle = snapshot.paddles[otherSide(this.localSide)];
    if (otherPaddle) this.remote = { x: otherPaddle.x, y: otherPaddle.y, power: 0 };
    this.score = { left: snapshot.score.left, right: snapshot.score.right };
    this.teleports = { left: snapshot.teleports.left, right: snapshot.teleports.right };
    this.phase = snapshot.phase;
    this.server = snapshot.server;
    this.messageKind = snapshot.messageKind;
    this.messageTimer = snapshot.messageTimer;
    this.pointWinner = snapshot.pointWinner;
    this.pointReason = snapshot.pointReason;
    this.matrixTimer = snapshot.matrixTimer;
    if (Array.isArray(snapshot.bursts)) {
      snapshot.bursts.slice(0, 20).forEach(([x, y, count, color, speed, life]) => this.burst(x, y, count, color, speed, life));
    }

    const localTeleportsNow = Math.min(this.teleports[this.localSide], localTeleportsBefore + 5);
    for (let i = localTeleportsBefore; i < localTeleportsNow; i += 1) this.onTeleport();
    if (this.phase === "gameOver") this.reportGameOver();
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    this.matrixTimer = Math.max(0, this.matrixTimer - dt);
    this.matrixDrops = this.matrixDrops.map((y) => (y > HEIGHT + 220 ? randomBetween(-200, 0) : y + 700 * dt));
    this.updateLocalPaddle(dt);
    this.updateParticles(dt);

    if (this.mode === "guest") {
      this.updateGuestView(dt);
      return;
    }

    if (this.phase === "serve") this.phaseTimer = Math.max(0, this.phaseTimer - dt);
    if (this.mode === "solo") this.updateCpu(dt);
    else this.updateRemotePaddle(dt);
    if (this.phase === "gameOver") return;

    this.updateBall(dt);

    const canHit = this.ball.visible && (this.phase === "serve" || this.phase === "rally");
    if (canHit && this.paddles.left.cooldown <= 0 && this.paddleTouchesBall(this.paddles.left)) {
      this.hit("left", this.powerOf("left"));
    } else if (
      canHit &&
      this.paddles.right.cooldown <= 0 &&
      !this.cpuIsWaitingToServe() &&
      this.paddleTouchesBall(this.paddles.right)
    ) {
      this.hit("right", this.powerOf("right"));
    }

    if (this.phase === "point") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if ((this.score.left + this.score.right) % 2 === 0) this.server = otherSide(this.server);
        this.startServe();
      }
    }
  }

  draw(): void {
    this.drawBackground();
    this.drawTable();
    this.drawBall();
    this.drawPaddle("left");
    this.drawPaddle("right");
    this.drawParticles();
    this.drawHud();
    if (this.matrixTimer > 0) this.drawMatrix();
    this.drawMessage();
    if (this.phase === "gameOver") this.drawGameOver();
  }

  private powerOf(side: Side): number {
    return side === this.localSide ? this.localPower : this.remote.power;
  }

  private showMessage(kind: MessageKind, seconds: number): void {
    this.messageKind = kind;
    this.messageTimer = seconds;
  }

  private startServe(): void {
    this.phase = "serve";
    this.phaseTimer = 0.8;
    this.lastHitter = null;
    this.bouncesOnReceiverSide = 0;
    this.teleportTimer = 0;
    this.cpuConfusedTimer = 0;
    this.ball = { x: this.server === "left" ? 300 : 660, y: TABLE_TOP - 120, vx: 0, vy: 0, visible: true };
    this.trail.length = 0;
    this.showMessage("serve", 2);
  }

  private startMatrixRain(): void {
    this.matrixDrops = Array.from({ length: 48 }, () => randomBetween(-HEIGHT, 0));
  }

  private burst(x: number, y: number, count: number, color: string, speed: number, life: number): void {
    const safeCount = clamp(Math.floor(count), 0, 40);
    for (let i = 0; i < safeCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = randomBetween(speed * 0.3, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        size: randomBetween(2, 6),
        color,
      });
    }
    if (this.mode === "host") this.pendingBursts.push([x, y, safeCount, color, speed, life]);
  }

  private hit(side: Side, power: number): void {
    const isCpu = this.mode === "solo" && side === "right";
    this.paddles[side].cooldown = isCpu ? 0.3 : 0.25;
    this.lastHitter = side;
    this.bouncesOnReceiverSide = 0;
    this.phase = "rally";
    const acrossNet = (depth: number): number => (side === "left" ? NET_X + depth : NET_X - depth);

    let shot: { vx: number; vy: number };
    if (isCpu) {
      shot = aimedVelocity(this.ball.x, this.ball.y, acrossNet(randomBetween(80, 320)), randomBetween(480, 680));
    } else {
      const isLow = this.ball.y > TABLE_TOP - LOW_BALL_HEIGHT;
      if (power >= (isLow ? LOW_BALL_TELEPORT_POWER : TELEPORT_POWER)) {
        this.teleportBall(side, power >= MATRIX_POWER);
        return;
      }
      const depth = clamp(120 + power * 0.1, 120, 360);
      shot = aimedVelocity(this.ball.x, this.ball.y, acrossNet(depth), clamp(450 + power * 0.2, 450, 900));
    }
    this.ball.vx = shot.vx;
    this.ball.vy = shot.vy;
    this.burst(this.ball.x, this.ball.y, 6, "#ffffff", 160, 0.3);
  }

  // The ball deletes itself, then pops back into existence on the other player's side.
  private teleportBall(hitter: Side, intoMatrix: boolean): void {
    this.teleports[hitter] += 1;
    if (hitter === this.localSide) this.onTeleport();
    this.ball.visible = false;
    this.trail.length = 0;
    this.burst(this.ball.x, this.ball.y, 14, "#ffffff", 280, 0.5);
    this.burst(this.ball.x, this.ball.y, 14, "#7df9ff", 280, 0.5);
    if (intoMatrix) {
      this.teleportTimer = 1.4;
      this.matrixTimer = 1.4;
      this.startMatrixRain();
      this.showMessage("matrix", 1.6);
    } else {
      this.teleportTimer = 0.45;
      this.showMessage("teleport", 1.1);
    }
  }

  private respawnBall(): void {
    const landingSide = otherSide(this.lastHitter ?? "left");
    this.ball = {
      x:
        landingSide === "right"
          ? randomBetween(NET_X + 80, TABLE_RIGHT - 40)
          : randomBetween(TABLE_LEFT + 40, NET_X - 80),
      y: randomBetween(TABLE_TOP - 240, TABLE_TOP - 90),
      vx: randomBetween(-140, 140),
      vy: randomBetween(-100, 60),
      visible: true,
    };
    if (this.mode === "solo" && landingSide === "right") this.cpuConfusedTimer = 0.9;
    this.burst(this.ball.x, this.ball.y, 24, "#7df9ff", 220, 0.45);
  }

  private awardPoint(winner: Side, reason: PointReason): void {
    if (this.phase !== "rally") return;
    this.score[winner] += 1;
    if (this.score[winner] >= this.winScore) {
      this.phase = "gameOver";
      this.messageTimer = 0;
      this.reportGameOver();
      return;
    }
    this.phase = "point";
    this.phaseTimer = 1.4;
    this.pointWinner = winner;
    this.pointReason = reason;
    this.showMessage("point", 1.4);
  }

  private winner(): Side {
    return this.score.left >= this.score.right ? "left" : "right";
  }

  private reportGameOver(): void {
    if (this.gameOverReported) return;
    this.gameOverReported = true;
    this.onGameOver(this.winner());
  }

  private onTableBounce(): void {
    if (this.phase !== "rally" || !this.lastHitter) return;
    const hitter = this.lastHitter;
    const receiver = otherSide(hitter);
    if (sideOf(this.ball.x) === hitter) {
      this.awardPoint(receiver, "short");
      return;
    }
    this.bouncesOnReceiverSide += 1;
    if (this.bouncesOnReceiverSide < 2) return;
    const lookingForBall = this.mode === "solo" && receiver === "right" && this.cpuConfusedTimer > 0;
    this.awardPoint(hitter, lookingForBall ? "confused" : "missed");
  }

  private updateLocalPaddle(dt: number): void {
    const side = this.localSide;
    const paddle = this.paddles[side];
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
    paddle.x = clamp(this.pointer.x, paddleMinX(side), paddleMaxX(side));
    paddle.y = clamp(this.pointer.y, 120, HEIGHT - 20);
    paddle.cooldown = Math.max(0, paddle.cooldown - dt);

    // Swing power is the fastest the paddle moved in the last tenth of a second.
    const speed = Math.hypot(paddle.x - paddle.prevX, paddle.y - paddle.prevY) / dt;
    this.swingSamples.push({ time: this.elapsed, speed });
    while (this.swingSamples.length > 0 && this.elapsed - (this.swingSamples[0]?.time ?? this.elapsed) > 0.1) {
      this.swingSamples.shift();
    }
    this.localPower = this.swingSamples.reduce((fastest, sample) => Math.max(fastest, sample.speed), 0);
    this.shownPower = Math.max(this.localPower, this.shownPower - 2500 * dt);
  }

  private updateRemotePaddle(dt: number): void {
    const side = otherSide(this.localSide);
    const paddle = this.paddles[side];
    paddle.prevX = paddle.x;
    paddle.prevY = paddle.y;
    paddle.x = clamp(this.remote.x, paddleMinX(side), paddleMaxX(side));
    paddle.y = clamp(this.remote.y, 120, HEIGHT - 20);
    paddle.cooldown = Math.max(0, paddle.cooldown - dt);
  }

  // The guest only hears from the host a few dozen times a second, so it keeps things moving in between.
  private updateGuestView(dt: number): void {
    if (this.ball.visible && (this.phase === "serve" || this.phase === "rally")) {
      this.ball.vy += GRAVITY * dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      const overTable = this.ball.x >= TABLE_LEFT && this.ball.x <= TABLE_RIGHT;
      if (overTable && this.ball.vy > 0 && this.ball.y + BALL_RADIUS >= TABLE_TOP && this.ball.y < TABLE_TOP) {
        this.ball.y = TABLE_TOP - BALL_RADIUS;
        this.ball.vy = this.phase === "serve" ? -SERVE_BOUNCE_SPEED : -this.ball.vy * 0.86;
      }
      this.trail.push({ x: this.ball.x, y: this.ball.y });
      if (this.trail.length > 10) this.trail.shift();
    } else {
      this.trail.length = 0;
    }
    const opponent = this.paddles[otherSide(this.localSide)];
    const follow = Math.min(1, dt * 20);
    opponent.x += (this.remote.x - opponent.x) * follow;
    opponent.y += (this.remote.y - opponent.y) * follow;
  }

  private cpuIsWaitingToServe(): boolean {
    return this.mode === "solo" && this.phase === "serve" && (this.server === "left" || this.phaseTimer > 0);
  }

  private updateCpu(dt: number): void {
    const cpu = this.paddles.right;
    cpu.prevX = cpu.x;
    cpu.prevY = cpu.y;
    cpu.cooldown = Math.max(0, cpu.cooldown - dt);
    this.cpuConfusedTimer = Math.max(0, this.cpuConfusedTimer - dt);
    if (this.cpuConfusedTimer > 0) return;

    let targetX = 790;
    let targetY = 330;
    const ballInPlay =
      this.ball.visible && (this.phase === "serve" || this.phase === "rally") && !this.cpuIsWaitingToServe();
    if (ballInPlay && this.ball.x > NET_X) {
      targetX = this.ball.x + this.ball.vx * 0.08 + 24;
      targetY = this.ball.y + this.ball.vy * 0.08 + 10;
    } else if (ballInPlay && this.ball.vx > 0) {
      targetX = 760;
      targetY = clamp(this.ball.y, 250, 400);
    }

    const dx = targetX - cpu.x;
    const dy = targetY - cpu.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      const step = Math.min(distance, CPU_SPEED * dt);
      cpu.x += (dx / distance) * step;
      cpu.y += (dy / distance) * step;
    }
    cpu.x = clamp(cpu.x, paddleMinX("right"), paddleMaxX("right"));
    cpu.y = clamp(cpu.y, 120, HEIGHT - 20);
  }

  // Paddles can move a long way in one frame, so check the whole path they swept, not just where they ended up.
  private paddleTouchesBall(paddle: Paddle): boolean {
    const pathX = paddle.x - paddle.prevX;
    const pathY = paddle.y - paddle.prevY;
    const lengthSquared = pathX * pathX + pathY * pathY;
    const along =
      lengthSquared === 0
        ? 0
        : clamp(((this.ball.x - paddle.prevX) * pathX + (this.ball.y - paddle.prevY) * pathY) / lengthSquared, 0, 1);
    const closestX = paddle.prevX + pathX * along;
    const closestY = paddle.prevY + pathY * along;
    return Math.hypot(this.ball.x - closestX, this.ball.y - closestY) < PADDLE_RADIUS + BALL_RADIUS;
  }

  private updateBall(dt: number): void {
    const ball = this.ball;
    if (!ball.visible) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) this.respawnBall();
      return;
    }

    const previousY = ball.y;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const overTable = ball.x >= TABLE_LEFT && ball.x <= TABLE_RIGHT;
    if (overTable && ball.vy > 0 && previousY + BALL_RADIUS <= TABLE_TOP && ball.y + BALL_RADIUS >= TABLE_TOP) {
      ball.y = TABLE_TOP - BALL_RADIUS;
      // A ball waiting to be served keeps bouncing at the same low height forever.
      ball.vy = this.phase === "serve" ? -SERVE_BOUNCE_SPEED : -ball.vy * 0.86;
      this.onTableBounce();
    }

    const touchingNet =
      Math.abs(ball.x - NET_X) < BALL_RADIUS + 3 && ball.y + BALL_RADIUS > NET_TOP && ball.y < TABLE_TOP;
    if (touchingNet) {
      ball.x = ball.vx > 0 ? NET_X - BALL_RADIUS - 3 : NET_X + BALL_RADIUS + 3;
      ball.vx *= -0.25;
    }

    const offScreen = ball.y > HEIGHT + 30 || ball.x < -40 || ball.x > WIDTH + 40;
    if (offScreen && this.phase === "rally" && this.lastHitter) {
      const hitter = this.lastHitter;
      if (this.bouncesOnReceiverSide >= 1) this.awardPoint(hitter, "missed");
      else this.awardPoint(otherSide(hitter), "out");
    } else if (offScreen && this.phase === "serve") {
      this.startServe();
    }

    this.trail.push({ x: ball.x, y: ball.y });
    if (this.trail.length > 10) this.trail.shift();
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }
  }

  private label(side: Side): string {
    return side === this.localSide ? "YOU" : this.names[side];
  }

  private messageText(): string {
    const you = this.localSide;
    switch (this.messageKind) {
      case "teleport":
        return "TELEPORT!";
      case "matrix":
        return "INTO THE MATRIX!";
      case "serve":
        return this.server === you ? "Your serve! Smash it while it's low..." : `${this.names[this.server]} serves`;
      case "point": {
        const winner = this.pointWinner;
        const loser = otherSide(winner);
        const heading = winner === you ? "Your point!" : `Point for ${this.names[winner]}!`;
        const who = loser === you ? "You" : this.names[loser];
        const reasons: Record<PointReason, string> = {
          short: loser === you ? "Your shot didn't make it over." : `${who}'s shot didn't make it over.`,
          out: `${who} hit it out.`,
          missed: `${who} missed it.`,
          confused: `${who} is still looking for the ball.`,
        };
        return `${heading} ${reasons[this.pointReason] ?? ""}`;
      }
      default:
        return "";
    }
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#0b1026");
    sky.addColorStop(1, "#27306a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Block party string lights.
    const bulbCount = 16;
    const bulbs = Array.from({ length: bulbCount + 1 }, (_, i) => ({
      x: (i / bulbCount) * WIDTH,
      y: 30 + Math.sin((i / bulbCount) * Math.PI) * 40 + Math.sin(this.elapsed * 2 + i) * 2,
    }));
    ctx.strokeStyle = "#3a3f5c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    bulbs.forEach((bulb, i) => (i === 0 ? ctx.moveTo(bulb.x, bulb.y) : ctx.lineTo(bulb.x, bulb.y)));
    ctx.stroke();
    bulbs.forEach((bulb, i) => {
      ctx.fillStyle = BULB_COLORS[i % BULB_COLORS.length] ?? "#ffd166";
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y + 8, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y + 8, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#1a1c2e";
    ctx.fillRect(0, 530, WIDTH, HEIGHT - 530);
  }

  private drawTable(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#3b2f2a";
    ctx.fillRect(TABLE_LEFT + 50, TABLE_TOP + 14, 14, 530 - TABLE_TOP - 14);
    ctx.fillRect(TABLE_RIGHT - 64, TABLE_TOP + 14, 14, 530 - TABLE_TOP - 14);

    ctx.fillStyle = "#1b7f5a";
    ctx.fillRect(TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT, 3);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(NET_X - 2, NET_TOP - 4, 4, TABLE_TOP - NET_TOP + 4);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    for (let y = NET_TOP + 8; y < TABLE_TOP; y += 8) {
      ctx.beginPath();
      ctx.moveTo(NET_X - 6, y);
      ctx.lineTo(NET_X + 6, y);
      ctx.stroke();
    }
  }

  private drawBall(): void {
    const ctx = this.ctx;
    const ball = this.ball;
    if (!ball.visible) return;
    if (ball.x >= TABLE_LEFT && ball.x <= TABLE_RIGHT && ball.y < TABLE_TOP) {
      const closeness = clamp(1 - (TABLE_TOP - ball.y) / 300, 0.15, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.35 * closeness})`;
      ctx.beginPath();
      ctx.ellipse(ball.x, TABLE_TOP + 1, BALL_RADIUS * 1.4 * closeness, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.trail.forEach((point, i) => {
      ctx.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.3})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL_RADIUS * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPaddle(side: Side): void {
    const ctx = this.ctx;
    const paddle = this.paddles[side];
    ctx.fillStyle = "#c68b59";
    ctx.fillRect(paddle.x - 6, paddle.y + PADDLE_RADIUS - 8, 12, 36);
    ctx.fillStyle = PADDLE_COLORS[side];
    ctx.strokeStyle = "#11131f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    this.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }

  private drawHud(): void {
    const ctx = this.ctx;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(this.score.left), 440, 130);
    ctx.fillText("-", 480, 128);
    ctx.fillText(String(this.score.right), 520, 130);
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = LABEL_COLORS.left;
    ctx.fillText(this.label("left"), 405, 130);
    ctx.textAlign = "left";
    ctx.fillStyle = LABEL_COLORS.right;
    ctx.fillText(this.label("right"), 555, 130);

    ctx.textBaseline = "top";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = "#7df9ff";
    ctx.fillText(`Teleports: ${this.teleports[this.localSide]}`, 20, 96);

    if (this.cpuConfusedTimer > 0) {
      ctx.textAlign = "center";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.fillText("???", this.paddles.right.x, this.paddles.right.y - PADDLE_RADIUS - 40);
    }

    this.drawPowerMeter();

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillStyle = "#b9b3d9";
    ctx.fillText("Move your mouse to swing. Smash it while it's LOW to teleport it!", WIDTH - 20, HEIGHT - 14);
  }

  private drawPowerMeter(): void {
    const ctx = this.ctx;
    const x = 20;
    const y = 562;
    const width = 280;
    const height = 16;
    const powerX = (power: number): number => x + (Math.min(power, MATRIX_POWER) / MATRIX_POWER) * width;

    ctx.fillStyle = "#11131f";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle =
      this.shownPower >= MATRIX_POWER ? "#50ff78" : this.shownPower >= LOW_BALL_TELEPORT_POWER ? "#7df9ff" : "#ffd166";
    ctx.fillRect(x, y, powerX(this.shownPower) - x, height);
    ctx.strokeStyle = "#b9b3d9";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.textBaseline = "bottom";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#b9b3d9";
    ctx.textAlign = "left";
    ctx.fillText("SWING POWER", x, y - 3);
    const marks: [number, string][] = [
      [LOW_BALL_TELEPORT_POWER, "low"],
      [TELEPORT_POWER, "teleport"],
      [MATRIX_POWER, "matrix"],
    ];
    marks.forEach(([power, label]) => {
      const markX = powerX(power);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(markX - 1, y - 2, 2, height + 4);
      ctx.textAlign = "center";
      ctx.fillStyle = "#b9b3d9";
      ctx.fillText(label, Math.min(markX, x + width - 18), y - 3);
    });
  }

  private drawMatrix(): void {
    const ctx = this.ctx;
    const strength = Math.min(1, this.matrixTimer / 0.4);
    ctx.fillStyle = `rgba(0,12,0,${0.85 * strength})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const columnWidth = WIDTH / Math.max(1, this.matrixDrops.length);
    this.matrixDrops.forEach((dropY, column) => {
      for (let row = 0; row < 12; row += 1) {
        ctx.fillStyle = `rgba(80,255,120,${strength * (1 - row / 12)})`;
        const glyph = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)] ?? "0";
        ctx.fillText(glyph, column * columnWidth, dropY - row * 18);
      }
    });
  }

  private drawMessage(): void {
    const text = this.messageText();
    if (this.messageTimer <= 0 || !text) return;
    const ctx = this.ctx;
    const big = this.messageKind === "teleport" || this.messageKind === "matrix";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = big ? "bold 56px system-ui, sans-serif" : "bold 26px system-ui, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#0b1026";
    ctx.strokeText(text, WIDTH / 2, 240);
    ctx.fillStyle = this.messageKind === "matrix" ? "#50ff78" : big ? "#7df9ff" : "#ffffff";
    ctx.fillText(text, WIDTH / 2, 240);
  }

  private drawGameOver(): void {
    const ctx = this.ctx;
    const winner = this.winner();
    const youWon = winner === this.localSide;
    ctx.fillStyle = "rgba(5,7,20,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.fillStyle = youWon ? "#ffd166" : "#8fc1ff";
    ctx.fillText(youWon ? "YOU WIN!" : `${this.names[winner]} WINS`, WIDTH / 2, 210);
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${this.score.left} - ${this.score.right}`, WIDTH / 2, 270);
    const teleports = this.teleports[this.localSide];
    ctx.fillStyle = "#7df9ff";
    ctx.fillText(`You teleported the ball ${teleports} ${teleports === 1 ? "time" : "times"}.`, WIDTH / 2, 310);
    if (this.gameOverNote) {
      ctx.fillStyle = "#ffd166";
      ctx.fillText(this.gameOverNote, WIDTH / 2, 355);
    }
    ctx.fillStyle = "#b9b3d9";
    ctx.fillText(this.gameOverHint, WIDTH / 2, 400);
  }
}

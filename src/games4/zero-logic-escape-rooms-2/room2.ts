import {
  BACK,
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawVignette,
  lerp,
  roundRect,
  updateDust,
  type Dust,
  type Room,
} from "../zero-logic-escape-rooms/engine";
import { sounds } from "../zero-logic-escape-rooms/sound";
import {
  allPressed,
  buttonAt,
  makeButtons,
  pressedCount,
  spawnAt,
  spawnCount,
  type RoomButton,
} from "./buttons";

// Escape Room 2: Everything is a Button. The walls are buttons, the floor is a
// button, there's a button sitting on another button, and pressing the little
// one makes more of them. Press every last one and the room itself turns out
// to have been a button the whole time, which is the way out.

const PALETTE = {
  ceiling: "#2f3a46",
  side: "#3c4a58",
  wallTop: "#4a5b6b",
  wallBottom: "#3d4c5a",
  floorBack: "#334049",
  floorFront: "#46565f",
  skirting: "#2b3640",
  floor: "concrete",
} as const;

type Stage = "pressing" | "roomdown" | "leaving" | "escaped";

interface Ripple {
  x: number;
  y: number;
  at: number;
}

export function createButtonRoom(onEscaped: () => void): Room {
  let buttons: RoomButton[] = makeButtons();
  let spawned = 0;
  let stage: Stage = "pressing";
  let startAt = 0;
  let stageAt = 0;
  let dust: Dust[] = [];
  let ripples: Ripple[] = [];
  let nudge = 0;
  // 0 is a normal room, 1 is the whole room pushed all the way in.
  let roomPress = 0;

  function puffAt(x: number, y: number): void {
    for (let i = 0; i < 10; i += 1) {
      dust.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 200,
        life: 0.4 + Math.random() * 0.4,
      });
    }
  }

  function press(button: RoomButton, now: number): void {
    if (button.pressed) {
      // Pressing a pressed button still clicks. It is still a button.
      sounds.tink();
      ripples.push({ x: button.x + button.w / 2, y: button.y + button.h / 2, at: now });
      return;
    }
    button.pressed = true;
    sounds.clack();
    puffAt(button.x + button.w / 2, button.y + button.h);

    // Every little button makes another little button, until the spares run out.
    if (button.shape === "tiny" && spawned < spawnCount()) {
      const extra = spawnAt(spawned);
      spawned += 1;
      if (extra) {
        buttons.push(extra);
        sounds.pop();
      }
    }
  }

  return {
    name: "Everything is a Button",
    exitLine: "The room was a button. You pressed it and it let you out.",

    reset(at) {
      buttons = makeButtons();
      spawned = 0;
      stage = "pressing";
      startAt = at;
      stageAt = at;
      dust = [];
      ripples = [];
      nudge = 0;
      roomPress = 0;
    },

    update(now, dt) {
      dust = updateDust(dust, dt);
      ripples = ripples.filter((ripple) => now - ripple.at < 600);
      nudge = Math.max(0, nudge - dt * 4);

      if (stage === "pressing" && allPressed(buttons)) {
        stage = "roomdown";
        stageAt = now;
        sounds.creak();
      }
      if (stage === "roomdown") {
        roomPress = clamp((now - stageAt) / 900, 0, 1);
        if (roomPress >= 1) {
          stage = "leaving";
          stageAt = now;
          sounds.thunk();
        }
      }
      if (stage === "leaving" && now - stageAt > 1200) {
        stage = "escaped";
        onEscaped();
      }
    },

    draw(now) {
      const secondsIn = (now - startAt) / 1000;

      ctx.save();
      if (stage === "leaving") {
        diveInto(W / 2, (BACK.top + BACK.bottom) / 2, clamp((now - stageAt) / 1200, 0, 1));
      }
      // The whole room sinks in like the world's biggest button.
      if (roomPress > 0) {
        const push = roomPress * 16;
        ctx.translate(0, push);
        ctx.scale(1 - roomPress * 0.03, 1 - roomPress * 0.03);
        ctx.translate(0, -push / 2);
      }
      // Every press rattles the room, because the room is a button too.
      if (nudge > 0) ctx.translate(0, Math.sin(nudge * 30) * nudge * 3);

      drawRoomBox(PALETTE);
      drawWiring();
      for (const button of buttons) drawButton(button, now);
      drawRipples(now);
      ctx.restore();

      drawDust(dust, "rgba(210, 205, 195, 0.75)");
      drawVignette();
      drawCounter();

      if (stage === "pressing") {
        drawCaption("Everything in here is a button.", secondsIn);
      }
    },

    pointerDown(p) {
      if (stage !== "pressing") return;
      const now = performance.now();
      nudge = 0.5;
      const button = buttonAt(buttons, p.x, p.y);
      if (button) {
        press(button, now);
        return;
      }
      // There was nothing there, and it clicked anyway.
      sounds.tap();
      ripples.push({ x: p.x, y: p.y, at: now });
    },

    pointerMove() {},
    pointerUp() {},

    // Everything is a button, so the cursor never says otherwise.
    cursor() {
      return "pointer";
    },
  };

  // ---------- drawing ----------

  function drawButton(button: RoomButton, now: number): void {
    const depth = button.pressed ? 2 : 8;
    ctx.save();
    ctx.translate(button.x + button.w / 2, button.y + button.h / 2);
    ctx.rotate(button.tilt);
    ctx.translate(-button.w / 2, -button.h / 2);

    // Housing underneath, so a pressed button looks sunk into its own socket.
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    if (button.shape === "round") {
      ctx.beginPath();
      ctx.ellipse(button.w / 2, button.h / 2 + 4, button.w / 2 + 4, button.h / 2 + 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(-4, -2, button.w + 8, button.h + 10, 8);
      ctx.fill();
    }

    const top = button.pressed ? 8 - depth : 0;
    ctx.translate(0, top);

    const shade = ctx.createLinearGradient(0, 0, 0, button.h);
    shade.addColorStop(0, lighten(button.color, button.pressed ? 0.05 : 0.25));
    shade.addColorStop(1, button.color);
    ctx.fillStyle = shade;

    if (button.shape === "round") {
      ctx.beginPath();
      ctx.ellipse(button.w / 2, button.h / 2, button.w / 2, button.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(0, 0, button.w, button.h, button.shape === "tiny" ? 5 : 10);
      ctx.fill();
    }

    if (!button.pressed) {
      // A shine on the unpressed ones, drifting so the room never sits still.
      ctx.globalAlpha = 0.35 + Math.sin(now / 700 + button.x) * 0.08;
      ctx.fillStyle = "#ffffff";
      if (button.shape === "round") {
        ctx.beginPath();
        ctx.ellipse(button.w / 2, button.h * 0.32, button.w * 0.28, button.h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        roundRect(6, 5, button.w - 12, button.h * 0.28, 5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // A little light comes on inside once it's down.
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.arc(button.w / 2, button.h / 2, Math.min(button.w, button.h) * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Wires run between the buttons, doing nothing in particular.
  function drawWiring(): void {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 1; i < buttons.length; i += 1) {
      const from = buttons[i - 1];
      const to = buttons[i];
      if (!from || !to) continue;
      ctx.moveTo(from.x + from.w / 2, from.y + from.h / 2);
      ctx.quadraticCurveTo(
        (from.x + to.x) / 2,
        Math.max(from.y, to.y) + 60,
        to.x + to.w / 2,
        to.y + to.h / 2
      );
    }
    ctx.stroke();
  }

  function drawRipples(now: number): void {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    for (const ripple of ripples) {
      const t = (now - ripple.at) / 600;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, lerp(4, 46, t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCounter(): void {
    if (stage !== "pressing") return;
    const text = `${pressedCount(buttons)} / ${buttons.length} pressed`;
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    const width = ctx.measureText(text).width + 32;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    roundRect(W - width - 18, 18, width, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, W - width / 2 - 18, 35);
  }
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const value = (at: number): number => {
    const channel = parseInt(clean.slice(at, at + 2), 16);
    return Math.round(channel + (255 - channel) * amount);
  };
  return `rgb(${value(0)}, ${value(2)}, ${value(4)})`;
}

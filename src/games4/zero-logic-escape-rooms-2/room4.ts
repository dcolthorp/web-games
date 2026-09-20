import {
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
  type Point,
  type Room,
} from "../zero-logic-escape-rooms/engine";
import { sounds } from "../zero-logic-escape-rooms/sound";
import { doorSpot, isNear, nextSpot, patienceFor, type DoorSpot } from "./doors";
import { armNoDoorLine, gloat, resetNoDoorLine, wordIsGone } from "./noDoorLine";

// Escape Room 4: Door :3. There is a door. It has a little face. Walk your
// cursor anywhere near it and a hand comes up out of the sentence underneath
// the game — the one that says there is no door — grabs the door, and throws
// it off the screen. It does this every single time, because the sentence is
// right and the room is wrong.
//
// So take the word "door" out of the sentence. Then it isn't saying anything,
// and the door it can't mention is one you can walk through.

const PALETTE = {
  ceiling: "#2d2636",
  side: "#3a3145",
  wallTop: "#4a4057",
  wallBottom: "#3c3348",
  floorBack: "#332c3d",
  floorFront: "#463c52",
  skirting: "#281f30",
  floor: "boards",
} as const;

const DOOR = { w: 112, h: 176 };
// The hand comes up from the bottom of the screen, where the words are.
const HAND_HOME: Point = { x: W / 2, y: H + 120 };

type Stage = "watched" | "grabbing" | "safe" | "opening" | "escaped";

interface Thrown {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
}

export function createDoorRoom(onEscaped: () => void): Room {
  let spot = 0;
  let door: DoorSpot = doorSpot(spot);
  let stage: Stage = "watched";
  let startAt = 0;
  let stageAt = 0;
  let pointer: Point = { x: W / 2, y: H };
  let dust: Dust[] = [];
  let thrown: Thrown | null = null;
  let patience = patienceFor(Math.random());
  let loitering = 0;
  let grabs = 0;
  let doorIn = 1;
  let openness = 0;
  let blink = 0;
  let shake = 0;

  function moveDoor(): void {
    spot = nextSpot(spot, Math.random());
    door = doorSpot(spot);
    doorIn = 0;
  }

  function startGrab(now: number): void {
    stage = "grabbing";
    stageAt = now;
    loitering = 0;
    grabs += 1;
    shake = 0.6;
    sounds.whoosh(0.5);
    // The sentence is extremely pleased with itself about this.
    gloat();
  }

  function throwDoor(): void {
    const toLeft = door.x > W / 2;
    thrown = {
      x: door.x,
      y: door.y,
      vx: (toLeft ? -1 : 1) * (700 + Math.random() * 300),
      vy: -420,
      spin: (toLeft ? -1 : 1) * 7,
      angle: 0,
    };
    sounds.crash();
    for (let i = 0; i < 18; i += 1) {
      dust.push({
        x: door.x,
        y: door.y + DOOR.h / 2,
        vx: (Math.random() - 0.5) * 260,
        vy: -Math.random() * 200,
        life: 0.4 + Math.random() * 0.5,
      });
    }
  }

  return {
    name: "Door :3",
    exitLine: "There was a door all along. It just needed the word taken off it.",

    reset(at) {
      spot = 0;
      door = doorSpot(spot);
      stage = "watched";
      startAt = at;
      stageAt = at;
      dust = [];
      thrown = null;
      patience = patienceFor(Math.random());
      loitering = 0;
      grabs = 0;
      doorIn = 1;
      openness = 0;
      shake = 0;
      resetNoDoorLine();
      // Taking the word off the page is the only thing that calms it down.
      armNoDoorLine(() => {
        if (stage === "watched" || stage === "grabbing") stage = "safe";
        stageAt = performance.now();
        sounds.chime();
      });
    },

    update(now, dt) {
      dust = updateDust(dust, dt);
      shake = Math.max(0, shake - dt * 2);
      doorIn = Math.min(1, doorIn + dt * 2.2);
      blink = (blink + dt) % 4;

      if (thrown) {
        thrown.vy += 900 * dt;
        thrown.x += thrown.vx * dt;
        thrown.y += thrown.vy * dt;
        thrown.angle += thrown.spin * dt;
        if (thrown.x < -300 || thrown.x > W + 300 || thrown.y > H + 400) thrown = null;
      }

      if (stage === "watched") {
        // Loiter near it long enough and up comes the hand.
        if (doorIn >= 1 && isNear(pointer, door)) {
          loitering += dt;
          if (loitering >= patience) startGrab(now);
        } else {
          loitering = Math.max(0, loitering - dt);
        }
      }

      if (stage === "grabbing") {
        const t = (now - stageAt) / 1000;
        if (t > 0.42 && !thrown && doorIn > 0) {
          throwDoor();
          doorIn = 0;
        }
        if (t > 1.15) {
          stage = "watched";
          patience = patienceFor(Math.random());
          moveDoor();
        }
      }

      if (stage === "opening") {
        openness = clamp((now - stageAt) / 900, 0, 1);
        if (now - stageAt > 1900) {
          stage = "escaped";
          resetNoDoorLine();
          onEscaped();
        }
      }
    },

    draw(now) {
      const secondsIn = (now - startAt) / 1000;

      ctx.save();
      if (stage === "opening") {
        diveInto(door.x, door.y, clamp((now - stageAt) / 1900, 0, 1));
      }
      if (shake > 0) ctx.translate(Math.sin(now / 20) * shake * 6, 0);

      drawRoomBox(PALETTE);
      if (doorIn > 0) drawDoor();
      if (thrown) drawThrownDoor(thrown);
      drawHand(now);
      ctx.restore();

      drawDust(dust, "rgba(200, 190, 210, 0.8)");
      drawVignette();
      drawNote();

      if (stage === "watched" && grabs === 0) {
        drawCaption("A door! Finally! Go on then.", secondsIn);
      }
    },

    pointerDown(p) {
      pointer = p;
      if (stage !== "safe" || !wordIsGone()) {
        if (stage === "safe") return;
        sounds.tap();
        return;
      }
      if (!isNear(p, door, 110)) {
        sounds.tap();
        return;
      }
      stage = "opening";
      stageAt = performance.now();
      sounds.creak();
    },

    pointerMove(p) {
      pointer = p;
    },

    pointerUp() {},

    cursor(p) {
      if (stage === "safe" && isNear(p, door, 110)) return "pointer";
      return "default";
    },
  };

  // ---------- drawing ----------

  function drawDoor(): void {
    const rise = (1 - doorIn) * 40;
    ctx.save();
    ctx.globalAlpha = doorIn;
    ctx.translate(door.x, door.y + rise);
    ctx.rotate(door.lean);

    const half = DOOR.w / 2;
    // The frame stays put; the door itself swings back into the light.
    ctx.fillStyle = "#241d2c";
    roundRect(-half - 8, -DOOR.h / 2 - 8, DOOR.w + 16, DOOR.h + 16, 6);
    ctx.fill();

    if (openness > 0) {
      const glow = ctx.createLinearGradient(0, -DOOR.h / 2, 0, DOOR.h / 2);
      glow.addColorStop(0, "#fff6d8");
      glow.addColorStop(1, "#ffd76a");
      ctx.fillStyle = glow;
      ctx.fillRect(-half, -DOOR.h / 2, DOOR.w, DOOR.h);
    }

    ctx.save();
    // Swinging open is just the door getting narrower from this side.
    ctx.scale(1 - openness * 0.92, 1);
    ctx.fillStyle = "#8a5a3c";
    roundRect(-half, -DOOR.h / 2, DOOR.w, DOOR.h, 4);
    ctx.fill();
    ctx.fillStyle = "#6f472e";
    roundRect(-half + 12, -DOOR.h / 2 + 14, DOOR.w - 24, DOOR.h * 0.36, 3);
    ctx.fill();
    roundRect(-half + 12, 8, DOOR.w - 24, DOOR.h * 0.36, 3);
    ctx.fill();

    ctx.fillStyle = "#e8c24a";
    ctx.beginPath();
    ctx.arc(half - 20, 8, 7, 0, Math.PI * 2);
    ctx.fill();

    // :3
    const winking = blink > 3.7;
    ctx.strokeStyle = "#2a1c12";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const eye of [-24, 24]) {
      ctx.beginPath();
      if (winking) {
        ctx.moveTo(eye - 9, -44);
        ctx.lineTo(eye + 9, -44);
      } else {
        ctx.arc(eye, -44, 9, Math.PI * 0.15, Math.PI * 0.85, true);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(-9, -22, 10, 0, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, -22, 10, Math.PI * 0.1, Math.PI);
    ctx.stroke();

    if (stage === "safe") {
      // Once the sentence can't name it, it relaxes.
      ctx.fillStyle = "rgba(255, 210, 220, 0.45)";
      for (const cheek of [-40, 40]) {
        ctx.beginPath();
        ctx.ellipse(cheek, -22, 11, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.restore();
  }

  function drawThrownDoor(flying: Thrown): void {
    ctx.save();
    ctx.translate(flying.x, flying.y);
    ctx.rotate(flying.angle);
    ctx.fillStyle = "#8a5a3c";
    roundRect(-DOOR.w / 2, -DOOR.h / 2, DOOR.w, DOOR.h, 4);
    ctx.fill();
    ctx.fillStyle = "#6f472e";
    roundRect(-DOOR.w / 2 + 12, -DOOR.h / 2 + 14, DOOR.w - 24, DOOR.h * 0.36, 3);
    ctx.fill();
    // Upside down and flying, the little face looks worse than it is.
    ctx.strokeStyle = "#2a1c12";
    ctx.lineWidth = 4;
    for (const eye of [-24, 24]) {
      ctx.beginPath();
      ctx.moveTo(eye - 8, -50);
      ctx.lineTo(eye + 8, -38);
      ctx.moveTo(eye - 8, -38);
      ctx.lineTo(eye + 8, -50);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -16, 11, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  // An arm out of the words at the bottom of the page, up through the floor.
  function drawHand(now: number): void {
    const reaching = stage === "grabbing";
    const t = reaching ? clamp((now - stageAt) / 1150, 0, 1) : 0;
    const fumbling = stage === "safe" && now - stageAt < 1800;
    if (!reaching && !fumbling) return;

    // Out, grab, and back down. Fumbling is the same arm finding nothing.
    const out = reaching ? Math.sin(Math.min(1, t / 0.75) * Math.PI) : Math.sin(((now - stageAt) / 1800) * Math.PI);
    const target: Point = fumbling ? { x: W / 2 + Math.sin(now / 160) * 130, y: 330 } : door;
    const handX = lerp(HAND_HOME.x, target.x, out);
    const handY = lerp(HAND_HOME.y, target.y + DOOR.h / 2 - 20, out);

    ctx.save();
    ctx.strokeStyle = "#e8c9a8";
    ctx.lineWidth = 34;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(HAND_HOME.x, HAND_HOME.y);
    ctx.quadraticCurveTo(lerp(HAND_HOME.x, handX, 0.4), lerp(HAND_HOME.y, handY, 0.8), handX, handY);
    ctx.stroke();
    ctx.strokeStyle = "#d8b592";
    ctx.lineWidth = 26;
    ctx.stroke();

    // The hand: a fist that opens on the way out and closes on the door.
    const grip = reaching ? clamp((t - 0.35) / 0.2, 0, 1) : 0;
    ctx.fillStyle = "#f0d6b8";
    ctx.beginPath();
    ctx.ellipse(handX, handY, 30 - grip * 6, 34 - grip * 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2c3a2";
    for (let finger = 0; finger < 4; finger += 1) {
      const spread = lerp(-24, 24, finger / 3);
      ctx.beginPath();
      ctx.ellipse(
        handX + spread * (1 - grip * 0.55),
        handY - 26 + grip * 10,
        9,
        lerp(20, 11, grip),
        spread / 80,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNote(): void {
    const text =
      stage === "safe"
        ? wordIsGone()
          ? "It can't say it any more. Open the door."
          : ""
        : grabs === 0
          ? ""
          : grabs === 1
            ? "The sentence means it."
            : grabs < 4
              ? "It will do that every time."
              : "Stop going near the door. Go and read the sentence.";
    if (!text) return;
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(text).width + 44;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(W / 2 - width / 2, H - 78, width, 40, 10);
    ctx.fill();
    ctx.fillStyle = stage === "safe" ? "#7dffb0" : "#ffcf5a";
    ctx.fillText(text, W / 2, H - 58);
  }
}

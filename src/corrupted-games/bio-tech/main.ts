// Bio Tech — a fanmade game for Bionic.
// Full-screen canvas game.
export {};

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

function draw(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#9effa0";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BIO TECH", w / 2, h / 2 - 20);

  ctx.fillStyle = "#5a7a5b";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText("C0m1ng s00n. St1ll c0mp1l1ng...", w / 2, h / 2 + 28);
}

draw();

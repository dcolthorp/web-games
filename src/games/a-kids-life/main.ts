import { GameApp } from "./app/GameApp";

const canvas = document.getElementById("game");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing game canvas");
}

const app = new GameApp(canvas);
app.start();

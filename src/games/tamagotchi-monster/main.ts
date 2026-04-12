import { GameApp } from "./app/GameApp";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing canvas element");
}

const app = new GameApp(canvas);
app.start();

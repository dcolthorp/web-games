const target = document.getElementById("target") as HTMLButtonElement | null;
const start = document.getElementById("start") as HTMLButtonElement | null;
const scoreLabel = document.getElementById("score");
const timeLabel = document.getElementById("time");
const message = document.getElementById("message");

let score = 0;
let timeLeft = 10;
let timer = 0;
let playing = false;

function moveTarget(): void {
  if (!target) return;
  target.style.left = `${8 + Math.random() * 75}%`;
  target.style.top = `${38 + Math.random() * 40}%`;
  target.style.transform = `translate(-50%, -50%) rotate(${-12 + Math.random() * 24}deg)`;
}

function finishGame(): void {
  playing = false;
  window.clearInterval(timer);
  target?.classList.remove("is-playing");
  if (start) start.disabled = false;
  if (message) message.textContent = `${score} clicks! the bell rang!`;
}

start?.addEventListener("click", () => {
  score = 0;
  timeLeft = 10;
  playing = true;
  if (scoreLabel) scoreLabel.textContent = "0";
  if (timeLabel) timeLabel.textContent = "10";
  if (message) message.textContent = "GO GO GO!";
  start.disabled = true;
  target?.classList.add("is-playing");
  moveTarget();

  window.clearInterval(timer);
  timer = window.setInterval(() => {
    timeLeft -= 1;
    if (timeLabel) timeLabel.textContent = String(timeLeft);
    if (timeLeft <= 0) finishGame();
  }, 1000);
});

target?.addEventListener("click", () => {
  if (!playing) return;
  score += 1;
  if (scoreLabel) scoreLabel.textContent = String(score);
  moveTarget();
});

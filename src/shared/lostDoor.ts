export {};

// The way into the lost games: type the word on any page of the site and the
// door opens. Nothing on any hub links to it, which is the point.

const WORD = "lost";
const PAGE = "/lost/index.html";

let typed = "";

window.addEventListener("keydown", (event) => {
  // Not while somebody is filling in a box.
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key.length !== 1) return;

  typed = (typed + event.key.toLowerCase()).slice(-WORD.length);
  if (typed !== WORD) return;
  typed = "";
  openTheDoor();
});

// A moment of static, and then you're through.
function openTheDoor(): void {
  const flash = document.createElement("div");
  flash.setAttribute(
    "style",
    [
      "position: fixed",
      "inset: 0",
      "z-index: 2147483000",
      "pointer-events: none",
      "background: repeating-linear-gradient(0deg, rgba(120,255,190,.25) 0 2px, rgba(0,0,0,.85) 2px 6px)",
      "animation: lost-door 620ms steps(6, end) forwards",
    ].join(";")
  );
  const style = document.createElement("style");
  style.textContent = "@keyframes lost-door { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 1 } }";
  document.head.appendChild(style);
  document.body.appendChild(flash);
  window.setTimeout(() => {
    window.location.href = PAGE;
  }, 560);
}

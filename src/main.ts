interface Game {
  id: string;
  name: string;
  path: string;
}

const games: Game[] = [
  // Add games here as you create them
  // { id: "snake", name: "Snake", path: "./games/snake/" },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Time to build some!</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li>
        <a href="${game.path}">${game.name}</a>
      </li>
    `
    )
    .join("");
}

renderGameList();

// admin.js

const colors = [
    "#FF0000", "#0000FF", "#00FF00", "#FFFF00", "#FF00FF",
    "#00FFFF", "#FFA500", "#800000", "#008000", "#000080",
    "#808000", "#800080", "#008080", "#A52A2A", "#FF1493",
    "#7FFF00", "#FFD700", "#4B0082", "#DC143C", "#00CED1"
];

let apiBase = localStorage.getItem("apiBase") || "";
let currentGameId = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("apiBase").value = apiBase;
    document.getElementById("saveApi").addEventListener("click", saveApiBase);
    document.getElementById("createGame").addEventListener("click", createGame);
    document.getElementById("addTeam").addEventListener("click", addTeam);
    document.getElementById("copyAllLinks").addEventListener("click", copyAllLinks);

    if (apiBase) {
        loadGames();
    }
});

function saveApiBase() {
    apiBase = document.getElementById("apiBase").value.trim();
    localStorage.setItem("apiBase", apiBase);
    loadGames();
}

async function loadGames() {
    if (!apiBase) return;
    const res = await fetch(`${apiBase}/games`);
    if (!res.ok) {
        alert("Virhe haettaessa pelejä");
        return;
    }
    const games = await res.json();
    const gameList = document.getElementById("gameList");
    gameList.innerHTML = "";
    games.forEach(game => {
        const btn = document.createElement("button");
        btn.textContent = game.name;
        btn.addEventListener("click", () => selectGame(game.id));
        gameList.appendChild(btn);
    });
}

async function createGame() {
    const name = prompt("Anna pelin nimi:");
    if (!name) return;
    const res = await fetch(`${apiBase}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    });
    if (!res.ok) {
        alert("Virhe pelin luonnissa");
        return;
    }
    await loadGames();
}

function selectGame(gameId) {
    currentGameId = gameId;
    document.getElementById("selectedGame").textContent = `Peli ID: ${gameId}`;
    renderFieldLinks();
    loadTeams();
}

async function loadTeams() {
    const res = await fetch(`${apiBase}/games/${currentGameId}/teams`);
    if (!res.ok) {
        alert("Virhe ladattaessa joukkueita");
        return;
    }
    const teams = await res.json();
    const teamList = document.getElementById("teamList");
    teamList.innerHTML = "";
    teams.forEach(team => {
        const div = document.createElement("div");
        div.textContent = `${team.name} (${team.color})`;
        div.style.color = team.color;
        teamList.appendChild(div);
    });
}

async function addTeam() {
    if (!currentGameId) return alert("Valitse peli ensin");
    const name = prompt("Joukkueen nimi:");
    if (!name) return;
    const color = prompt("Anna väri HEX-muodossa (tai jätä tyhjäksi):", colors[Math.floor(Math.random() * colors.length)]);
    const res = await fetch(`${apiBase}/games/${currentGameId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color })
    });
    if (!res.ok) {
        alert("Virhe lisättäessä joukkuetta");
        return;
    }
    await loadTeams();
}

function renderFieldLinks() {
    const list = document.getElementById("fieldLinks");
    list.innerHTML = "";
    if (!apiBase || !currentGameId) return;
    for (let i = 0; i < 10; i++) {
        const letter = String.fromCharCode(65 + i); // A, B, C...
        const url = `${window.location.origin}/device/index.html?api=${encodeURIComponent(apiBase)}&gameId=${currentGameId}&flag=${letter}`;
        
        const div = document.createElement("div");
        div.innerHTML = `
            <strong>Lippu ${letter}</strong> 
            <a href="${url}" target="_blank">Avaa</a> 
            <button data-url="${url}">Kopioi</button>
        `;
        list.appendChild(div);
    }
    list.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            navigator.clipboard.writeText(btn.dataset.url);
            alert("Linkki kopioitu");
        });
    });
}

function copyAllLinks() {
    if (!apiBase || !currentGameId) return;
    let all = "";
    for (let i = 0; i < 10; i++) {
        const letter = String.fromCharCode(65 + i);
        all += `${window.location.origin}/device/index.html?api=${encodeURIComponent(apiBase)}&gameId=${currentGameId}&flag=${letter}\n`;
    }
    navigator.clipboard.writeText(all);
    alert("Kaikki linkit kopioitu");
}

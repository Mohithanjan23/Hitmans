"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// --- Configuration ---
const SERVER_URL = 'ws://localhost:8080';
// --- Constants ---
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const MAP_WIDTH = 1600;
const MAP_HEIGHT = 900;
const VIEWPORT_WIDTH = CANVAS_WIDTH;
const VIEWPORT_HEIGHT = CANVAS_HEIGHT;
const PLAYER_RADIUS = 20;
const INTERPOLATION_DELAY = 100; // ms
let camera = { x: 0, y: 0 };
let obstacles = [];
// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const allViews = {
    mainMenu: document.getElementById('main-menu'),
    lobbyView: document.getElementById('lobby-view'),
    settingsView: document.getElementById('settings-view'),
    shopView: document.getElementById('shop-view'),
    gameContainer: document.getElementById('gameContainer'),
};
// UI Elements
const deathScreen = document.getElementById('death-screen');
const classSelectScreen = document.getElementById('class-select-screen');
const joinModalOverlay = document.getElementById('join-modal-overlay');
const usernameInput = document.getElementById('username');
const playButton = document.getElementById('playButton');
// Lobby UI
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
const modalOkayBtn = document.getElementById('modalOkayBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalLobbyIdInput = document.getElementById('modalLobbyIdInput');
const lobbyIdText = document.getElementById('lobby-id-text');
const lobbyCodeDisplay = document.getElementById('lobby-code-display');
// HUD UI
const respawnBtn = document.getElementById('respawnBtn');
const changeClassBtn = document.getElementById('changeClassBtn');
const killerNameText = document.getElementById('killer-name-text');
const hudHealthText = document.getElementById('hud-health-text');
const hudHealthBar = document.getElementById('hud-health-bar');
const ammoDisplay = document.getElementById('ammo-display');
const weaponDisplay = document.getElementById('weapon-display');
const killFeed = document.getElementById('kill-feed');
const hitmarker = document.getElementById('hitmarker');
// Characters
const characterContainer = document.getElementById('character-svg-container');
const prevCharBtn = document.getElementById('prev-char-btn');
const nextCharBtn = document.getElementById('next-char-btn');
// Auth
const authStatus = document.getElementById('auth-status');
const authUsername = document.getElementById('auth-username');
const authLoginBtn = document.getElementById('auth-login-btn');
const authRegisterBtn = document.getElementById('auth-register-btn');
const authLogoutBtn = document.getElementById('auth-logout-btn');
const authModalOverlay = document.getElementById('auth-modal-overlay');
const authModalTitle = document.getElementById('auth-modal-title');
const authUsernameInput = document.getElementById('auth-username-input');
const authPasswordInput = document.getElementById('auth-password-input');
const authCancelBtn = document.getElementById('auth-cancel-btn');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const classCards = document.querySelectorAll('.class-card');
// --- Game State ---
let ws;
let myPlayerId = null;
let isAuthenticated = false;
let authMode = 'login';
let clientState = { players: {}, bullets: {}, obstacles: [], matchEndTime: 0 };
const serverStateBuffer = [];
const pendingInputs = [];
const inputs = { up: false, down: false, left: false, right: false, shoot: false, angle: 0, seq: 0, dash: false, slide: false, reload: false };
let mousePos = { x: 0, y: 0 };
let inputSequence = 0;
let animationFrameId;
// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    showView('mainMenu');
});
function showView(viewToShow) {
    Object.values(allViews).forEach(view => view.classList.add('hidden'));
    if (allViews[viewToShow])
        allViews[viewToShow].classList.remove('hidden');
}
// --- Interaction Logic ---
playButton.addEventListener('click', () => {
    if (usernameInput.value.trim()) {
        showView('lobbyView');
    }
    else {
        usernameInput.style.border = '1px solid var(--danger-color)';
    }
});
createLobbyBtn.addEventListener('click', () => connectAndSend({ type: 'create_lobby', payload: { username: usernameInput.value.trim() } }));
joinLobbyBtn.addEventListener('click', () => joinModalOverlay.classList.remove('hidden'));
modalCancelBtn.addEventListener('click', () => joinModalOverlay.classList.add('hidden'));
modalOkayBtn.addEventListener('click', () => {
    const lobbyId = modalLobbyIdInput.value.trim().toUpperCase();
    if (lobbyId) {
        connectAndSend({ type: 'join_lobby', payload: { username: usernameInput.value.trim(), lobbyId } });
        joinModalOverlay.classList.add('hidden');
    }
});
leaveLobbyBtn.addEventListener('click', () => {
    if (ws)
        ws.close();
    resetLobbyView();
});
respawnBtn.addEventListener('click', () => sendRespawnRequest());
changeClassBtn.addEventListener('click', () => {
    deathScreen.classList.add('hidden');
    classSelectScreen.classList.remove('hidden');
});
classCards.forEach(card => {
    card.addEventListener('click', () => {
        const weapon = card.getAttribute('data-weapon');
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'select_weapon', payload: { weapon } }));
        }
        classSelectScreen.classList.add('hidden');
        const myPlayer = clientState.players[myPlayerId];
        if (myPlayer && myPlayer.isDead)
            sendRespawnRequest();
    });
});
function sendRespawnRequest() {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'respawn' }));
    }
}
function resetLobbyView() {
    showView('lobbyView');
    lobbyCodeDisplay.classList.add('hidden');
    createLobbyBtn.classList.remove('hidden');
    joinLobbyBtn.classList.remove('hidden');
    leaveLobbyBtn.classList.add('hidden');
    const teamLists = document.querySelectorAll('.player-list'); // Clear lists if any
    teamLists.forEach(l => l.innerHTML = '');
}
// --- Auth ---
authLoginBtn.addEventListener('click', () => openAuthModal('login'));
authRegisterBtn.addEventListener('click', () => openAuthModal('register'));
authCancelBtn.addEventListener('click', () => authModalOverlay.classList.add('hidden'));
authLogoutBtn.addEventListener('click', () => {
    isAuthenticated = false;
    authUsername.classList.add('hidden');
    authLoginBtn.classList.remove('hidden');
    authRegisterBtn.classList.remove('hidden');
    authLogoutBtn.classList.add('hidden');
    usernameInput.value = '';
    usernameInput.disabled = false;
    if (ws)
        ws.close();
});
authSubmitBtn.addEventListener('click', () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (username && password) {
        connectAndSend({ type: authMode, payload: { username, password } });
    }
});
function openAuthModal(mode) {
    authMode = mode;
    authModalTitle.textContent = mode.toUpperCase();
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    authModalOverlay.classList.remove('hidden');
}
// --- Networking ---
function connectAndSend(initialMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(initialMessage));
        return;
    }
    ws = new WebSocket(SERVER_URL);
    ws.onopen = () => ws.send(JSON.stringify(initialMessage));
    ws.onmessage = handleServerMessage;
    ws.onclose = () => {
        stopGame();
        showView('mainMenu');
        resetLobbyView();
    };
    ws.onerror = (e) => console.error("WS Error", e);
}
function handleServerMessage(event) {
    const message = JSON.parse(event.data);
    switch (message.type) {
        case 'lobby_joined':
            handleLobbyJoined(message.payload);
            break;
        case 'snapshot':
            handleSnapshot(message.payload);
            break;
        case 'player_death':
            handlePlayerDeath(message.payload);
            break;
        case 'respawn':
            handleRespawn();
            break;
        case 'auth_success':
            handleAuthSuccess(message.payload);
            break;
        case 'bullet_hit':
            showHitmarker();
            break;
        case 'error':
            alert(message.payload.message);
            break;
    }
}
function handleAuthSuccess(payload) {
    isAuthenticated = true;
    authUsername.textContent = payload.username;
    authUsername.classList.remove('hidden');
    authLoginBtn.classList.add('hidden');
    authRegisterBtn.classList.add('hidden');
    authLogoutBtn.classList.remove('hidden');
    usernameInput.value = payload.username;
    usernameInput.disabled = true;
    authModalOverlay.classList.add('hidden');
}
function handleLobbyJoined(payload) {
    myPlayerId = payload.playerId;
    clientState = payload.initialState;
    lobbyIdText.textContent = payload.lobbyId;
    lobbyCodeDisplay.classList.remove('hidden');
    createLobbyBtn.classList.add('hidden');
    joinLobbyBtn.classList.add('hidden');
    leaveLobbyBtn.classList.remove('hidden');
    showView('gameContainer');
    classSelectScreen.classList.remove('hidden'); // Show class select first
    startGame();
}
function handleSnapshot(payload) {
    serverStateBuffer.push({ time: Date.now(), state: payload.state });
    if (serverStateBuffer.length > 10)
        serverStateBuffer.shift();
    if (payload.state.obstacles && obstacles.length === 0) {
        obstacles = payload.state.obstacles;
    }
    if (myPlayerId && payload.state.players[myPlayerId]) {
        const myServerState = payload.state.players[myPlayerId];
        if (clientState.players[myPlayerId]) {
            const clientPlayer = clientState.players[myPlayerId];
            // Reconciliation (Standard)
            clientPlayer.x = myServerState.x;
            clientPlayer.y = myServerState.y;
            clientPlayer.ammo = myServerState.ammo;
            clientPlayer.maxAmmo = myServerState.maxAmmo;
            clientPlayer.isReloading = myServerState.isReloading;
            clientPlayer.canDash = myServerState.canDash;
            clientPlayer.isSliding = myServerState.isSliding;
            let j = 0;
            if (payload.lastProcessedInput !== undefined) {
                while (j < pendingInputs.length) {
                    if (pendingInputs[j].seq <= payload.lastProcessedInput) {
                        pendingInputs.splice(j, 1);
                    }
                    else {
                        applyInput(clientPlayer, pendingInputs[j]);
                        j++;
                    }
                }
            }
        }
    }
}
function handlePlayerDeath(payload) {
    addKillFeedItem(payload.killerName, payload.killedName);
    const player = clientState.players[payload.id];
    if (player)
        player.isDead = true;
    if (payload.id === myPlayerId) {
        killerNameText.textContent = payload.killerName;
        deathScreen.classList.remove('hidden');
        respawnBtn.disabled = true;
        setTimeout(() => { respawnBtn.disabled = false; }, 3000);
    }
}
function handleRespawn() {
    deathScreen.classList.add('hidden');
    const myPlayer = clientState.players[myPlayerId];
    if (myPlayer)
        myPlayer.isDead = false;
}
function addKillFeedItem(killer, killed) {
    const item = document.createElement('div');
    item.classList.add('kill-msg');
    item.innerHTML = `<span style="color: var(--primary-color)">${killer}</span> <span style="font-size: 0.8em; color: #888;">eliminated</span> <span style="color: var(--danger-color)">${killed}</span>`;
    killFeed.prepend(item); // Newest on top
    setTimeout(() => item.remove(), 4000);
}
function showHitmarker() {
    hitmarker.style.opacity = '1';
    hitmarker.classList.remove('hit-anim');
    void hitmarker.offsetWidth; // trigger reflow
    hitmarker.classList.add('hit-anim');
}
// --- Game Logic ---
function startGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.addEventListener('keydown', e => updateInput(e.key, true));
    document.addEventListener('keyup', e => updateInput(e.key, false));
    canvas.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
    canvas.addEventListener('mousedown', () => inputs.shoot = true);
    canvas.addEventListener('mouseup', () => inputs.shoot = false);
    animationFrameId = requestAnimationFrame(gameLoop);
}
function stopGame() {
    if (animationFrameId)
        cancelAnimationFrame(animationFrameId);
}
function gameLoop() {
    processInputs();
    updateClientState();
    render();
    animationFrameId = requestAnimationFrame(gameLoop);
}
const keys = {};
function updateInput(key, isPressed) {
    switch (key.toLowerCase()) {
        case 'w':
            inputs.up = isPressed;
            break;
        case 'a':
            inputs.left = isPressed;
            break;
        case 's':
            inputs.down = isPressed;
            break;
        case 'd':
            inputs.right = isPressed;
            break;
        case 'shift':
            inputs.slide = isPressed;
            break; // Slide maps to Shift
        case ' ':
            inputs.dash = isPressed;
            break; // Dash maps to Space
        case 'r':
            inputs.reload = isPressed;
            break;
    }
}
function processInputs() {
    const myPlayer = clientState.players[myPlayerId];
    if (!myPlayer || myPlayer.isDead)
        return;
    inputs.angle = Math.atan2(mousePos.y - (myPlayer.y - camera.y), mousePos.x - (myPlayer.x - camera.x));
    inputs.seq = ++inputSequence;
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', payload: inputs }));
    }
    pendingInputs.push({ ...inputs });
    applyInput(myPlayer, inputs);
}
function updateClientState() {
    const renderTime = Date.now() - INTERPOLATION_DELAY;
    if (serverStateBuffer.length < 2)
        return;
    let fromIndex = -1;
    for (let i = serverStateBuffer.length - 1; i >= 0; i--) {
        if (serverStateBuffer[i].time <= renderTime) {
            fromIndex = i;
            break;
        }
    }
    if (fromIndex === -1 || !serverStateBuffer[fromIndex + 1])
        return;
    const from = serverStateBuffer[fromIndex];
    const to = serverStateBuffer[fromIndex + 1];
    const t = (renderTime - from.time) / (to.time - from.time);
    clientState.bullets = to.state.bullets;
    for (const id in to.state.players) {
        if (!clientState.players[id])
            clientState.players[id] = { ...to.state.players[id] };
        const clientPlayer = clientState.players[id];
        const toPlayer = to.state.players[id];
        const fromPlayer = from.state.players[id];
        clientPlayer.isDead = toPlayer.isDead;
        clientPlayer.health = toPlayer.health;
        clientPlayer.weapon = toPlayer.weapon;
        clientPlayer.ammo = toPlayer.ammo;
        clientPlayer.maxAmmo = toPlayer.maxAmmo;
        clientPlayer.isReloading = toPlayer.isReloading;
        clientPlayer.canDash = toPlayer.canDash;
        clientPlayer.isSliding = toPlayer.isSliding; // Interpolate this? Probably not needed for boolean
        if (id !== myPlayerId && fromPlayer) {
            clientPlayer.x = fromPlayer.x + (toPlayer.x - fromPlayer.x) * t;
            clientPlayer.y = fromPlayer.y + (toPlayer.y - fromPlayer.y) * t;
            clientPlayer.angle = toPlayer.angle;
        }
    }
    // Cleanup
    for (const id in clientState.players) {
        if (!to.state.players[id])
            delete clientState.players[id];
    }
}
function applyInput(player, input) {
    const BASE_SPEED = 250 / 60;
    let speed = BASE_SPEED;
    // Sliding Logic (Simple Client Prediction)
    if (input.slide) {
        speed *= 1.5; // 50% Speed boost while sliding
    }
    let dx = 0, dy = 0;
    if (input.up)
        dy -= 1;
    if (input.down)
        dy += 1;
    if (input.left)
        dx -= 1;
    if (input.right)
        dx += 1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
        player.x += (dx / len) * speed;
        player.y += (dy / len) * speed;
    }
    // Boundary checks
    player.x = Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, player.y));
}
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw Background Grid
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const myPlayer = clientState.players[myPlayerId];
    if (myPlayer) {
        camera.x = myPlayer.x - VIEWPORT_WIDTH / 2;
        camera.y = myPlayer.y - VIEWPORT_HEIGHT / 2;
        camera.x = Math.max(0, Math.min(MAP_WIDTH - VIEWPORT_WIDTH, camera.x));
        camera.y = Math.max(0, Math.min(MAP_HEIGHT - VIEWPORT_HEIGHT, camera.y));
        // Update HUD HTML
        hudHealthText.textContent = Math.max(0, Math.round(myPlayer.health)).toString();
        hudHealthBar.style.width = `${Math.max(0, myPlayer.health)}%`;
        if (myPlayer.health < 30)
            hudHealthBar.style.backgroundColor = 'var(--danger-color)';
        else
            hudHealthBar.style.backgroundColor = 'var(--success-color)';
        if (myPlayer.isReloading) {
            ammoDisplay.textContent = "RLD...";
            ammoDisplay.style.color = "yellow";
        }
        else {
            ammoDisplay.textContent = `${myPlayer.ammo}/${myPlayer.maxAmmo}`;
            ammoDisplay.style.color = myPlayer.ammo === 0 ? "var(--danger-color)" : "var(--primary-color)";
        }
        weaponDisplay.textContent = myPlayer.weapon.toUpperCase();
    }
    // Grid Lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.1)"; // Cyan faint grid
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offsetX = -camera.x % gridSize;
    const offsetY = -camera.y % gridSize;
    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    // Map Borders
    ctx.strokeStyle = 'var(--primary-color)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-camera.x, -camera.y, MAP_WIDTH, MAP_HEIGHT);
    // Obstacles
    for (const obs of obstacles) {
        if (obs.type === 'box') {
            ctx.fillStyle = '#1e1e2e';
            ctx.strokeStyle = '#7000ff'; // Neon Purple border
        }
        else {
            ctx.fillStyle = '#111';
            ctx.strokeStyle = '#444';
        }
        ctx.lineWidth = 2;
        ctx.fillRect(obs.x - camera.x, obs.y - camera.y, obs.width, obs.height);
        ctx.strokeRect(obs.x - camera.x, obs.y - camera.y, obs.width, obs.height);
    }
    // Players
    for (const player of Object.values(clientState.players)) {
        if (player.isDead)
            continue;
        const isMe = player.id === myPlayerId;
        const color = isMe ? 'var(--primary-color)' : 'var(--danger-color)';
        // Draw Player Body
        ctx.fillStyle = isMe ? '#00f0ff' : '#ff0055';
        ctx.shadowBlur = 10;
        ctx.shadowColor = isMe ? '#00f0ff' : '#ff0055';
        ctx.beginPath();
        ctx.arc(player.x - camera.x, player.y - camera.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        // Direction Indicator
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(player.x - camera.x, player.y - camera.y);
        ctx.lineTo(player.x - camera.x + Math.cos(player.angle) * (PLAYER_RADIUS + 10), player.y - camera.y + Math.sin(player.angle) * (PLAYER_RADIUS + 10));
        ctx.stroke();
        // Overhead Name
        if (!isMe) {
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = '12px Orbitron';
            ctx.fillText(player.username, player.x - camera.x, player.y - camera.y - PLAYER_RADIUS - 10);
            // Overhead HP Bar
            const hpW = 40, hpH = 4;
            ctx.fillStyle = '#333';
            ctx.fillRect(player.x - camera.x - hpW / 2, player.y - camera.y - PLAYER_RADIUS - 25, hpW, hpH);
            ctx.fillStyle = player.health > 50 ? '#00ff99' : '#ff0055';
            ctx.fillRect(player.x - camera.x - hpW / 2, player.y - camera.y - PLAYER_RADIUS - 25, hpW * (player.health / 100), hpH);
        }
    }
    // Bullets (Tracers)
    for (const bullet of Object.values(clientState.bullets)) {
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffff00';
        ctx.beginPath();
        ctx.arc(bullet.x - camera.x, bullet.y - camera.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

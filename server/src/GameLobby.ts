import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GameState, ClientInput, PlayerState, BulletState, ServerMessage, WeaponType, Obstacle } from './types';
import { saveMatch, MatchStats } from './models/Match';
import { pool } from './db';
import { MAPS, MapData } from './maps';

// Constants
const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;
const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 900;
const PLAYER_RADIUS = 20;
const BULLET_RADIUS = 5;
const RESPAWN_TIME = 3000;



interface WeaponConfig {
    fireRate: number; // ms
    damage: number;
    speed: number;
    maxAmmo: number;
    reloadTime: number; // ms
    spread: number; // radians
}

const WEAPONS: Record<WeaponType, WeaponConfig> = {
    pistol: { fireRate: 400, damage: 20, speed: 700 / TICK_RATE, maxAmmo: 12, reloadTime: 1500, spread: 0.05 },
    rifle: { fireRate: 150, damage: 12, speed: 900 / TICK_RATE, maxAmmo: 30, reloadTime: 2000, spread: 0.1 },
    shotgun: { fireRate: 1000, damage: 10, speed: 600 / TICK_RATE, maxAmmo: 6, reloadTime: 2500, spread: 0.3 } // Damage per pellet
};


interface CustomWebSocket extends WebSocket {
    playerId: string;
    userId?: string;
}

export class GameLobby {
    public readonly id: string;
    private state: GameState = { players: {}, bullets: {}, obstacles: [], matchEndTime: 0 };
    private clients: Map<string, CustomWebSocket> = new Map();
    private inputs: Map<string, ClientInput> = new Map();
    private gameLoop: NodeJS.Timeout | null = null;
    private serverTick = 0;
    private playerFireCooldowns: Map<string, number> = new Map();
    private deadPlayers: Map<string, { timer: NodeJS.Timeout, killer: PlayerState | null }> = new Map();
    public matchId: string;
    private matchStartedAt: Date;
    private playerStats: Map<string, { kills: number, deaths: number, score: number, joinTime: Date, userId?: string }> = new Map();

    // Map & Voting
    private currentMap: MapData;
    private isVoting: boolean = false;
    private playerVotes: Map<string, string> = new Map();

    constructor(id: string) {
        this.id = id;
        this.matchId = uuidv4();
        this.matchStartedAt = new Date();
        this.currentMap = MAPS[0]; // Default
        this.state.obstacles = this.currentMap.obstacles;
        // Create match entry in DB
        this.initMatch();
    }

    private async initMatch() {
        try {
            await pool.query(
                'INSERT INTO matches (id, map_id, started_at, ended_at, metadata) VALUES ($1, $2, $3, $4, $5)',
                [this.matchId, this.currentMap.id, this.matchStartedAt, this.matchStartedAt, JSON.stringify({ lobbyId: this.id })]
            );
        } catch (e) {
            console.error('Failed to init match in DB:', e);
        }
    }

    start() {
        if (this.gameLoop) return;
        this.state.matchEndTime = Date.now() + 5 * 60 * 1000; // 5 Minutes
        this.gameLoop = setInterval(() => this.tick(), TICK_MS);
    }

    stop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    addPlayer(ws: CustomWebSocket, username: string) {
        const playerId = ws.playerId;
        this.clients.set(playerId, ws);
        this.inputs.set(playerId, {
            up: false, down: false, left: false, right: false,
            shoot: false, dash: false, slide: false, reload: false,
            angle: 0, seq: 0
        });

        this.state.players[playerId] = this.createPlayerState(playerId, username);
        this.playerStats.set(playerId, { kills: 0, deaths: 0, score: 0, joinTime: new Date(), userId: ws.userId });

        console.log(`[Lobby ${this.id}] Player ${username} (${playerId}) joined.`);

        const welcomeMessage: ServerMessage = {
            type: 'lobby_joined',
            payload: {
                playerId,
                lobbyId: this.id,
                initialState: this.state
            }
        };
        ws.send(JSON.stringify(welcomeMessage));
    }

    removePlayer(playerId: string) {
        // Save stats
        const stats = this.playerStats.get(playerId);
        if (stats) {
            this.savePlayerStats(playerId, stats);
            this.playerStats.delete(playerId);
        }

        this.clients.delete(playerId);
        this.inputs.delete(playerId);
        delete this.state.players[playerId];
        console.log(`[Lobby ${this.id}] Player ${playerId} left.`);

        if (this.clients.size === 0) {
            this.endMatch();
        }
    }

    private async savePlayerStats(playerId: string, stats: any) {
        try {
            await pool.query(
                'INSERT INTO match_players (match_id, user_id, kills, deaths, score) VALUES ($1, $2, $3, $4, $5)',
                [this.matchId, stats.userId || null, stats.kills, stats.deaths, stats.score]
            );
            // Update leaderboard if registered
            if (stats.userId) {
                await pool.query(
                    `INSERT INTO leaderboard (user_id, wins, games_played) 
                     VALUES ($1, $2, 1) 
                     ON CONFLICT (user_id) 
                     DO UPDATE SET games_played = leaderboard.games_played + 1, wins = leaderboard.wins + $2`,
                    [stats.userId, stats.score > 100 ? 1 : 0] // Dummy win condition
                );
            }
        } catch (e) {
            console.error(`Failed to save stats for player ${playerId}:`, e);
        }
    }

    private async endMatch() {
        try {
            await pool.query('UPDATE matches SET ended_at = NOW() WHERE id = $1', [this.matchId]);
        } catch (e) {
            console.error('Failed to close match:', e);
        }
    }

    setPlayerWeapon(playerId: string, weapon: WeaponType) {
        const player = this.state.players[playerId];
        if (player) {
            player.weapon = weapon;
        }
    }

    handleVote(playerId: string, mapId: string) {
        if (!this.isVoting || !this.state.voting) return;

        // Validate mapId
        if (!this.state.voting.options.includes(mapId)) return;

        const previousVote = this.playerVotes.get(playerId);
        if (previousVote) {
            this.state.voting.votes[previousVote] = Math.max(0, (this.state.voting.votes[previousVote] || 1) - 1);
        }

        this.playerVotes.set(playerId, mapId);
        this.state.voting.votes[mapId] = (this.state.voting.votes[mapId] || 0) + 1;

        this.broadcast(JSON.stringify({ type: 'vote_update', payload: { votes: this.state.voting.votes } }));
    }

    getPlayerCount(): number {
        return this.clients.size;
    }

    handleInput(playerId: string, input: ClientInput) {
        this.inputs.set(playerId, input);
    }

    handleRespawn(playerId: string) {
        const deadPlayer = this.deadPlayers.get(playerId);
        if (deadPlayer) {
            clearTimeout(deadPlayer.timer);
            this.respawnPlayer(playerId);
        }
    }

    private respawnPlayer(playerId: string, force: boolean = false) {
        const player = this.state.players[playerId];
        if (player) {
            player.health = 100;
            player.isDead = false; // Revive

            const spawn = this.currentMap.spawnPoints[Math.floor(Math.random() * this.currentMap.spawnPoints.length)];
            player.x = spawn.x + (Math.random() - 0.5) * 50;
            player.y = spawn.y + (Math.random() - 0.5) * 50;

            this.deadPlayers.delete(playerId);

            const client = this.clients.get(playerId);
            if (client) {
                client.send(JSON.stringify({ type: 'respawn' }));
            }
        }
    }

    private createPlayerState(id: string, username: string): PlayerState {
        const weapon = 'pistol';
        const spawn = this.currentMap.spawnPoints[Math.floor(Math.random() * this.currentMap.spawnPoints.length)];
        return {
            id,
            x: spawn.x,
            y: spawn.y,
            angle: 0,
            health: 100,
            username,
            kills: 0,
            deaths: 0,
            isDead: false,
            weapon: weapon,
            ammo: WEAPONS[weapon].maxAmmo,
            maxAmmo: WEAPONS[weapon].maxAmmo,
            isReloading: false,
            canDash: true,
            isSliding: false
        };
    }

    private startVoting() {
        this.isVoting = true;
        this.playerVotes.clear();

        // Select 3 random maps
        const options = [...MAPS].sort(() => 0.5 - Math.random()).slice(0, 3).map(m => m.id);

        const votes: { [id: string]: number } = {};
        options.forEach(id => votes[id] = 0);

        this.state.voting = {
            options,
            votes,
            endTime: Date.now() + 20000 // 20 seconds
        };
    }

    private endVoting() {
        this.isVoting = false;

        if (this.state.voting) {
            // Tally votes
            let winnerId = this.state.voting.options[0];
            let maxVotes = -1;

            for (const [mapId, count] of Object.entries(this.state.voting.votes)) {
                if (count > maxVotes) {
                    maxVotes = count;
                    winnerId = mapId;
                }
            }

            // Set new map
            const newMap = MAPS.find(m => m.id === winnerId);
            if (newMap) {
                this.currentMap = newMap;
                this.state.obstacles = this.currentMap.obstacles;
            }

            this.state.voting = undefined;
        }

        this.startNewMatch();
    }


    private tick() {
        this.serverTick++;

        if (this.isVoting) {
            if (this.state.voting && Date.now() > this.state.voting.endTime) {
                this.endVoting();
            }
            // During voting, we still broadcast state so clients see the voting screen/updates
            this.broadcastState();
            return;
        }

        if (Date.now() > this.state.matchEndTime) {
            this.rotateMatch();
            return;
        }

        this.processInputs();
        this.updateWorld();
        this.broadcastState();
    }

    private rotateMatch() {
        this.endMatch(); // Save current stats
        this.startVoting();
    }

    private startNewMatch() {
        this.matchId = uuidv4();
        this.matchStartedAt = new Date();
        this.state.matchEndTime = Date.now() + 5 * 60 * 1000;

        // Reset player stats
        for (const [id, player] of Object.entries(this.state.players)) {
            player.kills = 0;
            player.deaths = 0;
            player.health = 100;
            this.respawnPlayer(id, true);

            this.playerStats.set(id, { kills: 0, deaths: 0, score: 0, joinTime: new Date(), userId: this.clients.get(id)?.userId });
        }

        this.state.bullets = {};
        this.deadPlayers.clear();

        this.initMatch();
        this.broadcast(JSON.stringify({ type: 'error', payload: { message: 'Match Started!' } }));
    }

    private processInputs() {
        for (const [playerId, player] of Object.entries(this.state.players)) {
            if (this.deadPlayers.has(playerId)) continue;

            const input = this.inputs.get(playerId);
            if (!input) continue;

            let dx = 0;
            let dy = 0;
            if (input.up) dy -= 1;
            if (input.down) dy += 1;
            if (input.left) dx -= 1;
            if (input.right) dx += 1;

            const len = Math.sqrt(dx * dx + dy * dy);

            const now = Date.now();
            const config = WEAPONS[player.weapon];

            // Dash Logic
            if (input.dash && player.canDash) {
                // Determine dash direction
                const dashSpeed = 20; // boost
                if (len > 0) {
                    player.x += (dx / len) * dashSpeed;
                    player.y += (dy / len) * dashSpeed;
                    player.canDash = false;
                    setTimeout(() => { if (this.state.players[playerId]) this.state.players[playerId].canDash = true; }, 3000); // 3s cooldown
                }
            } else if (len > 0) {
                // Normal Movement & Sliding
                const BASE_SPEED = 250 / TICK_RATE;
                let finalSpeed = BASE_SPEED;

                if (input.slide) {
                    finalSpeed *= 1.5;
                    player.isSliding = true;
                } else {
                    player.isSliding = false;
                }

                // Check collision with obstacles
                const nextX = player.x + (dx / len) * finalSpeed;
                const nextY = player.y + (dy / len) * finalSpeed;

                if (!this.checkWallCollision(nextX, nextY, PLAYER_RADIUS)) {
                    player.x = nextX;
                    player.y = nextY;
                }
            } else {
                player.isSliding = false;
            }

            // Map Bounds
            player.angle = input.angle;
            player.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, player.x));
            player.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, player.y));

            // Reload Logic
            if (input.reload && !player.isReloading && player.ammo < player.maxAmmo) {
                player.isReloading = true;
                setTimeout(() => {
                    if (this.state.players[playerId]) {
                        player.ammo = player.maxAmmo;
                        player.isReloading = false;
                    }
                }, config.reloadTime);
            }

            // Shooting Logic
            const cooldown = this.playerFireCooldowns.get(playerId) || 0;
            if (input.shoot && now > cooldown && !player.isReloading) {
                if (player.ammo > 0) {
                    player.ammo--;
                    if (player.weapon === 'shotgun') {
                        for (let i = 0; i < 5; i++) this.spawnBullet(player, config);
                    } else {
                        this.spawnBullet(player, config);
                    }
                    this.playerFireCooldowns.set(playerId, now + config.fireRate);
                } else {
                    // Auto reload if out of ammo?
                    if (!player.isReloading) {
                        player.isReloading = true;
                        setTimeout(() => {
                            if (this.state.players[playerId]) {
                                player.ammo = player.maxAmmo;
                                player.isReloading = false;
                            }
                        }, config.reloadTime);
                    }
                }
            }
        }
    }

    private checkWallCollision(x: number, y: number, radius: number): boolean {
        for (const obs of this.state.obstacles) {
            // Simple Circle vs Rect
            // Find closest point on rect to circle center
            const clampX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
            const clampY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
            const distX = x - clampX;
            const distY = y - clampY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < radius) return true;
        }
        return false;
    }

    private spawnBullet(owner: PlayerState, config: WeaponConfig) {
        const id = uuidv4();
        const angle = owner.angle + (Math.random() - 0.5) * config.spread;
        const bullet: BulletState = {
            id,
            ownerId: owner.id,
            weapon: owner.weapon,
            x: owner.x + Math.cos(owner.angle) * (PLAYER_RADIUS + 5),
            y: owner.y + Math.sin(owner.angle) * (PLAYER_RADIUS + 5),
            vx: Math.cos(angle) * config.speed,
            vy: Math.sin(angle) * config.speed,
        };
        this.state.bullets[id] = bullet;
    }

    private updateWorld() {
        for (const id in this.state.bullets) {
            const bullet = this.state.bullets[id];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;

            if (bullet.x < 0 || bullet.x > ARENA_WIDTH || bullet.y < 0 || bullet.y > ARENA_HEIGHT) {
                delete this.state.bullets[id];
                continue;
            }

            // Check wall collision
            if (this.checkWallCollision(bullet.x, bullet.y, BULLET_RADIUS)) {
                delete this.state.bullets[id];
                continue;
            }

            for (const playerId in this.state.players) {
                if (playerId === bullet.ownerId || this.deadPlayers.has(playerId)) continue;

                const player = this.state.players[playerId];
                const dist = Math.sqrt((bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2);

                if (dist < PLAYER_RADIUS + BULLET_RADIUS) {
                    const damage = WEAPONS[bullet.weapon].damage;
                    player.health -= damage;
                    delete this.state.bullets[id];

                    // Send Hitmarker to shooter
                    const shooterInfo = this.clients.get(bullet.ownerId);
                    if (shooterInfo) {
                        shooterInfo.send(JSON.stringify({
                            type: 'bullet_hit',
                            payload: { x: player.x, y: player.y, type: 'player' }
                        }));
                    }

                    if (player.health <= 0) {
                        this.handlePlayerDeath(playerId, bullet.ownerId);
                    }
                    break;
                }
            }
        }
    }

    private handlePlayerDeath(playerId: string, killerId: string) {
        const killedPlayer = this.state.players[playerId];
        const killer = this.state.players[killerId];

        if (killedPlayer && !this.deadPlayers.has(playerId)) {
            killedPlayer.deaths++;
            if (killer) {
                killer.kills++;
                killer.kills += 1;
                // Update internal stats
                const kStats = this.playerStats.get(killerId);
                if (kStats) { kStats.kills++; kStats.score += 100; }
            }

            const dStats = this.playerStats.get(playerId);
            if (dStats) { dStats.deaths++; }

            this.deadPlayers.set(playerId, {
                timer: setTimeout(() => this.respawnPlayer(playerId), RESPAWN_TIME),
                killer: killer || null
            });
            // Update state
            killedPlayer.isDead = true;

            const message: ServerMessage = {
                type: 'player_death',
                payload: {
                    id: playerId,
                    killerId: killerId,
                    killerName: killer?.username || 'World',
                    killedName: killedPlayer.username
                }
            };
            this.broadcast(JSON.stringify(message));
        }
    }

    private broadcastState() {
        const snapshot = JSON.stringify({
            type: 'snapshot',
            payload: {
                state: this.state,
                serverTick: this.serverTick,
            }
        });
        for (const ws of this.clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(snapshot);
            }
        }
    }

    private broadcast(message: string) {
        for (const ws of this.clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }
}

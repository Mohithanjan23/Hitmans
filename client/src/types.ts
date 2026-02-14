// This file is shared between client and server.

// --- Game State Interfaces ---

export type WeaponType = 'pistol' | 'rifle' | 'shotgun';

export interface PlayerState {
    id: string;
    x: number;
    y: number;
    angle: number;
    health: number;
    username: string;
    kills: number;
    deaths: number;
    isDead: boolean;
    weapon: WeaponType;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    canDash: boolean;
    isSliding: boolean;
}

export interface BulletState {
    id: string;
    ownerId: string;
    weapon: WeaponType;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export interface Obstacle {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'wall' | 'box';
}

export interface GameState {
    players: { [id: string]: PlayerState };
    bullets: { [id: string]: BulletState };
    obstacles: Obstacle[];
    matchEndTime: number;
    voting?: {
        options: string[]; // Map IDs
        votes: { [mapId: string]: number };
        endTime: number;
    };
}

// --- Client -> Server Messages ---

export interface ClientInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
    dash: boolean;
    slide: boolean;
    reload: boolean;
    angle: number;
    seq: number;
}

export type ClientMessage =
    | { type: 'create_lobby'; payload: { username: string } }
    | { type: 'join_lobby'; payload: { username: string; lobbyId: string } }
    | { type: 'input'; payload: ClientInput }
    | { type: 'respawn' }
    | { type: 'select_weapon'; payload: { weapon: WeaponType } }
    | { type: 'login'; payload: { username: string; password: string } }
    | { type: 'register'; payload: { username: string; password: string } }
    | { type: 'vote_map'; payload: { mapId: string } };


// --- Server -> Client Messages ---

export interface LobbyJoinedPayload {
    playerId: string;
    lobbyId: string;
    initialState: GameState;
}

export interface SnapshotPayload {
    state: GameState;
    serverTick: number;
    lastProcessedInput?: number;
}

export interface PlayerDeathPayload {
    id: string; // ID of the player who was killed
    killerId: string;
    killerName: string;
    killedName: string;
}

export interface ErrorPayload {
    message: string;
}

export interface AuthSuccessPayload {
    username: string;
    userId: string;
}

export type ServerMessage =
    | { type: 'lobby_joined', payload: LobbyJoinedPayload }
    | { type: 'snapshot', payload: SnapshotPayload }
    | { type: 'player_death', payload: PlayerDeathPayload }
    | { type: 'respawn' }
    | { type: 'error', payload: ErrorPayload }
    | { type: 'auth_success', payload: AuthSuccessPayload }
    | { type: 'bullet_hit', payload: { x: number; y: number; type: 'wall' | 'player' } }
    | { type: 'vote_update', payload: { votes: { [mapId: string]: number } } };


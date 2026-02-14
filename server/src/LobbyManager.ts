import { GameLobby } from './GameLobby';

// A simple 6-character random string for lobby IDs
function generateLobbyId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export class LobbyManager {
    private lobbies: Map<string, GameLobby> = new Map();

    constructor() {
        this.cleanup();
    }

    createLobby(): GameLobby {
        let newId = generateLobbyId();
        // Ensure the ID is unique
        while (this.lobbies.has(newId)) {
            newId = generateLobbyId();
        }

        const lobby = new GameLobby(newId);
        this.lobbies.set(newId, lobby);
        lobby.start();
        console.log(`[LobbyManager] Created lobby ${newId}`);
        return lobby;
    }

    getLobby(lobbyId: string): GameLobby | undefined {
        return this.lobbies.get(lobbyId);
    }

    removeLobby(lobbyId: string) {
        const lobby = this.lobbies.get(lobbyId);
        if (lobby) {
            lobby.stop();
            this.lobbies.delete(lobbyId);
            console.log(`[LobbyManager] Removed lobby ${lobbyId}`);
        }
    }

    // Periodically clean up empty lobbies
    private cleanup() {
        setInterval(() => {
            for (const [id, lobby] of this.lobbies.entries()) {
                if (lobby.getPlayerCount() === 0) {
                    console.log(`[LobbyManager] Cleaning up empty lobby ${id}`);
                    this.removeLobby(id);
                }
            }
        }, 30000); // Check every 30 seconds
    }
}


import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ServerMessage } from './types';
import { LobbyManager } from './LobbyManager';
import { connectDB } from './db';
import { createUser, findUserByUsername, validatePassword, updateUserLastSeen } from './models/User';
import express from 'express';
import http from 'http';
import cors from 'cors';

const PORT = 8080;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const lobbyManager = new LobbyManager();

// Connect to Database
connectDB().catch(err => console.error("DB Connection Failed", err));

console.log(`Server started on ws://localhost:${PORT}`);

// Attach player ID and lobby ID to the WebSocket object for easier access
interface CustomWebSocket extends WebSocket {
    playerId: string;
    userId?: string; // Authenticated User DB ID
    username?: string;
    lobbyId?: string;
}

wss.on('connection', (ws: CustomWebSocket) => {
    ws.playerId = uuidv4();
    console.log(`Client connected with ID: ${ws.playerId}`);

    ws.on('message', async (rawMessage) => {
        try {
            const message: ClientMessage = JSON.parse(rawMessage.toString());

            switch (message.type) {
                case 'create_lobby': {
                    if (!ws.username) {
                        // Allow guest for now, or enforce login? 
                        // Use provided username for guest
                        ws.username = message.payload.username;
                    }
                    const lobby = lobbyManager.createLobby();
                    lobby.addPlayer(ws, ws.username || message.payload.username);
                    ws.lobbyId = lobby.id;
                    break;
                }
                case 'join_lobby': {
                    if (!ws.username) ws.username = message.payload.username;
                    const lobby = lobbyManager.getLobby(message.payload.lobbyId);
                    if (lobby) {
                        lobby.addPlayer(ws, ws.username || message.payload.username);
                        ws.lobbyId = lobby.id;
                    } else {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Lobby not found.' } }));
                    }
                    break;
                }
                case 'input': {
                    if (ws.lobbyId) {
                        const lobby = lobbyManager.getLobby(ws.lobbyId);
                        lobby?.handleInput(ws.playerId, message.payload);
                    }
                    break;
                }
                case 'respawn': {
                    if (ws.lobbyId) {
                        const lobby = lobbyManager.getLobby(ws.lobbyId);
                        lobby?.handleRespawn(ws.playerId);
                    }
                    break;
                }
                case 'vote_map': {
                    if (ws.lobbyId) {
                        const lobby = lobbyManager.getLobby(ws.lobbyId);
                        lobby?.handleVote(ws.playerId, message.payload.mapId);
                    }
                    break;
                }
                // --- Auth Handlers ---
                case 'register': {
                    try {
                        const { username, password } = message.payload;
                        if (!username || !password) throw new Error('Invalid credentials');
                        const user = await createUser(username, password);
                        ws.userId = user.id;
                        ws.username = user.username;
                        ws.send(JSON.stringify({ type: 'auth_success', payload: { username: user.username, userId: user.id } }));
                    } catch (e: any) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: e.message || 'Registration failed' } }));
                    }
                    break;
                }
                case 'login': {
                    try {
                        const { username, password } = message.payload;
                        const user = await findUserByUsername(username);
                        if (!user || !(await validatePassword(user, password))) {
                            throw new Error('Invalid credentials');
                        }
                        await updateUserLastSeen(user.id);
                        ws.userId = user.id;
                        ws.username = user.username;
                        ws.send(JSON.stringify({ type: 'auth_success', payload: { username: user.username, userId: user.id } }));
                    } catch (e: any) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: e.message || 'Login failed' } }));
                    }
                    break;
                }
            }
        } catch (error) {
            console.error(`Failed to parse message or handle client action for ${ws.playerId}:`, error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${ws.playerId}`);
        if (ws.lobbyId) {
            const lobby = lobbyManager.getLobby(ws.lobbyId);
            lobby?.removePlayer(ws.playerId);
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${ws.playerId}:`, error);
        if (ws.lobbyId) {
            const lobby = lobbyManager.getLobby(ws.lobbyId);
            lobby?.removePlayer(ws.playerId);
        }
    });
});

server.listen(PORT, () => {
    // console.log(`Server started on port ${PORT}`);
});



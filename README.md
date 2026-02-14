# PROJECT HITMANS: DECLASSIFIED

> **Mission Status:** ACTIVE  
> **Classification:** TOP SECRET // EYES ONLY  
> **Codename:** "Deadshot Protocol"

## MISSION BRIEFING
Operatives, welcome to **Project Hitmans**. This is a **high-octane, production-ready scaffold** for a web-based 2D top-down multiplayer shooter. We've engineered an **authoritative server model** to neutralize cheaters, deployed **low-latency WebSockets** for real-time intel, and built a scalable architecture ready for mass deployment.

This isn't just a codebase; it's a weapon.

---

## STANDARD ISSUE LOADOUT (Tech Stack)

### Field Ops (Frontend)
- **Engine:** HTML5 Canvas (Raw performance)
- **Language:** TypeScript (Type-safe operations)
- **Build System:** Vite (Lightning-fast HMR)

### HQ / Command (Backend)
- **Core:** Node.js
- **Language:** TypeScript
- **Comms:** WebSocket (`ws`) (Real-time data stream)

### Archives (Database)
- **Primary Intel:** PostgreSQL
- **Fast Access / PubSub:** Redis

### Logistics (DevOps)
- **Containerization:** Docker

---

## OPERATIONAL CAPABILITIES

- **Authoritative Server:** The central command (server) dictates reality. Cheaters are designated "Hostile" and neutralized immediately.
- **Real-time Multiplayer:** Engage multiple targets simultaneously with sub-second latency.
- **Lag Compensation:** Advanced prediction algorithms mask network jitter. What you see is what you hit.
- **Entity Interpolation:** Smooth movement for remote operatives, eliminating ghosting and stutter.
- **Physics Engine:** Basic collision detection and ballistic simulation.
- **Scalable Architecture:** Stateless matchmaker pattern conceptualized for massive scale operations.
- **Persistent Data:** Battle records and operative profiles stored securely in Postgres.

---

## BASE LAYOUT (Project Structure)

```bash
.
├── client/         # Field Ops (Frontend Vite Project)
├── docs/           # Tactical Maps (System Design & DB Schema)
├── server/         # Command Center (Backend Node.js Project)
├── docker-compose.yml # Deployment Manifest
└── README.md       # Mission Briefing
```

---

## PRE-DEPLOYMENT CHECKS

Ensure your rig is equipped with the following before commencing operations:

- **Node.js (v18+)**: Essential runtime environment.
- **Docker & Docker Compose**: Required for containerized service deployment.

---

## DEPLOYMENT PROTOCOL (Getting Started)

### Phase 1: Secure the Asset
Clone the repository to your local operating base.
```bash
git clone <repository_url>
cd <repository_name>
```

### Phase 2: Equip Dependencies
Install the necessary modules for both Command (Server) and Field Ops (Client).

```bash
# Execute from root directory
npm install --prefix server
npm install --prefix client
```

### Phase 3: Initialize Support Services
Launch the database and cache containers. This provides the backend infrastructure required for the mission.

```bash
docker-compose up -d
```

### Phase 4: Launch Mission Control
Initiate the development servers. You will need two terminal windows for this operation.

**Terminal 1: Activate Game Server**
```bash
# Execute from root directory
npm run dev --prefix server
```
> *Status: Server online at `ws://localhost:8080`*

**Terminal 2: Deploy Client**
```bash
# Execute from root directory
npm run dev --prefix client
```
> *Status: Deployment successful. Access the battlefield at `http://localhost:5173`.*

**Tactical Tip:** Open multiple browser tabs to simulate a squad-sized element.

---

## TACTICAL ANALYSIS (How It Works)

1.  **Uplink Established:** Client connects to Game Server via secure WebSocket.
2.  **Input Stream:** Client transmits operative commands (keyboard/mouse data) at high frequency.
3.  **Server Authority:** The Game Server processes inputs, simulates the world state, and adjudicates all combat actions (movement, hits, collisions).
4.  **State Broadcast:** Server transmits a "World Snapshot" to all connected operatives 20 times per second (20Hz Tick Rate).
5.  **Client Rendering:** Field Ops (Client) uses prediction and interpolation to render a smooth, lag-free visual of the battlefield, reconciling local inputs with server truth.

---

> **END OF BRIEFING**  
> *Good luck out there, soldier.*
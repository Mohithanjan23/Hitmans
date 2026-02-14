import { pool } from '../db';

export interface MatchStats {
    mapId: string;
    startedAt: Date;
    endedAt: Date;
    metadata?: any;
    players: {
        userId?: string; // If registered
        sessionId?: string; // If guest
        kills: number;
        deaths: number;
        score: number;
    }[];
}

export const saveMatch = async (stats: MatchStats) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create Match
        const matchRes = await client.query(
            'INSERT INTO matches (map_id, started_at, ended_at, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
            [stats.mapId, stats.startedAt, stats.endedAt, stats.metadata]
        );
        const matchId = matchRes.rows[0].id;

        // Create Match Players
        for (const player of stats.players) {
            await client.query(
                'INSERT INTO match_players (match_id, user_id, kills, deaths, score) VALUES ($1, $2, $3, $4, $5)',
                [matchId, player.userId || null, player.kills, player.deaths, player.score]
            );

            // Update stats if user registered
            if (player.userId) {
                await client.query(
                    `INSERT INTO leaderboard (user_id, wins, games_played) 
                     VALUES ($1, $2, 1) 
                     ON CONFLICT (user_id) 
                     DO UPDATE SET games_played = leaderboard.games_played + 1, wins = leaderboard.wins + $2`,
                    [player.userId, player.score > 0 ? 1 : 0] // Simplified win check
                );
            }
        }

        await client.query('COMMIT');
        return matchId;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

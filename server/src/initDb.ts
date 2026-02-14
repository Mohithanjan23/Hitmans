import { pool } from './db';

const createTables = async () => {
    try {
        console.log('Creating tables...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(32) UNIQUE NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS matches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                map_id VARCHAR(64) NOT NULL,
                started_at TIMESTAMPTZ NOT NULL,
                ended_at TIMESTAMPTZ NOT NULL,
                metadata JSONB
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS match_players (
                match_id UUID REFERENCES matches(id),
                user_id UUID REFERENCES users(id),
                kills INT NOT NULL DEFAULT 0,
                deaths INT NOT NULL DEFAULT 0,
                score INT NOT NULL DEFAULT 0,
                PRIMARY KEY (match_id, user_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                user_id UUID PRIMARY KEY REFERENCES users(id),
                rating FLOAT NOT NULL DEFAULT 1000,
                wins INT NOT NULL DEFAULT 0,
                games_played INT NOT NULL DEFAULT 0
            );
        `);

        console.log('Tables created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating tables:', err);
        process.exit(1);
    }
};

createTables();

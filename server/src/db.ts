import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Pool
export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'deadshot',
});

// Redis Client
export const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err: any) => console.log('Redis Client Error', err));

export const connectDB = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('Connected to PostgreSQL');

        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Failed to connect to database/redis:', err);
        process.exit(1);
    }
};

export const initDatabase = async () => {
    try {
        console.log('Initializing Database Schema...');
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
        console.log('Database Schema Verified.');
    } catch (err) {
        console.error('Failed to initialize database schema:', err);
    }
};

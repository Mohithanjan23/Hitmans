import { pool } from '../db';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface User {
    id: string;
    username: string;
    password_hash: string;
    created_at: Date;
    last_seen_at: Date;
}

export const createUser = async (username: string, password: string): Promise<User> => {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
        [username, passwordHash]
    );
    return result.rows[0];
};

export const findUserByUsername = async (username: string): Promise<User | null> => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
};

export const validatePassword = async (user: User, password: string): Promise<boolean> => {
    return bcrypt.compare(password, user.password_hash);
};

export const updateUserLastSeen = async (id: string) => {
    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [id]);
};

import { Obstacle } from './types';

// Simple map with some boxes and walls
export const defaultMapObstacles: Obstacle[] = [
    // Center Box
    { id: 'box1', x: 700, y: 350, width: 200, height: 200, type: 'box' },

    // Corner Walls
    { id: 'wall1', x: 200, y: 150, width: 20, height: 200, type: 'wall' },
    { id: 'wall2', x: 1400, y: 550, width: 20, height: 200, type: 'wall' },

    // Horizontal Barriers
    { id: 'wall3', x: 500, y: 700, width: 300, height: 20, type: 'wall' },
    { id: 'wall4', x: 900, y: 200, width: 300, height: 20, type: 'wall' },
];

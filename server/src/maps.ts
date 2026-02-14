import { Obstacle } from './types';

export interface MapData {
    id: string;
    name: string;
    width: number;
    height: number;
    obstacles: Obstacle[];
    spawnPoints: { x: number; y: number }[];
}

export const MAPS: MapData[] = [
    {
        id: 'default_arena',
        name: 'Training Grounds',
        width: 1600,
        height: 900,
        obstacles: [
            { id: 'w1', x: 400, y: 300, width: 50, height: 300, type: 'wall' },
            { id: 'w2', x: 1150, y: 300, width: 50, height: 300, type: 'wall' },
            { id: 'b1', x: 700, y: 400, width: 200, height: 100, type: 'box' },
            { id: 'b2', x: 200, y: 200, width: 100, height: 100, type: 'box' },
            { id: 'b3', x: 1300, y: 600, width: 100, height: 100, type: 'box' }
        ],
        spawnPoints: [{ x: 100, y: 100 }, { x: 1500, y: 800 }, { x: 1500, y: 100 }, { x: 100, y: 800 }]
    },
    {
        id: 'neon_city',
        name: 'Neon City',
        width: 1600,
        height: 900,
        obstacles: [
            { id: 'n1', x: 600, y: 100, width: 400, height: 50, type: 'wall' },
            { id: 'n2', x: 600, y: 750, width: 400, height: 50, type: 'wall' },
            { id: 'n3', x: 300, y: 300, width: 50, height: 300, type: 'wall' },
            { id: 'n4', x: 1250, y: 300, width: 50, height: 300, type: 'wall' },
            { id: 'c1', x: 750, y: 400, width: 100, height: 100, type: 'box' } // Center cover
        ],
        spawnPoints: [{ x: 50, y: 450 }, { x: 1550, y: 450 }]
    },
    {
        id: 'corridor',
        name: 'The Corridor',
        width: 1600,
        height: 900,
        obstacles: [
            { id: 'l1', x: 0, y: 300, width: 1600, height: 50, type: 'wall' }, // Long wall top
            { id: 'l2', x: 0, y: 550, width: 1600, height: 50, type: 'wall' }, // Long wall bottom
            { id: 'c1', x: 400, y: 350, width: 50, height: 200, type: 'box' },
            { id: 'c2', x: 800, y: 350, width: 50, height: 200, type: 'box' },
            { id: 'c3', x: 1200, y: 350, width: 50, height: 200, type: 'box' }
        ],
        spawnPoints: [{ x: 50, y: 450 }, { x: 1550, y: 450 }]
    }
];

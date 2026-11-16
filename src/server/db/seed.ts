import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from './connection';
import { runMigrations } from './migrations';
import { hashPassword } from '../services/authService';
import { SpaceConfig } from '../../shared/types/space';

export const DEFAULT_STARRY_NIGHT_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#070b19',
    density: 0.012
  },
  sky: {
    type: 'starry_night_flow',
    topColor: '#050a30',
    bottomColor: '#1f305e',
    horizonColor: '#2b580c',
    swirlSpeed: 1.2,
    starDensity: 500,
    moonGlow: 0.95
  },
  wind: {
    speed: 1.5,
    direction: [0.8, 0.1, 0.5],
    gustiness: 0.35,
    swayIntensity: 0.4
  },
  lighting: {
    ambient: { color: '#14213d', intensity: 0.45 },
    directional: {
      color: '#fefcd7',
      intensity: 0.85,
      position: [30, 45, -25],
      castShadow: true
    },
    pointLights: [
      { color: '#ffb703', intensity: 1.5, distance: 20, position: [0, 3, 0] },
      { color: '#fb8500', intensity: 1.0, distance: 15, position: [15, 2, -10] }
    ]
  },
  shaders: {
    swirlFlow: { frequency: 2.2, amplitude: 0.75, timeScale: 1.1 }
  },
  audio: {
    trackId: 'starry-night-ambient',
    name: 'Cosmic Night Whispers',
    sourceUrl: '/audio/starry-night-ambient.ogg',
    defaultVolume: 0.7,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 2.5, wet: 0.3 }
  },
  camera: {
    spawnPosition: [0, 1.7, 12],
    lookAt: [0, 6, -20],
    fov: 60,
    moveSpeed: 3.8,
    wanderSpeed: 1.0,
    wanderRadius: 35,
    wanderWaypoints: [
      [0, 2.5, 12],
      [10, 4.0, -5],
      [-8, 3.5, -15],
      [2, 6.0, 0]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_BREEZY_MEADOW_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#e0f2fe',
    density: 0.007
  },
  sky: {
    type: 'procedural_clouds',
    topColor: '#2563eb',
    bottomColor: '#93c5fd',
    horizonColor: '#e0f2fe',
    swirlSpeed: 0.0,
    starDensity: 0,
    cloudCoverage: 0.5,
    cloudSpeed: 0.75
  },
  wind: {
    speed: 2.4,
    direction: [1.0, 0.0, 0.3],
    gustiness: 0.65,
    swayIntensity: 0.9
  },
  lighting: {
    ambient: { color: '#f8fafc', intensity: 0.75 },
    directional: {
      color: '#fffbeb',
      intensity: 1.3,
      position: [40, 60, 30],
      castShadow: true
    },
    pointLights: []
  },
  shaders: {
    grassSway: { stiffness: 0.45, windInfluence: 0.95, noiseScale: 0.25 },
    flowerFlutter: { frequency: 2.8, amplitude: 0.4 }
  },
  audio: {
    trackId: 'breezy-meadow-ambient',
    name: 'Hillside Breeze & Gentle Notes',
    sourceUrl: '/audio/breezy-meadow-ambient.ogg',
    defaultVolume: 0.65,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 1.8, wet: 0.2 }
  },
  camera: {
    spawnPosition: [0, 1.7, 8],
    lookAt: [0, 2.5, -20],
    fov: 60,
    moveSpeed: 4.2,
    wanderSpeed: 1.3,
    wanderRadius: 45,
    wanderWaypoints: [
      [0, 2.0, 8],
      [15, 3.8, 0],
      [4, 4.5, -25],
      [-12, 3.0, -10]
    ],
    heightOffset: 1.7
  }
};

export function seedDatabase(dbInstance?: DatabaseSync): void {
  const db = dbInstance || getDatabase();
  runMigrations(db);

  const now = new Date().toISOString();

  // 1. Seed Users
  const userStmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adminHash = hashPassword('AdminPass123!');
  const visitorHash = hashPassword('VisitorPass123!');

  userStmt.run(
    'user-creator-admin',
    'admin',
    'admin@dreamerize.local',
    adminHash,
    'creator',
    now,
    now
  );

  userStmt.run(
    'user-visitor-default',
    'visitor',
    'visitor@dreamerize.local',
    visitorHash,
    'visitor',
    now,
    now
  );

  // 2. Seed Spaces
  const spaceStmt = db.prepare(`
    INSERT OR IGNORE INTO spaces (id, slug, name, description, thumbnail_url, creator_id, is_published, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  spaceStmt.run(
    'space-starry-night',
    'starry-night',
    'The Starry Night',
    'Kiệt tác Vincent van Gogh tái hiện dưới góc nhìn 3D siêu thực với dòng chảy xoáy sao chuyển động không ngừng, trăng lưỡi liềm vàng rực rỡ và bóng cây bách trầm mặc.',
    '/thumbnails/starry-night.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_STARRY_NIGHT_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-breezy-meadow',
    'breezy-meadow',
    'Ngọn đồi gió thoảng với hoa cỏ',
    'Không gian đồi cỏ xanh ngát, ngập tràn hoa trắng dập dờn trong gió và những đám mây bề thế trên bầu trời trong xanh, tái hiện cảm giác thư thái theo tranh ảnh tham chiếu.',
    '/thumbnails/breezy-meadow.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_BREEZY_MEADOW_CONFIG),
    now,
    now
  );
}

// When executed directly via `tsx src/server/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Seeding Dreamerize database...');
  seedDatabase();
  console.log('Database successfully seeded!');
}

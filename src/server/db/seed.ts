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
    topColor: '#081542',
    bottomColor: '#1f3e78',
    horizonColor: '#285249',
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
    name: 'StarryNight Horizon',
    sourceUrl: '/music/starry-night-horizon.mp3',
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
    wanderRadius: 70,
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
    density: 0.0055
  },
  sky: {
    type: 'procedural_clouds',
    topColor: '#2563eb',
    bottomColor: '#8ec5fc',
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
    ambient: { color: '#f8fafc', intensity: 0.85 },
    directional: {
      color: '#fffbeb',
      intensity: 1.35,
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
    name: 'Windy Hill',
    sourceUrl: '/music/windy-hill.mp3',
    defaultVolume: 0.65,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 1.8, wet: 0.2 }
  },
  camera: {
    spawnPosition: [0, 1.7, 10],
    lookAt: [0, 6.8, -32],
    fov: 60,
    moveSpeed: 4.2,
    wanderSpeed: 1.3,
    wanderRadius: 90,
    wanderWaypoints: [
      [0, 2.0, 8],
      [15, 3.8, 0],
      [4, 4.5, -25],
      [-12, 3.0, -10]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_COSMIC_BLACKHOLE_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#08051a',
    density: 0.0045
  },
  sky: {
    type: 'cosmic_nebula',
    topColor: '#03020b',
    bottomColor: '#1a0c38',
    horizonColor: '#0c2342',
    swirlSpeed: 1.0,
    starDensity: 2400
  },
  wind: {
    speed: 1.2,
    direction: [1.0, 0.2, 0.4],
    gustiness: 0.3,
    swayIntensity: 0.5
  },
  lighting: {
    ambient: { color: '#24184a', intensity: 0.65 },
    directional: {
      color: '#ffd27d',
      intensity: 1.4,
      position: [52, 34, -90],
      castShadow: false
    },
    pointLights: []
  },
  shaders: {
    swirlFlow: { frequency: 1.5, amplitude: 0.8, timeScale: 1.0 }
  },
  audio: {
    trackId: 'cosmic-blackhole-ambient',
    name: "Gravity's Edge",
    sourceUrl: '/music/gravitys-edge.mp3',
    defaultVolume: 0.7,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 3.5, wet: 0.4 }
  },
  camera: {
    spawnPosition: [0, 1.7, 16],
    lookAt: [6, 22, -85],
    fov: 60,
    moveSpeed: 4.5,
    wanderSpeed: 1.2,
    wanderRadius: 124,
    wanderWaypoints: [
      [0, 3.0, 16],
      [-16, 4.5, -10],
      [18, 4.5, -12],
      [0, 6.0, 4]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_MISTY_FOREST_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#cce5df',
    density: 0.0095
  },
  sky: {
    type: 'misty_mountain',
    topColor: '#3b82b6',
    bottomColor: '#a7d7d5',
    horizonColor: '#e6f2ec',
    swirlSpeed: 0.4,
    starDensity: 0
  },
  wind: {
    speed: 1.8,
    direction: [0.8, 0.0, 0.5],
    gustiness: 0.45,
    swayIntensity: 0.55
  },
  lighting: {
    ambient: { color: '#d9f0ea', intensity: 0.85 },
    directional: {
      color: '#fff5d6',
      intensity: 1.35,
      position: [45, 55, -60],
      castShadow: false
    },
    pointLights: []
  },
  shaders: {
    grassSway: { stiffness: 0.5, windInfluence: 0.75 }
  },
  audio: {
    trackId: 'misty-forest-ambient',
    name: 'Forest',
    sourceUrl: '/music/forest-1.mp3',
    defaultVolume: 0.7,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 2.6, wet: 0.3 }
  },
  camera: {
    spawnPosition: [-4, 1.7, 14],
    lookAt: [2, 6, -45],
    fov: 60,
    moveSpeed: 4.0,
    wanderSpeed: 1.15,
    wanderRadius: 124,
    wanderWaypoints: [
      [-4, 2.5, 14],
      [10, 4.0, -5],
      [-12, 4.5, -20],
      [4, 5.5, 5]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_PARADISE_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#e6d8cc',
    density: 0.0021
  },
  sky: {
    type: 'paradise_sky',
    topColor: '#1e64c8',
    bottomColor: '#d495b8',
    horizonColor: '#f6d4a6',
    swirlSpeed: 0.5,
    starDensity: 0,
    cloudCoverage: 0.65,
    cloudSpeed: 0.45,
    moonGlow: 0.85
  },
  wind: {
    speed: 1.6,
    direction: [0.85, 0.0, 0.45],
    gustiness: 0.38,
    swayIntensity: 0.55
  },
  lighting: {
    ambient: { color: '#f2e8df', intensity: 0.72 },
    directional: {
      color: '#ffedd0',
      intensity: 1.35,
      position: [38, 44, -90],
      castShadow: false
    },
    pointLights: [
      { color: '#ffd470', intensity: 1.4, distance: 26, position: [0, 4.2, -14] }
    ]
  },
  shaders: {
    grassSway: { stiffness: 0.5, windInfluence: 0.72 },
    flowerFlutter: { frequency: 2.2, amplitude: 0.35 }
  },
  audio: {
    trackId: 'paradise-sanctuary-ambient',
    name: 'Heaven Horizon',
    sourceUrl: '/music/heaven-horizon.mp3',
    defaultVolume: 0.7,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 3.4, wet: 0.38 }
  },
  camera: {
    spawnPosition: [0, 1.7, 21],
    lookAt: [0, 5.5, -14],
    fov: 60,
    moveSpeed: 4.0,
    wanderSpeed: 1.1,
    wanderRadius: 120,
    wanderWaypoints: [
      [0, 2.5, 21],
      [0, 3.2, -8],
      [28, 3.5, -14],
      [-22, 3.0, 6]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_GHIBLI_VALLEY_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#a6dbfa',
    density: 0.0019
  },
  sky: {
    type: 'ghibli_coastal',
    topColor: '#1256cc',
    bottomColor: '#4da3f0',
    horizonColor: '#bce4fc',
    swirlSpeed: 0.0,
    starDensity: 0,
    cloudCoverage: 0.65,
    cloudSpeed: 0.65
  },
  wind: {
    speed: 2.2,
    direction: [0.85, 0.0, 0.45],
    gustiness: 0.55,
    swayIntensity: 0.85
  },
  lighting: {
    ambient: { color: '#f4f6ee', intensity: 0.55 },
    directional: {
      color: '#fff5da',
      intensity: 1.75,
      position: [48, 66, 36],
      castShadow: false
    },
    pointLights: []
  },
  shaders: {
    grassSway: { stiffness: 0.48, windInfluence: 0.88, noiseScale: 0.25 },
    flowerFlutter: { frequency: 2.6, amplitude: 0.35 }
  },
  audio: {
    trackId: 'ghibli-valley-ambient',
    name: 'Ghibli Hill',
    sourceUrl: '/music/ghibli-hill.mp3',
    defaultVolume: 0.65,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 2.1, wet: 0.25 }
  },
  camera: {
    spawnPosition: [1.5, 1.7, 15.0],
    lookAt: [-1.5, 4.4, -24.0],
    fov: 60,
    moveSpeed: 4.2,
    wanderSpeed: 1.2,
    wanderRadius: 128,
    wanderWaypoints: [
      [1.5, 7.6, 15.0],
      [7.5, 5.2, -7.0],
      [-2.0, 3.6, -24.5],
      [-11.0, 6.2, -10.0]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_VIETNAM_HERITAGE_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#eab780',
    density: 0.000085
  },
  sky: {
    type: 'vietnam_heritage',
    topColor: '#134294',
    bottomColor: '#d98a4b',
    horizonColor: '#f2be7e',
    swirlSpeed: 0.0,
    starDensity: 0,
    cloudCoverage: 0.62,
    cloudSpeed: 0.55
  },
  wind: {
    speed: 2.0,
    direction: [0.85, 0.0, 0.45],
    gustiness: 0.52,
    swayIntensity: 0.85
  },
  lighting: {
    ambient: { color: '#ffe9cf', intensity: 0.48 },
    directional: {
      color: '#ffdfb0',
      intensity: 2.45,
      position: [62, 34, -85],
      castShadow: true
    },
    pointLights: [
      { color: '#ff9e44', intensity: 1.5, distance: 26, position: [0, 6, 0] }
    ]
  },
  shaders: {
    grassSway: { stiffness: 0.5, windInfluence: 0.85, noiseScale: 0.24 },
    flowerFlutter: { frequency: 2.2, amplitude: 0.3 }
  },
  audio: {
    trackId: 'vietnam-heritage-ambient',
    name: 'Việt Nam',
    sourceUrl: '/music/vietnam-1.mp3',
    defaultVolume: 0.72,
    loop: true,
    ambientType: 'audio_buffer',
    reverb: { decay: 2.4, wet: 0.28 }
  },
  camera: {
    spawnPosition: [0, 2.2, 58],
    lookAt: [0, 5.2, -12],
    fov: 60,
    moveSpeed: 24.0,
    wanderSpeed: 6.4,
    wanderRadius: 1450,
    wanderWaypoints: [
      [0, 3.8, 58],
      [0, 6.0, 22],
      [-32, 6.0, 22],
      [35, 6.0, 22],
      [0, 12.0, -40],
      [0, 26.0, -96],
      [-158, 22.0, -172],
      [-355, 52.0, -310],
      [380, 82.0, -308],
      [178, 12.0, -138],
      [-132, 12.0, 42],
      [175, 10.0, 88],
      [335, 18.0, 28],
      [-108, 12.0, 132],
      [0, 14.0, 178],
      [108, 16.0, 130],
      [-72, 10.0, 330],
      [18, 12.0, 445],
      [305, 16.0, 462],
      [680, 12.0, -175],
      [640, 8.0, 206],
      [705, 8.0, 318],
      [-646, 8.0, 80],
      [0, 10.0, -494],
      [-640, 10.0, -108],
      [820, 14.0, 42],
      [-680, 12.0, 438],
      [-840, 20.0, 198],
      [-560, 28.0, -562],
      [0, 10.0, -274],
      [740, 16.0, -432],
      [-820, 38.0, -422],
      [-240, 14.0, -618]
    ],
    heightOffset: 1.7
  }
};

export const DEFAULT_3DGS_COASTAL_SANCTUARY_CONFIG: SpaceConfig = {
  fog: {
    type: 'exp2',
    color: '#bde0fe',
    density: 0.0022
  },
  sky: {
    type: 'custom_asset',
    topColor: '#1d4ed8',
    bottomColor: '#60a5fa',
    horizonColor: '#dbeafe',
    swirlSpeed: 0.0,
    starDensity: 0,
    cloudCoverage: 0.4,
    cloudSpeed: 0.45
  },
  wind: {
    speed: 1.6,
    direction: [0.85, 0.0, 0.45],
    gustiness: 0.35,
    swayIntensity: 0.4
  },
  lighting: {
    ambient: { color: '#f8fafc', intensity: 0.78 },
    directional: {
      color: '#fff7ed',
      intensity: 1.35,
      position: [36, 48, 28],
      castShadow: false
    },
    pointLights: []
  },
  shaders: {},
  audio: {
    trackId: '3dgs-coastal-sanctuary-ambient',
    name: 'Coastal Sanctuary Piano & Gentle Breeze',
    sourceUrl: '/audio/3dgs-coastal-sanctuary-ambient.ogg',
    defaultVolume: 0.65,
    loop: true,
    ambientType: 'procedural_synth',
    reverb: { decay: 2.2, wet: 0.28 }
  },
  camera: {
    spawnPosition: [0, 1.7, 10],
    lookAt: [0, 1.5, 0],
    fov: 60,
    moveSpeed: 3.8,
    wanderSpeed: 1.0,
    wanderRadius: 24,
    wanderWaypoints: [
      [0, 2.0, 10],
      [8, 2.5, 4],
      [0, 2.2, -8],
      [-8, 2.5, 4]
    ],
    heightOffset: 1.7
  },
  assetFormat: 'splat',
  assetUrl: '/samples/coastal-garden.splat'
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

  // 2. Seed Built-in Spaces (upsert defaults so existing DBs receive updated 2x wanderRadius & new spaces)
  const spaceStmt = db.prepare(`
    INSERT INTO spaces (id, slug, name, description, thumbnail_url, creator_id, is_published, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      description = excluded.description,
      thumbnail_url = excluded.thumbnail_url,
      config = excluded.config,
      updated_at = excluded.updated_at
  `);

  spaceStmt.run(
    'space-starry-night',
    'starry-night',
    'The Starry Night',
    'Kiệt tác Vincent van Gogh tái hiện dưới góc nhìn 3D siêu thực với dòng chảy xoáy sao chuyển động không ngừng, mặt đất đồi sơn dầu lối mòn đá cuội ánh đèn làng cổ và bóng cây bách rực lửa.',
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
    'Không gian đồi cỏ xanh ngát, ngập tràn hoa trắng dập dờn trong gió, mây tích Ghibli bề thế cùng tiếng chim hót yên bình và nhạc piano học tập.',
    '/thumbnails/breezy-meadow.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_BREEZY_MEADOW_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-cosmic-blackhole',
    'cosmic-blackhole',
    'Vũ trụ Hố đen & Mặt trời siêu thực',
    'Thánh địa vũ trụ huyền ảo với hố đen thấu kính hấp dẫn xoáy đĩa bồi tụ rực sáng đối xứng mặt trời rực cháy giữa dải ngân hà và thềm đá obsidian đầy sao.',
    '/thumbnails/cosmic-blackhole.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_COSMIC_BLACKHOLE_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-misty-forest',
    'misty-forest',
    'Không gian Núi rừng',
    'Thung lũng rừng thông sương sớm ẩn hiện giữa những dãy núi trùng điệp, dòng suối trong veo róc rách, tiếng chim rừng và nhạc thiền học tập tĩnh tại.',
    '/thumbnails/misty-forest.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_MISTY_FOREST_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-paradise-sanctuary',
    'paradise-sanctuary',
    'Thiên đường',
    'Thánh địa Thiên đường bồng bềnh trên biển mây ngọc trai với đền cẩm thạch vàng, cầu vồng cực quang, thác nước thiên giới, vườn hoa đào tiên cảnh và đàn chim bồ câu trắng bay lượn.',
    '/thumbnails/paradise-sanctuary.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_PARADISE_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-ghibli-valley',
    'ghibli-valley',
    'Thế giới Ghibli',
    'Thung lũng ven biển đậm chất Ghibli rực nắng với tiệm bánh cối xay gió xoay êm đềm, cây cổ thụ linh hồn, vịnh biển ngọc lam lấp lánh và chuyến tàu ven biển lướt qua chân trời mây.',
    '/thumbnails/ghibli-valley.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_GHIBLI_VALLEY_CONFIG),
    now,
    now
  );

  spaceStmt.run(
    'space-vietnam-heritage',
    'vietnam-heritage',
    'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản',
    'Hành trình kỳ vĩ quy tụ 30 danh thắng di sản ba miền Tổ quốc: Miền Bắc (Vịnh Hạ Long, Lũng Cú, Fansipan, Hoàng Thành Thăng Long, Khuê Văn Các, Chùa Một Cột, Tháp Rùa, Chùa Hương, Đền Hùng, Mù Cang Chải), Miền Trung & Tây Nguyên (Kinh Thành Huế, Hội An, Cầu Rồng, Cầu Vàng, Sơn Đoòng, Phong Nha, Mỹ Sơn, Poshanư, Đà Lạt, Biển Hồ Nhà Rông) và Miền Nam & Hải Đảo (Chợ Bến Thành, Dinh Độc Lập, Nhà Thờ Đức Bà, Củ Chi, Ponagar, Chợ Nổi Cái Răng, Rừng Tràm Trà Sư, Mũi Cà Mau, Phú Quốc, Côn Đảo).',
    '/thumbnails/vietnam-heritage.jpg',
    'user-creator-admin',
    1,
    JSON.stringify(DEFAULT_VIETNAM_HERITAGE_CONFIG),
    now,
    now
  );

  // Remove legacy 3dgs-coastal-sanctuary if previously seeded
  db.prepare(
    "DELETE FROM spaces WHERE slug = '3dgs-coastal-sanctuary' OR id = 'space-3dgs-coastal-sanctuary'"
  ).run();
}

// When executed directly via `tsx src/server/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Seeding Dreamerize database...');
  seedDatabase();
  console.log('Database successfully seeded!');
}

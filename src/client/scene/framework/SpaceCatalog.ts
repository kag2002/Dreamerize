import type { SpaceConfig } from '../../../shared/types/space';
import type { ISpace } from '../ISpace';
import { StarryNightScene } from '../environments/StarryNightScene';
import type { WorldCatalogEntry } from './types';

const BUILT_IN_SPACE_LIST: WorldCatalogEntry[] = [
  {
    id: 'space-starry-night',
    slug: 'starry-night',
    aliases: ['starry-night', 'space-starry-night'],
    keywordMatches: ['starry'],
    name: 'The Starry Night',
    viewerTitle: 'The Starry Night',
    viewerSubtitle: 'Saint-Rémy 1889 • StarryNight Horizon Loop',
    gallerySubtitle: 'Vincent van Gogh • Nocturnal Piano, Nylon Guitar, Sax & Cello',
    description:
      'Kiệt tác Vincent van Gogh tái hiện dưới góc nhìn 3D siêu thực với dòng chảy xoáy sao chuyển động không ngừng, mặt đất đồi chân thực, lối mòn đá cuội ánh đèn làng cổ và bóng cây bách rực lửa.',
    accentColor: '#fbbf24',
    gradient: 'linear-gradient(135deg, #050a30 0%, #1e3a8a 55%, #f59e0b 135%)',
    tags: ['GLSL Swirl Sky', 'Photoreal Village & Cobblestone', 'Piano, Guitar & Mellow Sax'],
    tabLabel: 'Starry Night',
    tabTestId: 'switch-space-starry-night',
    syncFactory: () => new StarryNightScene(),
    loadFactory: async () => new StarryNightScene()
  },
  {
    id: 'space-breezy-meadow',
    slug: 'breezy-meadow',
    aliases: ['breezy-meadow', 'space-breezy-meadow'],
    keywordMatches: ['meadow'],
    name: 'Ngọn đồi gió thoảng với hoa cỏ',
    viewerTitle: 'Ngọn đồi gió thoảng với hoa cỏ',
    viewerSubtitle: 'Breezy Meadow • Windy Hill Loop',
    gallerySubtitle: 'Breezy Meadow Hill • Acoustic Guitar, Piano, Flute & Birdsong',
    description:
      'Không gian đồi cỏ xanh ngát, ngập tràn hoa trắng dập dờn trong gió, mây tích Ghibli bề thế cùng tiếng chim hót yên bình, suối róc rách và bản hòa tấu guitar, piano, sáo trúc êm dịu.',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #4d8c2e 100%)',
    tags: ['32k Instanced Grass', '2.2k Wildflowers', 'Guitar, Piano & Flute Chill'],
    tabLabel: 'Meadow Hill',
    tabTestId: 'switch-space-meadow',
    loadFactory: async () => {
      const { BreezyMeadowScene } = await import('../environments/BreezyMeadowScene');
      return new BreezyMeadowScene();
    }
  },
  {
    id: 'space-cosmic-blackhole',
    slug: 'cosmic-blackhole',
    aliases: ['cosmic-blackhole', 'space-cosmic-blackhole'],
    keywordMatches: ['cosmic', 'blackhole'],
    name: 'Vũ trụ Hố đen & Mặt trời siêu thực',
    viewerTitle: 'Vũ trụ Hố đen & Mặt trời siêu thực',
    viewerSubtitle: "Cosmic Singularity • Gravity's Edge Loop",
    gallerySubtitle: 'Cosmic Singularity • Warm Brass Horn, Ambient Guitar, Piano & Cello',
    description:
      'Thánh địa vũ trụ huyền ảo với hố đen thấu kính hấp dẫn xoáy đĩa bồi tụ rực sáng đối xứng mặt trời rực cháy giữa dải ngân hà và thềm đá obsidian đầy sao.',
    accentColor: '#c084fc',
    gradient: 'linear-gradient(135deg, #03020b 0%, #4c1d95 50%, #f59e0b 130%)',
    tags: ['Black Hole Lensing', 'Boiling Solar Corona', 'Brass Horn, Guitar & Piano'],
    tabLabel: 'Hố đen & Mặt trời',
    tabTestId: 'switch-space-cosmic-blackhole',
    loadFactory: async () => {
      const { CosmicBlackHoleScene } = await import('../environments/CosmicBlackHoleScene');
      return new CosmicBlackHoleScene();
    }
  },
  {
    id: 'space-misty-forest',
    slug: 'misty-forest',
    aliases: ['misty-forest', 'space-misty-forest'],
    keywordMatches: ['forest', 'mountain'],
    name: 'Không gian Núi rừng',
    viewerTitle: 'Không gian Núi rừng',
    viewerSubtitle: 'Misty Forest • Forest Loop',
    gallerySubtitle: 'Misty Forest • Fingerpicked Guitar, Bamboo Flute, Horn & Piano',
    description:
      'Thung lũng rừng thông sương sớm ẩn hiện giữa những dãy núi trùng điệp, dòng suối trong veo róc rách, tiếng chim rừng, cúc cu và bản nhạc guitar mộc, sáo trúc, kèn êm cùng piano.',
    accentColor: '#4ade80',
    gradient: 'linear-gradient(135deg, #0f3d34 0%, #2d6a4f 50%, #a7d7d5 120%)',
    tags: ['420+ Instanced Pines', 'Flowing Mountain Stream', 'Guitar, Bamboo Flute & Piano'],
    tabLabel: 'Núi rừng',
    tabTestId: 'switch-space-misty-forest',
    loadFactory: async () => {
      const { MistyForestScene } = await import('../environments/MistyForestScene');
      return new MistyForestScene();
    }
  },
  {
    id: 'space-paradise-sanctuary',
    slug: 'paradise-sanctuary',
    aliases: ['paradise-sanctuary', 'space-paradise-sanctuary'],
    keywordMatches: ['paradise', 'sanctuary', 'heaven'],
    name: 'Thiên đường',
    viewerTitle: 'Thiên đường',
    viewerSubtitle: 'Paradise Sanctuary • Heaven Horizon Loop',
    gallerySubtitle: 'Paradise Sanctuary • Heavenly Harp, Guitar, Flute, Horn & Piano',
    description:
      'Thánh địa Thiên đường bồng bềnh trên biển mây ngọc trai với đền cẩm thạch vàng, cầu vồng cực quang, thác nước thiên giới, vườn hoa đào và chim bồ câu trắng bay lượn.',
    accentColor: '#fcd34d',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #f9a8d4 52%, #fef08a 115%)',
    tags: ['Marble Rotunda & Falls', 'Aurora Rainbow & Cloud Sea', 'Harp, Guitar, Flute & Choir'],
    tabLabel: 'Thiên đường',
    tabTestId: 'switch-space-paradise',
    loadFactory: async () => {
      const { ParadiseScene } = await import('../environments/ParadiseScene');
      return new ParadiseScene();
    }
  },
  {
    id: 'space-ghibli-valley',
    slug: 'ghibli-valley',
    aliases: ['ghibli-valley', 'space-ghibli-valley'],
    keywordMatches: ['ghibli'],
    name: 'Thế giới Ghibli',
    viewerTitle: 'Thế giới Ghibli',
    viewerSubtitle: 'Ghibli Valley • Ghibli Hill Loop',
    gallerySubtitle: 'Ghibli Coastal Valley • Piano Waltz, Acoustic Guitar & Flugelhorn',
    description:
      'Thung lũng ven biển đậm chất Ghibli rực nắng với tiệm bánh cối xay gió xoay êm đềm, cây cổ thụ linh hồn, vịnh biển ngọc lam lấp lánh và chuyến tàu ven biển.',
    accentColor: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #2dd4bf 55%, #fb7185 130%)',
    tags: ['Sunlit Coastal Valley', 'Windmill & Sea Train', 'Piano, Guitar & Flugelhorn Waltz'],
    tabLabel: 'Ghibli',
    tabTestId: 'switch-space-ghibli',
    loadFactory: async () => {
      const { GhibliValleyScene } = await import('../environments/GhibliValleyScene');
      return new GhibliValleyScene();
    }
  },
  {
    id: 'space-vietnam-heritage',
    slug: 'vietnam-heritage',
    aliases: ['vietnam-heritage', 'space-vietnam-heritage'],
    keywordMatches: ['vietnam'],
    name: 'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản',
    viewerTitle: 'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản',
    viewerSubtitle: '30 Địa Danh Bắc · Trung · Nam & Hải Đảo • Nhạc nền Việt Nam Loop',
    gallerySubtitle: 'Vietnam Heritage • Đàn Tranh, Sáo Trúc Ngũ Cung, Piano & Cello',
    description:
      'Hành trình kỳ vĩ quy tụ tinh hoa di sản Việt Nam: Cầu Vàng Bàn Tay Khổng Lồ Bà Nà, Khuê Văn Các, Chùa Một Cột trên đầm sen, Tháp Rùa Hồ Gươm, Ruộng bậc thang Tây Bắc và Vịnh Hạ Long thuyền buồm cánh dơi.',
    accentColor: '#f43f5e',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #be123c 48%, #f59e0b 125%)',
    tags: ['Cầu Vàng & Hạ Long', 'Khuê Văn Các & Một Cột', 'Đàn Tranh & Sáo Trúc'],
    tabLabel: 'Việt Nam',
    tabTestId: 'switch-space-vietnam',
    loadFactory: async () => {
      const { VietnamHeritageScene } = await import('../environments/VietnamHeritageScene');
      // Enable proximity zone streaming in live runtime so the 14 outer macro zones stream on demand!
      return new VietnamHeritageScene({ streamingMode: 'proximity' });
    }
  },
  {
    id: 'space-lantern-night',
    slug: 'lantern-night',
    aliases: ['lantern-night', 'space-lantern-night'],
    keywordMatches: ['lantern', 'hoa-dang', 'hoadang'],
    name: 'Đêm Hoa Đăng & Đèn Trời',
    viewerTitle: 'Đêm Hoa Đăng & Đèn Trời',
    viewerSubtitle: 'Biển Đêm Đen Mực • Hoa Đăng Gợn Sóng & Đèn Lồng Bay',
    gallerySubtitle: 'Lantern Night Void • Floating Lotus Lanterns & Sky Lantern Reflections',
    description:
      'Không gian đêm tối đen như mực nơi mặt nước không màu hòa làm một với bầu trời, bên dưới là hàng trăm đèn hoa đăng trôi êm kèm những gợn sóng vàng ấm, trên cao là biển đèn lồng sáng lung linh bay lên và chiếu bóng lung linh xuống mặt nước.',
    accentColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #010103 0%, #1c0c04 52%, #f59e0b 135%)',
    tags: ['420 Đèn Lồng Bay', '180 Hoa Đăng Gợn Sóng', 'Gương Nước Phản Chiếu'],
    tabLabel: 'Đêm Hoa Đăng',
    tabTestId: 'switch-space-lantern-night',
    loadFactory: async () => {
      const { LanternNightScene } = await import('../environments/LanternNightScene');
      return new LanternNightScene();
    }
  }
];

/**
 * Registers or overrides a built-in world definition in the global SpaceCatalog so future maps
 * automatically appear in SpaceEngine routing, SpaceViewer tabs/metadata, and the gallery.
 */
export function registerBuiltInSpace(entry: WorldCatalogEntry): void {
  const idx = BUILT_IN_SPACE_LIST.findIndex((e) => e.slug === entry.slug);
  if (idx >= 0) {
    BUILT_IN_SPACE_LIST[idx] = entry;
  } else {
    BUILT_IN_SPACE_LIST.push(entry);
  }
}

export function unregisterBuiltInSpace(slug: string): boolean {
  const idx = BUILT_IN_SPACE_LIST.findIndex((e) => e.slug === slug);
  if (idx >= 0) {
    BUILT_IN_SPACE_LIST.splice(idx, 1);
    return true;
  }
  return false;
}

export function getBuiltInSpaces(): readonly WorldCatalogEntry[] {
  return BUILT_IN_SPACE_LIST;
}

export function getKnownBuiltInSlugs(): Set<string> {
  const set = new Set<string>();
  for (const entry of BUILT_IN_SPACE_LIST) {
    set.add(entry.slug);
    for (const a of entry.aliases) {
      set.add(a);
    }
  }
  return set;
}

export function findBuiltInSpace(rawSlug: string): WorldCatalogEntry | undefined {
  const s = (rawSlug || '').trim().toLowerCase();
  if (!s) return undefined;

  for (const entry of BUILT_IN_SPACE_LIST) {
    if (entry.slug === s || entry.aliases.includes(s)) {
      return entry;
    }
  }

  for (const entry of BUILT_IN_SPACE_LIST) {
    if (entry.keywordMatches?.some((kw) => s.includes(kw))) {
      return entry;
    }
  }

  return undefined;
}

export function isKnownBuiltInSlug(rawSlug: string): boolean {
  const s = (rawSlug || '').trim().toLowerCase();
  return getKnownBuiltInSlugs().has(s);
}

export function normalizeBuiltInSlug(rawSlug: string): string {
  const s = (rawSlug || '').trim().toLowerCase();
  const exact = BUILT_IN_SPACE_LIST.find((e) => e.slug === s || e.aliases.includes(s));
  if (exact) return exact.slug;
  return s || 'starry-night';
}

export function createBuiltInSpaceSyncIfFast(slug: string, config?: SpaceConfig): ISpace | null {
  if (
    config?.assetFormat === 'splat' ||
    config?.assetFormat === 'ply' ||
    config?.assetFormat === 'glb' ||
    config?.sky?.type === 'custom_asset'
  ) {
    return null;
  }

  const normalizedSlug = (slug || '').trim().toLowerCase();
  if (
    normalizedSlug.includes('3dgs') ||
    normalizedSlug.includes('splat') ||
    normalizedSlug.includes('ply') ||
    normalizedSlug.includes('glb') ||
    normalizedSlug.includes('custom')
  ) {
    return null;
  }

  const match = findBuiltInSpace(normalizedSlug);
  if (match) {
    return match.syncFactory ? match.syncFactory() : null;
  }

  return new StarryNightScene();
}

export async function createBuiltInSpaceBySlug(slug: string): Promise<ISpace> {
  const fast = createBuiltInSpaceSyncIfFast(slug);
  if (fast) return fast;

  const normalizedSlug = (slug || '').trim().toLowerCase();
  if (normalizedSlug.includes('3dgs') || normalizedSlug.includes('splat')) {
    const { GaussianSplatScene } = await import('../loaders/GaussianSplatScene');
    return new GaussianSplatScene({ slug });
  }

  const match = findBuiltInSpace(normalizedSlug);
  if (match) {
    return match.loadFactory();
  }

  return new StarryNightScene();
}

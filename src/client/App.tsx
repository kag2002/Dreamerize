import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SpaceViewer } from './components/viewer/SpaceViewer';
import { SpaceConfig, SpaceEntity } from '../shared/types/space';
import {
  detectGraphicsCapabilities,
  GraphicsCapabilities,
} from './scene/capabilities/WebGPUCapability';

const AuthModal = React.lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const Import3DAssetForm = React.lazy(() =>
  import('./components/admin/CreatorControlPanel').then((m) => ({ default: m.Import3DAssetForm }))
);
const GraphicsBackendBadge = React.lazy(() =>
  import('./components/admin/CreatorControlPanel').then((m) => ({ default: m.GraphicsBackendBadge }))
);

interface SpaceCardItem {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  accentColor: string;
  gradient: string;
  tags: string[];
  entity?: SpaceEntity;
}

const DEFAULT_SPACES: SpaceCardItem[] = [
  {
    id: 'space-starry-night',
    slug: 'starry-night',
    name: 'The Starry Night',
    subtitle: 'Vincent van Gogh • Nocturnal Piano, Nylon Guitar, Sax & Cello',
    description:
      'Kiệt tác Vincent van Gogh tái hiện dưới góc nhìn 3D siêu thực với dòng chảy xoáy sao chuyển động không ngừng, mặt đất đồi chân thực, lối mòn đá cuội ánh đèn làng cổ và bóng cây bách rực lửa.',
    accentColor: '#fbbf24',
    gradient: 'linear-gradient(135deg, #050a30 0%, #1e3a8a 55%, #f59e0b 135%)',
    tags: ['GLSL Swirl Sky', 'Photoreal Village & Cobblestone', 'Piano, Guitar & Mellow Sax'],
  },
  {
    id: 'space-breezy-meadow',
    slug: 'breezy-meadow',
    name: 'Ngọn đồi gió thoảng với hoa cỏ',
    subtitle: 'Breezy Meadow Hill • Acoustic Guitar, Piano, Flute & Birdsong',
    description:
      'Không gian đồi cỏ xanh ngát, ngập tràn hoa trắng dập dờn trong gió, mây tích Ghibli bề thế cùng tiếng chim hót yên bình, suối róc rách và bản hòa tấu guitar, piano, sáo trúc êm dịu.',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #4d8c2e 100%)',
    tags: ['32k Instanced Grass', '2.2k Wildflowers', 'Guitar, Piano & Flute Chill'],
  },
  {
    id: 'space-cosmic-blackhole',
    slug: 'cosmic-blackhole',
    name: 'Vũ trụ Hố đen & Mặt trời siêu thực',
    subtitle: 'Cosmic Singularity • Warm Brass Horn, Ambient Guitar, Piano & Cello',
    description:
      'Thánh địa vũ trụ huyền ảo với hố đen thấu kính hấp dẫn xoáy đĩa bồi tụ rực sáng đối xứng mặt trời rực cháy giữa dải ngân hà và thềm đá obsidian đầy sao.',
    accentColor: '#c084fc',
    gradient: 'linear-gradient(135deg, #03020b 0%, #4c1d95 50%, #f59e0b 130%)',
    tags: ['Black Hole Lensing', 'Boiling Solar Corona', 'Brass Horn, Guitar & Piano'],
  },
  {
    id: 'space-misty-forest',
    slug: 'misty-forest',
    name: 'Không gian Núi rừng',
    subtitle: 'Misty Forest • Fingerpicked Guitar, Bamboo Flute, Horn & Piano',
    description:
      'Thung lũng rừng thông sương sớm ẩn hiện giữa những dãy núi trùng điệp, dòng suối trong veo róc rách, tiếng chim rừng, cúc cu và bản nhạc guitar mộc, sáo trúc, kèn êm cùng piano.',
    accentColor: '#4ade80',
    gradient: 'linear-gradient(135deg, #0f3d34 0%, #2d6a4f 50%, #a7d7d5 120%)',
    tags: ['420+ Instanced Pines', 'Flowing Mountain Stream', 'Guitar, Bamboo Flute & Piano'],
  },
  {
    id: 'space-paradise-sanctuary',
    slug: 'paradise-sanctuary',
    name: 'Thiên đường',
    subtitle: 'Paradise Sanctuary • Heavenly Harp, Guitar, Flute, Horn & Piano',
    description:
      'Thánh địa Thiên đường bồng bềnh trên biển mây ngọc trai với đền cẩm thạch vàng, cầu vồng cực quang, thác nước thiên giới, vườn hoa đào và chim bồ câu trắng bay lượn.',
    accentColor: '#fcd34d',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #f9a8d4 52%, #fef08a 115%)',
    tags: ['Marble Rotunda & Falls', 'Aurora Rainbow & Cloud Sea', 'Harp, Guitar, Flute & Choir'],
  },
  {
    id: 'space-ghibli-valley',
    slug: 'ghibli-valley',
    name: 'Thế giới Ghibli',
    subtitle: 'Ghibli Coastal Valley • Piano Waltz, Acoustic Guitar & Flugelhorn',
    description:
      'Thung lũng ven biển đậm chất Ghibli rực nắng với tiệm bánh cối xay gió xoay êm đềm, cây cổ thụ linh hồn, vịnh biển ngọc lam lấp lánh và chuyến tàu ven biển.',
    accentColor: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #2dd4bf 55%, #fb7185 130%)',
    tags: ['Sunlit Coastal Valley', 'Windmill & Sea Train', 'Piano, Guitar & Flugelhorn Waltz'],
  },
  {
    id: 'space-vietnam-heritage',
    slug: 'vietnam-heritage',
    name: 'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản',
    subtitle: 'Vietnam Heritage • Đàn Tranh, Sáo Trúc Ngũ Cung, Piano & Cello',
    description:
      'Hành trình kỳ vĩ quy tụ tinh hoa di sản Việt Nam: Cầu Vàng Bàn Tay Khổng Lồ Bà Nà, Khuê Văn Các, Chùa Một Cột trên đầm sen, Tháp Rùa Hồ Gươm, Ruộng bậc thang Tây Bắc và Vịnh Hạ Long thuyền buồm cánh dơi.',
    accentColor: '#f43f5e',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #be123c 48%, #f59e0b 125%)',
    tags: ['Cầu Vàng & Hạ Long', 'Khuê Văn Các & Một Cột', 'Đàn Tranh & Sáo Trúc'],
  },
];

function buildCustomCardFromEntity(space: SpaceEntity): SpaceCardItem {
  const cfg: Partial<SpaceConfig> =
    typeof space.config === 'string'
      ? (() => {
          try {
            return JSON.parse(space.config) as SpaceConfig;
          } catch {
            return {};
          }
        })()
      : space.config || {};
  const fmt = cfg.assetFormat;
  const isGlb = fmt === 'glb';
  const isSplat = fmt === 'splat' || fmt === 'ply';

  return {
    id: space.id,
    slug: space.slug,
    name: space.name,
    subtitle: isGlb
      ? 'Custom GLB PBR • Draco / KTX2 / Meshopt'
      : isSplat
        ? `Custom 3DGS (.${fmt}) • WebGL2 GPU Splatting`
        : 'Custom 3D Art Space',
    description:
      space.description ||
      'Creator-imported surreal 3D environment ready for serene first-person or glide exploration.',
    accentColor: isGlb ? '#fbbf24' : '#60a5fa',
    gradient: isGlb
      ? 'linear-gradient(135deg, #1e293b 0%, #0f766e 55%, #f59e0b 130%)'
      : 'linear-gradient(135deg, #0f172a 0%, #3730a3 55%, #38bdf8 130%)',
    tags: isGlb
      ? ['GLB PBR', 'Draco / KTX2 / Meshopt', 'PMREM Lighting']
      : isSplat
        ? [`3DGS .${fmt?.toUpperCase()}`, 'WebGL2 Covariance Sort', 'Ambient Synth']
        : ['Custom Space', 'WebGL2'],
    entity: { ...space, config: cfg as SpaceConfig },
  };
}

const LandingPage: React.FC<{ onNavigate: (path: string, spaceEntity?: SpaceEntity | null) => void }> = ({
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [spaces, setSpaces] = useState<SpaceCardItem[]>(DEFAULT_SPACES);
  const [graphicsCaps, setGraphicsCaps] = useState<GraphicsCapabilities | null>(null);

  const fetchSpaces = useCallback(() => {
    fetch('/api/spaces', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.spaces || !Array.isArray(data.spaces)) return;
        const dbSpaces = data.spaces as SpaceEntity[];
        const bySlug = new Map<string, SpaceEntity>();
        for (const sp of dbSpaces) {
          if (sp.slug === '3dgs-coastal-sanctuary') continue;
          bySlug.set(sp.slug, sp);
        }

        const mergedDefaults = DEFAULT_SPACES.map((def) => {
          const match = bySlug.get(def.slug);
          if (!match) return def;
          bySlug.delete(def.slug);
          const parsedCfg =
            typeof match.config === 'string'
              ? (() => {
                  try {
                    return JSON.parse(match.config);
                  } catch {
                    return def;
                  }
                })()
              : match.config;
          return {
            ...def,
            id: match.id,
            name: match.name || def.name,
            description: match.description || def.description,
            entity: { ...match, config: parsedCfg },
          };
        });

        const customCards = Array.from(bySlug.values()).map(buildCustomCardFromEntity);
        setSpaces([...mergedDefaults, ...customCards]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces, user]);

  useEffect(() => {
    let cancelled = false;
    detectGraphicsCapabilities()
      .then((caps) => {
        if (!cancelled) setGraphicsCaps(caps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Ensure any lingering WebGL canvas is removed when on landing page
    const staleCanvas = document.getElementById('space-canvas');
    if (staleCanvas && staleCanvas.parentElement) {
      staleCanvas.parentElement.removeChild(staleCanvas);
    }
    if (typeof window !== 'undefined') {
      const w = window as any;
      w.__isRenderLoopRunning = false;
      w.__spaceEngineDisposed = true;
    }
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 0%, #0f172a 0%, #020617 75%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Navigation Header */}
      <header
        style={{
          maxWidth: '1160px',
          margin: '0 auto',
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #fbbf24, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#020617',
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
          >
            D
          </div>
          <div>
            <h1
              data-testid="app-title"
              style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              Dreamerize
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Surreal 3D Art Spaces for Study & Relaxation
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user ? (
            <>
              {user.role === 'creator' && (
                <button
                  type="button"
                  data-testid="import-3d-btn"
                  onClick={() => setImportModalOpen(true)}
                  style={{
                    padding: '0.5rem 0.95rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                    color: '#020617',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ＋ Import 3DGS / GLB
                </button>
              )}
              <span
                style={{
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                {user.username} ({user.role})
              </span>
              <button
                type="button"
                data-testid="logout-btn"
                onClick={() => logout()}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-testid="login-btn"
                onClick={() => {
                  setAuthMode('login');
                  setAuthModalOpen(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Log in
              </button>
              <button
                type="button"
                data-testid="register-btn"
                onClick={() => {
                  setAuthMode('register');
                  setAuthModalOpen(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Register
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ maxWidth: '1160px', margin: '0 auto', padding: '3.5rem 2rem 5rem' }}>
        <div style={{ maxWidth: '720px', marginBottom: '3rem' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(251, 191, 36, 0.12)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              color: '#fde68a',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            WebGL 2.0 Procedural Sanctuaries
          </div>
          <div
            style={{
              margin: '0 0 1rem',
              fontSize: '2.6rem',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            Step inside living paintings for deep focus & tranquility.
          </div>
          <p style={{ margin: 0, fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.65 }}>
            Explore non-pixel surreal 3D environments in first-person or let the autonomous glider camera
            carry you across swirling skies and windswept hills with gapless ambient soundscapes.
          </p>
        </div>

        {/* Space Gallery Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
          }}
        >
          {spaces.map((space) => (
            <div
              key={space.id}
              style={{
                borderRadius: '20px',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                background: 'rgba(15, 23, 42, 0.7)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* Artwork Preview Banner */}
              <div
                style={{
                  height: '190px',
                  background: space.gradient,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {space.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        background: 'rgba(2, 6, 23, 0.55)',
                        backdropFilter: 'blur(8px)',
                        color: '#f8fafc',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                  {space.subtitle}
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '1.75rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 0.65rem', fontSize: '1.4rem', fontWeight: 700 }}>
                  {space.name}
                </h3>
                <p
                  style={{
                    margin: '0 0 1.5rem',
                    fontSize: '0.92rem',
                    color: '#94a3b8',
                    lineHeight: 1.6,
                    flex: 1,
                  }}
                >
                  {space.description}
                </p>

                <a
                  href={`/space/${space.slug}`}
                  data-testid={`space-card-${space.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(`/space/${space.slug}`, space.entity ?? null);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.8rem 1.25rem',
                    borderRadius: '12px',
                    background: space.accentColor,
                    color: '#020617',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    textDecoration: 'none',
                  }}
                >
                  Enter {space.name} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModalOpen}
            initialMode={authMode}
            onClose={() => setAuthModalOpen(false)}
          />
        </Suspense>
      )}

      {importModalOpen && (
        <div
          data-testid="import-3d-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(4, 7, 17, 0.78)',
            backdropFilter: 'blur(12px)',
            padding: '1rem',
          }}
          onClick={() => setImportModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(8, 13, 26, 0.98))',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '18px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8', fontWeight: 700 }}>
                  Creator Studio Import
                </div>
                <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                  Import 3DGS / GLB Space
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setImportModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.35rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <Suspense fallback={null}>
              <Import3DAssetForm
                onCancel={() => setImportModalOpen(false)}
                onSpaceCreated={(createdSpace) => {
                  setImportModalOpen(false);
                  fetchSpaces();
                  onNavigate(`/space/${createdSpace.slug}`, createdSpace);
                }}
              />

              <GraphicsBackendBadge capabilities={graphicsCaps} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [selectedSpaceEntity, setSelectedSpaceEntity] = useState<SpaceEntity | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setSelectedSpaceEntity(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextPath: string, spaceEntity: SpaceEntity | null = null) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedSpaceEntity(spaceEntity);
    setPathname(nextPath);
  };

  const spaceMatch = pathname.match(/^\/space\/([^/?#]+)/);

  return (
    <AuthProvider>
      {spaceMatch ? (
        <SpaceViewer
          slug={decodeURIComponent(spaceMatch[1])}
          initialSpaceEntity={selectedSpaceEntity}
          onNavigate={navigate}
        />
      ) : (
        <LandingPage onNavigate={navigate} />
      )}
    </AuthProvider>
  );
}

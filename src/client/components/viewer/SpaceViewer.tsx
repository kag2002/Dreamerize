import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AtmosphereWeather, SpaceEngine } from '../../scene/SpaceEngine';
import { CameraController } from '../../scene/camera/CameraController';
import { AudioManager } from '../../scene/audio/AudioManager';
import { IPointOfInterest, ISpace } from '../../scene/ISpace';
import { CameraMode, SpaceConfig, SpaceEntity } from '../../../shared/types/space';
import { useAuth } from '../../context/AuthContext';

const CreatorControlPanel = React.lazy(() =>
  import('../admin/CreatorControlPanel').then((m) => ({ default: m.CreatorControlPanel }))
);
const AuthModal = React.lazy(() =>
  import('../auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);

interface SpaceViewerProps {
  slug: string;
  initialSpaceEntity?: SpaceEntity | null;
  onNavigate: (path: string, spaceEntity?: SpaceEntity | null) => void;
}

const KNOWN_BUILT_IN_SLUGS = new Set([
  'starry-night',
  'space-starry-night',
  'breezy-meadow',
  'space-breezy-meadow',
  'cosmic-blackhole',
  'space-cosmic-blackhole',
  'misty-forest',
  'space-misty-forest',
  'paradise-sanctuary',
  'space-paradise-sanctuary',
  'ghibli-valley',
  'space-ghibli-valley',
  'vietnam-heritage',
  'space-vietnam-heritage',
]);

function normalizeBuiltInSlug(rawSlug: string): string {
  const s = (rawSlug || '').trim().toLowerCase();
  if (s === 'breezy-meadow' || s === 'space-breezy-meadow') return 'breezy-meadow';
  if (s === 'cosmic-blackhole' || s === 'space-cosmic-blackhole') return 'cosmic-blackhole';
  if (s === 'misty-forest' || s === 'space-misty-forest') return 'misty-forest';
  if (s === 'paradise-sanctuary' || s === 'space-paradise-sanctuary') return 'paradise-sanctuary';
  if (s === 'ghibli-valley' || s === 'space-ghibli-valley') return 'ghibli-valley';
  if (s === 'vietnam-heritage' || s === 'space-vietnam-heritage') return 'vietnam-heritage';
  if (s === 'starry-night' || s === 'space-starry-night') return 'starry-night';
  return s || 'starry-night';
}

const SPACE_META: Record<string, { title: string; subtitle: string; accent: string }> = {
  'starry-night': {
    title: 'The Starry Night',
    subtitle: 'Saint-Rémy 1889 • StarryNight Horizon Loop',
    accent: '#fbbf24',
  },
  'breezy-meadow': {
    title: 'Ngọn đồi gió thoảng với hoa cỏ',
    subtitle: 'Breezy Meadow • Windy Hill Loop',
    accent: '#38bdf8',
  },
  'cosmic-blackhole': {
    title: 'Vũ trụ Hố đen & Mặt trời siêu thực',
    subtitle: "Cosmic Singularity • Gravity's Edge Loop",
    accent: '#c084fc',
  },
  'misty-forest': {
    title: 'Không gian Núi rừng',
    subtitle: 'Misty Forest • Forest Loop',
    accent: '#4ade80',
  },
  'paradise-sanctuary': {
    title: 'Thiên đường',
    subtitle: 'Paradise Sanctuary • Heaven Horizon Loop',
    accent: '#fcd34d',
  },
  'ghibli-valley': {
    title: 'Thế giới Ghibli',
    subtitle: 'Ghibli Valley • Ghibli Hill Loop',
    accent: '#2dd4bf',
  },
  'vietnam-heritage': {
    title: 'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản',
    subtitle: '30 Địa Danh Bắc · Trung · Nam & Hải Đảo • Nhạc nền Việt Nam Loop',
    accent: '#f43f5e',
  },
};

const ATMOSPHERE_TIME_PRESETS: Array<{ id: string; label: string; hour: number; icon: string }> = [
  { id: 'dawn', label: 'Bình minh 6h', hour: 6, icon: '🌅' },
  { id: 'day', label: 'Ban ngày 13h', hour: 13, icon: '☀️' },
  { id: 'sunset', label: 'Hoàng hôn 17.5h', hour: 17.5, icon: '🌇' },
  { id: 'night', label: 'Đêm 22h', hour: 22, icon: '🌙' },
];

const ATMOSPHERE_WEATHER_PRESETS: Array<{ id: AtmosphereWeather; label: string; icon: string }> = [
  { id: 'clear', label: 'Trong xanh', icon: '✨' },
  { id: 'mist', label: 'Sương sớm', icon: '🌫️' },
  { id: 'rain', label: 'Mưa nhẹ', icon: '🌧️' },
  { id: 'fireflies', label: 'Đom đóm', icon: '🪲' },
];

function parseSpaceConfig(rawConfig: SpaceConfig | string | undefined): SpaceConfig | undefined {
  if (!rawConfig) return undefined;
  if (typeof rawConfig === 'string') {
    try {
      return JSON.parse(rawConfig) as SpaceConfig;
    } catch {
      return undefined;
    }
  }
  return rawConfig;
}

export const SpaceViewer: React.FC<SpaceViewerProps> = ({
  slug,
  initialSpaceEntity = null,
  onNavigate,
}) => {
  const viewerRootRef = useRef<HTMLDivElement | null>(null);
  const wasNativeFullscreenRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SpaceEngine | null>(null);
  const cameraCtrlRef = useRef<CameraController | null>(null);
  const audioMgrRef = useRef<AudioManager | null>(null);

  const { user, logout } = useAuth();

  const normalizedSlug = (slug || '').trim().toLowerCase();
  const isBuiltIn = KNOWN_BUILT_IN_SLUGS.has(normalizedSlug);

  const matchingInitial =
    initialSpaceEntity && initialSpaceEntity.slug.toLowerCase() === normalizedSlug
      ? {
          ...initialSpaceEntity,
          config: parseSpaceConfig(initialSpaceEntity.config) ?? initialSpaceEntity.config,
        }
      : null;

  const [resolvedSpaceEntity, setResolvedSpaceEntity] = useState<SpaceEntity | null>(matchingInitial);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [checkingSlug, setCheckingSlug] = useState<boolean>(!isBuiltIn && !matchingInitial);
  const [activeSlug, setActiveSlug] = useState<string>(() => normalizeBuiltInSlug(normalizedSlug));
  const [activeSpace, setActiveSpace] = useState<ISpace | null>(null);
  const [customSpaceMeta, setCustomSpaceMeta] = useState<{
    title: string;
    subtitle: string;
    accent: string;
  } | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('first_person');
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [isDraggingView, setIsDraggingView] = useState<boolean>(false);
  const [isAutoPan360, setIsAutoPan360] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.7);
  const [audioSuspended, setAudioSuspended] = useState<boolean>(false);
  const [activePois, setActivePois] = useState<IPointOfInterest[]>([]);
  const [showLandmarkPopover, setShowLandmarkPopover] = useState<boolean>(false);
  const [selectedPoiIndex, setSelectedPoiIndex] = useState<number | null>(null);
  const [isCinematicTour, setIsCinematicTour] = useState<boolean>(false);
  const [showAtmospherePopover, setShowAtmospherePopover] = useState<boolean>(false);
  const [atmosphereTime, setAtmosphereTime] = useState<number>(13);
  const [atmosphereWeather, setAtmosphereWeather] = useState<AtmosphereWeather>('clear');
  const cinematicActivatedWanderRef = useRef<boolean>(false);
  const [isFullView, setIsFullView] = useState<boolean>(false);
  const [showCreatorPanel, setShowCreatorPanel] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Synchronize Full View state with native browser Fullscreen & F / Esc hotkeys (YouTube-style)
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasNativeFullscreenRef.current = true;
      } else if (wasNativeFullscreenRef.current) {
        wasNativeFullscreenRef.current = false;
        setIsFullView(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);

      if (e.key === 'Escape') {
        setIsFullView((prev) => {
          if (prev) {
            if (document.fullscreenElement) {
              void document.exitFullscreen?.().catch(() => {});
            }
            return false;
          }
          return prev;
        });
        return;
      }

      if (
        !isEditing &&
        !showAuthModal &&
        !showCreatorPanel &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'f' || e.key === 'F')
      ) {
        e.preventDefault();
        setIsFullView((prev) => {
          const next = !prev;
          if (next) {
            setShowLandmarkPopover(false);
            setShowAtmospherePopover(false);
            if (!document.fullscreenElement) {
              void viewerRootRef.current?.requestFullscreen?.().catch(() => {});
            }
          } else if (document.fullscreenElement) {
            void document.exitFullscreen?.().catch(() => {});
          }
          return next;
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAuthModal, showCreatorPanel]);

  // Resolve DB space entity for custom/non-built-in slugs before mounting WebGL
  useEffect(() => {
    if (
      initialSpaceEntity &&
      initialSpaceEntity.slug.toLowerCase() === normalizedSlug
    ) {
      const parsedCfg = parseSpaceConfig(initialSpaceEntity.config) ?? initialSpaceEntity.config;
      setResolvedSpaceEntity({ ...initialSpaceEntity, config: parsedCfg });
      setNotFound(false);
      setCheckingSlug(false);
      return;
    }

    if (isBuiltIn) {
      setResolvedSpaceEntity(null);
      setNotFound(false);
      setCheckingSlug(false);
      return;
    }

    let cancelled = false;
    setCheckingSlug(true);
    fetch(`/api/spaces/${encodeURIComponent(normalizedSlug)}`, { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.space) {
          const parsedCfg = parseSpaceConfig(data.space.config) ?? data.space.config;
          setResolvedSpaceEntity({ ...data.space, config: parsedCfg });
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setCheckingSlug(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSlug, isBuiltIn, initialSpaceEntity]);

  // Mount WebGL SpaceEngine, CameraController, and AudioManager
  useEffect(() => {
    if (checkingSlug || notFound) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let engine: SpaceEngine | null = null;
    let cameraController: CameraController | null = null;
    let audioManager: AudioManager | null = null;

    const targetConfig = parseSpaceConfig(resolvedSpaceEntity?.config);

    const mountWithSpace = (initialSpace: ISpace) => {
      if (disposed) return;

      audioManager = new AudioManager();
      engine = new SpaceEngine(container, { audioManager });
      cameraController = new CameraController(engine.getCamera(), engine.getRenderer().domElement, {
        initialMode: 'first_person',
      });

      engine.cameraController = cameraController;
      engine.audioManager = audioManager;

      engineRef.current = engine;
      cameraCtrlRef.current = cameraController;
      audioMgrRef.current = audioManager;

      setAudioSuspended(audioManager.isSuspended());

      cameraController.onModeChange = (nextMode) => {
        if (!disposed) setCameraMode(nextMode);
      };

      cameraController.onLockChange = (locked) => {
        if (!disposed) setIsPointerLocked(locked);
      };

      cameraController.onDragChange = (dragging) => {
        if (!disposed) setIsDraggingView(dragging);
      };

      cameraController.onAutoPanChange = (active) => {
        if (!disposed) setIsAutoPan360(active);
      };

      cameraController.onCinematicModeChange = (active) => {
        if (!disposed) {
          setIsCinematicTour(active);
          engine?.setCinematicLetterbox(active ? 1.0 : 0.0);
        }
      };

      audioManager.onStateChange = () => {
        if (!disposed && audioManager) {
          setIsMuted(audioManager.isMuted());
          setIsLooping(audioManager.isLooping);
          setVolume(audioManager.getVolume());
          setAudioSuspended(audioManager.isSuspended());
        }
      };

      engine.onSpaceSwitched = (nextSlug, nextSpace) => {
        if (!disposed && cameraController && audioManager) {
          cameraController.setAutoPan360(false);
          cameraController.setCinematicMode(false);
          cameraController.getFPVController().setElevatedPerch(null);
          engine?.setCinematicLetterbox(0.0);
          cinematicActivatedWanderRef.current = false;
          setIsCinematicTour(false);
          setShowAtmospherePopover(false);
          setAtmosphereTime(13);
          setAtmosphereWeather('clear');
          setActiveSlug(nextSlug);
          setActiveSpace(nextSpace);
          setActivePois(nextSpace.getPointsOfInterest());
          setSelectedPoiIndex(null);
          setShowLandmarkPopover(false);
          if (!SPACE_META[nextSlug]) {
            const nextCfg = (nextSpace as any).config as SpaceConfig | null;
            const fmtLabel = nextCfg?.assetFormat ? nextCfg.assetFormat.toUpperCase() : '3D';
            setCustomSpaceMeta({
              title: nextSpace.name,
              subtitle: `Custom ${fmtLabel} Space • WebGL2 ACES`,
              accent: fmtLabel === 'GLB' ? '#fbbf24' : '#60a5fa',
            });
          } else {
            setCustomSpaceMeta(null);
          }
          const cfg = (nextSpace as any).config as SpaceConfig | null;
          if (cfg?.audio?.defaultVolume !== undefined) {
            setVolume(cfg.audio.defaultVolume);
          }
          setAudioSuspended(audioManager.isSuspended());
        }
      };

      if (typeof window !== 'undefined') {
        const w = window as any;
        w.spaceEngine = engine;
        w.__spaceEngine = engine;
        w.__spaceEngineDisposed = false;
        w.cameraController = cameraController;
        w.__cameraController = cameraController;
        w.audioManager = audioManager;
        w.__audioManager = audioManager;
        w.__audioContext = audioManager.getAudioContext();
        w.__threeRenderer = engine.getRenderer();
        w.__threeCamera = engine.getCamera();
      }

      const activeEngine = engine;
      const activeAudio = audioManager;

      activeEngine.loadSpace(initialSpace, targetConfig).then(() => {
        if (disposed) return;
        setActiveSlug(initialSpace.slug);
        setActiveSpace(initialSpace);
        setActivePois(initialSpace.getPointsOfInterest());
        setSelectedPoiIndex(null);
        setShowLandmarkPopover(false);
        if (!SPACE_META[initialSpace.slug] && resolvedSpaceEntity) {
          const fmtLabel = targetConfig?.assetFormat ? targetConfig.assetFormat.toUpperCase() : '3D';
          setCustomSpaceMeta({
            title: resolvedSpaceEntity.name || initialSpace.name,
            subtitle: `Custom ${fmtLabel} Space • WebGL2 ACES`,
            accent: fmtLabel === 'GLB' ? '#fbbf24' : '#60a5fa',
          });
        } else {
          setCustomSpaceMeta(null);
        }
        activeEngine.start();

        const cfg = (initialSpace as any).config as SpaceConfig | null;
        if (cfg?.audio) {
          setVolume(cfg.audio.defaultVolume ?? 0.7);
          activeAudio.loadAndPlay(cfg.audio);
          setAudioSuspended(activeAudio.isSuspended());
        }

        if (isBuiltIn) {
          fetch(`/api/spaces/${encodeURIComponent(initialSpace.id)}`, { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (disposed || !data?.space?.config) return;
              const remoteConfig = parseSpaceConfig(data.space.config);
              if (!remoteConfig) return;
              if (activeEngine.getActiveSpace() === initialSpace) {
                (initialSpace as any).updateConfig(remoteConfig, true);
                if (remoteConfig?.audio?.defaultVolume !== undefined) {
                  activeAudio.setVolume(remoteConfig.audio.defaultVolume);
                  setVolume(remoteConfig.audio.defaultVolume);
                }
              }
            })
            .catch(() => {});
        }
      });
    };

    const fastSpace = SpaceEngine.createSpaceSyncIfFast(normalizedSlug, targetConfig);
    if (fastSpace) {
      mountWithSpace(fastSpace);
    } else {
      const spaceArg = resolvedSpaceEntity
        ? {
            id: resolvedSpaceEntity.id,
            slug: resolvedSpaceEntity.slug,
            name: resolvedSpaceEntity.name,
            config: targetConfig,
          }
        : normalizedSlug;
      SpaceEngine.createSpaceForConfig(spaceArg, targetConfig).then((initialSpace) => {
        mountWithSpace(initialSpace);
      });
    }

    return () => {
      disposed = true;
      cameraController?.dispose();
      audioManager?.dispose();
      engine?.dispose();
      engineRef.current = null;
      cameraCtrlRef.current = null;
      audioMgrRef.current = null;
      setIsPointerLocked(false);
      setIsDraggingView(false);
      setIsAutoPan360(false);
      setIsCinematicTour(false);
      setShowAtmospherePopover(false);
    };
  }, [checkingSlug, notFound, normalizedSlug, isBuiltIn, resolvedSpaceEntity]);

  if (notFound) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #020617 100%)',
          color: '#f8fafc',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.65rem', color: '#fbbf24' }}>
            404 — Space Not Found (Không tìm thấy không gian)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            The surreal space slug <code>{slug}</code> does not exist in the gallery.
          </p>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#0f172a',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Home / Quay lại
          </a>
        </div>
      </div>
    );
  }

  const handleToggleMode = () => {
    const ctrl = cameraCtrlRef.current;
    if (!ctrl) return;
    audioMgrRef.current?.resume();
    ctrl.getFPVController().setElevatedPerch(null);
    const nextMode: CameraMode = ctrl.mode === 'first_person' ? 'auto_wander' : 'first_person';
    ctrl.setMode(nextMode, 2.0);
    setCameraMode(nextMode);
  };

  const handleToggleAutoPan = () => {
    const ctrl = cameraCtrlRef.current;
    if (!ctrl) return;
    audioMgrRef.current?.resume();
    const next = ctrl.toggleAutoPan360();
    setIsAutoPan360(next);
  };

  const handleTogglePointerLock = () => {
    const ctrl = cameraCtrlRef.current;
    if (!ctrl) return;
    audioMgrRef.current?.resume();
    if (ctrl.isPointerLocked()) {
      ctrl.unlockPointer();
    } else {
      ctrl.lockPointer();
    }
  };

  const handleToggleMute = () => {
    const mgr = audioMgrRef.current;
    if (!mgr) return;
    mgr.resume();
    const nextMuted = !mgr.isMuted();
    mgr.setMute(nextMuted);
    setIsMuted(nextMuted);
    setAudioSuspended(mgr.isSuspended());
  };

  const handleToggleLoop = () => {
    const mgr = audioMgrRef.current;
    if (!mgr) return;
    mgr.resume();
    const nextLoop = !mgr.isLooping;
    mgr.setLoop(nextLoop);
    setIsLooping(nextLoop);
    setAudioSuspended(mgr.isSuspended());
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const mgr = audioMgrRef.current;
    if (mgr) {
      mgr.resume();
      mgr.setVolume(val);
      setAudioSuspended(mgr.isSuspended());
    }
  };

  const handleSwitchSpace = (targetSlug: string) => {
    const engine = engineRef.current;
    audioMgrRef.current?.resume();
    if (engine) {
      engine.switchSpace(targetSlug);
    } else {
      onNavigate(`/space/${targetSlug}`);
    }
  };

  const handleToggleCinematicTour = () => {
    const ctrl = cameraCtrlRef.current;
    const engine = engineRef.current;
    if (!ctrl) return;
    audioMgrRef.current?.resume();

    if (!isCinematicTour) {
      ctrl.getFPVController().setElevatedPerch(null);
      cinematicActivatedWanderRef.current = ctrl.mode !== 'auto_wander';
      ctrl.setCinematicMode(true);
      if (ctrl.mode !== 'auto_wander') {
        ctrl.setMode('auto_wander', 2.0);
        setCameraMode('auto_wander');
      }
      engine?.setCinematicLetterbox(1.0);
      setIsCinematicTour(true);
    } else {
      ctrl.setCinematicMode(false);
      engine?.setCinematicLetterbox(0.0);
      if (cinematicActivatedWanderRef.current && ctrl.mode === 'auto_wander') {
        ctrl.setMode('first_person', 1.5);
        setCameraMode('first_person');
      }
      cinematicActivatedWanderRef.current = false;
      setIsCinematicTour(false);
    }
  };

  const handleSelectTimePreset = (hour: number) => {
    audioMgrRef.current?.resume();
    setAtmosphereTime(hour);
    engineRef.current?.setAtmosphereState({ timeOfDay: hour, weather: atmosphereWeather });
  };

  const handleSelectWeatherPreset = (nextWeather: AtmosphereWeather) => {
    audioMgrRef.current?.resume();
    setAtmosphereWeather(nextWeather);
    engineRef.current?.setAtmosphereState({ timeOfDay: atmosphereTime, weather: nextWeather });
  };

  const handleToggleFullView = () => {
    audioMgrRef.current?.resume();
    setIsFullView((prev) => {
      const next = !prev;
      if (next) {
        setShowLandmarkPopover(false);
        setShowAtmospherePopover(false);
        setShowCreatorPanel(false);
        setShowAuthModal(false);
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
          void viewerRootRef.current?.requestFullscreen?.().catch(() => {});
        }
      } else if (typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  };

  const handleSelectLandmark = (poi: IPointOfInterest, index: number) => {
    const mgr = audioMgrRef.current;
    mgr?.resume();

    const engine = engineRef.current;
    const cameraCtrl = cameraCtrlRef.current;
    if (!engine || !cameraCtrl) return;

    if (cameraCtrl.mode === 'auto_wander') {
      cameraCtrl.setMode('first_person', 0);
      setCameraMode('first_person');
    } else {
      cameraCtrl.getTransitionCoordinator().cancel();
    }

    const cam = engine.getCamera();
    cam.position.copy(poi.position);
    cam.lookAt(poi.lookAt ?? new THREE.Vector3(0, poi.position.y, 0));
    cameraCtrl.getFPVController().syncFromCamera();
    cameraCtrl.getFPVController().setElevatedPerch(poi.position.y);
    cameraCtrl.getWanderController().syncFromCamera();

    setSelectedPoiIndex(index);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowLandmarkPopover(false);
    }
  };

  const poiSections: Array<{
    region: string | null;
    items: Array<{ poi: IPointOfInterest; index: number }>;
  }> = [];
  if (activePois.some((p) => Boolean(p.region))) {
    const byRegion = new Map<string, Array<{ poi: IPointOfInterest; index: number }>>();
    activePois.forEach((poi, index) => {
      const regionKey = poi.region || 'Địa danh khác';
      let bucket = byRegion.get(regionKey);
      if (!bucket) {
        bucket = [];
        byRegion.set(regionKey, bucket);
        poiSections.push({ region: regionKey, items: bucket });
      }
      bucket.push({ poi, index });
    });
  } else if (activePois.length > 0) {
    poiSections.push({
      region: null,
      items: activePois.map((poi, index) => ({ poi, index })),
    });
  }

  const currentMeta =
    SPACE_META[activeSlug] ??
    customSpaceMeta ?? {
      title: activeSpace?.name || slug,
      subtitle: 'Custom 3D Space • WebGL2 ACES',
      accent: '#60a5fa',
    };

  const spaceTabs = [
    { slug: 'starry-night', label: 'Starry Night', testId: 'switch-space-starry-night', color: '#fbbf24' },
    { slug: 'breezy-meadow', label: 'Meadow Hill', testId: 'switch-space-meadow', color: '#38bdf8' },
    { slug: 'cosmic-blackhole', label: 'Hố đen & Mặt trời', testId: 'switch-space-cosmic-blackhole', color: '#c084fc' },
    { slug: 'misty-forest', label: 'Núi rừng', testId: 'switch-space-misty-forest', color: '#4ade80' },
    { slug: 'paradise-sanctuary', label: 'Thiên đường', testId: 'switch-space-paradise', color: '#fcd34d' },
    { slug: 'ghibli-valley', label: 'Ghibli', testId: 'switch-space-ghibli', color: '#2dd4bf' },
    { slug: 'vietnam-heritage', label: 'Việt Nam', testId: 'switch-space-vietnam', color: '#f43f5e' },
  ];

  return (
    <div
      ref={viewerRootRef}
      data-full-view={isFullView ? 'true' : 'false'}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#040711',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
      onClick={() => {
        audioMgrRef.current?.resume();
        if (audioMgrRef.current) setAudioSuspended(audioMgrRef.current.isSuspended());
      }}
    >
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={containerRef}
        onDoubleClick={handleToggleFullView}
        onDragStart={(e) => e.preventDefault()}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: isPointerLocked ? 'crosshair' : isDraggingView ? 'grabbing' : 'grab',
        }}
      />

      {/* Viewer HUD Overlay (hidden cleanly in YouTube-style Full View) */}
      {!isFullView && (
        <div
          data-testid="viewer-hud-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.15rem 1.4rem',
            zIndex: 20,
          }}
        >
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Exit + Space Title + 4-Space Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              pointerEvents: 'auto',
              background: 'rgba(10, 15, 29, 0.72)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              padding: '0.5rem 0.85rem',
              borderRadius: '14px',
              color: '#f8fafc',
            }}
          >
            <a
              href="/"
              data-testid="back-button"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              style={{
                color: '#cbd5e1',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 500,
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              ← Exit
            </a>

            <div style={{ paddingRight: '0.4rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                {currentMeta.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {currentMeta.subtitle}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {spaceTabs.map((tab) => {
                const isActive = activeSlug === tab.slug;
                return (
                  <button
                    key={tab.slug}
                    type="button"
                    data-testid={tab.testId}
                    onClick={() => handleSwitchSpace(tab.slug)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      border: isActive ? `1px solid ${tab.color}` : '1px solid transparent',
                      background: isActive ? `${tab.color}30` : 'rgba(255, 255, 255, 0.06)',
                      color: isActive ? '#f8fafc' : '#cbd5e1',
                      fontSize: '0.78rem',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Creator Panel Trigger & User Session */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              pointerEvents: 'auto',
            }}
          >
            {audioSuspended && (
              <button
                type="button"
                onClick={() => {
                  audioMgrRef.current?.resume();
                  setAudioSuspended(false);
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.6)',
                  background: 'rgba(10, 15, 29, 0.86)',
                  backdropFilter: 'blur(12px)',
                  color: '#bae6fd',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                }}
              >
                🔊 Bật âm thanh & nhạc học tập
              </button>
            )}

            {user?.role === 'creator' && (
              <button
                type="button"
                data-testid="creator-panel-btn"
                onClick={() => setShowCreatorPanel((prev) => !prev)}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(251, 191, 36, 0.45)',
                  background: showCreatorPanel
                    ? 'rgba(251, 191, 36, 0.25)'
                    : 'rgba(10, 15, 29, 0.78)',
                  backdropFilter: 'blur(12px)',
                  color: '#fde68a',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Creator Settings
              </button>
            )}

            {user ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(10, 15, 29, 0.72)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                }}
              >
                <span>{user.username}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '6px',
                    background:
                      user.role === 'creator'
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(56, 189, 248, 0.2)',
                    color: user.role === 'creator' ? '#fde68a' : '#bae6fd',
                  }}
                >
                  {user.role}
                </span>
                <button
                  type="button"
                  data-testid="logout-btn"
                  onClick={() => logout()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#cbd5e1',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="login-btn"
                onClick={() => setShowAuthModal(true)}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(10, 15, 29, 0.72)',
                  backdropFilter: 'blur(12px)',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Log in
              </button>
            )}
          </div>
        </div>

        {/* Bottom Bar: Camera Mode HUD, Subtle Hint & Audio Loop Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Bottom-Left: Camera Mode Indicator, 360° Look & Pointer Lock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              pointerEvents: 'auto',
              background: 'rgba(10, 15, 29, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              padding: '0.55rem 0.85rem',
              borderRadius: '14px',
              color: '#f8fafc',
            }}
          >
            <div>
              <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                Navigation Mode
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                {cameraMode === 'auto_wander' ? 'Auto Wander' : 'First Person View'}
              </div>
            </div>

            <button
              type="button"
              id="mode-toggle"
              data-testid="mode-toggle"
              onClick={handleToggleMode}
              style={{
                padding: '0.42rem 0.78rem',
                borderRadius: '10px',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                background:
                  cameraMode === 'auto_wander'
                    ? 'rgba(251, 191, 36, 0.24)'
                    : 'rgba(255, 255, 255, 0.08)',
                color: cameraMode === 'auto_wander' ? '#fde68a' : '#f8fafc',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cameraMode === 'auto_wander' ? 'Auto Wander: ON' : 'Auto Wander'}
            </button>

            <button
              type="button"
              data-testid="cinematic-tour-btn"
              onClick={handleToggleCinematicTour}
              title="Cinematic Tour: du ngoạn mượt quanh các địa danh với khung hình điện ảnh 2.39:1"
              style={{
                padding: '0.42rem 0.78rem',
                borderRadius: '10px',
                border: isCinematicTour
                  ? '1px solid rgba(244, 63, 94, 0.7)'
                  : '1px solid rgba(148, 163, 184, 0.25)',
                background: isCinematicTour
                  ? 'rgba(244, 63, 94, 0.24)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: isCinematicTour ? '#fecdd3' : '#e2e8f0',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isCinematicTour ? '🎬 Cinematic Tour: ON' : '🎬 Cinematic Tour'}
            </button>

            <button
              type="button"
              data-testid="look-360-btn"
              onClick={handleToggleAutoPan}
              title="Tự động xoay nhìn toàn cảnh 360° (hoặc kéo chuột / nhấn Q-E)"
              style={{
                padding: '0.42rem 0.72rem',
                borderRadius: '10px',
                border: isAutoPan360
                  ? '1px solid rgba(56, 189, 248, 0.65)'
                  : '1px solid rgba(148, 163, 184, 0.25)',
                background: isAutoPan360
                  ? 'rgba(56, 189, 248, 0.22)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: isAutoPan360 ? '#bae6fd' : '#e2e8f0',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isAutoPan360 ? '🧭 360° Look: ON' : '🧭 360° Look'}
            </button>

            <button
              type="button"
              data-testid="pointer-lock-btn"
              onClick={handleTogglePointerLock}
              title="Khóa chuột để xoay tự do 360° không chạm mép màn hình (ESC để thoát)"
              style={{
                padding: '0.42rem 0.72rem',
                borderRadius: '10px',
                border: isPointerLocked
                  ? '1px solid rgba(74, 222, 128, 0.6)'
                  : '1px solid rgba(148, 163, 184, 0.25)',
                background: isPointerLocked
                  ? 'rgba(74, 222, 128, 0.2)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: isPointerLocked ? '#bbf7d0' : '#cbd5e1',
                fontSize: '0.76rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isPointerLocked ? '🔓 Đang khóa 360° (ESC)' : '🔒 Khóa chuột 360°'}
            </button>
          </div>

          {/* Bottom-Center Subtle Hint */}
          <div
            style={{
              fontSize: '0.73rem',
              color: 'rgba(226, 232, 240, 0.85)',
              background: 'rgba(10, 15, 29, 0.5)',
              backdropFilter: 'blur(8px)',
              padding: '0.4rem 0.85rem',
              borderRadius: '999px',
              border: '1px solid rgba(148, 163, 184, 0.16)',
            }}
          >
            {isPointerLocked
              ? 'Đã khóa chuột 360° • Di chuyển chuột tự do • Nhấn ESC để thoát'
              : cameraMode === 'auto_wander'
                ? 'Kéo chuột để nhìn 360° • Q/E xoay trái/phải • Đang tự động du ngoạn • F: Full View'
                : 'Kéo chuột để xoay 360° • WASD để đi • Q/E xoay trái/phải • F: Full View'}
          </div>

          {/* Bottom-Right: Audio Loop, Landmarks & Full View Controls */}
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            {showLandmarkPopover && activePois.length >= 4 && (
              <div
                data-testid="landmark-library-popover"
                style={{
                  position: 'absolute',
                  bottom: '3.6rem',
                  right: 0,
                  width: '340px',
                  maxHeight: '64vh',
                  overflowY: 'auto',
                  background: 'rgba(10, 15, 29, 0.94)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '16px',
                  padding: '0.95rem',
                  color: '#f8fafc',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                  fontSize: '0.8rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.7rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#fda4af', fontSize: '0.86rem' }}>
                    📍 Danh thắng &amp; Địa danh ({activePois.length})
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng danh sách địa danh"
                    onClick={() => setShowLandmarkPopover(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {poiSections.map((section) => (
                    <div key={section.region ?? 'all-pois'}>
                      {section.region && (
                        <div
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: '#94a3b8',
                            marginBottom: '0.35rem',
                          }}
                        >
                          {section.region} ({section.items.length})
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {section.items.map(({ poi, index }) => {
                          const isSelected = selectedPoiIndex === index;
                          return (
                            <button
                              key={`${index}-${poi.name}`}
                              type="button"
                              data-testid={`landmark-poi-${index}`}
                              onClick={() => handleSelectLandmark(poi, index)}
                              style={{
                                textAlign: 'left',
                                width: '100%',
                                padding: '0.5rem 0.65rem',
                                borderRadius: '10px',
                                border: isSelected
                                  ? `1px solid ${currentMeta.accent}`
                                  : '1px solid rgba(148, 163, 184, 0.16)',
                                background: isSelected
                                  ? 'rgba(244, 63, 94, 0.18)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                color: '#f8fafc',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease, border-color 0.15s ease',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: '0.8rem',
                                  color: isSelected ? '#fda4af' : '#f8fafc',
                                }}
                              >
                                <span>
                                  {index + 1}. {poi.name}
                                </span>
                                <span style={{ fontSize: '0.67rem', color: '#94a3b8', flexShrink: 0 }}>
                                  Di chuyển →
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showAtmospherePopover && (
              <div
                data-testid="atmosphere-popover"
                style={{
                  position: 'absolute',
                  bottom: '3.6rem',
                  right: 0,
                  width: '296px',
                  background: 'rgba(10, 15, 29, 0.94)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '16px',
                  padding: '0.9rem',
                  color: '#f8fafc',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                  fontSize: '0.78rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.65rem',
                    paddingBottom: '0.45rem',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#bae6fd', fontSize: '0.84rem' }}>
                    🌤️ Thời gian &amp; Thời tiết
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng bảng không khí"
                    onClick={() => setShowAtmospherePopover(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#94a3b8',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Thời gian
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    {ATMOSPHERE_TIME_PRESETS.map((preset) => {
                      const active = Math.abs(atmosphereTime - preset.hour) < 0.1;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          data-testid={`atmosphere-time-${preset.id}`}
                          onClick={() => handleSelectTimePreset(preset.hour)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.42rem 0.55rem',
                            borderRadius: '9px',
                            border: active
                              ? '1px solid rgba(251, 191, 36, 0.65)'
                              : '1px solid rgba(148, 163, 184, 0.18)',
                            background: active
                              ? 'rgba(251, 191, 36, 0.2)'
                              : 'rgba(255, 255, 255, 0.04)',
                            color: active ? '#fde68a' : '#e2e8f0',
                            fontSize: '0.74rem',
                            fontWeight: active ? 600 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#94a3b8',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Thời tiết
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    {ATMOSPHERE_WEATHER_PRESETS.map((preset) => {
                      const active = atmosphereWeather === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          data-testid={`atmosphere-weather-${preset.id}`}
                          onClick={() => handleSelectWeatherPreset(preset.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.42rem 0.55rem',
                            borderRadius: '9px',
                            border: active
                              ? '1px solid rgba(56, 189, 248, 0.65)'
                              : '1px solid rgba(148, 163, 184, 0.18)',
                            background: active
                              ? 'rgba(56, 189, 248, 0.2)'
                              : 'rgba(255, 255, 255, 0.04)',
                            color: active ? '#bae6fd' : '#e2e8f0',
                            fontSize: '0.74rem',
                            fontWeight: active ? 600 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'rgba(10, 15, 29, 0.75)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                padding: '0.6rem 0.9rem',
                borderRadius: '14px',
                color: '#f8fafc',
              }}
            >
              <button
                type="button"
                id="mute-btn"
                data-testid="mute-btn"
                onClick={handleToggleMute}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: isMuted ? '#fca5a5' : '#f8fafc',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <label htmlFor="volume-slider" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Vol
                </label>
                <input
                  id="volume-slider"
                  name="volume"
                  data-testid="volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{ width: '85px', cursor: 'pointer' }}
                />
              </div>

              <button
                type="button"
                data-testid="loop-btn"
                onClick={handleToggleLoop}
                title="Bật/tắt phát lặp vô tận (Loop nhạc nền)"
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  border: isLooping
                    ? '1px solid rgba(74, 222, 128, 0.55)'
                    : '1px solid rgba(148, 163, 184, 0.25)',
                  background: isLooping
                    ? 'rgba(74, 222, 128, 0.18)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isLooping ? '#bbf7d0' : '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {isLooping ? '🔁 Loop: ON' : '🔁 Loop: OFF'}
              </button>

              <button
                type="button"
                data-testid="atmosphere-btn"
                onClick={() => {
                  audioMgrRef.current?.resume();
                  setShowLandmarkPopover(false);
                  setShowAtmospherePopover((prev) => !prev);
                }}
                title="Chọn thời gian & thời tiết (Bình minh / Ban ngày / Hoàng hôn / Đêm)"
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  border:
                    showAtmospherePopover || atmosphereTime !== 13 || atmosphereWeather !== 'clear'
                      ? '1px solid rgba(56, 189, 248, 0.6)'
                      : '1px solid rgba(148, 163, 184, 0.2)',
                  background:
                    showAtmospherePopover || atmosphereTime !== 13 || atmosphereWeather !== 'clear'
                      ? 'rgba(56, 189, 248, 0.18)'
                      : 'rgba(255, 255, 255, 0.06)',
                  color:
                    showAtmospherePopover || atmosphereTime !== 13 || atmosphereWeather !== 'clear'
                      ? '#bae6fd'
                      : '#e2e8f0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                🌤️ Không khí
              </button>

              {activePois.length >= 4 && (
                <button
                  type="button"
                  data-testid="landmark-picker-btn"
                  onClick={() => {
                    setShowAtmospherePopover(false);
                    setShowLandmarkPopover((prev) => !prev);
                  }}
                  title="Chọn địa danh tham quan ngay"
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    border:
                      showLandmarkPopover || selectedPoiIndex !== null
                        ? `1px solid ${currentMeta.accent}`
                        : '1px solid rgba(148,163,184,0.2)',
                    background:
                      showLandmarkPopover || selectedPoiIndex !== null
                        ? 'rgba(244, 63, 94, 0.18)'
                        : 'rgba(255,255,255,0.06)',
                    color: selectedPoiIndex !== null ? '#fda4af' : '#e2e8f0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {activePois.length >= 30 ? `📍 ${activePois.length} Địa Danh` : '📍 Địa danh'}
                </button>
              )}

              <button
                type="button"
                data-testid="full-view-btn"
                onClick={handleToggleFullView}
                title="Xem toàn màn hình kiểu YouTube không chữ & nút đè lên (Phím F hoặc nhấp đúp chuột, Esc để thoát)"
                aria-label="Full View (YouTube clean fullscreen mode)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
                <span>Full View</span>
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Creator Live Control Panel */}
      {!isFullView && user?.role === 'creator' && showCreatorPanel && (
        <Suspense fallback={null}>
          <CreatorControlPanel
            space={activeSpace}
            audioManager={audioMgrRef.current}
            onClose={() => setShowCreatorPanel(false)}
            onSpaceCreated={(createdSpace) => {
              setShowCreatorPanel(false);
              const engine = engineRef.current;
              if (engine) {
                const parsedCfg = parseSpaceConfig(createdSpace.config) ?? createdSpace.config;
                engine.switchSpace(
                  { id: createdSpace.id, slug: createdSpace.slug, name: createdSpace.name, config: parsedCfg },
                  parsedCfg
                );
              } else {
                onNavigate(`/space/${createdSpace.slug}`, createdSpace);
              }
            }}
          />
        </Suspense>
      )}

      {/* Auth Modal */}
      {!isFullView && showAuthModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

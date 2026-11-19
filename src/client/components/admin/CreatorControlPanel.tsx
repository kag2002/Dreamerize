import React, { useState, useEffect } from 'react';
import { SpaceAssetFormat, SpaceConfig, SpaceEntity } from '../../../shared/types/space';
import { ISpace } from '../../scene/ISpace';
import { AudioManager } from '../../scene/audio/AudioManager';
import {
  detectGraphicsCapabilities,
  GraphicsCapabilities,
} from '../../scene/capabilities/WebGPUCapability';

export function slugifySpaceName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 38);
  const suffix = Math.random().toString(36).slice(2, 6);
  const candidate = base.length >= 2 ? `${base}-${suffix}` : `space-${suffix}`;
  return candidate.slice(0, 50);
}

export function inferAssetFormat(filenameOrUrl: string): Exclude<SpaceAssetFormat, 'procedural'> | null {
  const clean = filenameOrUrl.split('?')[0].split('#')[0].trim().toLowerCase();
  if (clean.endsWith('.splat')) return 'splat';
  if (clean.endsWith('.ply')) return 'ply';
  if (clean.endsWith('.glb') || clean.endsWith('.gltf')) return 'glb';
  return null;
}

export function buildCustomAssetSpaceConfig(
  assetUrl: string,
  assetFormat: Exclude<SpaceAssetFormat, 'procedural'>
): SpaceConfig {
  const isGlb = assetFormat === 'glb';
  return {
    fog: {
      type: 'exp2',
      color: isGlb ? '#dce8f2' : '#bde0fe',
      density: isGlb ? 0.0045 : 0.0022,
    },
    sky: {
      type: 'custom_asset',
      topColor: isGlb ? '#3468c8' : '#1d4ed8',
      bottomColor: isGlb ? '#97c7f5' : '#60a5fa',
      horizonColor: isGlb ? '#f2e8d8' : '#dbeafe',
      swirlSpeed: 0.0,
      starDensity: 0,
      cloudCoverage: 0.4,
      cloudSpeed: 0.45,
    },
    wind: {
      speed: 1.4,
      direction: [0.85, 0.0, 0.45],
      gustiness: 0.3,
      swayIntensity: 0.35,
    },
    lighting: {
      ambient: { color: '#f8fafc', intensity: 0.78 },
      directional: {
        color: '#fff4dc',
        intensity: isGlb ? 1.85 : 1.35,
        position: [24, 38, 22],
        castShadow: false,
      },
      pointLights: [],
    },
    shaders: {},
    audio: {
      trackId: isGlb ? 'glb-sanctuary-ambient' : '3dgs-coastal-ambient',
      name: isGlb ? 'Garden Stone Sanctuary & Wind Chimes' : 'Coastal Sanctuary Piano & Gentle Breeze',
      sourceUrl: '/audio/breezy-meadow-ambient.ogg',
      defaultVolume: 0.65,
      loop: true,
      ambientType: 'procedural_synth',
      reverb: { decay: 2.2, wet: 0.28 },
    },
    camera: {
      spawnPosition: [0, 1.7, isGlb ? 7 : 10],
      lookAt: [0, 1.3, 0],
      fov: 60,
      moveSpeed: 3.8,
      wanderSpeed: 1.1,
      wanderRadius: 24,
      wanderWaypoints: [
        [0, 2.0, 8],
        [6, 2.4, 2],
        [0, 2.2, -7],
        [-6, 2.4, 2],
      ],
      heightOffset: 1.7,
    },
    assetUrl,
    assetFormat,
  };
}

export const GraphicsBackendBadge: React.FC<{ capabilities: GraphicsCapabilities | null }> = ({
  capabilities,
}) => {
  if (!capabilities) return null;
  const rendererLabel = capabilities.webglRenderer
    ? capabilities.webglRenderer.replace(/ANGLE \(([^,]+), ([^,)]+).*\)/, '$2')
    : null;

  return (
    <div
      data-testid="graphics-backend-indicator"
      title={capabilities.webglRenderer || 'WebGL2 Runtime'}
      style={{
        padding: '0.5rem 0.7rem',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.72)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        fontSize: '0.72rem',
        color: '#cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.28rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
          {capabilities.webgl2Supported ? 'WebGL2 ACES' : 'WebGL'} • 3DGS / Draco / KTX2
        </span>
        {capabilities.webgpuSupported && (
          <span
            style={{
              padding: '0.12rem 0.42rem',
              borderRadius: '999px',
              background: 'rgba(74, 222, 128, 0.16)',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              color: '#86efac',
              fontSize: '0.66rem',
              fontWeight: 600,
            }}
          >
            WebGPU Adapter Ready
          </span>
        )}
      </div>
      {rendererLabel && (
        <div
          style={{
            fontSize: '0.66rem',
            color: '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          GPU: {rendererLabel}
        </div>
      )}
    </div>
  );
};

interface Import3DAssetFormProps {
  onSpaceCreated: (space: SpaceEntity) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export const Import3DAssetForm: React.FC<Import3DAssetFormProps> = ({
  onSpaceCreated,
  onCancel,
  compact = false,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetFormat, setAssetFormat] = useState<Exclude<SpaceAssetFormat, 'procedural'>>('splat');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!slugEdited) {
      setSlug(nextName.trim() ? slugifySpaceName(nextName) : '');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    if (file) {
      const inferred = inferAssetFormat(file.name);
      if (inferred) {
        setAssetFormat(inferred);
      } else {
        setError('Unsupported file format. Please choose a .splat, .ply, or .glb file.');
      }
      if (!name.trim()) {
        const cleanTitle = file.name.replace(/\.(splat|ply|glb|gltf)$/i, '').replace(/[-_]+/g, ' ');
        handleNameChange(cleanTitle);
      }
    }
  };

  const handleUrlChange = (nextUrl: string) => {
    setAssetUrl(nextUrl);
    if (nextUrl.trim()) {
      setSelectedFile(null);
      const inferred = inferAssetFormat(nextUrl);
      if (inferred) setAssetFormat(inferred);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a space name.');
      return;
    }

    const finalSlug = (slug.trim() || slugifySpaceName(trimmedName)).toLowerCase();
    if (!/^[a-z0-9-]{2,50}$/.test(finalSlug)) {
      setError('Slug must be 2–50 characters using only lowercase letters, numbers, and hyphens.');
      return;
    }

    if (!selectedFile && !assetUrl.trim()) {
      setError('Please upload a .splat/.ply/.glb file or enter an asset URL.');
      return;
    }

    setSubmitting(true);
    try {
      let resolvedUrl = assetUrl.trim();
      let resolvedFormat = assetFormat;

      if (selectedFile) {
        const inferred = inferAssetFormat(selectedFile.name);
        if (!inferred) {
          setError('Only .splat, .ply, and .glb files are supported.');
          setSubmitting(false);
          return;
        }
        const contentType =
          inferred === 'glb'
            ? 'model/gltf-binary'
            : inferred === 'ply'
              ? 'application/x-ply'
              : 'application/octet-stream';

        const uploadRes = await fetch(
          `/api/spaces/assets?filename=${encodeURIComponent(selectedFile.name)}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': contentType,
              'x-filename': selectedFile.name,
            },
            body: selectedFile,
          }
        );

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData?.assetUrl) {
          setError(uploadData?.message || `Asset upload failed (${uploadRes.status})`);
          setSubmitting(false);
          return;
        }

        resolvedUrl = uploadData.assetUrl;
        resolvedFormat = uploadData.assetFormat || inferred;
      } else {
        const inferred = inferAssetFormat(resolvedUrl);
        if (inferred) resolvedFormat = inferred;
      }

      const config = buildCustomAssetSpaceConfig(resolvedUrl, resolvedFormat);
      const createRes = await fetch('/api/spaces', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: finalSlug,
          name: trimmedName,
          description:
            description.trim() ||
            `Custom ${resolvedFormat.toUpperCase()} 3D space imported in Creator Studio.`,
          isPublished: true,
          config,
        }),
      });

      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createData?.space) {
        setError(createData?.message || `Failed to create space (${createRes.status})`);
        setSubmitting(false);
        return;
      }

      onSpaceCreated(createData.space as SpaceEntity);
    } catch {
      setError('Network error while importing 3D asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: compact ? '0.48rem 0.65rem' : '0.62rem 0.8rem',
    borderRadius: '9px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    fontSize: compact ? '0.8rem' : '0.88rem',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.65rem' : '0.9rem' }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.7rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.16)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '0.78rem',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
          Space Name
        </label>
        <input
          type="text"
          data-testid="import-space-name"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Mossy Stone Lantern Garden"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
            URL Slug
          </label>
          <input
            type="text"
            data-testid="import-space-slug"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            placeholder="mossy-lantern-garden"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
            Format
          </label>
          <select
            data-testid="import-asset-format"
            value={assetFormat}
            onChange={(e) => setAssetFormat(e.target.value as Exclude<SpaceAssetFormat, 'procedural'>)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            <option value="splat">.splat (3DGS)</option>
            <option value="ply">.ply (3DGS)</option>
            <option value="glb">.glb (PBR/Draco)</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
          Upload 3D File (.splat, .ply, .glb)
        </label>
        <input
          type="file"
          data-testid="asset-file-input"
          accept=".splat,.ply,.glb"
          onChange={handleFileChange}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: '0.76rem',
            color: '#cbd5e1',
          }}
        />
        {selectedFile && (
          <div style={{ fontSize: '0.72rem', color: '#86efac', marginTop: '0.2rem' }}>
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
            Or Paste Asset URL (/samples/... or https://...)
          </label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => handleUrlChange('/samples/coastal-garden.splat')}
              style={{
                padding: '0.15rem 0.4rem',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#bae6fd',
                fontSize: '0.68rem',
                cursor: 'pointer',
              }}
            >
              Sample .splat
            </button>
            <button
              type="button"
              onClick={() => handleUrlChange('/samples/stone-lantern.glb')}
              style={{
                padding: '0.15rem 0.4rem',
                borderRadius: '6px',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                background: 'rgba(251, 191, 36, 0.12)',
                color: '#fde68a',
                fontSize: '0.68rem',
                cursor: 'pointer',
              }}
            >
              Sample .glb
            </button>
          </div>
        </div>
        <input
          type="text"
          data-testid="asset-url-input"
          value={assetUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="/samples/stone-lantern.glb"
          style={inputStyle}
        />
      </div>

      {!compact && (
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Serene 3D sanctuary..."
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#cbd5e1',
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          data-testid="create-enter-asset-btn"
          disabled={submitting}
          style={{
            flex: 1,
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            color: '#020617',
            fontWeight: 700,
            fontSize: compact ? '0.82rem' : '0.9rem',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          {submitting ? 'Importing...' : 'Create & Enter 3D Space'}
        </button>
      </div>
    </form>
  );
};

interface CreatorControlPanelProps {
  space: ISpace | null;
  audioManager: AudioManager | null;
  onClose: () => void;
  onSpaceCreated?: (space: SpaceEntity) => void;
}

export const CreatorControlPanel: React.FC<CreatorControlPanelProps> = ({
  space,
  audioManager,
  onClose,
  onSpaceCreated,
}) => {
  const initialConfig = (space as any)?.config as SpaceConfig | null;

  const [swirlSpeed, setSwirlSpeed] = useState<number>(initialConfig?.sky?.swirlSpeed ?? 1.2);
  const [fogDensity, setFogDensity] = useState<number>(initialConfig?.fog?.density ?? 0.012);
  const [fogColor, setFogColor] = useState<string>(initialConfig?.fog?.color ?? '#070b19');
  const [windSpeed, setWindSpeed] = useState<number>(initialConfig?.wind?.speed ?? 1.5);
  const [swayIntensity, setSwayIntensity] = useState<number>(initialConfig?.wind?.swayIntensity ?? 0.4);
  const [defaultVolume, setDefaultVolume] = useState<number>(initialConfig?.audio?.defaultVolume ?? 0.7);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [showImportDrawer, setShowImportDrawer] = useState<boolean>(false);
  const [capabilities, setCapabilities] = useState<GraphicsCapabilities | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectGraphicsCapabilities()
      .then((caps) => {
        if (!cancelled) setCapabilities(caps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync state if space or its config updates externally (e.g. via window.currentSpace.updateConfig)
  useEffect(() => {
    const activeSpace = space || ((typeof window !== 'undefined' ? (window as any).currentSpace : null) as ISpace | null);
    if (!activeSpace) return;

    const syncFromSpace = (cfg: SpaceConfig) => {
      if (typeof cfg?.sky?.swirlSpeed === 'number') setSwirlSpeed(cfg.sky.swirlSpeed);
      if (typeof cfg?.fog?.density === 'number') setFogDensity(cfg.fog.density);
      if (typeof cfg?.fog?.color === 'string') setFogColor(cfg.fog.color);
      if (typeof cfg?.wind?.speed === 'number') setWindSpeed(cfg.wind.speed);
      if (typeof cfg?.wind?.swayIntensity === 'number') setSwayIntensity(cfg.wind.swayIntensity);
      if (typeof cfg?.audio?.defaultVolume === 'number') setDefaultVolume(cfg.audio.defaultVolume);
    };

    const currentCfg = (activeSpace as any).config as SpaceConfig | null;
    if (currentCfg) {
      syncFromSpace(currentCfg);
    }

    (activeSpace as any).onConfigUpdate = syncFromSpace;
    return () => {
      if ((activeSpace as any).onConfigUpdate === syncFromSpace) {
        (activeSpace as any).onConfigUpdate = undefined;
      }
    };
  }, [space]);

  const applyLiveUpdate = (partial: Partial<SpaceConfig>) => {
    const activeSpace = space || ((typeof window !== 'undefined' ? (window as any).currentSpace : null) as ISpace | null);
    if (activeSpace) {
      activeSpace.updateConfig(partial);
    }
    if (partial.audio?.defaultVolume !== undefined && audioManager) {
      audioManager.setVolume(partial.audio.defaultVolume);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const activeSpace = space || ((typeof window !== 'undefined' ? (window as any).currentSpace : null) as ISpace | null);
      const spaceId = activeSpace?.id || 'space-starry-night';
      const liveConfig: SpaceConfig = (activeSpace as any)?.config ?? {
        sky: { swirlSpeed, type: 'starry_night_flow', starDensity: 500, topColor: '#050a30', bottomColor: '#1f305e', horizonColor: '#2b580c' },
        fog: { density: fogDensity, color: fogColor, type: 'exp2' },
        wind: { speed: windSpeed, swayIntensity, direction: [0.8, 0.1, 0.5], gustiness: 0.35 },
        audio: { defaultVolume, trackId: 'starry-night-ambient', name: 'Ambient', sourceUrl: '/audio/starry-night-ambient.ogg', loop: true, ambientType: 'audio_buffer' },
      };

      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: liveConfig }),
      });

      if (res.ok) {
        setStatusMessage('Configuration saved!');
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMessage(err?.message || 'Save failed');
      }
    } catch {
      setStatusMessage('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      data-testid="creator-panel"
      style={{
        position: 'fixed',
        top: '4.5rem',
        right: '1.25rem',
        zIndex: 40,
        width: '320px',
        maxHeight: 'calc(100vh - 6rem)',
        overflowY: 'auto',
        background: 'rgba(10, 15, 29, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '16px',
        padding: '1.25rem',
        color: '#f8fafc',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fbbf24', fontWeight: 600 }}>
            Creator Studio
          </span>
          <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.05rem', fontWeight: 600 }}>
            Live Environment Tuning
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="swirl-speed-slider">Sky Swirl Flow Speed</label>
            <span style={{ color: '#fbbf24' }}>{swirlSpeed.toFixed(2)}</span>
          </div>
          <input
            id="swirl-speed-slider"
            type="range"
            min="0"
            max="4"
            step="0.05"
            value={swirlSpeed}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSwirlSpeed(val);
              applyLiveUpdate({ sky: { swirlSpeed: val } as any });
            }}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="fog-density-slider">Atmospheric Fog Density</label>
            <span style={{ color: '#fbbf24' }}>{fogDensity.toFixed(3)}</span>
          </div>
          <input
            id="fog-density-slider"
            type="range"
            min="0"
            max="0.06"
            step="0.001"
            value={fogDensity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setFogDensity(val);
              applyLiveUpdate({ fog: { density: val } as any });
            }}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="fog-color-input">Atmosphere Tint</label>
            <input
              id="fog-color-input"
              type="color"
              value={fogColor}
              onChange={(e) => {
                const val = e.target.value;
                setFogColor(val);
                applyLiveUpdate({ fog: { color: val } as any });
              }}
              style={{ width: '28px', height: '22px', border: 'none', background: 'none', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="wind-speed-slider">Wind Speed</label>
            <span style={{ color: '#fbbf24' }}>{windSpeed.toFixed(2)} m/s</span>
          </div>
          <input
            id="wind-speed-slider"
            type="range"
            min="0"
            max="6"
            step="0.1"
            value={windSpeed}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setWindSpeed(val);
              applyLiveUpdate({ wind: { speed: val } as any });
            }}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="sway-slider">Foliage Sway Intensity</label>
            <span style={{ color: '#fbbf24' }}>{swayIntensity.toFixed(2)}</span>
          </div>
          <input
            id="sway-slider"
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={swayIntensity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSwayIntensity(val);
              applyLiveUpdate({ wind: { swayIntensity: val } as any });
            }}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="creator-volume-slider">Default Ambient Volume</label>
            <span style={{ color: '#fbbf24' }}>{Math.round(defaultVolume * 100)}%</span>
          </div>
          <input
            id="creator-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={defaultVolume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDefaultVolume(val);
              applyLiveUpdate({ audio: { defaultVolume: val } as any });
            }}
            style={{ width: '100%' }}
          />
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(251, 191, 36, 0.14)',
              color: '#fde68a',
              fontSize: '0.8rem',
            }}
          >
            {statusMessage}
          </div>
        )}

        <button
          type="button"
          data-testid="save-config-btn"
          disabled={saving}
          onClick={handleSave}
          style={{
            marginTop: '0.35rem',
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#0f172a',
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.18)', paddingTop: '0.75rem', marginTop: '0.15rem' }}>
          <button
            type="button"
            data-testid="toggle-import-drawer-btn"
            onClick={() => setShowImportDrawer((prev) => !prev)}
            style={{
              width: '100%',
              padding: '0.52rem 0.75rem',
              borderRadius: '9px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: showImportDrawer ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.08)',
              color: '#bae6fd',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showImportDrawer ? '▲ Hide Import 3DGS / GLB' : '＋ Import 3DGS / GLB'}
          </button>

          {showImportDrawer && (
            <div style={{ marginTop: '0.75rem' }}>
              <Import3DAssetForm
                compact
                onSpaceCreated={(created) => {
                  setShowImportDrawer(false);
                  setStatusMessage(`Created "${created.name}"!`);
                  onSpaceCreated?.(created);
                }}
              />
            </div>
          )}
        </div>

        <GraphicsBackendBadge capabilities={capabilities} />
      </div>
    </aside>
  );
};

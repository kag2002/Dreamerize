import * as THREE from 'three';

/**
 * GLSL Shaders for "Đêm Hoa Đăng & Đèn Trời" (LanternNightScene)
 * - Pitch-black ink night sky dome with ultra-subtle distant horizon lantern glow
 * - Colorless ink-black mirror water with multi-scale wind ripples & golden lantern shimmer
 * - GPU-animated instanced Sky Lanterns (đèn trời / đèn lồng bay) with internal candle core glow
 * - GPU-mirrored Sky Lantern Water Reflections with ripple distortion & vertical elongation
 * - GPU-animated Floating Lotus Water Lanterns (đèn hoa đăng) with subsurface petal translucency
 * - Concentric expanding water ripple rings catching warm candlelight around each hoa đăng
 * - Drifting warm ember sparks rising through the dark night
 */

export function createLanternInkSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 },
      uHorizonGlow: { value: 0.24 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uHorizonGlow;
      varying vec3 vWorldDir;

      void main() {
        vec3 d = normalize(vWorldDir);
        // Pitch-black ink void everywhere above and below
        vec3 inkBlack = vec3(0.002, 0.002, 0.004);

        // Extremely subtle, narrow warm amber haze right along the distant lantern-release horizon
        // (keeps upper sky 100% pitch-black like ink while echoing the reference photo's distant glow)
        float h = abs(d.y);
        float horizonBand = exp(-h * 26.0) * smoothstep(0.0, 0.04, d.y + 0.02);
        float pulse = 0.92 + 0.08 * sin(uTime * 0.7 + d.x * 3.0) + uBassEnergy * 0.08;
        vec3 warmHaze = vec3(0.28, 0.10, 0.02) * horizonBand * uHorizonGlow * pulse;

        vec3 col = inkBlack + warmHaze;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });
}

export function createLanternMirrorWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 },
      uMidEnergy: { value: 0 },
      uRippleStrength: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uMidEnergy;
      uniform float uRippleStrength;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 p = vWorldPos.xz;
        float dist = length(p - cameraPosition.xz);

        // Multi-directional gentle night water ripples
        float w1 = sin(p.x * 0.48 + uTime * 0.85 + noise2(p * 0.14) * 3.0);
        float w2 = sin(p.y * 0.62 - uTime * 0.68 + p.x * 0.22);
        float w3 = sin((p.x - p.y) * 0.85 + uTime * 1.12);
        float ripple = (w1 * 0.45 + w2 * 0.35 + w3 * 0.20) * uRippleStrength;

        // Water normal perturbed by subtle ripples
        vec3 N = normalize(vec3(
          cos(p.x * 0.48 + uTime * 0.85) * 0.045 * uRippleStrength,
          1.0,
          cos(p.y * 0.62 - uTime * 0.68) * 0.045 * uRippleStrength
        ));

        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);

        // Colorless pitch-black water matching the ink-black sky
        vec3 baseCol = vec3(0.002, 0.002, 0.004);

        // Soft warm ambient reflection shimmer from the sea of sky lanterns overhead
        float shimmerWave = pow(max(0.0, ripple * 0.5 + 0.5), 4.5);
        float horizonBoost = smoothstep(8.0, 110.0, dist);
        float audioPulse = 1.0 + uBassEnergy * 0.18 + uMidEnergy * 0.12;
        vec3 lanternGlint = vec3(1.0, 0.54, 0.14) * shimmerWave * (0.045 + 0.11 * fresnel) * (0.45 + 0.55 * horizonBoost) * audioPulse;

        // Gentle radial falloff so outer edge dissolves invisibly into pitch-black fog
        float fade = exp(-dist * 0.0055);
        vec3 col = mix(baseCol, baseCol + lanternGlint, fade);

        // Semi-transparent so the crisp rippled 3D mirrored lantern reflections underneath shine through!
        float alpha = mix(0.36, 0.72, fresnel * 0.65 + (1.0 - fade) * 0.35);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });
}

/**
 * Sky Lantern Material (used for both rising 3D sky lanterns AND their rippled water reflections).
 * When `isReflection = true`, flips Y below the water plane and applies organic water-ripple
 * horizontal shimmer + vertical stretch + distance attenuation.
 */
export function createSkyLanternMaterial(isReflection = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 },
      uMidEnergy: { value: 0 },
      uWindStrength: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      attribute vec4 aBasePos;   // xyz = base anchor, w = vertical travel range
      attribute vec4 aParams;    // x = phase, y = riseSpeed, z = swayRadius, w = scale
      attribute float aTint;     // 0..1 warm palette variation (gold -> amber -> copper)

      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uWindStrength;

      varying vec3 vLocalPos;
      varying vec3 vNormalDir;
      varying float vFlicker;
      varying float vTint;
      varying float vAltitude;
      varying float vDist;

      void main() {
        float phase = aParams.x;
        float speed = aParams.y;
        float swayR = aParams.z * uWindStrength;
        float sc = aParams.w;
        float travelH = max(18.0, aBasePos.w);

        // Seamless vertical cycling from near-horizon up into the pitch-black sky
        float rawY = aBasePos.y + uTime * speed;
        float cycY = mod(rawY, travelH) + 2.4;

        // Gentle helical breeze sway
        float tSway = uTime * 0.42 + phase;
        float dx = sin(tSway) * swayR + cos(tSway * 0.61 + phase) * swayR * 0.45;
        float dz = cos(tSway * 0.83 + phase * 1.3) * swayR;

        vec3 centerWorld = vec3(aBasePos.x + dx, cycY, aBasePos.z + dz);

        // Gentle tilt with breeze
        float tiltX = sin(tSway * 1.15) * 0.11 * uWindStrength;
        float tiltZ = cos(tSway * 0.95) * 0.11 * uWindStrength;
        vec3 lp = position * sc;
        float cx = cos(tiltX); float sx = sin(tiltX);
        float cz = cos(tiltZ); float sz = sin(tiltZ);
        vec3 tilted = vec3(
          lp.x * cz - lp.y * sz,
          lp.x * sz + lp.y * cz,
          lp.z
        );
        tilted = vec3(
          tilted.x,
          tilted.y * cx - tilted.z * sx,
          tilted.y * sx + tilted.z * cx
        );

        vec3 worldPos = centerWorld + tilted;

        ${isReflection ? `
        // Mirror across water surface y = 0 with gentle vertical stretch & water ripple wobble
        worldPos.y = -worldPos.y;
        float depthBelow = abs(worldPos.y);
        float waveA = sin(worldPos.z * 0.55 + uTime * 2.1 + phase * 3.0);
        float waveB = cos(worldPos.x * 0.48 - uTime * 1.65 + depthBelow * 0.25);
        float wobble = (waveA * 0.6 + waveB * 0.4) * (0.12 + min(depthBelow * 0.038, 1.35));
        worldPos.x += wobble;
        worldPos.z += waveB * (0.08 + min(depthBelow * 0.02, 0.65));
        // Slight vertical elongation of reflected light on rippled water
        worldPos.y *= 1.06 + 0.05 * sin(uTime * 1.9 + phase);
        ` : ''}

        vLocalPos = position;
        vNormalDir = normalize(normal);
        vFlicker = 0.88 + 0.12 * sin(uTime * 4.8 + phase * 9.0) + 0.06 * sin(uTime * 11.3 + phase * 17.0) + uBassEnergy * 0.18;
        vTint = aTint;
        vAltitude = cycY;
        vDist = length(worldPos - cameraPosition);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uMidEnergy;
      varying vec3 vLocalPos;
      varying vec3 vNormalDir;
      varying float vFlicker;
      varying float vTint;
      varying float vAltitude;
      varying float vDist;

      void main() {
        // Normalize vertical coordinate of lantern body (-0.55 bottom mouth .. +0.55 top dome)
        float h = clamp((vLocalPos.y + 0.55) / 1.1, 0.0, 1.0);

        // Internal flame sits near lower third (h ~ 0.18) -> blazing incandescent white-gold core
        float coreGlow = exp(-pow((h - 0.16) * 2.9, 2.0));
        float upperShade = smoothstep(0.95, 0.25, h);

        // Subtle vertical paper-rib pleats
        float angle = atan(vLocalPos.z, vLocalPos.x);
        float ribs = 0.92 + 0.08 * cos(angle * 8.0);

        // Dark copper-brass rim right at the bottom mouth opening
        float rimBand = smoothstep(0.055, 0.015, h);

        // Rich warm palette: incandescent ivory-gold core -> honey amber -> deep tangerine-copper
        vec3 coreCol = vec3(1.55, 1.18, 0.62);
        vec3 midCol = mix(vec3(1.18, 0.58, 0.12), vec3(1.28, 0.72, 0.18), vTint);
        vec3 topCol = mix(vec3(0.58, 0.16, 0.03), vec3(0.75, 0.26, 0.05), vTint);

        vec3 paperCol = mix(topCol, midCol, upperShade);
        paperCol = mix(paperCol, coreCol, coreGlow * 0.85);
        paperCol *= ribs * (vFlicker + uMidEnergy * 0.10);

        // Darken bottom brass burner ring slightly for authentic silhouette contrast
        paperCol = mix(paperCol, vec3(0.18, 0.08, 0.03), rimBand * 0.72);

        // Gentle atmospheric distance attenuation in the ink void
        float distFade = exp(-vDist * 0.0048);

        ${isReflection ? `
        // Reflected lanterns fade naturally with altitude above water and ripple dispersion
        float altFade = exp(-vAltitude * 0.028);
        float reflIntensity = 0.62 * altFade * distFade;
        vec3 finalCol = paperCol * reflIntensity;
        float alpha = clamp(reflIntensity * 1.15, 0.0, 0.85);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(finalCol, alpha);
        ` : `
        // Smooth fade-in right at spawn altitude and fade-out high in the ink sky
        float spawnFade = smoothstep(2.4, 5.5, vAltitude);
        float topFade = smoothstep(98.0, 74.0, vAltitude);
        float vis = spawnFade * topFade * distFade;
        gl_FragColor = vec4(paperCol * vis, 1.0);
        `}
      }
    `,
    transparent: isReflection,
    depthWrite: !isReflection,
    blending: isReflection ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Floating Lotus Water Lantern ("Đèn Hoa Đăng") Material.
 * Renders glowing multi-petal lotus lanterns drifting smoothly on the pitch-black water,
 * plus an optional mirrored underwater glow pass (`isReflection = true`).
 */
export function createHoaDangMaterial(isReflection = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 },
      uMidEnergy: { value: 0 }
    },
    vertexShader: /* glsl */ `
      attribute vec4 aBasePos;   // x, z anchor, y = orbit radius, w = drift speed
      attribute vec4 aParams;    // x = phase, y = scale, z = petalTint (0=gold,0.5=lotus-pink,1=ivory), w = rotY

      uniform float uTime;

      varying vec3 vLocalPos;
      varying float vTint;
      varying float vFlicker;
      varying float vDist;

      void main() {
        float phase = aParams.x;
        float sc = aParams.y;
        float orbitR = aBasePos.y;
        float driftSpd = aBasePos.w;

        // Gentle circular & meandering water current drift
        float ang = uTime * driftSpd + phase;
        float wx = aBasePos.x + cos(ang) * orbitR;
        float wz = aBasePos.z + sin(ang * 0.82 + phase) * orbitR;

        // Gentle bobbing & rocking on micro-waves
        float bob = sin(uTime * 1.55 + phase * 5.0 + wx * 0.25) * 0.025;
        float rockX = sin(uTime * 1.25 + phase * 3.1) * 0.065;
        float rockZ = cos(uTime * 1.10 + phase * 2.7) * 0.065;

        // Rotate lantern around Y + wave rock
        float ry = aParams.w + uTime * 0.08 * (mod(phase * 10.0, 2.0) - 1.0);
        vec3 lp = position * sc;
        float cry = cos(ry); float sry = sin(ry);
        vec3 rot = vec3(lp.x * cry - lp.z * sry, lp.y, lp.x * sry + lp.z * cry);
        rot.y += rot.x * rockX + rot.z * rockZ;

        vec3 worldPos = vec3(wx, 0.03 + bob, wz) + rot;

        ${isReflection ? `
        worldPos.y = -worldPos.y - 0.03;
        float rip = sin(uTime * 2.4 + phase * 6.0 + worldPos.x * 1.2) * 0.055;
        worldPos.x += rip;
        worldPos.z += cos(uTime * 2.1 + phase * 5.0) * 0.04;
        ` : ''}

        vLocalPos = position;
        vTint = aParams.z;
        vFlicker = 0.90 + 0.10 * sin(uTime * 6.2 + phase * 11.0);
        vDist = length(worldPos - cameraPosition);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBassEnergy;
      uniform float uMidEnergy;

      varying vec3 vLocalPos;
      varying float vTint;
      varying float vFlicker;
      varying float vDist;

      void main() {
        float r = length(vLocalPos.xz);
        float h = vLocalPos.y;

        // Central candle flame (r < 0.08, h > 0.16)
        float isFlame = smoothstep(0.11, 0.03, r) * smoothstep(0.12, 0.24, h);
        // Inner glowing candle cup
        float coreGlow = exp(-r * 3.6);

        // Lotus petal palette: warm amber-gold / lotus rose-gold / warm ivory-saffron
        vec3 lotusGold = vec3(1.15, 0.68, 0.18);
        vec3 lotusRose = vec3(1.18, 0.42, 0.36);
        vec3 lotusIvory = vec3(1.22, 0.88, 0.46);
        vec3 petalCol = vTint < 0.5
          ? mix(lotusGold, lotusRose, vTint * 2.0)
          : mix(lotusRose, lotusIvory, (vTint - 0.5) * 2.0);

        // Subsurface glow strongest near center candle, softer at petal tips
        vec3 col = petalCol * (0.38 + 0.88 * coreGlow) * vFlicker;
        // Dark floating leaf base right at bottom (h < 0.03)
        float isBase = smoothstep(0.04, 0.005, h);
        col = mix(col, vec3(0.04, 0.03, 0.02), isBase * 0.82);

        // Blazing candle flame core
        vec3 flameCol = vec3(1.85, 1.48, 0.78) * (1.0 + uBassEnergy * 0.22 + uMidEnergy * 0.14);
        col = mix(col, flameCol, isFlame);

        float distFade = exp(-vDist * 0.0062);

        ${isReflection ? `
        vec3 reflCol = col * 0.48 * distFade;
        gl_FragColor = vec4(reflCol, 0.52 * distFade);
        ` : `
        gl_FragColor = vec4(col * distFade, 1.0);
        `}
      }
    `,
    transparent: isReflection,
    depthWrite: !isReflection,
    blending: isReflection ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Concentric expanding water ripple rings glowing softly around every floating Hoa Đăng.
 */
export function createHoaDangRippleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 }
    },
    vertexShader: /* glsl */ `
      attribute vec4 aBasePos;   // x, z anchor, y = orbit radius, w = drift speed
      attribute vec4 aParams;    // x = phase, y = scale, z = petalTint, w = rotY

      uniform float uTime;

      varying vec2 vUv;
      varying float vPhase;
      varying float vDist;

      void main() {
        float phase = aParams.x;
        float orbitR = aBasePos.y;
        float driftSpd = aBasePos.w;

        float ang = uTime * driftSpd + phase;
        float wx = aBasePos.x + cos(ang) * orbitR;
        float wz = aBasePos.z + sin(ang * 0.82 + phase) * orbitR;

        // Scale ripple disc proportionally to lantern size
        float discScale = 1.9 + aParams.y * 1.4;
        vec3 worldPos = vec3(wx + position.x * discScale, 0.012, wz + position.z * discScale);

        vUv = uv;
        vPhase = phase;
        vDist = length(worldPos - cameraPosition);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;

      varying vec2 vUv;
      varying float vPhase;
      varying float vDist;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        // 2 concentric expanding ripple rings moving outward from the lantern
        float t1 = fract(uTime * 0.34 + vPhase);
        float t2 = fract(uTime * 0.34 + vPhase + 0.5);

        float ring1 = exp(-pow((r - t1) * 18.0, 2.0)) * (1.0 - t1) * smoothstep(0.06, 0.20, t1);
        float ring2 = exp(-pow((r - t2) * 18.0, 2.0)) * (1.0 - t2) * smoothstep(0.06, 0.20, t2);

        // Soft warm candlelight pool right under the lotus lantern
        float corePool = exp(-r * r * 11.0) * 0.42;

        float intensity = (ring1 * 0.52 + ring2 * 0.44 + corePool) * (1.0 + uBassEnergy * 0.22);
        float distFade = exp(-vDist * 0.0075);

        vec3 col = vec3(1.15, 0.64, 0.18) * intensity * distFade;
        float alpha = clamp(intensity * distFade * 0.85, 0.0, 0.85);
        if (alpha < 0.008) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/**
 * Rising warm golden ember sparks drifting gently between the sky lanterns.
 */
export function createLanternEmberMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBassEnergy: { value: 0 },
      uPixelRatio: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;

      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uPixelRatio;

      varying float vAlpha;

      void main() {
        vec3 pos = position;
        float travelH = 68.0;
        pos.y = mod(pos.y + uTime * aSpeed, travelH) + 0.8;
        pos.x += sin(uTime * 0.55 + aPhase) * 1.4;
        pos.z += cos(uTime * 0.48 + aPhase * 1.7) * 1.4;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        float dist = max(1.0, -mv.z);
        gl_PointSize = clamp((aSize * uPixelRatio * 95.0) / dist, 1.5, 9.0);

        float twinkle = 0.55 + 0.45 * sin(uTime * 4.5 + aPhase * 13.0);
        float fadeH = smoothstep(0.8, 4.0, pos.y) * smoothstep(68.0, 52.0, pos.y);
        vAlpha = twinkle * fadeH * (0.75 + uBassEnergy * 0.25);

        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 18.0);
        vec3 col = mix(vec3(1.1, 0.48, 0.08), vec3(1.5, 1.15, 0.55), glow);
        gl_FragColor = vec4(col * glow, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

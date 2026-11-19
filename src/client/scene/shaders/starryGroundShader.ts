import * as THREE from 'three';
import { PbrTextureSet } from '../textures/pbrTextures';

export const starryGroundVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const starryGroundFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uMoonDirection;
  #ifdef USE_DETAIL_TEX
  uniform sampler2D uDetailTex;
  #endif
  #ifdef USE_COBBLE_PBR
  uniform sampler2D uCobbleMap;
  uniform sampler2D uCobbleNormalMap;
  uniform sampler2D uCobbleRoughnessMap;
  #endif

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float gHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 41.23);
    return fract(p.x * p.y);
  }

  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
      mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float gFbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 3; i++) {
      v += a * gNoise(p);
      p = p * 2.04 + vec2(11.3, 19.7);
      a *= 0.45;
    }
    return v;
  }

  float roadCenterAtZ(float z) {
    return sin(z * 0.07 + 0.6) * 6.0 + smoothstep(-25.0, -55.0, z) * 5.0;
  }

  void main() {
    vec2 p = vWorldPosition.xz;
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uMoonDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    float camDist = length(vWorldPosition - cameraPosition);
    float nearStroke = 1.0 - smoothstep(26.0, 82.0, camDist);
    float cobbleFade = 1.0 - smoothstep(34.0, 86.0, camDist);

    // Tactile canvas weave & impasto oil-knife texture modulation (centered around 1.0)
    float detailGrain = 1.0;
    #ifdef USE_DETAIL_TEX
    vec3 d1 = texture2D(uDetailTex, p * 0.28).rgb;
    vec3 d2 = texture2D(uDetailTex, p * 0.09 + vec2(0.31, 0.67)).rgb;
    float texLum = clamp((dot(mix(d1, d2, 0.45), vec3(0.333)) - 0.88) / 0.12, 0.0, 1.0);
    float rawGrain = mix(0.84, 1.16, texLum);
    detailGrain = mix(1.0, rawGrain, 0.35 + 0.65 * nearStroke);
    #endif

    // Van Gogh 2D curl-flow potential field matching the swirling celestial sky
    vec2 flowScale = p * 0.042;
    float eps = 0.04;
    float psi0 = gFbm(flowScale + vec2(sin(p.y * 0.03) * 0.35, cos(p.x * 0.03) * 0.35));
    float psiX = gFbm(flowScale + vec2(eps, 0.0) + vec2(sin(p.y * 0.03) * 0.35, cos((p.x + eps) * 0.03) * 0.35)) - psi0;
    float psiY = gFbm(flowScale + vec2(0.0, eps) + vec2(sin((p.y + eps) * 0.03) * 0.35, cos(p.x * 0.03) * 0.35)) - psi0;
    vec2 rawCurl = vec2(psiY, -psiX);
    float curlLen = length(rawCurl);
    vec2 swirlDir = curlLen > 0.0001 ? rawCurl / curlLen : vec2(0.8, 0.6);

    // Blend curl-flow tangent with hill contour tangent so strokes hug undulating hills
    vec2 contourTan = vec2(-N.z, N.x);
    float slopeWeight = clamp(length(N.xz) * 2.2, 0.0, 0.45);
    vec2 flowDir = normalize(mix(swirlDir, length(contourTan) > 0.01 ? normalize(contourTan) : swirlDir, slopeWeight));
    vec2 flowPerp = vec2(-flowDir.y, flowDir.x);

    vec2 flowUv = vec2(dot(p, flowDir), dot(p, flowPerp));
    float ribbonWave = sin(flowUv.y * 2.35 + psi0 * 7.5 - uTime * 0.08);
    float dashEnv = smoothstep(0.18, 0.84, gNoise(vec2(flowUv.x * 0.42, flowUv.y * 0.88) + vec2(3.1, 7.4)));
    float bristle = gNoise(vec2(flowUv.x * 1.15, flowUv.y * 3.1));
    float rawBrush = smoothstep(-0.32, 0.86, ribbonWave) * (0.42 + 0.58 * dashEnv);
    float brushCrest = mix(0.45, rawBrush, 0.38 + 0.62 * nearStroke);
    float brushGroove = mix(0.28, smoothstep(0.32, -0.78, ribbonWave), 0.35 + 0.65 * nearStroke);

    // Calibrated linear-RGB Van Gogh nocturnal palette (rich cobalt, Prussian, indigo, dark teal-emerald)
    vec3 indigoTrough = vec3(0.004, 0.009, 0.045);
    vec3 prussianValley = vec3(0.006, 0.022, 0.078);
    vec3 viridianHill = vec3(0.008, 0.048, 0.046);
    vec3 cobaltMoon = vec3(0.014, 0.048, 0.155);
    vec3 ochreHighlight = vec3(0.075, 0.058, 0.014);
    vec3 moonFillTint = vec3(0.028, 0.068, 0.195); // Deep nocturnal cobalt moonlight

    // Directional moonlight + subtle sky-to-ground hemisphere bounce + controlled crest rim
    float moonDiff = clamp(dot(N, L) * 0.62 + 0.38, 0.0, 1.0);
    float hemiMix = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 hemiBounce = mix(vec3(0.004, 0.008, 0.028), vec3(0.010, 0.028, 0.088), hemiMix);
    float crestRim = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 3.0) * (0.35 + 0.65 * moonDiff);
    float elevBlend = clamp((vWorldPosition.y + 1.8) / 3.8, 0.0, 1.0);

    vec3 meadowColor = mix(prussianValley, viridianHill, elevBlend * 0.42 + brushCrest * 0.44);
    meadowColor = mix(meadowColor, indigoTrough, brushGroove * 0.65);
    meadowColor = mix(meadowColor, cobaltMoon, (moonDiff * 0.44 + 0.18) * brushCrest * 0.52);
    meadowColor = mix(meadowColor, ochreHighlight, smoothstep(0.70, 0.96, brushCrest * bristle) * (0.14 + 0.22 * elevBlend));

    // Fine dark-loam & teal-emerald micro-turf texture under foreground grass blades
    float microTuft = gNoise(p * 6.2) * 0.45 + gNoise(p * 15.0 + vec2(3.7, 1.9)) * 0.35 + gNoise(p * 32.0 - vec2(5.1, 2.8)) * 0.20;
    float rootStubble = smoothstep(0.28, 0.74, microTuft);
    vec3 darkLoam = vec3(0.005, 0.012, 0.028);
    vec3 emeraldClover = vec3(0.009, 0.044, 0.038) * (0.72 + 0.34 * moonDiff);
    vec3 turfMicro = mix(darkLoam, emeraldClover, rootStubble);
    meadowColor = mix(meadowColor, turfMicro, nearStroke * 0.48);

    meadowColor += hemiBounce * (0.14 + 0.12 * brushCrest);
    meadowColor += moonFillTint * (moonDiff * 0.03 + crestRim * 0.045);
    meadowColor *= detailGrain;

    // Furrowed golden-ochre & olive wheat-field zones flanking the town, right hillside, valley & rear hill
    float westField = smoothstep(-16.0, -18.5, p.x) * (1.0 - smoothstep(-48.0, -54.0, p.x)) *
                      smoothstep(-14.0, -19.0, p.y) * (1.0 - smoothstep(-60.0, -64.0, p.y));
    float eastField = smoothstep(21.0, 24.5, p.x) * (1.0 - smoothstep(48.0, 54.0, p.x)) *
                      smoothstep(-12.0, -17.0, p.y) * (1.0 - smoothstep(-58.0, -63.0, p.y));
    float eastFrontField = smoothstep(20.5, 24.0, p.x) * (1.0 - smoothstep(44.0, 48.0, p.x)) *
                           (1.0 - smoothstep(9.0, 13.5, p.y)) * smoothstep(-15.5, -11.5, p.y);
    float southField = smoothstep(10.0, 14.0, abs(p.x)) * (1.0 - smoothstep(38.0, 44.0, abs(p.x))) *
                       smoothstep(18.0, 22.0, p.y) * (1.0 - smoothstep(42.0, 46.0, p.y));
    float valleyField = (1.0 - smoothstep(50.0, 58.0, abs(p.x))) *
                        smoothstep(-55.0, -58.5, p.y) * (1.0 - smoothstep(-64.5, -67.5, p.y));
    float fieldMask = clamp(max(max(westField, eastField), max(max(eastFrontField, valleyField), southField)), 0.0, 1.0);

    if (fieldMask > 0.01) {
      vec2 furrowDir = normalize(vec2(0.45, 0.89));
      float furrowWave = sin(dot(p, furrowDir) * 2.2 + sin(p.x * 0.09) * 1.5 + gNoise(p * 0.20) * 1.4);
      float rawRidge = smoothstep(-0.65, 0.75, furrowWave);
      float furrowRidge = mix(0.55, rawRidge, nearStroke);
      float strawStroke = smoothstep(0.2, 0.85, gNoise(vec2(dot(p, furrowDir) * 1.8, dot(p, vec2(-furrowDir.y, furrowDir.x)) * 0.7)));
      vec3 furrowShadow = vec3(0.012, 0.018, 0.024);
      vec3 furrowGold = vec3(0.120, 0.084, 0.018);
      vec3 furrowOlive = vec3(0.024, 0.046, 0.024);
      vec3 fieldCol = mix(furrowShadow, mix(furrowOlive, furrowGold, strawStroke * 0.72 + 0.24), furrowRidge);
      fieldCol *= detailGrain * (0.76 + 0.34 * moonDiff);
      fieldCol += moonFillTint * crestRim * 0.04;
      meadowColor = mix(meadowColor, fieldCol, fieldMask * 0.84);
    }

    // Terraced Provençal lavender & sage hillside strips
    float lavBand1 = smoothstep(7.5, 11.5, p.x) * (1.0 - smoothstep(14.5, 17.5, p.x)) *
                     smoothstep(13.0, 17.0, p.y) * (1.0 - smoothstep(36.0, 41.0, p.y));
    float lavBand2 = smoothstep(-32.0, -26.0, p.x) * (1.0 - smoothstep(-9.0, -6.5, p.x)) *
                     smoothstep(-6.0, -2.0, p.y) * (1.0 - smoothstep(14.0, 18.0, p.y));
    float lavMask = clamp(max(lavBand1, lavBand2) * (1.0 - fieldMask * 0.85), 0.0, 1.0);
    if (lavMask > 0.01) {
      float lavRow = smoothstep(-0.4, 0.75, sin((p.x * 0.32 + p.y * 0.94) * 2.8 + gNoise(p * 0.25) * 1.2));
      vec3 lavSoil = vec3(0.006, 0.010, 0.036);
      vec3 lavBloom = mix(vec3(0.020, 0.018, 0.082), vec3(0.034, 0.028, 0.108), brushCrest);
      vec3 lavCol = mix(lavSoil, lavBloom, lavRow) * detailGrain * (0.80 + 0.30 * moonDiff);
      meadowColor = mix(meadowColor, lavCol, lavMask * 0.75);
    }

    // Subtle damp mossy riverbank shading along the winding Rhone/village stream
    float streamCenterX = 15.5 + 3.5 * sin(p.y * 0.065 + 0.5) + smoothstep(-20.0, -60.0, p.y) * 5.0;
    float distToStream = abs(p.x - streamCenterX);
    float bankMask = 1.0 - smoothstep(1.9, 3.8, distToStream);
    meadowColor = mix(meadowColor, vec3(0.010, 0.045, 0.058), bankMask * 0.58);

    // Distant terraced olive-grove soil bands & eastern moulin cobblestone courtyard apron
    float dMoulin = length(p - vec2(32.5, -10.5));
    float moulinApron = 1.0 - smoothstep(3.8, 5.6, dMoulin);
    float outerTerrace = smoothstep(36.0, 52.0, length(p)) * (1.0 - smoothstep(95.0, 125.0, length(p)));
    float terraceStep = smoothstep(0.35, 0.72, sin(length(p) * 0.42 + gNoise(p * 0.14) * 1.4));
    meadowColor = mix(meadowColor, mix(vec3(0.012, 0.032, 0.072), vec3(0.026, 0.062, 0.088), terraceStep), outerTerrace * 0.44);

    // Winding cobblestone country path extending gently toward the village (-Z) and behind spawn (+Z)
    float pathCenterX = roadCenterAtZ(p.y);
    float distToPath = abs(p.x - pathCenterX);
    float pathWidth = 1.92 + sin(p.y * 0.25) * 0.32;
    float pathMask = 1.0 - smoothstep(pathWidth * 0.62, pathWidth + 0.85, distToPath);

    // Cross-town cobblestone carriage boulevard ellipse: center (0, -35.5), rx = 27.0, rz = 4.2
    vec2 ep = vec2(p.x / 27.0, (p.y + 35.5) / 4.2);
    float epLen = max(length(ep), 0.0001);
    float epGradLen = max(length(vec2(ep.x / 27.0, ep.y / 4.2)), 0.0001);
    float distToCarriageLane = abs(epLen - 1.0) / epGradLen;
    float laneMask = 1.0 - smoothstep(1.45, 2.35, distToCarriageLane);

    // Extended cobblestone town plaza apron reaching under the Café Terrace corner
    float plazaX = smoothstep(-17.4, -15.6, p.x) * (1.0 - smoothstep(9.8, 11.6, p.x));
    float plazaZ = (1.0 - smoothstep(-17.6, -16.4, p.y)) * smoothstep(-32.6, -30.8, p.y);
    float plazaMask = plazaX * plazaZ;

    float roadMask = clamp(max(max(pathMask, laneMask), max(plazaMask, moulinApron)), 0.0, 1.0);
    float curbEdge = clamp(
      smoothstep(pathWidth * 0.55, pathWidth, distToPath) * (1.0 - smoothstep(pathWidth, pathWidth + 0.75, distToPath)) +
      smoothstep(1.3, 1.9, distToCarriageLane) * (1.0 - smoothstep(1.9, 2.6, distToCarriageLane)) * 0.75,
      0.0, 1.0
    );

    vec3 cobbleNormal = N;
    float cobbleRoughness = 0.56;
    vec3 pathStone;
    float puddleNoise = gNoise(p * 0.28 + vec2(2.3, -4.1)) * 0.62 + gNoise(p * 0.74) * 0.38;
    float wetPuddle = smoothstep(0.46, 0.72, puddleNoise) * roadMask;
    #ifdef USE_COBBLE_PBR
    vec2 cobbleUv = p * 0.64;
    vec2 cobbleMacroUv = p * 0.16 + vec2(0.37, 0.21);
    vec3 texCobbleFine = texture2D(uCobbleMap, cobbleUv).rgb;
    vec3 texCobbleMacro = texture2D(uCobbleMap, cobbleMacroUv).rgb;
    vec3 texCobbleCol = mix(texCobbleFine, texCobbleMacro, 0.24);
    vec3 texCobbleN = texture2D(uCobbleNormalMap, cobbleUv).xyz * 2.0 - 1.0;
    float texCobbleR = texture2D(uCobbleRoughnessMap, cobbleUv).r;
    float normalAmt = mix(1.15, 0.14, wetPuddle) * cobbleFade;
    cobbleNormal = normalize(N + vec3(texCobbleN.x * normalAmt, 0.0, texCobbleN.y * normalAmt));
    cobbleRoughness = mix(mix(0.44, texCobbleR * 0.64, cobbleFade), 0.05 + texCobbleR * 0.08, wetPuddle);
    // Moonlit cobalt-slate stone crowns (linear RGB, crisp & readable against deep meadow!)
    vec3 cobbleTint = mix(vec3(0.042, 0.068, 0.148), vec3(0.105, 0.155, 0.275), moonDiff);
    pathStone = texCobbleCol * cobbleTint * mix(0.86, 1.18, detailGrain) * mix(1.0, 0.62, wetPuddle);
    #else
    float cobble = mix(0.56, gNoise(p * 2.15), cobbleFade);
    float stoneCrevice = mix(0.75, smoothstep(0.24, 0.64, gNoise(p * 3.8)), cobbleFade);
    pathStone = mix(vec3(0.024, 0.040, 0.098), vec3(0.075, 0.115, 0.220), cobble * stoneCrevice);
    pathStone *= mix(0.90, 1.12, detailGrain) * mix(1.0, 0.62, wetPuddle);
    pathStone += vec3(0.036, 0.048, 0.088) * smoothstep(0.54, 0.88, cobble) * moonDiff;
    #endif

    // Moonlit rim & specular sheen on damp cobblestone crowns + mirror puddles
    vec3 H_moon = normalize(L + V);
    vec3 R_cobble = reflect(-V, cobbleNormal);
    float cobbleGloss = clamp(1.0 - cobbleRoughness, 0.18, 0.96);
    float cobbleSpec = pow(max(dot(cobbleNormal, H_moon), 0.0001), mix(20.0, 140.0, cobbleGloss));
    float cobbleFresnel = pow(max(1.0 - max(dot(cobbleNormal, V), 0.0), 0.0001), 3.0);
    vec3 skyMirrorTint = mix(vec3(0.024, 0.058, 0.165), vec3(0.072, 0.145, 0.320), clamp(R_cobble.y, 0.0, 1.0));
    pathStone += moonFillTint * cobbleSpec * (0.45 + 0.80 * wetPuddle) * cobbleFade;
    pathStone += skyMirrorTint * cobbleFresnel * (0.16 + 0.36 * wetPuddle) * cobbleFade;

    vec3 borderMoss = mix(vec3(0.012, 0.048, 0.042), vec3(0.042, 0.078, 0.148), smoothstep(0.45, 0.82, gNoise(p * 8.6)));

    vec3 groundCol = mix(meadowColor, pathStone, roadMask * 0.94);
    groundCol = mix(groundCol, borderMoss, curbEdge * (1.0 - roadMask * 0.72) * 0.58);

    // Warm golden radial light pools on grass & cobbles around Café, Church, Fountain & all 14 Streetlamps
    vec2 pCafe = vec2(-9.5, -22.5);
    vec2 pCafeTerrace = vec2(-8.2, -20.2);
    vec2 pFountain = vec2(1.2, -24.5);
    vec2 pChurch = vec2(9.0, -45.5);

    vec2 pL1 = vec2(roadCenterAtZ(38.0) - 2.3, 38.0);
    vec2 pL2 = vec2(roadCenterAtZ(28.0) + 2.3, 28.0);
    vec2 pL3 = vec2(roadCenterAtZ(14.0) - 2.3, 14.0);
    vec2 pL4 = vec2(roadCenterAtZ(2.0) + 2.3, 2.0);
    vec2 pL5 = vec2(roadCenterAtZ(-12.0) - 2.3, -12.0);
    vec2 pL6 = vec2(roadCenterAtZ(44.0) + 2.3, 44.0);
    vec2 pPlazaL = vec2(-7.2, -18.5);
    vec2 pPlazaR = vec2(6.5, -19.0);
    vec2 pPlazaBL = vec2(-7.2, -28.4);
    vec2 pPlazaBR = vec2(6.5, -28.8);
    vec2 pChurchL = vec2(-5.0, -42.5);
    vec2 pChurchR = vec2(4.6, -42.6);

    float dCafe = length(p - pCafe);
    float dCafeT = length(p - pCafeTerrace);
    float dFountain = length(p - pFountain);
    float dChurch = length(p - pChurch);
    float dL1 = length(p - pL1);
    float dL2 = length(p - pL2);
    float dL3 = length(p - pL3);
    float dL4 = length(p - pL4);
    float dL5 = length(p - pL5);
    float dL6 = length(p - pL6);
    float dPlazaL = length(p - pPlazaL);
    float dPlazaR = length(p - pPlazaR);
    float dPlazaBL = length(p - pPlazaBL);
    float dPlazaBR = length(p - pPlazaBR);
    float dChurchL = length(p - pChurchL);
    float dChurchR = length(p - pChurchR);

    float flicker = 0.94 + 0.06 * sin(uTime * 3.8 + p.x);
    float lampPools = (
      exp(-dL1 * dL1 * 0.115) * 0.72 +
      exp(-dL2 * dL2 * 0.115) * 0.72 +
      exp(-dL3 * dL3 * 0.115) * 0.78 +
      exp(-dL4 * dL4 * 0.115) * 0.80 +
      exp(-dL5 * dL5 * 0.115) * 0.78 +
      exp(-dL6 * dL6 * 0.115) * 0.70 +
      exp(-dPlazaL * dPlazaL * 0.075) * 0.78 +
      exp(-dPlazaR * dPlazaR * 0.075) * 0.78 +
      exp(-dPlazaBL * dPlazaBL * 0.075) * 0.74 +
      exp(-dPlazaBR * dPlazaBR * 0.075) * 0.74 +
      exp(-dChurchL * dChurchL * 0.075) * 0.76 +
      exp(-dChurchR * dChurchR * 0.075) * 0.76
    ) * flicker;

    float villagePools = (
      exp(-dCafe * 0.16) * 0.85 +
      exp(-dCafeT * 0.20) * 0.75 +
      exp(-dFountain * 0.18) * 0.38 +
      exp(-dChurch * 0.11) * 0.65
    ) * flicker;

    // Wet-cobblestone point specular glints
    float lanternSpec = 0.0;
    float specExp = mix(24.0, 128.0, cobbleGloss);
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pCafe.x - p.x, 2.7, pCafe.y - p.y)) + V)), 0.0001), specExp) * exp(-dCafe * 0.13) * 1.45;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pCafeTerrace.x - p.x, 2.6, pCafeTerrace.y - p.y)) + V)), 0.0001), specExp) * exp(-dCafeT * 0.14) * 1.35;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pL3.x - p.x, 2.5, pL3.y - p.y)) + V)), 0.0001), specExp) * exp(-dL3 * 0.18) * 1.20;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pL4.x - p.x, 2.5, pL4.y - p.y)) + V)), 0.0001), specExp) * exp(-dL4 * 0.18) * 1.25;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pL5.x - p.x, 2.5, pL5.y - p.y)) + V)), 0.0001), specExp) * exp(-dL5 * 0.18) * 1.25;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pPlazaL.x - p.x, 2.5, pPlazaL.y - p.y)) + V)), 0.0001), specExp) * exp(-dPlazaL * 0.18) * 1.25;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pPlazaR.x - p.x, 2.5, pPlazaR.y - p.y)) + V)), 0.0001), specExp) * exp(-dPlazaR * 0.18) * 1.25;
    lanternSpec += pow(max(dot(cobbleNormal, normalize(normalize(vec3(pChurch.x - p.x, 3.2, pChurch.y - p.y)) + V)), 0.0001), specExp) * exp(-dChurch * 0.12) * 1.15;
    lanternSpec *= roadMask * (0.48 + 1.15 * wetPuddle + 0.55 * cobbleGloss) * flicker;

    // Warm golden ground glow directly in linear RGB on both grass and cobble
    vec3 warmGold = vec3(0.76, 0.40, 0.075);
    groundCol += warmGold * lampPools * (0.28 + 0.18 * roadMask);
    groundCol += warmGold * villagePools * (0.14 + 0.16 * roadMask * cobbleGloss);
    groundCol += vec3(0.95, 0.62, 0.14) * lanternSpec * 0.65;

    gl_FragColor = vec4(groundCol, 1.0);

    #include <fog_fragment>
  }
`;

export function createStarryGroundMaterial(
  moonDirection?: THREE.Vector3,
  detailTex?: THREE.Texture,
  cobblePbr?: PbrTextureSet
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uMoonDirection: {
      value: (moonDirection ?? new THREE.Vector3(115, 125, -165)).clone().normalize()
    }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  const defines: Record<string, number> = {};
  if (detailTex) {
    uniforms.uDetailTex = { value: detailTex };
    defines.USE_DETAIL_TEX = 1;
  }
  if (cobblePbr) {
    uniforms.uCobbleMap = { value: cobblePbr.map };
    uniforms.uCobbleNormalMap = { value: cobblePbr.normalMap };
    uniforms.uCobbleRoughnessMap = { value: cobblePbr.roughnessMap };
    defines.USE_COBBLE_PBR = 1;
  }

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: starryGroundVertexShader,
    fragmentShader: starryGroundFragmentShader,
    defines: Object.keys(defines).length > 0 ? defines : undefined,
    fog: true
  });
}

export const alpillesRidgeVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const alpillesRidgeFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uLayerIndex;
  uniform vec3 uMoonDirection;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float rHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
  }

  float rNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(rHash(i), rHash(i + vec2(1.0, 0.0)), u.x),
      mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float rPsi(vec2 p) {
    return rNoise(p) * 0.65 + rNoise(p * 2.1 + vec2(4.3, 8.1)) * 0.35;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 L = normalize(uMoonDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    // Van Gogh curl-flow mountain strata brushstrokes along the Alpilles ridge silhouette
    vec2 p = vec2(vWorldPosition.x * 0.055, vWorldPosition.y * 0.085);
    float eps = 0.05;
    float p0 = rPsi(p + vec2(uLayerIndex * 3.1, 0.0));
    float px = rPsi(p + vec2(eps + uLayerIndex * 3.1, 0.0)) - p0;
    float py = rPsi(p + vec2(uLayerIndex * 3.1, eps)) - p0;
    vec2 flowDir = normalize(vec2(py, -px) * 1.3 + vec2(0.85, 0.38 * sin(vWorldPosition.x * 0.04 + uLayerIndex)));
    vec2 flowPerp = vec2(-flowDir.y, flowDir.x);

    vec2 strokeCoord = vec2(dot(p * 12.0, flowDir), dot(p * 18.0, flowPerp));
    float ribbon = sin(strokeCoord.y + p0 * 6.0 - uTime * 0.04);
    float dash = smoothstep(0.18, 0.84, rNoise(vec2(strokeCoord.x * 0.45, strokeCoord.y * 0.75)));
    float crest = smoothstep(-0.30, 0.85, ribbon) * (0.42 + 0.58 * dash);
    float groove = smoothstep(0.32, -0.78, ribbon);

    // Depth-layered Van Gogh nocturnal mountain palette (0.04..0.28 linear RGB)
    vec3 indigo = vec3(0.008, 0.016, 0.072);
    vec3 prussian = vec3(0.012, 0.042, 0.128);
    vec3 cobalt = vec3(0.030, 0.092, 0.255);
    vec3 viridian = vec3(0.014, 0.068, 0.074);
    vec3 ochre = vec3(0.135, 0.105, 0.030);
    vec3 moonRim = vec3(0.078, 0.165, 0.420); // Nocturnal cobalt crest rim

    float moonLit = clamp(dot(N, L) * 0.55 + 0.45, 0.0, 1.0);
    float depthMist = clamp(uLayerIndex * 0.24, 0.0, 0.55);

    vec3 ridgeCol = mix(prussian, viridian, (1.0 - depthMist) * 0.45 * crest);
    ridgeCol = mix(ridgeCol, indigo, groove * 0.62);
    ridgeCol = mix(ridgeCol, cobalt, (0.32 + 0.52 * moonLit) * crest * (0.45 + depthMist * 0.30));
    ridgeCol = mix(ridgeCol, ochre, smoothstep(0.68, 0.96, crest) * (1.0 - depthMist) * 0.18);

    // Subtle cobalt moonlit rim highlight along the upper mountain crest & atmospheric base mist
    float crestHeight = smoothstep(0.62, 0.98, vUv.y);
    float fresnelRim = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 2.4);
    ridgeCol += moonRim * crestHeight * (0.12 + 0.16 * fresnelRim + 0.10 * crest);
    ridgeCol = mix(ridgeCol, vec3(0.018, 0.052, 0.155), (1.0 - smoothstep(0.0, 0.42, vUv.y)) * (0.32 + depthMist * 0.32));

    gl_FragColor = vec4(ridgeCol, 1.0);

    #include <fog_fragment>
  }
`;

export function createAlpillesRidgeMaterial(
  moonDirection?: THREE.Vector3,
  layerIndex = 0
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uLayerIndex: { value: layerIndex },
    uMoonDirection: {
      value: (moonDirection ?? new THREE.Vector3(115, 125, -165)).clone().normalize()
    }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: alpillesRidgeVertexShader,
    fragmentShader: alpillesRidgeFragmentShader,
    side: THREE.DoubleSide,
    fog: true
  });
}

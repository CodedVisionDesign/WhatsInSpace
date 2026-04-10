"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBolt, faFireFlameCurved, faRocket } from "@fortawesome/free-solid-svg-icons"

/*
 * Artemis II Trajectory Viewer
 *
 * DATA SOURCES (two-layer architecture):
 *   Layer 1 (curve): /trajectory-data.json - 428 JPL Horizons state vectors (spacecraft -1024)
 *                     /moon-trajectory.json - 428 Moon positions (body 301)
 *                     Frame: Earth-centered ICRF J2000, units: km, km/s
 *   Layer 2 (labels): /mission-milestones.json - 23 event waypoints from JPL Horizons
 *
 * The trajectory curve is NEVER hand-drawn. It comes exclusively from official
 * NASA/JPL Horizons ephemeris data. Milestones are labels placed on the real curve.
 */

// ── Scale & Constants ─────────────────────────────────────────────────
const SCALE = 1 / 8000
const EARTH_R = 6371 * SCALE
const MOON_R = 1737 * SCALE
const E_VIS = EARTH_R * 3
const M_VIS = MOON_R * 5
const LAUNCH_UTC = "2026-04-01T22:35:12Z"

const SUN_DIR = new THREE.Vector3(-1, 0.3, 0.5).normalize()
const SUN_POS = SUN_DIR.clone().multiplyScalar(200)

// ── Types ─────────────────────────────────────────────────────────────

interface EphemerisRow { utc: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }
interface MoonRow { x: number; y: number; z: number }
interface Milestone { id: string; label: string; utc: string; met: string; type: string; notes?: string }

// ── GLSL Shaders (kept from photorealistic version) ───────────────────

const EARTH_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
varying vec3 vTangent; varying vec3 vBitangent;
void main() {
  vUv = uv;
  vec3 N = normalize(mat3(modelMatrix) * normal);
  vWorldNormal = N;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  // Derive tangent frame from spherical UVs
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  if (length(T) < 0.001) T = normalize(cross(vec3(0.0, 0.0, 1.0), N));
  vTangent = T;
  vBitangent = cross(N, T);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const EARTH_FRAG = /* glsl */ `
uniform sampler2D dayTexture; uniform sampler2D nightTexture; uniform sampler2D specularMap;
uniform sampler2D normalMap; uniform sampler2D cloudTexture;
uniform vec3 sunDirection;
varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
varying vec3 vTangent; varying vec3 vBitangent;
void main() {
  // Normal mapping -perturb surface normal with tangent-space normal map
  vec3 mapN = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;
  mapN.xy *= 0.6; // scale down the bump intensity
  mat3 TBN = mat3(normalize(vTangent), normalize(vBitangent), normalize(vWorldNormal));
  vec3 normal = normalize(TBN * mapN);

  float NdotL = dot(normal, sunDirection);
  float diffuse = max(0.0, NdotL);
  float dayMix = smoothstep(-0.15, 0.2, NdotL);

  vec3 dayColor = texture2D(dayTexture, vUv).rgb;
  vec3 nightColor = texture2D(nightTexture, vUv).rgb;
  float specMask = texture2D(specularMap, vUv).r;

  // Cloud shadow on surface -darken day texture under clouds
  float cloudDensity = texture2D(cloudTexture, vUv).r;
  dayColor *= mix(1.0, 0.7, cloudDensity * dayMix);

  vec3 litDay = dayColor * (0.06 + 0.94 * diffuse);

  // Specular highlight on oceans
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 halfDir = normalize(sunDirection + viewDir);
  float specHighlight = pow(max(0.0, dot(normal, halfDir)), 128.0);
  litDay += vec3(0.9, 0.93, 1.0) * specHighlight * specMask * 0.6;

  // Slight rim light for depth
  float rim = 1.0 - max(0.0, dot(normal, viewDir));
  litDay += vec3(0.15, 0.25, 0.45) * pow(rim, 4.0) * 0.15;

  vec3 litNight = nightColor * 2.0;
  // Dim city lights under clouds
  litNight *= mix(1.0, 0.3, cloudDensity);

  gl_FragColor = vec4(mix(litNight, litDay, dayMix), 1.0);
}`

const ATMOS_VERT = /* glsl */ `
varying vec3 vNormal; varying vec3 vPosition; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const ATMOS_FRAG = /* glsl */ `
uniform vec3 sunDirection;
varying vec3 vNormal; varying vec3 vPosition; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
void main() {
  vec3 viewDir = normalize(-vPosition);
  vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
  float rim = 1.0 - max(0.0, dot(normalize(vNormal), viewDir));
  float fresnel = pow(rim, 3.0);

  float sunFacing = max(0.0, dot(normalize(vWorldNormal), sunDirection));
  float sunAngle = dot(normalize(vWorldNormal), sunDirection);

  // Rayleigh scattering: blue at limb, orange/red at terminator
  vec3 rayleighBlue = vec3(0.15, 0.35, 0.95);
  vec3 rayleighWhite = vec3(0.45, 0.65, 1.0);
  vec3 sunsetOrange = vec3(1.0, 0.4, 0.1);
  vec3 sunsetRed = vec3(0.9, 0.15, 0.05);

  // Base Rayleigh color varies with rim
  vec3 color = mix(rayleighBlue, rayleighWhite, rim);

  // Terminator band: where sun angle is near zero (sunset/sunrise line)
  float terminator = 1.0 - smoothstep(0.0, 0.25, abs(sunAngle));
  vec3 terminatorColor = mix(sunsetOrange, sunsetRed, rim * 0.5);
  color = mix(color, terminatorColor, terminator * 0.7);

  // Brighten the sunlit limb
  color = mix(color, vec3(0.7, 0.85, 1.0), sunFacing * rim * 0.4);

  float intensity = 0.7 + 0.8 * sunFacing + 0.3 * terminator;
  gl_FragColor = vec4(color, fresnel * intensity);
}`

// ── Star Shaders (GPU-driven twinkle) ──────────────────────────────
const STAR_VERT = /* glsl */ `
attribute float size;
attribute float twinkleSpeed;
attribute float twinklePhase;
uniform float uTime;
varying vec3 vColor;
varying float vBrightness;
void main() {
  vColor = color;
  // Smooth GPU-driven twinkle
  float twinkle = 0.7 + 0.3 * sin(uTime * twinkleSpeed + twinklePhase);
  vBrightness = twinkle;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * twinkle * (200.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}`

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vBrightness;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  // Soft circular glow falloff
  float alpha = smoothstep(0.5, 0.0, d);
  // Bright core
  float core = smoothstep(0.15, 0.0, d);
  vec3 col = vColor * (0.6 + 0.4 * core) * vBrightness;
  // Subtle cross/diffraction spike for bright stars
  float spike = max(
    smoothstep(0.02, 0.0, abs(uv.x)) * smoothstep(0.35, 0.0, abs(uv.y)),
    smoothstep(0.02, 0.0, abs(uv.y)) * smoothstep(0.35, 0.0, abs(uv.x))
  );
  col += vColor * spike * 0.3 * vBrightness;
  gl_FragColor = vec4(col, alpha * vBrightness);
}`

// ── Moon Shader ──────────────────────────────────────────────────────
const MOON_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const MOON_FRAG = /* glsl */ `
uniform sampler2D moonTexture; uniform vec3 sunDirection;
varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
void main() {
  vec3 normal = normalize(vWorldNormal);
  // Derive bump from texture luminance for crater depth
  vec2 texelSize = vec2(1.0 / 512.0, 1.0 / 256.0);
  float hL = dot(texture2D(moonTexture, vUv - vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float hR = dot(texture2D(moonTexture, vUv + vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float hD = dot(texture2D(moonTexture, vUv - vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
  float hU = dot(texture2D(moonTexture, vUv + vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
  vec3 bumpN = normalize(vec3(hL - hR, hD - hU, 0.3));
  // Derive tangent frame
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), normal));
  if (length(T) < 0.001) T = normalize(cross(vec3(0.0, 0.0, 1.0), normal));
  vec3 B = cross(normal, T);
  mat3 TBN = mat3(T, B, normal);
  vec3 perturbedNormal = normalize(TBN * bumpN);

  float NdotL = max(0.0, dot(perturbedNormal, sunDirection));
  vec3 tex = texture2D(moonTexture, vUv).rgb;
  vec3 color = tex * (0.03 + 0.97 * NdotL);
  // Subtle backscatter for realism (opposition effect)
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float phase = max(0.0, dot(viewDir, sunDirection));
  color += tex * 0.05 * pow(phase, 8.0);
  gl_FragColor = vec4(color, 1.0);
}`

// ── Phase Data (labels only, curve from ephemeris) ────────────────────

interface PhaseInfo { name: string; day: string; speed: string; altitude: string; description: string }
const PHASES: PhaseInfo[] = [
  { name: "Launch & Earth Orbit", day: "Day 1", speed: "28,000 km/h", altitude: "185 km LEO to 70,377 km HEO", description: "SLS launches from Pad 39B. After one LEO orbit, Orion raises to a 70,377 km apogee HEO. ICPS separation occurs at MET 3h 24m." },
  { name: "Trans-Lunar Injection", day: "Day 2", speed: "40,270 km/h (escape velocity)", altitude: "Departing Earth gravity", description: "The ICPS fires for 5m 55s (388 m/s delta-v), accelerating Orion past escape velocity onto a precise free-return trajectory to the Moon." },
  { name: "Outbound Coast", day: "Days 2-5", speed: "Decelerating from ~10 to ~1 km/s", altitude: "Earth to lunar distance", description: "Orion coasts 4 days toward the Moon. Two planned correction burns were cancelled due to excellent TLI accuracy. A small 18-sec burn (3 m/s) was performed on Day 5." },
  { name: "Lunar Far Side Flyby", day: "Days 5-6", speed: "~2.3 km/s at closest approach", altitude: "8,282 km from Moon center", description: "Orion enters the Moon's sphere of influence at 62,800 km. At closest approach, it passes 8,282 km from the Moon's center (6,545 km above surface). Lunar gravity bends the trajectory into the return path." },
  { name: "Return Coast", day: "Days 6-10", speed: "Accelerating from ~1 to ~11 km/s", altitude: "Max: 413,146 km from Earth", description: "Free-return trajectory carries Orion back. At peak distance (413,146.2 km), it surpasses Apollo 13's record. Three correction burns totaling ~2.1 m/s fine-tune the entry corridor." },
  { name: "Reentry & Splashdown", day: "Day 10", speed: "38,400 km/h (Mach 32)", altitude: "Entry interface: 122 km", description: "Service module separates. AVCOAT heat shield endures 2,760\u00B0C. Skip reentry reduces g-forces from ~8g to ~4g. Splashdown in the Pacific off Baja California." },
]

// Phase boundaries by milestone ID
const PHASE_BOUNDARIES = [
  { startId: "icps_separation", endId: "tli_start" },    // Earth Orbit
  { startId: "tli_start", endId: "earth_shadow_exit" },   // TLI
  { startId: "earth_shadow_exit", endId: "lunar_soi_entry" }, // Outbound
  { startId: "lunar_soi_entry", endId: "lunar_soi_exit" },    // Lunar Flyby
  { startId: "lunar_soi_exit", endId: "service_module_separation" }, // Return
  { startId: "service_module_separation", endId: "splashdown" },     // Reentry
]

// ── Procedural Textures (fallback) ────────────────────────────────────

function createProceduralEarth(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512
  const ctx = c.getContext("2d")!
  const g = ctx.createLinearGradient(0,0,0,512)
  g.addColorStop(0,"#1a3a5c"); g.addColorStop(0.3,"#1e4d7a"); g.addColorStop(0.5,"#1a5276"); g.addColorStop(0.7,"#1e4d7a"); g.addColorStop(1,"#1a3a5c")
  ctx.fillStyle = g; ctx.fillRect(0,0,1024,512)
  ctx.fillStyle = "#2d5a1e"
  const land = [[180,80,120,100],[170,100,80,70],[200,60,60,40],[230,200,60,120],[220,220,50,80],[440,80,60,50],[460,70,40,40],[460,150,70,120],[470,170,60,100],[520,60,180,100],[560,80,120,80],[600,100,80,60],[680,250,70,50],[690,260,50,40],[0,460,1024,52]]
  land.forEach(([x,y,w,h])=>{ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill()})
  ctx.fillStyle="#3a6b2a"
  land.forEach(([x,y,w,h])=>{for(let j=0;j<8;j++){ctx.beginPath();ctx.ellipse(x+Math.random()*w,y+Math.random()*h,8+Math.random()*15,6+Math.random()*12,Math.random()*Math.PI,0,Math.PI*2);ctx.fill()}})
  ctx.fillStyle="#c4a35a";[[470,140,50,30],[540,110,40,25],[680,240,30,20]].forEach(([x,y,w,h])=>{ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill()})
  ctx.fillStyle="#e8eef4";ctx.fillRect(0,0,1024,25);ctx.fillRect(0,470,1024,42)
  ctx.fillStyle="rgba(255,255,255,0.2)"
  for(let i=0;i<40;i++){ctx.beginPath();ctx.ellipse(Math.random()*1024,50+Math.random()*400,20+Math.random()*60,5+Math.random()*15,Math.random()*Math.PI,0,Math.PI*2);ctx.fill()}
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function createProceduralMoon(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(256,128,0,256,128,256)
  g.addColorStop(0,"#a8a8a8");g.addColorStop(0.5,"#8a8a8a");g.addColorStop(1,"#707070")
  ctx.fillStyle = g; ctx.fillRect(0,0,512,256)
  ctx.fillStyle="#5a5a5a";[[120,80,60,45],[200,100,80,50],[180,60,40,30],[300,90,55,40],[100,130,45,35],[250,70,35,25]].forEach(([x,y,w,h])=>{ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill()})
  for(let i=0;i<200;i++){const cx=Math.random()*512,cy=Math.random()*256,cr=1+Math.random()*6;ctx.strokeStyle=`rgba(60,60,60,${0.3+Math.random()*0.4})`;ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(cx,cy,cr,0,Math.PI*2);ctx.stroke();ctx.fillStyle=`rgba(40,40,40,${0.1+Math.random()*0.2})`;ctx.beginPath();ctx.arc(cx+cr*0.3,cy+cr*0.3,cr*0.8,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(180,180,180,${0.1+Math.random()*0.15})`;ctx.beginPath();ctx.arc(cx-cr*0.2,cy-cr*0.2,cr*0.6,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle="rgba(190,190,190,0.15)"
  for(let i=0;i<15;i++){ctx.beginPath();ctx.ellipse(Math.random()*512,Math.random()*256,15+Math.random()*30,10+Math.random()*20,Math.random()*Math.PI,0,Math.PI*2);ctx.fill()}
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function createSolidTexture(r: number, g: number, b: number): THREE.DataTexture {
  const d = new Uint8Array([r,g,b,255]); const t = new THREE.DataTexture(d,1,1,THREE.RGBAFormat); t.needsUpdate = true; return t
}

// ── Utility ───────────────────────────────────────────────────────────

function icrf2scene(p: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(p.x * SCALE, p.z * SCALE, -p.y * SCALE)
}

function parseUTC(s: string): number {
  // Handle both "2026-Apr-02 02:00:00.0000" and ISO "2026-04-02T02:00:00Z"
  if (s.includes("T")) return new Date(s).getTime()
  const months: Record<string, string> = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" }
  const m = s.match(/(\d{4})-(\w{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2})/)
  if (!m) return 0
  return new Date(`${m[1]}-${months[m[2]]}-${m[3]}T${m[4]}Z`).getTime()
}

function formatMET(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `MET ${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`
}

function makeLabel(text: string, scale = 1): THREE.Sprite {
  const c = document.createElement("canvas"); c.width = 512; c.height = 64
  const ctx = c.getContext("2d")!
  ctx.font = "bold 28px Inter, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(text, 256, 32)
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
  const s = new THREE.Sprite(mat); s.scale.set(5*scale, 0.6*scale, 1); return s
}

// ── Component ─────────────────────────────────────────────────────────

export default function TrajectoryViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activePhase, setActivePhase] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [hudSpeed, setHudSpeed] = useState(0)
  const [hudDistEarth, setHudDistEarth] = useState(0)
  const [hudDistMoon, setHudDistMoon] = useState(0)
  const [hudMET, setHudMET] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [showTrajectory, setShowTrajectory] = useState(true)
  const [showTrail, setShowTrail] = useState(true)
  const showTrajectoryRef = useRef(true)
  const showTrailRef = useRef(true)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; met: string; notes?: string } | null>(null)
  const milestoneMeshes = useRef<{ mesh: THREE.Mesh; data: Milestone; idx: number }[]>([])
  const mouseNDC = useRef(new THREE.Vector2(-10, -10)) // offscreen initially

  const progressRef = useRef(0)
  const playingRef = useRef(true)
  const phaseRef = useRef(0)
  const hudThrottle = useRef(0)

  // Data refs
  const orionData = useRef<EphemerisRow[]>([])
  const moonData = useRef<MoonRow[]>([])
  const milestones = useRef<Milestone[]>([])
  const phaseBoundaryIndices = useRef<{ start: number; end: number }[]>([])

  const scrubBarRef = useRef<HTMLDivElement>(null)

  // Load all data
  useEffect(() => {
    Promise.all([
      fetch("/trajectory-data.json").then(r => r.json()),
      fetch("/moon-trajectory.json").then(r => r.json()),
      fetch("/mission-milestones.json").then(r => r.json()),
    ]).then(([orion, moon, ms]) => {
      orionData.current = orion as EphemerisRow[]
      moonData.current = moon as MoonRow[]
      milestones.current = (ms as { waypoints: Milestone[] }).waypoints

      // Build phase boundary indices by matching milestone UTCs to nearest data sample
      const orionTimes = orionData.current.map(r => parseUTC(r.utc))
      const findIdx = (id: string) => {
        const wp = milestones.current.find(m => m.id === id)
        if (!wp) return 0
        const t = parseUTC(wp.utc)
        let best = 0, bestDiff = Infinity
        for (let i = 0; i < orionTimes.length; i++) {
          const diff = Math.abs(orionTimes[i] - t)
          if (diff < bestDiff) { bestDiff = diff; best = i }
        }
        return best
      }

      phaseBoundaryIndices.current = PHASE_BOUNDARIES.map(pb => ({
        start: findIdx(pb.startId),
        end: findIdx(pb.endId),
      }))

      setDataLoaded(true)
    })
  }, [])

  // Scrubber drag handlers
  const onScrubDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    playingRef.current = false
    setIsPlaying(false)
    updateScrub(e.clientX)
  }, [])

  const onScrubMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    updateScrub(e.clientX)
  }, [isDragging])

  const onScrubUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const updateScrub = (clientX: number) => {
    if (!scrubBarRef.current) return
    const rect = scrubBarRef.current.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    progressRef.current = p
    setProgress(p)
  }

  // 3D Scene
  useEffect(() => {
    if (!containerRef.current || !dataLoaded) return
    if (orionData.current.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    const S = SCALE
    const totalPts = orionData.current.length
    const launchTime = parseUTC(LAUNCH_UTC)

    // Convert ephemeris to scene points
    const orionPts = orionData.current.map(r => icrf2scene(r))
    const moonPts = moonData.current.map(r => icrf2scene(r))

    // ── Renderer ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 500)
    camera.position.set(0, 35, 55)

    // Post-processing
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.4, 0.6))

    // Lighting
    scene.add(new THREE.AmbientLight(0x111122, 0.3))
    const sunLight = new THREE.DirectionalLight(0xfff5e0, 3.0)
    sunLight.position.copy(SUN_POS)
    scene.add(sunLight)

    // ── Textures ──────────────────────────────────────────────────
    const loader = new THREE.TextureLoader()
    const procEarth = createProceduralEarth()
    const procMoon = createProceduralMoon()
    const solidBlack = createSolidTexture(0,0,0)
    const solidFlat = createSolidTexture(128,128,255) // flat normal map fallback
    const earthUniforms = {
      dayTexture: { value: procEarth as THREE.Texture },
      nightTexture: { value: solidBlack as THREE.Texture },
      specularMap: { value: solidBlack as THREE.Texture },
      normalMap: { value: solidFlat as THREE.Texture },
      cloudTexture: { value: solidBlack as THREE.Texture },
      sunDirection: { value: SUN_DIR.clone() },
    }
    const moonUniforms = {
      moonTexture: { value: procMoon as THREE.Texture },
      sunDirection: { value: SUN_DIR.clone() },
    }
    let cloudTexLoaded: THREE.Texture | null = null

    const tryLoad = (path: string, cs: THREE.ColorSpace, cb: (t: THREE.Texture) => void) => {
      loader.load(path, (t) => { t.colorSpace = cs; cb(t) }, undefined, () => {})
    }
    tryLoad("/textures/earth_day_4k.jpg", THREE.SRGBColorSpace, t => { earthUniforms.dayTexture.value = t })
    tryLoad("/textures/earth_night_4k.jpg", THREE.SRGBColorSpace, t => { earthUniforms.nightTexture.value = t })
    tryLoad("/textures/earth_specular_2k.jpg", THREE.LinearSRGBColorSpace, t => { earthUniforms.specularMap.value = t })
    tryLoad("/textures/earth_normal_2k.jpg", THREE.LinearSRGBColorSpace, t => { earthUniforms.normalMap.value = t })
    tryLoad("/textures/earth_clouds_2k.jpg", THREE.SRGBColorSpace, t => {
      cloudTexLoaded = t
      if (earthUniforms.cloudTexture) earthUniforms.cloudTexture.value = t
    })
    tryLoad("/textures/moon_2k.jpg", THREE.SRGBColorSpace, t => { moonUniforms.moonTexture.value = t })

    const gltfLoader = new GLTFLoader()

    // ── Stars (GPU-driven twinkle) ─────────────────────────────
    const STAR_COUNT = 20000
    const starsGeo = new THREE.BufferGeometry()
    const starPositions = new Float32Array(STAR_COUNT * 3)
    const starColors = new Float32Array(STAR_COUNT * 3)
    const starSizesArr = new Float32Array(STAR_COUNT)
    const starTwinkleSpeeds = new Float32Array(STAR_COUNT)
    const starTwinklePhases = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 180 + Math.random() * 120, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
      starPositions[i*3] = r*Math.sin(ph)*Math.cos(th); starPositions[i*3+1] = r*Math.sin(ph)*Math.sin(th); starPositions[i*3+2] = r*Math.cos(ph)
      const temp = Math.random()
      if (temp < 0.65) { starColors[i*3]=0.9+Math.random()*0.1; starColors[i*3+1]=0.9+Math.random()*0.1; starColors[i*3+2]=0.95+Math.random()*0.05 }
      else if (temp < 0.8) { starColors[i*3]=1; starColors[i*3+1]=0.85+Math.random()*0.1; starColors[i*3+2]=0.6+Math.random()*0.2 }
      else if (temp < 0.93) { starColors[i*3]=0.6+Math.random()*0.2; starColors[i*3+1]=0.7+Math.random()*0.15; starColors[i*3+2]=1 }
      else { starColors[i*3]=1; starColors[i*3+1]=0.5+Math.random()*0.3; starColors[i*3+2]=0.3+Math.random()*0.2 } // red giants
      starSizesArr[i] = Math.random() < 0.93 ? 0.3+Math.random()*0.8 : 1.2+Math.random()*2.0
      starTwinkleSpeeds[i] = 0.5 + Math.random() * 3.0
      starTwinklePhases[i] = Math.random() * Math.PI * 2
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    starsGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3))
    starsGeo.setAttribute("size", new THREE.BufferAttribute(starSizesArr, 1))
    starsGeo.setAttribute("twinkleSpeed", new THREE.BufferAttribute(starTwinkleSpeeds, 1))
    starsGeo.setAttribute("twinklePhase", new THREE.BufferAttribute(starTwinklePhases, 1))
    const starUniforms = { uTime: { value: 0 } }
    scene.add(new THREE.Points(starsGeo, new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: starUniforms,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })))

    // Sun -high-res multi-layer glow (512px canvas)
    const sgC = document.createElement("canvas"); sgC.width = 512; sgC.height = 512
    const sgCtx = sgC.getContext("2d")!
    // Outer halo
    const sgOuter = sgCtx.createRadialGradient(256,256,0,256,256,256)
    sgOuter.addColorStop(0,"rgba(255,252,240,0)"); sgOuter.addColorStop(0.3,"rgba(255,230,180,0.02)"); sgOuter.addColorStop(0.6,"rgba(255,200,120,0.04)"); sgOuter.addColorStop(1,"rgba(255,160,60,0)")
    sgCtx.fillStyle = sgOuter; sgCtx.fillRect(0,0,512,512)
    // Mid glow
    const sgMid = sgCtx.createRadialGradient(256,256,0,256,256,128)
    sgMid.addColorStop(0,"rgba(255,255,245,1)"); sgMid.addColorStop(0.04,"rgba(255,250,235,0.95)"); sgMid.addColorStop(0.1,"rgba(255,240,210,0.7)"); sgMid.addColorStop(0.25,"rgba(255,220,160,0.35)"); sgMid.addColorStop(0.5,"rgba(255,190,100,0.1)"); sgMid.addColorStop(1,"rgba(255,160,60,0)")
    sgCtx.fillStyle = sgMid; sgCtx.fillRect(0,0,512,512)
    // Core
    const sgCore = sgCtx.createRadialGradient(256,256,0,256,256,20)
    sgCore.addColorStop(0,"rgba(255,255,255,1)"); sgCore.addColorStop(0.5,"rgba(255,255,240,0.9)"); sgCore.addColorStop(1,"rgba(255,245,220,0)")
    sgCtx.fillStyle = sgCore; sgCtx.fillRect(0,0,512,512)
    // Horizontal anamorphic streak
    sgCtx.globalAlpha = 0.3
    const streakH = sgCtx.createLinearGradient(0,256,512,256)
    streakH.addColorStop(0,"rgba(255,220,150,0)"); streakH.addColorStop(0.35,"rgba(255,230,180,0.1)"); streakH.addColorStop(0.5,"rgba(255,250,230,0.5)"); streakH.addColorStop(0.65,"rgba(255,230,180,0.1)"); streakH.addColorStop(1,"rgba(255,220,150,0)")
    sgCtx.fillStyle = streakH; sgCtx.fillRect(0,248,512,16)
    // Vertical streak (subtler)
    sgCtx.globalAlpha = 0.15
    const streakV = sgCtx.createLinearGradient(256,0,256,512)
    streakV.addColorStop(0,"rgba(255,220,150,0)"); streakV.addColorStop(0.4,"rgba(255,240,200,0.1)"); streakV.addColorStop(0.5,"rgba(255,250,230,0.4)"); streakV.addColorStop(0.6,"rgba(255,240,200,0.1)"); streakV.addColorStop(1,"rgba(255,220,150,0)")
    sgCtx.fillStyle = streakV; sgCtx.fillRect(248,0,16,512)
    sgCtx.globalAlpha = 1
    const sunTex = new THREE.CanvasTexture(sgC); sunTex.colorSpace = THREE.SRGBColorSpace
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    sunSprite.position.copy(SUN_POS); sunSprite.scale.set(40,40,1); scene.add(sunSprite)

    // Lens flare -ghosts along camera-to-sun axis (positioned dynamically in animation loop)
    const flareSprites: { sprite: THREE.Sprite; offset: number; size: number; baseOpacity: number }[] = []
    const flareConfigs = [
      { offset: 0.6, size: 4, color: 0xffeedd, opacity: 0.12 },
      { offset: 0.4, size: 2.5, color: 0xaaddff, opacity: 0.08 },
      { offset: 0.25, size: 6, color: 0xffccaa, opacity: 0.06 },
      { offset: -0.2, size: 3, color: 0xddddff, opacity: 0.05 },
      { offset: -0.5, size: 8, color: 0xffeebb, opacity: 0.04 },
    ]
    flareConfigs.forEach(cfg => {
      const fc = document.createElement("canvas"); fc.width = 128; fc.height = 128
      const fctx = fc.getContext("2d")!
      const fg = fctx.createRadialGradient(64,64,0,64,64,64)
      fg.addColorStop(0, `rgba(255,255,255,0.4)`); fg.addColorStop(0.3, `rgba(255,240,220,0.15)`); fg.addColorStop(0.7, `rgba(255,220,180,0.03)`); fg.addColorStop(1, `rgba(255,200,150,0)`)
      fctx.fillStyle = fg; fctx.fillRect(0,0,128,128)
      // Hexagonal ring artifact for realism
      fctx.strokeStyle = "rgba(255,240,210,0.08)"; fctx.lineWidth = 1.5
      fctx.beginPath()
      for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3; const method = j === 0 ? "moveTo" : "lineTo"; fctx[method](64+30*Math.cos(a), 64+30*Math.sin(a)) }
      fctx.closePath(); fctx.stroke()
      const flareMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), color: cfg.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: cfg.opacity })
      const sprite = new THREE.Sprite(flareMat)
      sprite.scale.set(cfg.size, cfg.size, 1)
      scene.add(sprite)
      flareSprites.push({ sprite, offset: cfg.offset, size: cfg.size, baseOpacity: cfg.opacity })
    })

    // ── Earth (NASA GLB model + shader fallback) ───────────────
    const earthGroup = new THREE.Group()
    // Shader fallback while GLB loads
    const earthFallback = new THREE.Mesh(
      new THREE.SphereGeometry(E_VIS, 128, 64),
      new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: earthUniforms })
    )
    earthGroup.add(earthFallback)
    scene.add(earthGroup)

    // Load NASA Earth GLB
    gltfLoader.load("/models/earth.glb", (gltf) => {
      earthGroup.remove(earthFallback)
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const s = (E_VIS * 2) / maxDim
      model.scale.setScalar(s)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center.multiplyScalar(s))
      earthGroup.add(model)
    })

    // Subtle atmosphere glow
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(E_VIS*1.08,64,32),
      new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.06, side: THREE.BackSide })
    ))

    // cloudMesh removed - using GLB model now

    // ── Moon (GLB model with shader fallback) ─────────────────────
    const moonGroup = new THREE.Group()
    const moonFallback = new THREE.Mesh(
      new THREE.SphereGeometry(M_VIS, 64, 32),
      new THREE.ShaderMaterial({ vertexShader: MOON_VERT, fragmentShader: MOON_FRAG, uniforms: moonUniforms })
    )
    moonGroup.add(moonFallback)
    scene.add(moonGroup)
    const moon = moonGroup // alias for position updates

    gltfLoader.load("/models/moon_small.glb", (gltf) => {
      moonGroup.remove(moonFallback)
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = (M_VIS * 2) / maxDim
      model.scale.setScalar(scale)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center.multiplyScalar(scale))
      moonGroup.add(model)
    }, undefined, () => { /* keep fallback */ })

    // Labels
    const earthLabel = makeLabel("Earth"); earthLabel.position.set(0, E_VIS+2, 0); scene.add(earthLabel)
    const moonLabel = makeLabel("Moon"); scene.add(moonLabel)

    // ── Trajectory from REAL JPL Horizons data ────────────────────
    const fullGeo = new THREE.BufferGeometry().setFromPoints(orionPts)
    const trajectoryLine = new THREE.Line(fullGeo, new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.15 }))
    scene.add(trajectoryLine)

    // Gradient trail -brighter and more saturated than the faint trajectory line
    const TRAIL_LEN = 100
    const trailGeo = new THREE.BufferGeometry()
    const trailColors = new Float32Array(TRAIL_LEN * 3)
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, linewidth: 2 })
    const trail = new THREE.Line(trailGeo, trailMat)
    // Second trail layer for glow effect
    const trailGlow = new THREE.Line(trailGeo.clone(), new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.3, linewidth: 1 }))
    scene.add(trailGlow)
    scene.add(trail)

    // ── Orion Spacecraft (GLB model with fallback) ──
    const orionGroup = new THREE.Group()
    // Fallback geometry (shown while GLB loads)
    const fallbackCapsule = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.4 }))
    fallbackCapsule.rotation.x = Math.PI
    const fallbackSvc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x333333, emissiveIntensity: 0.1 }))
    fallbackSvc.position.y = 0.45
    orionGroup.add(fallbackCapsule, fallbackSvc)

    // Engine glow sprite
    const egC = document.createElement("canvas"); egC.width = 64; egC.height = 64
    const egCtx = egC.getContext("2d")!
    const egG = egCtx.createRadialGradient(32,32,0,32,32,32)
    egG.addColorStop(0,"rgba(255,200,100,1)"); egG.addColorStop(0.2,"rgba(255,150,50,0.8)"); egG.addColorStop(0.5,"rgba(255,100,20,0.3)"); egG.addColorStop(1,"rgba(255,50,0,0)")
    egCtx.fillStyle = egG; egCtx.fillRect(0,0,64,64)
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(egC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    engineGlow.position.y = 0.75; engineGlow.scale.set(0.8, 0.8, 1)
    const engineLight = new THREE.PointLight(0xff6622, 0, 5, 2)
    engineLight.position.y = 0.75
    orionGroup.add(engineGlow, engineLight)
    scene.add(orionGroup)
    const orionLabel = makeLabel("Artemis II / Orion", 0.8); scene.add(orionLabel)

    // Load Artemis 2 GLB model
    gltfLoader.load("/models/artemis2.glb", (gltf) => {
      orionGroup.remove(fallbackCapsule, fallbackSvc)
      const model = gltf.scene
      // Auto-scale to fit ~1 unit
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 1.8 / maxDim
      model.scale.setScalar(scale)
      // Center the model
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center.multiplyScalar(scale))
      orionGroup.add(model)
    }, undefined, () => { /* keep fallback on error */ })

    // ── Interactive milestone markers from JPL Horizons waypoints ──
    const orionTimes = orionData.current.map(r => parseUTC(r.utc))
    const visibleMilestones = milestones.current.filter(m =>
      ["translunar_injection","moon_approach","lunar_flyby","deep_space_peak","moon_departure","reentry","landing","separation"].includes(m.type)
    )
    const milestoneDots: { mesh: THREE.Mesh; data: Milestone; idx: number }[] = []
    visibleMilestones.forEach(m => {
      const t = parseUTC(m.utc)
      let bestIdx = 0, bestDiff = Infinity
      for (let i = 0; i < orionTimes.length; i++) {
        const diff = Math.abs(orionTimes[i] - t)
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
      }
      if (bestIdx < orionPts.length) {
        const pos = orionPts[bestIdx]
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 })
        )
        dot.position.copy(pos)
        scene.add(dot)
        // Outer glow ring
        const ring = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15, side: THREE.BackSide })
        )
        ring.position.copy(pos)
        scene.add(ring)
        milestoneDots.push({ mesh: dot, data: m, idx: bestIdx })
      }
    })
    milestoneMeshes.current = milestoneDots

    // Milestone raycaster
    const milestoneRaycaster = new THREE.Raycaster()
    milestoneRaycaster.params.Mesh = { threshold: 0.5 }
    let hoveredDotIdx = -1

    // ── Camera Controls (mouse + touch + pinch-to-zoom) ─────────
    let isDrag = false, prev = { x: 0, y: 0 }
    let camTheta = 0, camPhi = 0.6, camDist = 60
    let pinchStartDist = 0
    // Camera target: centroid of trajectory
    let cx = 0, cy = 0, cz = 0
    for (const p of orionPts) { cx += p.x; cy += p.y; cz += p.z }
    const camTarget = new THREE.Vector3(cx/totalPts, cy/totalPts, cz/totalPts)

    const onDown = (e: PointerEvent) => { isDrag = true; prev = { x: e.clientX, y: e.clientY } }
    const onMove = (e: PointerEvent) => {
      // Track mouse for milestone raycasting
      const rect = cvs.getBoundingClientRect()
      mouseNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseNDC.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      if (!isDrag) return
      camTheta -= (e.clientX - prev.x) * 0.005
      camPhi = Math.max(0.1, Math.min(Math.PI-0.1, camPhi - (e.clientY - prev.y) * 0.005))
      prev = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => { isDrag = false }
    const onClick = (e: PointerEvent) => {
      // Check if a milestone was clicked
      const rect = cvs.getBoundingClientRect()
      const clickNDC = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      milestoneRaycaster.setFromCamera(clickNDC, camera)
      const meshes = milestoneDots.map(m => m.mesh)
      const hits = milestoneRaycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const hitMesh = hits[0].object
        const found = milestoneDots.find(m => m.mesh === hitMesh)
        if (found) {
          // Jump to that milestone's timeline position
          progressRef.current = found.idx / totalPts
          setProgress(progressRef.current)
          playingRef.current = false
          setIsPlaying(false)
        }
      }
    }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); camDist = Math.max(10, Math.min(150, camDist + e.deltaY * 0.05)) }

    // Pinch-to-zoom for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchStartDist = Math.sqrt(dx * dx + dy * dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const delta = pinchStartDist - dist
        camDist = Math.max(10, Math.min(150, camDist + delta * 0.15))
        pinchStartDist = dist
      }
    }

    const cvs = renderer.domElement
    cvs.style.touchAction = "none"
    cvs.addEventListener("pointerdown", onDown)
    cvs.addEventListener("pointermove", onMove)
    cvs.addEventListener("pointerup", onUp)
    cvs.addEventListener("click", onClick)
    cvs.addEventListener("wheel", onWheel, { passive: false })
    cvs.addEventListener("touchstart", onTouchStart, { passive: true })
    cvs.addEventListener("touchmove", onTouchMove, { passive: false })

    // ── Animation Loop ────────────────────────────────────────────
    let raf: number
    const velDir = new THREE.Vector3()
    let flareIntensityCurrent = 0 // smoothly lerped flare intensity
    const raycaster = new THREE.Raycaster()
    const occlusionTargets = [earthGroup, moon]

    const animate = () => {
      raf = requestAnimationFrame(animate)

      if (playingRef.current) {
        progressRef.current += 0.0006
        if (progressRef.current >= 1) progressRef.current = 0
        setProgress(progressRef.current)
      }

      const idx = Math.floor(progressRef.current * (totalPts - 1))
      const clampIdx = Math.min(idx, totalPts - 1)
      const pos = orionPts[clampIdx]
      const row = orionData.current[clampIdx]

      // Position Orion
      orionGroup.position.copy(pos)
      orionLabel.position.set(pos.x, pos.y + 1.5, pos.z)

      // Orient Orion along velocity vector (nose forward)
      velDir.set(row.vx * S, row.vz * S, -row.vy * S).normalize()
      if (velDir.lengthSq() > 0) {
        orionGroup.lookAt(pos.x + velDir.x, pos.y + velDir.y, pos.z + velDir.z)
        orionGroup.rotateY(-1.50)
      }

      // Moon position from real ephemeris
      const moonPos = moonPts[Math.min(clampIdx, moonPts.length - 1)]
      moon.position.copy(moonPos)
      moonLabel.position.set(moonPos.x, moonPos.y + M_VIS + 1.5, moonPos.z)

      // Gradient trail
      const tStart = Math.max(0, clampIdx - TRAIL_LEN + 1)
      const tSlice = orionPts.slice(tStart, clampIdx + 1)
      if (tSlice.length > 1) {
        trailGeo.setFromPoints(tSlice)
        trailGlow.geometry.setFromPoints(tSlice)
        const numPts = tSlice.length
        const colArr = new Float32Array(numPts * 3)
        for (let i = 0; i < numPts; i++) {
          const alpha = i / (numPts - 1)
          // Brighter, more saturated gradient: white-hot at head, orange at mid, dim at tail
          colArr[i*3] = (0.4 + 0.6 * alpha); colArr[i*3+1] = (0.15 + 0.55 * alpha) * alpha; colArr[i*3+2] = 0.05 * alpha
        }
        trailGeo.setAttribute("color", new THREE.BufferAttribute(colArr, 3))
      }
      trailGlow.visible = showTrailRef.current

      // Phase detection from real milestone boundaries
      let newPhase = 0
      for (let p = 0; p < phaseBoundaryIndices.current.length; p++) {
        const pb = phaseBoundaryIndices.current[p]
        if (clampIdx >= pb.start && clampIdx < pb.end) { newPhase = p; break }
        if (clampIdx >= pb.end) newPhase = p + 1
      }
      newPhase = Math.min(5, newPhase)
      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase; setActivePhase(newPhase)
      }

      // HUD update (throttled to ~10fps)
      const now = Date.now()
      if (now - hudThrottle.current > 100) {
        hudThrottle.current = now
        const speed = Math.sqrt(row.vx**2 + row.vy**2 + row.vz**2) * 3600
        const dEarth = Math.sqrt(row.x**2 + row.y**2 + row.z**2)
        const moonRow = moonData.current[Math.min(clampIdx, moonData.current.length - 1)]
        const dMoon = Math.sqrt((row.x - moonRow.x)**2 + (row.y - moonRow.y)**2 + (row.z - moonRow.z)**2)
        const met = parseUTC(row.utc) - launchTime
        setHudSpeed(Math.round(speed))
        setHudDistEarth(Math.round(dEarth))
        setHudDistMoon(Math.round(dMoon))
        setHudMET(formatMET(met))
      }

      // Camera
      camera.position.x = camTarget.x + camDist * Math.sin(camPhi) * Math.sin(camTheta)
      camera.position.y = camTarget.y + camDist * Math.cos(camPhi)
      camera.position.z = camTarget.z + camDist * Math.sin(camPhi) * Math.cos(camTheta)
      camera.lookAt(camTarget)

      // Rotations
      earthGroup.rotation.y += 0.001
      moon.rotation.y += 0.0003

      // Star twinkle -GPU driven via uniform
      starUniforms.uTime.value = now * 0.001

      // Engine glow -pulse during burn phases (TLI = phase 1, reentry = phase 5)
      const phase = phaseRef.current
      const isBurning = phase === 1 || phase === 5
      const glowIntensity = isBurning ? 0.8 + 0.2 * Math.sin(now * 0.005) : 0.05
      engineGlow.material.opacity = glowIntensity
      engineGlow.scale.setScalar(isBurning ? 1.0 + 0.3 * Math.sin(now * 0.008) : 0.3)
      engineLight.intensity = isBurning ? 2.0 + Math.sin(now * 0.006) : 0

      // Dynamic lens flare -Option D: smooth fade + view-angle + occlusion
      const sunScreenPos = SUN_POS.clone().project(camera)

      // Factor 1: Viewport fade -smooth falloff near screen edges
      const inFront = sunScreenPos.z < 1 ? 1 : 0
      const edgeX = 1 - Math.min(1, Math.max(0, (Math.abs(sunScreenPos.x) - 0.8) / 0.7))
      const edgeY = 1 - Math.min(1, Math.max(0, (Math.abs(sunScreenPos.y) - 0.8) / 0.7))
      const viewportFade = inFront * edgeX * edgeY

      // Factor 2: View-angle intensity -stronger when looking toward sun
      const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      const toSun = SUN_POS.clone().sub(camera.position).normalize()
      const viewAngle = Math.max(0, camForward.dot(toSun))
      const viewAngleFactor = Math.pow(viewAngle, 1.5) // gentle power curve

      // Factor 3: Occlusion -raycast to check if Earth or Moon blocks the sun
      raycaster.set(camera.position, toSun)
      const hits = raycaster.intersectObjects(occlusionTargets)
      const sunDist = camera.position.distanceTo(SUN_POS)
      const occluded = hits.length > 0 && hits[0].distance < sunDist
      const occlusionTarget = occluded ? 0 : 1

      // Combined target intensity
      const flareTarget = viewportFade * viewAngleFactor * occlusionTarget

      // Smooth lerp -ease toward target (fast attack ~0.08, slow decay ~0.04)
      const lerpSpeed = flareTarget > flareIntensityCurrent ? 0.08 : 0.04
      flareIntensityCurrent += (flareTarget - flareIntensityCurrent) * lerpSpeed

      // Position and fade each ghost
      const centerToSun = new THREE.Vector3(sunScreenPos.x, sunScreenPos.y, 0)
      flareSprites.forEach(({ sprite, offset, size, baseOpacity }) => {
        if (flareIntensityCurrent > 0.001) {
          const flareScreenPos = centerToSun.clone().multiplyScalar(offset)
          const flareWorld = new THREE.Vector3(flareScreenPos.x, flareScreenPos.y, 0.5).unproject(camera)
          sprite.position.copy(flareWorld)
          sprite.material.opacity = baseOpacity * flareIntensityCurrent
          sprite.scale.setScalar(size * (0.8 + 0.2 * flareIntensityCurrent))
          sprite.visible = true
        } else {
          sprite.visible = false
        }
      })

      // Also gently fade the main sun sprite when occluded (keep glow, just dim it)
      const sunGlowTarget = occluded ? 0.15 : 1
      sunSprite.material.opacity += (sunGlowTarget - sunSprite.material.opacity) * 0.05

      // Milestone hover raycasting
      milestoneRaycaster.setFromCamera(mouseNDC.current, camera)
      const mMeshes = milestoneDots.map(m => m.mesh)
      const mHits = milestoneRaycaster.intersectObjects(mMeshes)
      if (mHits.length > 0) {
        const hitMesh = mHits[0].object as THREE.Mesh
        const hitIdx = milestoneDots.findIndex(m => m.mesh === hitMesh)
        if (hitIdx !== hoveredDotIdx) {
          // Unhover previous
          if (hoveredDotIdx >= 0 && hoveredDotIdx < milestoneDots.length) {
            const prev = milestoneDots[hoveredDotIdx].mesh;
            (prev.material as THREE.MeshBasicMaterial).color.setHex(0x00ff88)
            prev.scale.setScalar(1)
          }
          // Hover new
          hoveredDotIdx = hitIdx
          ;(hitMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff)
          hitMesh.scale.setScalar(1.5)
          // Project to screen for tooltip
          const screenPos = milestoneDots[hitIdx].mesh.position.clone().project(camera)
          const rect = container.getBoundingClientRect()
          const tx = ((screenPos.x + 1) / 2) * rect.width
          const ty = ((-screenPos.y + 1) / 2) * rect.height
          const d = milestoneDots[hitIdx].data
          const met = parseUTC(d.utc) - launchTime
          setTooltip({ x: tx, y: ty, label: d.label, met: formatMET(met), notes: d.notes })
        }
        cvs.style.cursor = "pointer"
      } else {
        if (hoveredDotIdx >= 0 && hoveredDotIdx < milestoneDots.length) {
          const prev = milestoneDots[hoveredDotIdx].mesh;
          (prev.material as THREE.MeshBasicMaterial).color.setHex(0x00ff88)
          prev.scale.setScalar(1)
        }
        hoveredDotIdx = -1
        setTooltip(null)
        cvs.style.cursor = isDrag ? "grabbing" : "grab"
      }

      // Toggle visibility from refs
      trajectoryLine.visible = showTrajectoryRef.current
      trail.visible = showTrailRef.current

      composer.render()
    }
    animate()

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix()
      renderer.setSize(w, h); composer.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize)
      cvs.removeEventListener("pointerdown", onDown); cvs.removeEventListener("pointermove", onMove)
      cvs.removeEventListener("pointerup", onUp); cvs.removeEventListener("click", onClick); cvs.removeEventListener("wheel", onWheel)
      cvs.removeEventListener("touchstart", onTouchStart); cvs.removeEventListener("touchmove", onTouchMove)
      composer.dispose(); renderer.dispose()
      if (container.contains(cvs)) container.removeChild(cvs)
    }
  }, [dataLoaded])

  const togglePlay = () => { playingRef.current = !playingRef.current; setIsPlaying(p => !p) }
  const toggleTrajectory = () => { showTrajectoryRef.current = !showTrajectoryRef.current; setShowTrajectory(p => !p) }
  const toggleTrail = () => { showTrailRef.current = !showTrailRef.current; setShowTrail(p => !p) }
  const jumpToPhase = (idx: number) => {
    if (phaseBoundaryIndices.current.length === 0) return
    const pb = phaseBoundaryIndices.current[Math.min(idx, phaseBoundaryIndices.current.length - 1)]
    const total = orionData.current.length
    progressRef.current = pb.start / total
    phaseRef.current = idx; setActivePhase(idx); setProgress(progressRef.current)
  }

  const phase = PHASES[activePhase]

  return (
    <div className="relative w-full">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black border border-white/10 cursor-grab active:cursor-grabbing">
        {!dataLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
            Loading NASA/JPL Horizons ephemeris data...
          </div>
        )}
      </div>

      {/* Milestone hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -120%)" }}
        >
          <div className="bg-black/90 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3 shadow-xl max-w-[240px]">
            <p className="text-white font-semibold text-sm mb-1">{tooltip.label}</p>
            <p className="text-orange-400 font-mono text-xs mb-1">{tooltip.met}</p>
            {tooltip.notes && <p className="text-white/50 text-xs leading-relaxed">{tooltip.notes}</p>}
            <p className="text-white/20 text-[10px] mt-1.5">Click to jump here</p>
          </div>
          <div className="w-2 h-2 bg-black/90 border-b border-r border-white/20 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
        <button onClick={togglePlay} className="px-3 py-1.5 bg-black/70 border border-white/20 rounded-lg text-white text-sm hover:bg-black/90 transition-colors backdrop-blur-sm">
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={toggleTrajectory} className={`px-3 py-1.5 border rounded-lg text-sm transition-colors backdrop-blur-sm ${showTrajectory ? "bg-orange-600/30 border-orange-500/40 text-orange-300 hover:bg-orange-600/40" : "bg-black/70 border-white/20 text-white/40 hover:bg-black/90 hover:text-white/60"}`}>
          Trajectory
        </button>
        <button onClick={toggleTrail} className={`px-3 py-1.5 border rounded-lg text-sm transition-colors backdrop-blur-sm ${showTrail ? "bg-orange-600/30 border-orange-500/40 text-orange-300 hover:bg-orange-600/40" : "bg-black/70 border-white/20 text-white/40 hover:bg-black/90 hover:text-white/60"}`}>
          Trail
        </button>
        <div className="px-3 py-1.5 bg-black/70 border border-white/20 rounded-lg text-white/50 text-xs backdrop-blur-sm flex items-center">
          Drag to orbit / Scroll to zoom
        </div>
      </div>

      {/* Debug: Artemis rotation sliders */}
      {/* Live HUD */}
      <div className="absolute top-4 right-4 z-10 bg-black/80 border border-white/15 rounded-lg p-3 backdrop-blur-sm min-w-[200px]">
        <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-2">Live Telemetry</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-white/40 text-[11px]">Speed</span>
            <span className="text-white font-mono text-sm">{hudSpeed.toLocaleString()} km/h</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-white/40 text-[11px]">Earth</span>
            <span className="text-white font-mono text-sm">{hudDistEarth.toLocaleString()} km</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-white/40 text-[11px]">Moon</span>
            <span className="text-white font-mono text-sm">{hudDistMoon.toLocaleString()} km</span>
          </div>
          <div className="border-t border-white/10 pt-1.5 mt-1.5">
            <span className="text-orange-400 font-mono text-xs">{hudMET}</span>
          </div>
        </div>
        <p className="text-[9px] text-white/20 mt-2">Source: NASA/JPL Horizons ID -1024</p>
      </div>

      {/* Draggable Timeline Scrubber */}
      <div
        ref={scrubBarRef}
        className="absolute bottom-0 left-0 right-0 h-2 hover:h-4 bg-white/10 z-10 cursor-pointer transition-all group"
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubUp}
        onPointerLeave={onScrubUp}
      >
        <div className="h-full bg-orange-500/80 transition-none relative" style={{ width: `${progress * 100}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-orange-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-orange-500/50" />
        </div>
      </div>

      {/* Phase Panel */}
      <div className="mt-6 grid md:grid-cols-[1fr_2fr] gap-6">
        <div className="flex flex-col gap-1">
          {PHASES.map((p, i) => (
            <button key={i} onClick={() => jumpToPhase(i)} className={`text-left px-4 py-3 rounded-lg transition-all ${
              activePhase === i ? "bg-orange-600/20 border border-orange-500/30 text-white" : "bg-white/5 border border-transparent text-white/40 hover:text-white/60 hover:bg-white/10"
            }`}>
              <span className="text-[11px] uppercase tracking-wider block mb-0.5 text-orange-500/70 font-medium">{p.day}</span>
              <span className="text-sm font-medium">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-2xl font-bold text-white mb-1">{phase.name}</h3>
          <p className="text-orange-400 text-sm mb-4">{phase.day}</p>
          <p className="text-white/60 leading-relaxed mb-6">{phase.description}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-white/30 text-[11px] uppercase tracking-wider mb-1 font-medium">Speed</p>
              <p className="text-white font-mono text-base">{phase.speed}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-white/30 text-[11px] uppercase tracking-wider mb-1 font-medium">Altitude</p>
              <p className="text-white font-mono text-base">{phase.altitude}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Science Cards */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
            <FontAwesomeIcon icon={faBolt} className="w-5 h-5 text-orange-400" />
          </div>
          <h4 className="text-white font-semibold text-lg mb-2">Gravity Slingshot</h4>
          <p className="text-white/50 text-sm leading-relaxed">
            Lunar gravity accelerates and redirects Orion back toward Earth. No fuel needed for the return.
            The free-return trajectory bends the flight path into a figure-8 using the Moon&apos;s gravitational field.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
            <FontAwesomeIcon icon={faFireFlameCurved} className="w-5 h-5 text-orange-400" />
          </div>
          <h4 className="text-white font-semibold text-lg mb-2">Skip Reentry</h4>
          <p className="text-white/50 text-sm leading-relaxed">
            At 38,400 km/h (Mach 32), Orion skips off the upper atmosphere to reduce peak g-forces from ~8g to ~4g.
            The AVCOAT heat shield endures 2,760&#176;C (5,000&#176;F).
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
            <FontAwesomeIcon icon={faRocket} className="w-5 h-5 text-orange-400" />
          </div>
          <h4 className="text-white font-semibold text-lg mb-2">Escape Velocity</h4>
          <p className="text-white/50 text-sm leading-relaxed">
            The 5m 55s TLI burn (388 m/s) accelerates Orion past 40,270 km/h, the fastest humans have travelled
            since Apollo 17 in 1972. The entire ICPS propellant supply is consumed.
          </p>
        </div>
      </div>
    </div>
  )
}

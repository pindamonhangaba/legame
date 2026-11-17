import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

const DX = 300;
const inDungeonZone = (x) => x > 250;

// ---------------- audio ----------------
let AC = null;
const audio = () => { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; };
function noiseBuf(ac, dur) {
  const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function playNoise(dur, freq, type, gainV, decay) {
  if (!AC) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf(AC, dur);
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(gainV, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + decay);
  src.connect(f); f.connect(g); g.connect(AC.destination); src.start();
}
function playTone(freq, dur, type, gainV, slideTo) {
  if (!AC) return;
  const o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, AC.currentTime + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(gainV, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}
const sfx = {
  swing: () => playNoise(0.18, 1400, 'bandpass', 0.25, 0.16),
  hit: () => { playTone(220, 0.12, 'square', 0.16, 90); playNoise(0.08, 900, 'lowpass', 0.2, 0.08); },
  hurt: () => playTone(140, 0.3, 'sawtooth', 0.2, 60),
  pickup: () => playTone(660, 0.15, 'sine', 0.12, 990),
  activate: () => { playTone(330, 0.5, 'sine', 0.14, 495); playTone(495, 0.7, 'sine', 0.08, 660); },
  thunder: () => { playNoise(2.2, 120, 'lowpass', 0.5, 2.0); playTone(50, 1.4, 'sine', 0.18, 32); },
  door: () => { playNoise(1.6, 90, 'lowpass', 0.5, 1.5); playTone(70, 1.2, 'sawtooth', 0.1, 45); },
  roar: () => { playTone(90, 0.9, 'sawtooth', 0.22, 45); playNoise(0.9, 300, 'lowpass', 0.3, 0.8); }
};

// ---------------- terrain ----------------
const PATH = [];
{
  const th0 = -0.5, sweep = 1.1;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const r = 24 + t * 23;
    const th = th0 + t * sweep + Math.sin(t * 6.0) * 0.06;
    PATH.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
}
function distToPath(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH.length; i++) {
    const dx = x - PATH[i][0], dz = z - PATH[i][1];
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h;
  if (r < 26) h = 10;
  else if (r < 31) h = 10 - 9 * smoothstep(26, 31, r);
  else if (r < 48) h = 1 - smoothstep(31, 48, r);
  else h = lerp(0, -3.5, smoothstep(48, 58, r));
  const n = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.5 + Math.sin(x * 0.13 + z * 0.21) * 0.45;
  h += n * smoothstep(20, 30, r) * 0.9 + 0.12;
  const d = distToPath(x, z);
  if (d < 3.6 && r > 22) {
    const t = clamp((r - 24) / 22, 0, 1);
    const ramp = 10 * (1 - t);
    h = lerp(h, ramp, smoothstep(3.6, 1.3, d));
  }
  return h;
}
function canStand(fromX, fromZ, fromY, toX, toZ) {
  const h = terrainHeight(toX, toZ);
  const d = Math.hypot(toX - fromX, toZ - fromZ);
  return h - fromY <= d * 1.3 + 0.03;
}

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x172b38);
scene.fog = new THREE.Fog(0x172b38, 55, 130);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);
camera.position.set(20, 24, 20);

const hemi = new THREE.HemisphereLight(0x6c98b7, 0x22303a, 0.75);
scene.add(hemi);
const storm = new THREE.DirectionalLight(0xbfd6e4, 1.4);
storm.position.set(-30, 45, -20);
storm.castShadow = true;
storm.shadow.mapSize.set(2048, 2048);
storm.shadow.camera.left = -60; storm.shadow.camera.right = 60;
storm.shadow.camera.top = 60; storm.shadow.camera.bottom = -60;
storm.shadow.camera.far = 160;
storm.shadow.bias = -0.0006;
scene.add(storm);
scene.add(storm.target);

// ---------------- terrain mesh ----------------
{
  const size = 150, seg = 170;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0x8a7c58), cRock = new THREE.Color(0x45525c),
    cMoss = new THREE.Color(0x44523a), cWet = new THREE.Color(0x2b404f), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const slope = Math.abs(terrainHeight(x + 0.6, z) - h) + Math.abs(terrainHeight(x, z + 0.6) - h);
    if (h < 0.4) c.copy(cWet).lerp(cSand, smoothstep(-1.2, 0.5, h));
    else c.copy(cSand).lerp(cMoss, smoothstep(3, 9, h));
    c.lerp(cRock, smoothstep(0.7, 1.8, slope));
    c.multiplyScalar(rand(0.93, 1.05));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);
}

// ---------------- ocean ----------------
const oceanGeo = new THREE.PlaneGeometry(420, 420, 84, 84);
oceanGeo.rotateX(-Math.PI / 2);
const oceanBase = oceanGeo.attributes.position.array.slice();
const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshStandardMaterial({
  color: 0x1d4258, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.94, flatShading: true
}));
ocean.position.y = 0.1;
scene.add(ocean);

// ---------------- rain ----------------
const RAIN_N = 900;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) {
  rainPos[i * 3] = rand(-35, 35); rainPos[i * 3 + 1] = rand(0, 40); rainPos[i * 3 + 2] = rand(-35, 35);
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
  color: 0x8fb3c7, size: 0.09, transparent: true, opacity: 0.4, depthWrite: false
}));
scene.add(rain);

// ---------------- scatter rocks ----------------
{
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3d4750, roughness: 1, flatShading: true });
  for (let i = 0; i < 70; i++) {
    const a = rand(0, TAU), r = rand(8, 50);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (distToPath(x, z) < 6) continue;
    if (Math.hypot(x + 17.3, z - 10.3) < 9) continue;
    const s = rand(0.5, 2.6);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(x, terrainHeight(x, z) + s * 0.3, z);
    rock.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    rock.castShadow = true; rock.receiveShadow = true;
    scene.add(rock);
  }
}

// ---------------- stone door ----------------
const DOOR_POS = new THREE.Vector3(-17.3, 0, 10.3);
DOOR_POS.y = terrainHeight(DOOR_POS.x, DOOR_POS.z);
const doorSlabMat = new THREE.MeshStandardMaterial({ color: 0x2a3a46, roughness: 0.85 });
const runeMat = new THREE.MeshStandardMaterial({ color: 0x183040, emissive: 0x224b66, emissiveIntensity: 0.25, roughness: 0.6 });
let doorSlab, doorRunes = [];
{
  const g = new THREE.Group();
  g.position.copy(DOOR_POS);
  g.lookAt(0, DOOR_POS.y, 0);
  const facadeMat = new THREE.MeshStandardMaterial({ color: 0x36414b, roughness: 1, flatShading: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 3), facadeMat);
  arch.position.set(0, 4.0, -1.2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 3.6), facadeMat);
  lintel.position.set(0, 8.6, -1.0);
  const jL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9.5, 3.4), facadeMat);
  jL.position.set(-4.6, 4.2, -0.9);
  const jR = jL.clone(); jR.position.x = 4.6;
  arch.castShadow = jL.castShadow = lintel.castShadow = true;
  arch.receiveShadow = true;
  doorSlab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 7.4, 0.7), doorSlabMat);
  doorSlab.position.set(0, 3.7, 0.4);
  doorSlab.castShadow = true;
  for (let i = 0; i < 5; i++) {
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.1), runeMat);
    rune.position.set(-2 + i, 3.7, 0.82);
    doorRunes.push(rune);
    doorSlab.add(rune);
  }
  g.add(arch, lintel, jL, jR, doorSlab);
  scene.add(g);
}

// ---------------- mechanisms ----------------
const interactables = [];
const brassMat = new THREE.MeshStandardMaterial({ color: 0x7a623b, roughness: 0.6, metalness: 0.6 });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 1, flatShading: true });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3a, roughness: 0.7, metalness: 0.5 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0x224b66, emissive: 0x4e7c9a, emissiveIntensity: 0 });

function makeGear() {
  const g = new THREE.Group();
  const teeth = 10;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 14), stoneMat);
  core.rotation.x = Math.PI / 2;
  core.castShadow = true;
  g.add(core);
  for (let i = 0; i < teeth; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.5), stoneMat);
    const a = (i / teeth) * TAU;
    t.position.set(Math.cos(a) * 1.28, Math.sin(a) * 1.28, 0);
    t.rotation.z = a;
    g.add(t);
  }
  return g;
}
const gear = makeGear();
{
  const gx = 33.2, gz = 0.8;
  gear.position.set(gx, terrainHeight(gx, gz) + 0.5, gz);
  gear.rotation.y = 0.7;
  gear.rotation.x = 0.35;
  scene.add(gear);
}
const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 8), stoneMat.clone());
let plateGlow;
{
  plate.position.set(5, 10.2, 4);
  plate.receiveShadow = true;
  scene.add(plate);
  plateGlow = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 8),
    new THREE.MeshBasicMaterial({ color: 0x4e7c9a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  plateGlow.rotation.x = -Math.PI / 2;
  plateGlow.position.set(5, 10.38, 4);
  scene.add(plateGlow);
}
let winchDrum;
{
  const g = new THREE.Group();
  const wx = 39.5, wz = 8.8;
  g.position.set(wx, terrainHeight(wx, wz), wz);
  g.rotation.y = -0.22;
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.6), stoneMat);
  base.position.y = 0.25; base.castShadow = true;
  const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), ironMat);
  post1.position.set(-0.8, 1.2, 0);
  const post2 = post1.clone(); post2.position.x = 0.8;
  winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 10), ironMat);
  winchDrum.rotation.z = Math.PI / 2;
  winchDrum.position.y = 1.4;
  winchDrum.castShadow = true;
  const boom = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.16), ironMat);
  boom.position.set(1.8, 2.3, 0);
  boom.castShadow = true;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0x634b28, roughness: 1 }));
  rope.position.set(3.3, 1.55, 0);
  const winchWeight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), stoneMat);
  winchWeight.position.set(3.3, 0.55, 0);
  winchWeight.castShadow = true;
  g.add(base, post1, post2, winchDrum, boom, rope, winchWeight);
  scene.add(g);
}

// ---------------- signal fire ----------------
let fireLit = false, fireGlow, fireFlame;
{
  const fx = -4, fz = -12;
  const fy = terrainHeight(fx, fz);
  const g = new THREE.Group();
  g.position.set(fx, fy, fz);
  const pyre = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 8), stoneMat);
  pyre.position.y = 0.4; pyre.castShadow = true;
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }));
  wood.position.y = 1.6;
  fireFlame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 7),
    new THREE.MeshStandardMaterial({ color: 0xff9a4a, emissive: 0xff7a2a, emissiveIntensity: 2 }));
  fireFlame.position.y = 2.6;
  fireFlame.visible = false;
  fireGlow = new THREE.PointLight(0xff8a3a, 0, 22);
  fireGlow.position.y = 3;
  g.add(pyre, wood, fireFlame, fireGlow);
  scene.add(g);
  interactables.push({
    pos: new THREE.Vector3(fx, fy, fz), radius: 2.6, label: 'Light the signal fire',
    enabled: () => !fireLit,
    action: () => {
      fireLit = true;
      fireFlame.visible = true;
      fireGlow.intensity = 3;
      state.signals++;
      sfx.activate();
      banner('The fire roars — and something howls back from the water.');
      spawnWave(4, false);
    }
  });
}

// ---------------- dungeon ----------------
const dun = new THREE.Group();
dun.position.set(DX, 0, 0);
let beaconFlame, beaconLight, beaconLit = false;
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), new THREE.MeshStandardMaterial({ color: 0x33393f, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  dun.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 1, flatShading: true });
  const mkWall = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    dun.add(m);
    return m;
  };
  mkWall(46, 10, 1.5, 0, 5, -15.5);
  mkWall(46, 10, 1.5, 0, 5, 15.5);
  mkWall(1.5, 10, 32, -22.5, 5, 0);
  mkWall(1.5, 10, 12, 22.5, 5, -9);
  mkWall(1.5, 10, 12, 22.5, 5, 9);
  mkWall(10, 10, 1.5, 17.5, 5, 3.5);
  mkWall(10, 10, 1.5, 17.5, 5, -3.5);
  const torch = (x, z) => {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff8a3a, emissiveIntensity: 2 }));
    fl.position.set(x, 3.4, z);
    const l = new THREE.PointLight(0xff9a4a, 1.6, 16);
    l.position.set(x, 3.6, z);
    dun.add(fl, l);
  };
  torch(-10, -14.4); torch(8, 14.4); torch(-18, 14.4);
  const boat = new THREE.Group();
  boat.position.set(13, 0, -9);
  boat.rotation.y = 0.5;
  const hull = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1, flatShading: true }));
  hull.scale.set(1, 0.55, 0.5);
  hull.rotation.z = 0.12;
  hull.castShadow = true;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1 }));
  mast.position.set(-0.6, 1.2, 0);
  mast.rotation.z = 1.2;
  boat.add(hull, mast);
  dun.add(boat);
  const brazier = new THREE.Group();
  brazier.position.set(0, 0, -10);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 1.6, 8), stoneMat);
  pedestal.position.y = 0.8; pedestal.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 0.6, 8), ironMat);
  bowl.position.y = 1.9;
  beaconFlame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 7),
    new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff7a2a, emissiveIntensity: 2.5 }));
  beaconFlame.position.y = 3.4;
  beaconFlame.visible = false;
  beaconLight = new THREE.PointLight(0xff8a3a, 0, 40);
  beaconLight.position.y = 4;
  brazier.add(pedestal, bowl, beaconFlame, beaconLight);
  dun.add(brazier);
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const s = rand(0.3, 1.0);
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rubbleMat);
    rk.position.set(rand(-19, 19), s * 0.4, rand(-13, 13));
    rk.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    rk.castShadow = true;
    dun.add(rk);
  }
  scene.add(dun);
}

// ---------------- player ----------------
const player = new THREE.Group();
let armPivot;
{
  const oilskin = new THREE.MeshStandardMaterial({ color: 0x5a5230, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 10), oilskin);
  body.position.y = 0.85;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a37e, roughness: 0.8 }));
  head.position.y = 1.5;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 1 }));
  hair.position.y = 1.53;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.07, 6, 12), new THREE.MeshStandardMaterial({ color: 0x7a3030, roughness: 1 }));
  scarf.position.y = 1.32;
  scarf.rotation.x = Math.PI / 2;
  armPivot = new THREE.Group();
  armPivot.position.set(0.36, 1.2, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 6), new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }));
  handle.position.y = -0.4;
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.38), new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.4, metalness: 0.7 }));
  axeHead.position.set(0, -0.85, 0.14);
  handle.castShadow = true;
  armPivot.add(handle, axeHead);
  player.add(body, head, hair, scarf, armPivot);
  scene.add(player);
}
const spawnX = 21, spawnZ = -11.5;
player.position.set(spawnX, terrainHeight(spawnX, spawnZ), spawnZ);

// ---------------- enemies ----------------
const enemies = [];
function makeBar(width, color) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.1), new THREE.MeshBasicMaterial({ color: 0x0c1114, depthTest: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.04, 0.06), new THREE.MeshBasicMaterial({ color, depthTest: false }));
  fg.position.z = 0.002;
  bg.renderOrder = 998; fg.renderOrder = 999;
  g.add(bg, fg);
  return { g, fg, w: width - 0.04 };
}
function spawnEnemy(pos, big) {
  if (enemies.length >= 42) return;
  const s = big ? 2.1 : rand(0.85, 1.15);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: big ? 0x1b3a44 : 0x24444e, roughness: 0.7, flatShading: true, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat);
  body.scale.set(1, 0.75, 1.35);
  body.castShadow = true;
  const eyeMat = new THREE.MeshBasicMaterial({ color: big ? 0xffd27a : 0x9fe8ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
  e1.position.set(0.18, 0.22, 0.5);
  const e2 = e1.clone(); e2.position.x = -0.18;
  const finL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 4), mat);
  finL.position.set(0.5, 0.15, -0.2); finL.rotation.z = -1.4;
  const finR = finL.clone(); finR.position.x = -0.5; finR.rotation.z = 1.4;
  const bar = makeBar(big ? 1.6 : 0.9, big ? 0xffd27a : 0xb8433a);
  bar.g.position.y = big ? 2.4 : 1.15;
  g.add(body, e1, e2, finL, finR, bar.g);
  g.scale.setScalar(s);
  g.position.copy(pos);
  scene.add(g);
  enemies.push({
    g, mat, bar, big: !!big,
    hp: big ? 320 : 30 + state.threat * 6,
    maxHp: big ? 320 : 30 + state.threat * 6,
    speed: big ? 1.9 : rand(2.0, 2.9),
    dmg: big ? 26 : 7 + Math.floor(state.threat * 1.5),
    windup: 0, atkCd: rand(0, 0.6), hitFlash: 0, phase: rand(0, TAU)
  });
}
const DUN_SPAWNS = [[-18, -11], [-18, 11], [18, -11], [18, 11], [0, -12]];
function spawnEdge() {
  if (inDungeonZone(player.position.x)) {
    let best = null, bd = -1;
    for (let i = 0; i < 5; i++) {
      const s = DUN_SPAWNS[(Math.random() * DUN_SPAWNS.length) | 0];
      const d = Math.hypot(s[0] + DX - player.position.x, s[1] - player.position.z);
      if (d > bd) { bd = d; best = s; }
    }
    return new THREE.Vector3(best[0] + DX, 0, best[1]);
  }
  const a = rand(0, TAU);
  return new THREE.Vector3(Math.cos(a) * 47, 0.4, Math.sin(a) * 47);
}
function spawnWave(n, bannerText) {
  for (let i = 0; i < n; i++) setTimeout(() => { if (!state.over) spawnEnemy(spawnEdge(), false); }, i * 350);
  if (bannerText) banner(bannerText);
}

// ---------------- pickups ----------------
const pickups = [];
function dropSalvage(pos) {
  const n = 1 + ((Math.random() * 2) | 0) + (Math.random() < 0.2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0x7fd8e8, emissive: 0x4e7c9a, emissiveIntensity: 1.2 }));
    m.position.copy(pos).add(new THREE.Vector3(rand(-0.7, 0.7), 0.5, rand(-0.7, 0.7)));
    scene.add(m);
    pickups.push(m);
  }
}

// ---------------- game state ----------------
const state = {
  started: false, over: false, hp: 100, maxHp: 100, salvage: 0,
  mech: 0, doorOpen: false, beaconLit: false, signals: 0, threat: 0,
  time: 0, spawnT: 4, waveT: 22, waveN: 0, lastHurt: -99, visitedDungeon: false
};
let vy = 0, grounded = true, attackCd = 0, heavyCd = 0, swingT = 0, swingHeavy = false;
let shake = 0, facing = 0, deathT = 0;

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
const hudEl = $('hud'), bannerEl = $('banner'), interactEl = $('interact'),
  interactLabel = $('interact-label'), hpFill = $('hp-fill'), vignette = $('vignette'),
  flashEl = $('flash'), fadeEl = $('fade'), objectiveEl = $('objective');
let bannerTimer = null;
function banner(text, ms = 3800) {
  bannerEl.textContent = text;
  bannerEl.style.opacity = 1;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => bannerEl.style.opacity = 0, ms);
}
function setObjective() {
  let t;
  if (state.beaconLit) t = 'Survive the sea\u2019s answer';
  else if (state.visitedDungeon) t = 'Search the dark for a way off this rock';
  else if (state.doorOpen) t = 'Descend through the stone door \u2014 find a way off this rock';
  else t = `Wake the hidden mechanisms (${state.mech}/3)`;
  objectiveEl.textContent = t;
}
function updateHP() {
  const r = clamp(state.hp / state.maxHp, 0, 1);
  hpFill.style.width = (r * 100) + '%';
  hpFill.classList.toggle('low', r < 0.35);
}

// ---------------- interactables registration ----------------
interactables.push(
  {
    pos: gear.position.clone(), radius: 3.0, label: 'Wake the stone gear',
    enabled: () => !gear.userData.done,
    action: () => {
      gear.userData.done = true; gear.userData.spin = true;
      state.mech++; state.threat++;
      glowMat.emissiveIntensity = 0;
      sfx.activate(); sfx.thunder();
      banner('Deep in the rock, something turns over.');
      spawnWave(2, false);
      setObjective();
    }
  },
  {
    pos: new THREE.Vector3(5, 10, 4), radius: 2.6, label: 'Step on the rune plate',
    enabled: () => !plate.userData.done,
    action: () => {
      plate.userData.done = true;
      plate.position.y = 10.05;
      plateGlow.material.opacity = 0.85;
      state.mech++; state.threat++;
      sfx.activate(); sfx.thunder();
      banner('The rune drinks the rain and lights from below.');
      spawnWave(2, false);
      setObjective();
    }
  },
  {
    pos: new THREE.Vector3(39.5, 0, 8.8), radius: 3.0, label: 'Turn the rusted winch',
    enabled: () => !winchDrum.userData.done,
    action: () => {
      winchDrum.userData.done = true; winchDrum.userData.spin = true;
      state.mech++; state.threat++;
      sfx.activate(); sfx.thunder();
      banner('Chains groan under the cliff. The door heard it.');
      spawnWave(3, false);
      setObjective();
    }
  },
  {
    pos: DOOR_POS.clone(), radius: 4.2, label: 'Open the stone door',
    enabled: () => state.mech >= 3 && !state.doorOpen,
    action: () => {
      state.doorOpen = true;
      doorSlab.userData.opening = true;
      doorRunes.forEach(r => r.material.emissiveIntensity = 1.6);
      sfx.door(); shake = 0.8;
      banner('The door that was never meant to be found, opens.');
      setObjective();
    }
  },
  {
    pos: new THREE.Vector3(DX + 13, 0, DX * 0 + -9), radius: 3.0, label: 'Search the broken boat',
    enabled: () => true,
    action: () => {
      banner('Splinters and salt. It was never going to hold.');
      sfx.hit();
    }
  },
  {
    pos: new THREE.Vector3(DX + 0, 0, -10), radius: 3.0, label: 'Light the beacon',
    enabled: () => !beaconLit,
    action: () => {
      beaconLit = true;
      beaconFlame.visible = true;
      beaconLight.intensity = 5;
      state.signals++; state.threat += 2;
      sfx.activate(); sfx.roar();
      banner('The beacon burns. Out in the black, the sea begins to move.', 5000);
      spawnWave(5, 'They are coming ashore.');
      setObjective();
    }
  }
);

// ---------------- input ----------------
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyQ') doAttack(true);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys[e.code] = false);
const mouseNDC = new THREE.Vector2();
addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.target.tagName === 'CANVAS') doAttack(false);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

$('start-btn').onclick = () => {
  audio();
  $('title-screen').style.display = 'none';
  hudEl.style.display = 'block';
  state.started = true;
  setObjective();
  banner('Washed ashore. The cliffs are the only way left to go.');
};
$('restart-btn').onclick = () => location.reload();

// ---------------- combat ----------------
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
function updateAim() {
  raycaster.setFromCamera(mouseNDC, camera);
  aimPlane.constant = -player.position.y;
  raycaster.ray.intersectPlane(aimPlane, aimPoint);
}
function doAttack(heavy) {
  if (!state.started || state.over) return;
  if (attackCd > 0) return;
  if (heavy && heavyCd > 0) return;
  swingHeavy = heavy;
  swingT = 0.3;
  attackCd = heavy ? 0.6 : 0.45;
  if (heavy) heavyCd = 5;
  const dx = aimPoint.x - player.position.x, dz = aimPoint.z - player.position.z;
  if (dx * dx + dz * dz > 0.01) facing = Math.atan2(dx, dz);
  const range = heavy ? 3.4 : 2.5;
  const arc = heavy ? Math.PI : 1.9;
  const dmg = heavy ? 55 : 24;
  sfx.swing();
  if (heavy) { shake = Math.max(shake, 0.35); playNoise(0.3, 500, 'lowpass', 0.25, 0.25); }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ex = e.g.position.x - player.position.x, ez = e.g.position.z - player.position.z;
    const d = Math.hypot(ex, ez);
    if (d > range + (e.big ? 1.2 : 0)) continue;
    const ang = Math.abs(((Math.atan2(ex, ez) - facing + Math.PI * 3) % TAU) - Math.PI);
    if (ang > arc / 2) continue;
    damageEnemy(e, dmg, ex / (d || 1), ez / (d || 1));
  }
}
function damageEnemy(e, dmg, kx, kz) {
  e.hp -= dmg;
  e.hitFlash = 0.12;
  e.mat.emissive.setHex(0xffffff);
  e.g.position.x += kx * 0.45;
  e.g.position.z += kz * 0.45;
  sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  dropSalvage(e.g.position);
  scene.remove(e.g);
  enemies.splice(enemies.indexOf(e), 1);
  if (e.big) { banner('The deep one sinks back, unfinished business.'); shake = 0.5; }
}
function damagePlayer(d) {
  if (state.over) return;
  state.hp -= d;
  state.lastHurt = state.time;
  shake = Math.max(shake, 0.3);
  vignette.style.opacity = 0.9;
  sfx.hurt();
  updateHP();
  if (state.hp <= 0) {
    state.hp = 0;
    state.over = true;
    updateHP();
    setTimeout(() => {
      $('death-stats').textContent = `SALVAGE RECOVERED: ${state.salvage}  \u2022  THE SEA REMAINS`;
      $('death-screen').style.display = 'flex';
    }, 1200);
  }
}
function tryInteract() {
  if (!state.started || state.over) return;
  let best = null, bd = 1e9;
  for (const it of interactables) {
    if (!it.enabled()) continue;
    const d = Math.hypot(it.pos.x - player.position.x, it.pos.z - player.position.z);
    if (d < it.radius && d < bd) { bd = d; best = it; }
  }
  if (best) best.action();
}

// ---------------- door & dungeon transitions ----------------
function enterDungeon() {
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    player.position.set(DX - 16, 0, 0);
    vy = 0;
    state.visitedDungeon = true;
    setObjective();
    banner('Dripping halls. Old wood. Old bones. A chance.');
    fadeEl.style.opacity = 0;
  }, 550);
}
function exitDungeon() {
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    player.position.set(DOOR_POS.x * 0.85, terrainHeight(DOOR_POS.x * 0.85, DOOR_POS.z * 0.85), DOOR_POS.z * 0.85);
    vy = 0;
    fadeEl.style.opacity = 0;
  }, 550);
}

// ---------------- lightning ----------------
let nextFlash = rand(3, 7), flashDecay = 0;

// ---------------- main loop ----------------
const clock = new THREE.Clock();
const camOffset = new THREE.Vector3(14, 17, 14);
const desiredCam = new THREE.Vector3();
const fwd = new THREE.Vector3(), rightV = new THREE.Vector3(), moveV = new THREE.Vector3();
const _barQ = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;

  // ocean
  {
    const pos = oceanGeo.attributes.position;
    const t = state.time;
    for (let i = 0; i < pos.count; i++) {
      const x = oceanBase[i * 3], z = oceanBase[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.14 + t * 1.1) * 0.35 + Math.cos(z * 0.11 + t * 0.8) * 0.3 + Math.sin((x + z) * 0.06 + t * 0.5) * 0.25);
    }
    pos.needsUpdate = true;
    oceanGeo.computeVertexNormals();
  }

  rain.visible = !inDungeonZone(player.position.x);

  // rain follows camera
  {
    const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_N; i++) {
      let y = p.getY(i) - 30 * dt;
      if (y < camera.position.y - 22) {
        y = camera.position.y + 18;
        p.setX(i, camera.position.x + rand(-35, 35));
        p.setZ(i, camera.position.z + rand(-35, 35));
      }
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }

  // lightning
  nextFlash -= dt;
  if (nextFlash <= 0) {
    nextFlash = rand(4, 10);
    flashDecay = 1;
    flashEl.style.opacity = 0.55;
    setTimeout(() => flashEl.style.opacity = 0, 90);
    if (state.started) sfx.thunder();
  }
  if (flashDecay > 0) {
    flashDecay = Math.max(0, flashDecay - dt * 3);
    storm.intensity = 1.4 + flashDecay * 3.5;
    hemi.intensity = 0.75 + flashDecay * 1.2;
  }
  vignette.style.opacity = Math.max(0, parseFloat(vignette.style.opacity || 0) - dt * 1.6);

  // mechanisms idle animation
  if (gear.userData.spin) gear.rotation.z += dt * 2.5;
  if (winchDrum.userData.spin) winchDrum.rotation.x += dt * 3;
  if (!plate.userData.done) plateGlow.material.opacity = 0.25 + Math.sin(state.time * 3) * 0.2;
  doorRunes.forEach((r, i) => {
    if (!state.doorOpen) r.material.emissiveIntensity = 0.2 + Math.sin(state.time * 2 + i) * 0.15 + (state.mech / 3) * 0.6;
  });
  if (doorSlab.userData.opening && doorSlab.position.y > -7.5) {
    doorSlab.position.y -= dt * 1.6;
    if (Math.random() < 0.3) shake = Math.max(shake, 0.25);
  }
  if (fireLit) {
    fireFlame.scale.y = 1 + Math.sin(state.time * 11) * 0.18;
    fireGlow.intensity = 3 + Math.sin(state.time * 9) * 0.6;
  }
  if (beaconLit) {
    beaconFlame.scale.y = 1 + Math.sin(state.time * 9) * 0.15;
    beaconLight.intensity = 5 + Math.sin(state.time * 7.3) * 0.9;
  }

  if (state.started && !state.over) {
    updateAim();

    // movement
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    rightV.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    moveV.set(0, 0, 0);
    if (keys.KeyW) moveV.add(fwd);
    if (keys.KeyS) moveV.sub(fwd);
    if (keys.KeyD) moveV.add(rightV);
    if (keys.KeyA) moveV.sub(rightV);
    const moving = moveV.lengthSq() > 0;
    if (moving) {
      moveV.normalize().multiplyScalar(6 * dt);
      const px = player.position.x, pz = player.position.z, py = player.position.y;
      let nx = px + moveV.x, nz = pz + moveV.z;
      const dungeon = inDungeonZone(px);
      let ok = true;
      if (!dungeon) {
        ok = canStand(px, pz, py, nx, nz) && Math.hypot(nx, nz) <= 52;
        if (!ok) {
          if (canStand(px, pz, py, nx, pz) && Math.hypot(nx, pz) <= 52) { ok = true; nz = pz; }
          else if (canStand(px, pz, py, px, nz) && Math.hypot(px, nz) <= 52) { ok = true; nx = px; }
          else ok = false;
        }
      } else {
        ok = nx > DX - 21.5 && nx < DX + 21.5 && nz > -14.5 && nz < 14.5;
      }
      if (ok) {
        player.position.x = nx;
        player.position.z = nz;
        facing = lerpAngle(facing, Math.atan2(moveV.x, moveV.z), 1 - Math.pow(0.0001, dt));
      }
    }

    // vertical
    const dungeonNow = inDungeonZone(player.position.x);
    const groundY = dungeonNow ? 0 : terrainHeight(player.position.x, player.position.z);
    if (keys.Space && grounded) { vy = 7.2; grounded = false; }
    vy -= 22 * dt;
    player.position.y += vy * dt;
    if (player.position.y <= groundY) { player.position.y = groundY; vy = 0; grounded = true; }
    else grounded = false;
    player.rotation.y = facing;
    player.children[0].position.y = 0.85 + (moving && grounded ? Math.abs(Math.sin(state.time * 10)) * 0.06 : 0);

    // transitions
    if (state.doorOpen) {
      if (Math.hypot(player.position.x - DOOR_POS.x, player.position.z - DOOR_POS.z) < 2.2) enterDungeon();
    }
    if (state.visitedDungeon && dungeonNow && player.position.x < DX - 20.5) exitDungeon();

    // regen
    if (state.time - state.lastHurt > 5 && state.hp < state.maxHp) {
      state.hp = Math.min(state.maxHp, state.hp + 4 * dt);
      updateHP();
    }

    // cooldowns
    attackCd = Math.max(0, attackCd - dt);
    heavyCd = Math.max(0, heavyCd - dt);

    // spawning
    const onIsland = !dungeonNow;
    if ((state.mech > 0 || state.beaconLit) && ((onIsland && state.mech > 0) || (!onIsland && state.beaconLit))) {
      state.spawnT -= dt;
      const interval = state.beaconLit ? 3.0 : Math.max(2.5, 7 - state.threat * 0.7);
      if (state.spawnT <= 0) {
        state.spawnT = interval;
        spawnEnemy(spawnEdge(), false);
      }
    }
    if (state.beaconLit) {
      state.waveT -= dt;
      if (state.waveT <= 0) {
        state.waveN++;
        state.waveT = 22;
        const n = 3 + state.waveN;
        for (let i = 0; i < n; i++) setTimeout(() => { if (!state.over) spawnEnemy(spawnEdge(), false); }, i * 400);
        if (state.waveN % 3 === 0) {
          setTimeout(() => {
            if (state.over) return;
            spawnEnemy(spawnEdge(), true);
            sfx.roar();
            banner('Something vast has smelled the light.');
          }, n * 400 + 300);
        }
        banner(`The sea answers \u2014 wave ${state.waveN}`);
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const ex = player.position.x - e.g.position.x, ez = player.position.z - e.g.position.z;
      const d = Math.hypot(ex, ez);
      if (d > 0.01) {
        const sp = e.speed * dt;
        e.g.position.x += (ex / d) * sp;
        e.g.position.z += (ez / d) * sp;
        e.g.rotation.y = Math.atan2(ex, ez);
      }
      for (let j = i - 1; j >= 0; j--) {
        const o = enemies[j];
        const sx = e.g.position.x - o.g.position.x, sz = e.g.position.z - o.g.position.z;
        const sd = Math.hypot(sx, sz);
        const minD = 0.9 * (e.g.scale.x + o.g.scale.x) * 0.5 + 0.3;
        if (sd > 0.001 && sd < minD) {
          const push = (minD - sd) * 0.5;
          e.g.position.x += (sx / sd) * push; e.g.position.z += (sz / sd) * push;
          o.g.position.x -= (sx / sd) * push; o.g.position.z -= (sz / sd) * push;
        }
      }
      const gy = inDungeonZone(e.g.position.x) ? 0 : terrainHeight(e.g.position.x, e.g.position.z);
      e.phase += dt * 8;
      e.g.position.y = gy + Math.abs(Math.sin(e.phase)) * 0.25 * e.g.scale.x;
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        if (e.hitFlash <= 0) e.mat.emissive.setHex(0x000000);
      }
      e.atkCd -= dt;
      if (d < 1.9 + (e.big ? 1.2 : 0)) {
        e.windup += dt;
        if (e.windup > 0.45 && e.atkCd <= 0) {
          e.atkCd = 1.3;
          e.windup = 0;
          if (d < 2.4 + (e.big ? 1.2 : 0)) damagePlayer(e.dmg);
        }
      } else e.windup = Math.max(0, e.windup - dt * 2);
      e.bar.g.quaternion.copy(camera.quaternion).premultiply(_barQ.setFromAxisAngle(_up, -e.g.rotation.y));
      const ratio = clamp(e.hp / e.maxHp, 0, 1);
      e.bar.fg.scale.x = ratio;
      e.bar.fg.position.x = -(1 - ratio) * e.bar.w / 2;
      e.bar.g.visible = e.hp < e.maxHp;
    }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const m = pickups[i];
      m.rotation.y += dt * 3;
      m.rotation.x += dt * 2;
      const d = m.position.distanceTo(player.position);
      if (d < 3.2) m.position.lerp(player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), dt * 6);
      if (d < 0.9) {
        scene.remove(m);
        pickups.splice(i, 1);
        state.salvage++;
        $('salvage-num').textContent = state.salvage;
        sfx.pickup();
      }
    }

    // interact prompt
    {
      let best = null, bd = 1e9;
      for (const it of interactables) {
        if (!it.enabled()) continue;
        const d = Math.hypot(it.pos.x - player.position.x, it.pos.z - player.position.z);
        if (d < it.radius && d < bd) { bd = d; best = it; }
      }
      if (best) {
        interactEl.style.display = 'block';
        interactLabel.textContent = best.label;
      } else interactEl.style.display = 'none';
    }
  }

  // swing animation
  if (swingT > 0) {
    swingT -= dt;
    const t = 1 - Math.max(0, swingT) / 0.3;
    armPivot.rotation.x = swingHeavy
      ? lerp(-2.6, 0.7, Math.min(1, t * 1.6))
      : lerp(-1.8, 0.5, Math.min(1, t * 1.8));
  } else {
    armPivot.rotation.x = Math.sin(state.time * 2.2) * 0.06;
  }

  // camera
  desiredCam.copy(player.position).add(camOffset);
  camera.position.lerp(desiredCam, 1 - Math.pow(0.0005, dt));
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.6);
    camera.position.x += rand(-1, 1) * shake * 0.4;
    camera.position.y += rand(-1, 1) * shake * 0.4;
  }
  camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);
  storm.position.set(player.position.x - 30, 45, player.position.z - 20);
  storm.target.position.copy(player.position);

  if (state.over) {
    deathT += dt;
    player.rotation.z = Math.min(Math.PI / 2, deathT * 1.5);
    player.position.y = Math.max(terrainHeight(player.position.x, player.position.z) - 0.4, player.position.y - dt * 0.5);
  }

  renderer.render(scene, camera);
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + d * t;
}
animate();

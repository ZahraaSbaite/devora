// WebGL scenes of studio objects — laptop, phone, browser, code tag, cursor,
// gears, database, chat bubbles, paper plane — in the brand colors. They
// float, follow the mouse, grow on hover and do a full turn when clicked.
// Used full-screen behind the home hero (#heroScene) and as a small cluster
// in each inner page header (canvas.page-scene, picked with data-set).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const C = { slate:0x6666ff, peri:0xb8baff, columbia:0xc9e8ff, celadon:0xb9f0d7, white:0xf5f5fb };

const glossy = color => new THREE.MeshPhysicalMaterial({
  color, roughness:0.25, metalness:0.15, clearcoat:1, clearcoatRoughness:0.12
});

// ---------- screen textures (drawn once on a canvas) ----------
function screenTexture(kind){
  const w = 512, h = kind === 'app' ? 1024 : 320;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const box = (x, y, bw, bh, color, r = 8) => {
    g.fillStyle = color;
    g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill();
  };
  g.fillStyle = '#10101e';
  g.fillRect(0, 0, w, h);

  if(kind === 'code'){
    // editor: line numbers + colored token bars
    const colors = ['#b8baff', '#c9e8ff', '#b9f0d7', '#6666ff', '#f5f5fb'];
    const lines = [[0,3,5],[1,2,4,3],[1,6],[2,3,2,4],[2,5],[1,2],[0,1],[0,4,3],[1,3,6],[1,2]];
    lines.forEach((tokens, i) => {
      const y = 22 + i * 29;
      box(14, y + 4, 18, 10, '#2a2a44', 3);
      let x = 48 + tokens[0] * 26;
      tokens.slice(1).forEach((len, j) => {
        box(x, y, len * 22, 16, colors[(i + j) % colors.length], 5);
        x += len * 22 + 12;
      });
    });
  }else if(kind === 'site'){
    // browser: tab bar, nav, hero text, button, image tiles
    box(0, 0, w, 34, '#1b1b30', 0);
    ['#ff6b6b', '#ffd166', '#8fe3a0'].forEach((col, i) => box(16 + i * 20, 12, 10, 10, col, 5));
    box(110, 9, 280, 16, '#26263c', 8);
    box(24, 56, 70, 12, '#b8baff', 6);
    [0,1,2].forEach(i => box(300 + i * 62, 58, 46, 8, '#3a3a58', 4));
    box(24, 96, 260, 26, '#f5f5fb', 8);
    box(24, 130, 200, 26, '#f5f5fb', 8);
    box(24, 172, 230, 10, '#5a5a78', 5);
    box(24, 202, 110, 30, '#6666ff', 15);
    box(310, 96, 178, 138, '#b9f0d7', 14);
    box(334, 120, 60, 60, '#6666ff', 30);
    [0,1,2].forEach(i => box(24 + i * 160, 256, 144, 48, '#1f1f36', 10));
  }else{ // app
    box(0, 0, w, 90, '#1b1b30', 0);
    box(32, 34, 140, 22, '#f5f5fb', 8);
    box(420, 28, 60, 34, '#6666ff', 17);
    box(32, 120, 448, 220, '#b8baff', 28);
    box(64, 160, 200, 26, '#16162a', 10);
    box(64, 200, 140, 18, '#3c3c6a', 9);
    box(64, 270, 120, 44, '#16162a', 22);
    [0,1,2,3].forEach(i => {
      const y = 380 + i * 132;
      box(32, y, 448, 112, '#1f1f36', 24);
      box(56, y + 24, 64, 64, ['#b9f0d7','#c9e8ff','#6666ff','#b8baff'][i], 18);
      box(140, y + 32, 200, 18, '#f5f5fb', 9);
      box(140, y + 62, 140, 14, '#5a5a78', 7);
    });
    box(176, 980, 160, 10, '#3a3a58', 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const screenMat = kind => new THREE.MeshBasicMaterial({ map: screenTexture(kind), toneMapped:false });

function roundedRect(w, h, r){
  const s = new THREE.Shape();
  s.moveTo(-w/2 + r, -h/2);
  s.lineTo(w/2 - r, -h/2);  s.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
  s.lineTo(w/2, h/2 - r);   s.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
  s.lineTo(-w/2 + r, h/2);  s.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
  s.lineTo(-w/2, -h/2 + r); s.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
  return s;
}
const polygon = pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const extrude = (shape, depth, bevel = 0.03) => {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:4, curveSegments:24
  });
  geo.center();
  return geo;
};

// ---------- objects ----------
function laptop(){
  const g = new THREE.Group();
  const body = glossy(C.peri);
  const base = new THREE.Mesh(extrude(roundedRect(2.4, 1.6, 0.12), 0.08), body);
  base.rotation.x = -Math.PI / 2;
  g.add(base);
  const lid = new THREE.Group(); // hinged at the back edge of the base
  lid.position.set(0, 0, -0.78);
  const frame = new THREE.Mesh(extrude(roundedRect(2.4, 1.55, 0.12), 0.06), body);
  frame.position.y = 0.78;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.18, 1.34), screenMat('code'));
  screen.position.set(0, 0.78, 0.07);
  lid.add(frame, screen);
  lid.rotation.x = -0.28;
  g.add(lid);
  g.rotation.x = 0.35;
  g.position.y = -0.4;
  return g;
}

function phone(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(extrude(roundedRect(1, 2, 0.16), 0.1), glossy(C.slate)));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.76), screenMat('app'));
  screen.position.z = 0.09;
  g.add(screen);
  return g;
}

function browser(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(extrude(roundedRect(2.5, 1.62, 0.12), 0.06), glossy(C.columbia)));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 1.46), screenMat('site'));
  screen.position.z = 0.07;
  g.add(screen);
  return g;
}

function codeTag(color = C.slate){
  // "</>" from two chevrons and a slash
  const g = new THREE.Group();
  const mat = glossy(color);
  const chevronPts = [[0.55, 0.62], [0.32, 0.62], [-0.2, 0], [0.32, -0.62], [0.55, -0.62], [0.03, 0]];
  const left = new THREE.Mesh(extrude(polygon(chevronPts), 0.22), mat);
  left.position.x = -0.85;
  const right = new THREE.Mesh(extrude(polygon(chevronPts.map(([x, y]) => [-x, y])), 0.22), mat);
  right.position.x = 0.85;
  const slash = new THREE.Mesh(extrude(polygon([[0.12, 0.72], [0.32, 0.72], [-0.12, -0.72], [-0.32, -0.72]]), 0.22), glossy(C.celadon));
  g.add(left, slash, right);
  return g;
}

function cursor(){
  const shape = polygon([[0, 0], [0, -1.1], [0.26, -0.84], [0.46, -1.28], [0.62, -1.2], [0.42, -0.78], [0.78, -0.78]]);
  return new THREE.Mesh(extrude(shape, 0.16), glossy(C.white));
}

function gear(teeth = 10, color = C.celadon){
  const s = new THREE.Shape();
  const rOut = 0.85, rIn = 0.68;
  for(let i = 0; i <= teeth * 2; i++){
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? rOut : rIn;
    if(i === 0) s.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    else s.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    if(i < teeth * 2) s.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.26, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(extrude(s, 0.26, 0.02), glossy(color)));
  return g;
}

function database(){
  const g = new THREE.Group();
  [C.slate, C.peri, C.columbia].forEach((col, i) => {
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 48), glossy(col));
    disk.position.y = (i - 1) * 0.42;
    g.add(disk);
  });
  g.rotation.x = 0.35;
  return g;
}

function bubble(color = C.peri, dots = true){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(extrude(roundedRect(1.8, 1.15, 0.4), 0.22), glossy(color)));
  const tail = new THREE.Mesh(extrude(polygon([[-0.2, 0.2], [-0.45, -0.25], [0.25, 0.2]]), 0.22), glossy(color));
  tail.position.set(-0.45, -0.62, 0);
  g.add(tail);
  if(dots){
    [-0.42, 0, 0.42].forEach(x => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), glossy(C.slate));
      d.position.set(x, 0, 0.2);
      g.add(d);
    });
  }
  return g;
}

function paperPlane(){
  // nose, wing tips, tail and a keel, as flat triangles
  const v = new Float32Array([
    1.4, 0, 0,   -0.9, 0, 0.95,  -0.6, 0, 0,
    1.4, 0, 0,   -0.6, 0, 0,     -0.9, 0, -0.95,
    1.4, 0, 0,   -0.6, 0, 0,     -0.7, -0.35, 0
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.computeVertexNormals();
  const mat = glossy(C.white);
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.rotation.set(0.6, 0.5, 0.3);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// ---------- layouts: [factory, position, scale, motion] ----------
// 'sway' keeps the front facing the viewer; gears turn in their own plane
const HERO = () => [
  [laptop,             [-4.3, -2.05,  0.0], 0.5,  'sway'], // left margin, beside the stats
  [phone,              [ 4.55,-1.1,   0.0], 0.55, 'sway'], // right margin
  [() => codeTag(),    [-4.4,  2.75, -1.5], 0.45, 'sway'], // peeks over the D
  [() => gear(10),     [ 4.5, -2.75, -0.5], 0.42, 'spin'],
  [database,           [ 4.3,  2.85, -2.0], 0.4,  'sway'], // peeks over the A
  [cursor,             [ 1.4, -1.5,   1.0], 0.38, 'sway']  // pointing at the CTA
];
const HEADER_SETS = [
  () => [ // about
    [laptop,           [ 0.4,  0.1,  0.0], 1.05, 'sway'],
    [() => codeTag(),  [-2.3,  1.4, -0.8], 0.55, 'sway'],
    [cursor,           [ 2.5, -1.3,  0.8], 0.6,  'sway']
  ],
  () => [ // services
    [browser,          [ 0.3,  0.5, -0.4], 1.0,  'sway'],
    [phone,            [ 2.3, -0.9,  0.6], 0.85, 'sway'],
    [() => gear(10),   [-2.3, -1.1,  0.0], 0.6,  'spin']
  ],
  () => [ // portfolio
    [browser,          [-0.4,  0.6, -0.8], 1.0,  'sway'],
    [browser,          [ 1.0, -0.6,  0.4], 0.8,  'sway'],
    [cursor,           [ 2.6,  1.2,  1.0], 0.55, 'sway']
  ],
  () => [ // process
    [() => gear(12, C.slate),    [-0.55, 0.45, 0.0], 1.15, 'spin'],
    [() => gear(8, C.celadon),   [ 1.05,-0.75, 0.2], 0.8,  'spin-rev'],
    [() => codeTag(C.peri),      [ 2.5,  1.4, -0.6], 0.45, 'sway']
  ],
  () => [ // faq
    [() => bubble(C.peri),           [-0.4,  0.5, 0.0], 1.0,  'sway'],
    [() => bubble(C.celadon, false), [ 1.7, -0.9, 0.6], 0.65, 'sway'],
    [cursor,                         [-2.4, -1.2, 0.4], 0.5,  'sway']
  ],
  () => [ // contact
    [paperPlane,              [ 0.3,  0.5,  0.0], 1.1, 'sway'],
    [() => bubble(C.celadon), [-2.2, -0.9, -0.4], 0.7, 'sway'],
    [phone,                   [ 2.4, -0.7,  0.5], 0.7, 'sway']
  ]
];

const heroCanvas = document.getElementById('heroScene');
if(heroCanvas) init(heroCanvas, HERO(), true);
document.querySelectorAll('canvas.page-scene').forEach(c => {
  const set = HEADER_SETS[Number(c.dataset.set) || 0] || HEADER_SETS[0];
  init(c, set(), false);
});

function init(canvas, specs, isHero){
  if(!canvas.offsetWidth) return; // hidden (header scenes are off on small screens)
  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  }catch(err){
    return; // no WebGL: the page still works, just without the scene
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a55, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rimA = new THREE.PointLight(C.slate, 40, 30);
  rimA.position.set(-6, -3, 4);
  scene.add(rimA);
  const rimB = new THREE.PointLight(C.celadon, 30, 30);
  rimB.position.set(6, -2, 3);
  scene.add(rimB);

  // Each object hangs from a pivot that carries its position, hover scale
  // and click turn, so the object's own resting angle is preserved.
  const pivots = specs.map(([make, pos, scale, motion], i) => {
    const obj = make();
    const pivot = new THREE.Group();
    pivot.add(obj);
    pivot.position.set(...pos);
    pivot.scale.setScalar(scale);
    pivot.userData = {
      home: new THREE.Vector3(...pos),
      baseScale: scale, scale, motion, obj,
      phase: i * 1.7, turn: 0, turnTarget: 0, punch: 0
    };
    scene.add(pivot);
    return pivot;
  });

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const spread = Math.min(1, camera.aspect / 1.6);
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    const portrait = isHero && camera.aspect < 1.1;
    pivots.forEach(p => {
      const u = p.userData;
      if(portrait){
        // tall screens: small objects peeking in from the side edges
        u.scale = u.baseScale * (camera.aspect < 0.7 ? 0.42 : 0.55);
        p.position.x = Math.sign(u.home.x) * halfW * 0.92;
      }else if(isHero){
        u.scale = u.baseScale * (0.6 + 0.4 * spread);
        p.position.x = u.home.x * spread;
      }else{
        u.scale = u.baseScale;
      }
    });
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- pointer: parallax, hover and click ----
  const pointer = new THREE.Vector2(9, 9); // off-canvas until the mouse arrives
  const target = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let hovered = null;
  const section = canvas.closest('section');
  const clamp = v => Math.max(-1, Math.min(1, v));

  section.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    target.set(clamp(pointer.x), clamp(pointer.y));
  });
  section.addEventListener('pointerleave', () => {
    target.set(0, 0); pointer.set(9, 9); hovered = null; canvas.style.cursor = '';
  });
  canvas.addEventListener('click', () => {
    if(hovered){
      hovered.userData.turnTarget += Math.PI * 2; // one full turn
      hovered.userData.punch = 1;
    }
  });

  function pick(){
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pivots, true)[0];
    let o = hit ? hit.object : null;
    while(o && !pivots.includes(o)) o = o.parent;
    hovered = o;
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  // ---- loop, paused when off-screen or the tab is hidden ----
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let visible = true, running = false;

  function pose(p, t){
    const u = p.userData;
    if(u.motion === 'spin' || u.motion === 'spin-rev'){
      p.rotation.set(0.25 + Math.sin(t * 0.5 + u.phase) * 0.15, -0.3 + u.turn, 0);
    }else{
      // gentle sway that keeps screens and faces readable, angled toward center
      p.rotation.set(
        Math.sin(t * 0.6 + u.phase) * 0.08,
        Math.sin(t * 0.45 + u.phase) * 0.3 - Math.sign(u.home.x || 1) * 0.3 + u.turn,
        Math.sin(t * 0.5 + u.phase) * 0.04
      );
    }
  }

  function frame(){
    if(!visible || document.hidden){ running = false; return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const scrollY = Math.min(window.scrollY / window.innerHeight, 1.5);

    camera.position.x += (target.x * 0.9 - camera.position.x) * 0.05;
    camera.position.y += (target.y * 0.6 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    pick();
    pivots.forEach(p => {
      const u = p.userData;
      u.turn += (u.turnTarget - u.turn) * 0.06;
      if(u.motion === 'spin') u.obj.rotation.z += 0.45 * dt;
      if(u.motion === 'spin-rev') u.obj.rotation.z -= 0.65 * dt; // meshing gear turns the other way
      pose(p, t);
      p.position.y = u.home.y * (1 + scrollY * (isHero ? 0.5 : 0.2)) + Math.sin(t * 0.8 + u.phase) * 0.15;
      p.position.z = u.home.z + scrollY * (isHero ? 2 : 1);
      u.punch *= 0.9;
      const s = u.scale * (p === hovered ? 1.12 : 1) * (1 + u.punch * 0.2);
      p.scale.setScalar(p.scale.x + (s - p.scale.x) * 0.15);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function start(){
    if(running || reduceMotion) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(frame);
  }

  if(reduceMotion){
    pivots.forEach(p => pose(p, 0));
    renderer.render(scene, camera); // one still frame
    return;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if(visible) start();
  }).observe(section);
  document.addEventListener('visibilitychange', start);
  start();
}

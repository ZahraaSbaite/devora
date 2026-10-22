// WebGL scene behind the home hero: glossy shapes in the brand colors that
// float, follow the mouse, grow on hover and spin when clicked.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const canvas = document.getElementById('heroScene');
if(canvas) init();

function init(){
  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  }catch(err){
    return; // no WebGL: the hero still works, just without the scene
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a55, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rimA = new THREE.PointLight(0x6666ff, 40, 30);
  rimA.position.set(-6, -3, 4);
  scene.add(rimA);
  const rimB = new THREE.PointLight(0xb9f0d7, 30, 30);
  rimB.position.set(6, -2, 3);
  scene.add(rimB);

  const material = color => new THREE.MeshPhysicalMaterial({
    color, roughness:0.22, metalness:0.15, clearcoat:1, clearcoatRoughness:0.12
  });

  // [geometry, color, position, scale]
  const specs = [
    [new THREE.TorusKnotGeometry(0.7, 0.24, 160, 24), 0x6666ff, [ 4.6,  2.0, -1.5], 0.8],
    [new THREE.IcosahedronGeometry(0.9, 0),          0xb8baff, [-5.4, -1.2, -0.5], 0.75],
    [new THREE.TorusGeometry(0.7, 0.26, 32, 80),     0xb9f0d7, [-4.4,  2.1, -2.0], 0.8],
    [new THREE.SphereGeometry(0.62, 48, 48),         0xc9e8ff, [ 5.2, -0.9,  0.0], 0.8],
    [new THREE.OctahedronGeometry(0.55, 0),          0x6666ff, [-1.2,  3.4, -3.0], 0.7],
    [new THREE.DodecahedronGeometry(0.45, 0),        0xb9f0d7, [ 1.4,  3.4, -3.5], 0.8],
    [new THREE.SphereGeometry(0.16, 32, 32),         0x6666ff, [-3.0,  0.4,  2.0], 1.0]
  ];

  const shapes = specs.map(([geo, color, pos, scale], i) => {
    const mesh = new THREE.Mesh(geo, material(color));
    mesh.position.set(...pos);
    mesh.userData = {
      home: new THREE.Vector3(...pos),
      baseScale: scale,
      scale,
      spin: new THREE.Vector3(0.12 + i * 0.03, 0.18 + i * 0.02, 0),
      boost: 0,
      phase: i * 1.7
    };
    scene.add(mesh);
    return mesh;
  });

  // Narrow screens: pull the shapes in and shrink them so they stay visible.
  let spread = 1;
  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    spread = Math.min(1, camera.aspect / 1.6);
    // half the visible width at z=0
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    const portrait = camera.aspect < 1.1;
    shapes.forEach(m => {
      const u = m.userData;
      if(portrait){
        // tall screens: small shapes peeking in from the side edges
        u.scale = u.baseScale * (camera.aspect < 0.7 ? 0.38 : 0.5);
        m.position.x = Math.sign(u.home.x) * halfW * 0.95;
      }else{
        u.scale = u.baseScale * (0.6 + 0.4 * spread);
        m.position.x = u.home.x * spread;
      }
    });
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- pointer: parallax, hover and click ----
  const pointer = new THREE.Vector2();
  const target = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let hovered = null;
  const hero = canvas.closest('section');

  hero.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    target.copy(pointer);
  });
  hero.addEventListener('pointerleave', () => { target.set(0, 0); hovered = null; canvas.style.cursor = ''; });
  canvas.addEventListener('click', () => {
    if(hovered){
      hovered.userData.boost = 9; // fast spin that decays
      hovered.userData.punch = 1;
    }
  });

  function pick(){
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(shapes, false)[0];
    hovered = hit ? hit.object : null;
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  // ---- loop, paused when the hero is off-screen or the tab is hidden ----
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let visible = true, running = false;

  function frame(){
    if(!visible || document.hidden){ running = false; return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const scrollY = Math.min(window.scrollY / window.innerHeight, 1.5);

    camera.position.x += (target.x * 0.9 - camera.position.x) * 0.05;
    camera.position.y += (target.y * 0.6 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    pick();
    shapes.forEach(m => {
      const u = m.userData;
      u.boost *= 0.95;
      m.rotation.x += (u.spin.x + u.boost) * dt;
      m.rotation.y += (u.spin.y + u.boost * 0.6) * dt;
      // float, and drift apart as the page scrolls
      m.position.y = u.home.y * (1 + scrollY * 0.5) + Math.sin(t * 0.8 + u.phase) * 0.18;
      m.position.z = u.home.z + scrollY * 2;
      u.punch = (u.punch || 0) * 0.9;
      const s = u.scale * (m === hovered ? 1.15 : 1) * (1 + u.punch * 0.25);
      m.scale.setScalar(m.scale.x + (s - m.scale.x) * 0.15);
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
    renderer.render(scene, camera); // one still frame
    return;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if(visible) start();
  }).observe(hero);
  document.addEventListener('visibilitychange', start);
  start();
}

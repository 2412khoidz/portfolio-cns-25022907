import * as THREE from './three.module.min.js';

const stage = document.querySelector('[data-solar-system]');
const canvas = document.querySelector('[data-solar-canvas]');

if (stage && canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x07070d, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);
  camera.position.set(0, 0, 28);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  root.rotation.x = -0.58;
  root.rotation.y = -0.18;
  root.scale.setScalar(1.06);
  scene.add(root);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(9, 9);
  const textureLoader = new THREE.TextureLoader();
  const planetItems = [];
  const labels = Array.from(document.querySelectorAll('[data-planet-label]'));
  const sunLabel = document.querySelector('[data-sun-label]');
  let hovered = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let targetRotX = root.rotation.x;
  let targetRotY = root.rotation.y;

  const texturePaths = {
    mercury: 'assets/planets/2k_mercury.jpg',
    venus: 'assets/planets/2k_venus_surface.jpg',
    venusAtmosphere: 'assets/planets/2k_venus_atmosphere.jpg',
    earth: 'assets/planets/2k_earth_daymap.jpg',
    earthNight: 'assets/planets/2k_earth_nightmap.jpg',
    mars: 'assets/planets/2k_mars.jpg',
    jupiter: 'assets/planets/2k_jupiter.jpg',
    saturn: 'assets/planets/2k_saturn.jpg',
    saturnRing: 'assets/planets/2k_saturn_ring_alpha.png',
    uranus: 'assets/planets/2k_uranus.jpg',
    stars: 'assets/planets/2k_stars_milky_way.jpg'
  };

  function loadTexture(path, fallback) {
    const texture = textureLoader.load(path, undefined, undefined, () => {
      if (fallback) texture.image = fallback.image;
      texture.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 6;
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  function makePlasmaSunTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const image = ctx.createImageData(size, size);
    const data = image.data;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = x / size;
        const ny = y / size;
        const wave =
          Math.sin((nx * 18 + ny * 7) * Math.PI) * 0.22 +
          Math.sin((nx * 42 - ny * 16) * Math.PI) * 0.12 +
          Math.sin((nx * 88 + ny * 55) * Math.PI) * 0.06;
        const grain = Math.sin((x * 12.9898 + y * 78.233) * 0.018) * 43758.5453;
        const noise = grain - Math.floor(grain);
        const hot = Math.max(0, wave + noise * 0.75);
        const i = (y * size + x) * 4;
        data[i] = 218 + hot * 37;
        data[i + 1] = 74 + hot * 150;
        data[i + 2] = 9 + hot * 42;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(size * 0.35, size * 0.32, 0, size * 0.5, size * 0.5, size * 0.58);
    glow.addColorStop(0, 'rgba(255,255,210,.92)');
    glow.addColorStop(0.22, 'rgba(255,218,90,.36)');
    glow.addColorStop(1, 'rgba(255,118,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  function makeFallbackTexture(type) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const colors = {
      mercury: ['#c8c3bc', '#706d68', '#333333'],
      venus: ['#fff0a5', '#d19545', '#7b431e'],
      earth: ['#65d8ff', '#126bc0', '#0a326e'],
      mars: ['#ed8250', '#b84a2f', '#4b1e15'],
      jupiter: ['#f7dfbd', '#bd8453', '#704630'],
      saturn: ['#f6dfaa', '#c7a86a', '#765737'],
      uranus: ['#caffff', '#5fd8dc', '#0d6a7a']
    }[type] || ['#ddd', '#777', '#222'];
    const g = ctx.createLinearGradient(0, 0, size, size);
    colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.38;
    for (let y = 0; y < size; y += 22) {
      ctx.fillStyle = colors[(y / 22) % colors.length | 0];
      ctx.fillRect(0, y + Math.sin(y * 0.08) * 8, size, 10);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const fallbackTextures = {};
  ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus'].forEach((type) => {
    fallbackTextures[type] = makeFallbackTexture(type);
  });
  const textures = Object.fromEntries(
    Object.entries(texturePaths).map(([key, path]) => [key, loadTexture(path, fallbackTextures[key])])
  );

  function makeGlow(color, size, opacity) {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 384;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(192, 192, 0, 192, 192, 192);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color);
    g.addColorStop(0.58, color.replace(/[\d.]+\)$/u, '.18)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 384, 384);
    const map = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  function makeRingTexture(primary, secondary) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.12, primary);
    g.addColorStop(0.27, secondary);
    g.addColorStop(0.42, 'rgba(255,255,255,.14)');
    g.addColorStop(0.62, primary);
    g.addColorStop(0.78, secondary);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 64);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeSaturnRingTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const image = ctx.createImageData(size, size);
    const data = image.data;
    const center = size * 0.5;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const r = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (r < 0.52 || r > 1) {
          data[i + 3] = 0;
          continue;
        }
        const band = (r - 0.52) / 0.48;
        const stripe =
          Math.sin(band * Math.PI * 24) * 0.08 +
          Math.sin(band * Math.PI * 73) * 0.035;
        const gap =
          (band > 0.36 && band < 0.41) ||
          (band > 0.68 && band < 0.71);
        const warm = 0.72 + stripe + (gap ? -0.28 : 0);
        const fadeIn = Math.min(1, Math.max(0, (r - 0.52) / 0.04));
        const fadeOut = Math.min(1, Math.max(0, (1 - r) / 0.055));
        const alpha = Math.max(0, Math.min(1, warm)) * fadeIn * fadeOut * (gap ? 0.38 : 0.78);
        data[i] = 222 + Math.round(28 * warm);
        data[i + 1] = 190 + Math.round(34 * warm);
        data[i + 2] = 135 + Math.round(28 * warm);
        data[i + 3] = Math.round(alpha * 255);
      }
    }

    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  function makeOrbit(distance) {
    const curve = new THREE.EllipseCurve(0, 0, distance, distance * 0.34, 0, Math.PI * 2);
    const points = curve.getPoints(220).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.48 });
    return new THREE.LineLoop(geo, mat);
  }

  scene.add(new THREE.AmbientLight(0x8eb6ff, 0.82));
  const sunLight = new THREE.PointLight(0xffcf74, 7.6, 95, 1.15);
  root.add(sunLight);
  const rimLight = new THREE.DirectionalLight(0x9beaff, 1.28);
  rimLight.position.set(-8, 14, 22);
  scene.add(rimLight);

  const starSphere = new THREE.Mesh(
    new THREE.SphereGeometry(64, 48, 32),
    new THREE.MeshBasicMaterial({
      map: textures.stars,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.72
    })
  );
  scene.add(starSphere);

  const starField = new THREE.BufferGeometry();
  const starPositions = [];
  const starColors = [];
  for (let i = 0; i < 620; i += 1) {
    starPositions.push((Math.random() - 0.5) * 54, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 30);
    const tone = i % 6 === 0 ? [0.48, 0.76, 1] : [1, 0.95, 0.78];
    starColors.push(...tone);
  }
  starField.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starField.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starField, new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.95
  })));

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 84, 84),
    new THREE.MeshBasicMaterial({ map: makePlasmaSunTexture(), color: 0xffd06a })
  );
  root.add(sun);
  root.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.48, 84, 84),
    new THREE.MeshBasicMaterial({
      color: 0xff8a19,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  ));
  root.add(makeGlow('rgba(255,118,22,.7)', 9.2, 0.55));
  root.add(makeGlow('rgba(255,207,74,.32)', 15, 0.32));

  const asteroidGeo = new THREE.BufferGeometry();
  const asteroidPositions = [];
  for (let i = 0; i < 920; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 8.55 + Math.random() * 1.05;
    asteroidPositions.push(Math.cos(a) * d, (Math.random() - 0.5) * 0.08, Math.sin(a) * d * 0.34);
  }
  asteroidGeo.setAttribute('position', new THREE.Float32BufferAttribute(asteroidPositions, 3));
  root.add(new THREE.Points(asteroidGeo, new THREE.PointsMaterial({
    size: 0.035,
    color: 0xc5c5c5,
    transparent: true,
    opacity: 0.58
  })));

  const projects = [
    { label: 'Bài 1', name: 'Sao Thủy', href: 'bai-1-thao-tac-tep-thu-muc.html', radius: 0.72, distance: 3.35, speed: 0.35, type: 'mercury', labelOffset: { x: 48, y: 8 } },
    { label: 'Bài 2', name: 'Sao Kim', href: 'bai-2-tim-kiem-danh-gia-thong-tin.html', radius: 0.92, distance: 4.9, speed: 0.29, type: 'venus', labelOffset: { x: 74, y: 58 } },
    { label: 'Bài 3', name: 'Trái Đất', href: 'bai-3-viet-prompt-hieu-qua.html', radius: 0.98, distance: 6.45, speed: 0.24, type: 'earth', labelOffset: { x: -38, y: 72 } },
    { label: 'Bài 4', name: 'Sao Hỏa', href: 'bai-4-hop-tac-truc-tuyen.html', radius: 0.78, distance: 7.92, speed: 0.21, type: 'mars', labelOffset: { x: -16, y: 55 } },
    { label: 'Bài 5', name: 'Sao Mộc', href: 'bai-5-ai-sang-tao-noi-dung.html', radius: 1.5, distance: 10.12, speed: 0.16, type: 'jupiter', labelOffset: { x: 0, y: 64 } },
    { label: 'Bài 6', name: 'Sao Thổ', href: 'bai-6-ai-co-trach-nhiem.html', radius: 1.28, distance: 12.34, speed: 0.13, type: 'saturn', ring: 'saturn', labelOffset: { x: 0, y: 68 } },
    { label: 'Bài 7', name: 'Sao Thiên Vương', href: 'bai-7-phan-tich-tai-lieu-voi-ai.html', radius: 1.08, distance: 14.55, speed: 0.11, type: 'uranus', ring: 'uranus', labelOffset: { x: 0, y: 68 } }
  ];

  projects.forEach((project, index) => {
    root.add(makeOrbit(project.distance));
    const pivot = new THREE.Group();
    pivot.rotation.y = index * 0.82 + 0.18;
    root.add(pivot);

    const material = new THREE.MeshStandardMaterial({
      map: textures[project.type],
      roughness: project.type === 'uranus' ? 0.42 : 0.56,
      metalness: 0.02
    });
    if (project.type === 'earth') {
      material.emissive = new THREE.Color(0x052245);
      material.emissiveIntensity = 0.16;
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(project.radius, 64, 64), material);
    mesh.position.set(project.distance, 0, 0);
    mesh.userData = { ...project, index };
    pivot.add(mesh);

    if (project.type === 'earth') {
      const cityLights = new THREE.Mesh(
        new THREE.SphereGeometry(project.radius * 1.012, 64, 64),
        new THREE.MeshBasicMaterial({
          map: textures.earthNight,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      mesh.add(cityLights);
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(project.radius * 1.08, 64, 64),
        new THREE.MeshBasicMaterial({
          color: 0x7fe9ff,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      mesh.add(atmosphere);
    }

    if (project.type === 'venus') {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(project.radius * 1.018, 64, 64),
        new THREE.MeshStandardMaterial({
          map: textures.venusAtmosphere,
          transparent: true,
          opacity: 0.5,
          roughness: 0.76,
          depthWrite: false
        })
      );
      mesh.add(atmosphere);
    }

    if (project.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(project.radius * 1.42, project.radius * (project.ring === 'saturn' ? 2.72 : 2.05), 160),
        new THREE.MeshBasicMaterial({
          map: project.ring === 'saturn'
            ? makeSaturnRingTexture()
            : makeRingTexture('rgba(150,255,255,.62)', 'rgba(40,164,183,.36)'),
          transparent: true,
          opacity: project.ring === 'saturn' ? 0.92 : 0.56,
          side: THREE.DoubleSide,
          alphaTest: project.ring === 'saturn' ? 0.04 : 0,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI * 0.49;
      ring.rotation.y = project.ring === 'saturn' ? -0.22 : -0.72;
      mesh.add(ring);
    }

    planetItems.push({ mesh, pivot, project, label: labels[index], index });
  });

  function resize() {
    const rect = stage.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    const compact = camera.aspect < 1.25;
    camera.position.set(0, 0, compact ? 40 : 35);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    root.scale.setScalar(compact ? 0.72 : 0.9);
    camera.updateProjectionMatrix();
  }

  function projectToScreen(object, label, offset = {}) {
    if (!label) return;
    const rect = stage.getBoundingClientRect();
    const pos = new THREE.Vector3();
    camera.updateMatrixWorld();
    object.getWorldPosition(pos);
    pos.project(camera);
    const x = (pos.x * 0.5 + 0.5) * rect.width + (offset.x || 0);
    const y = (-pos.y * 0.5 + 0.5) * rect.height + (offset.y || 0);
    const visible = pos.z < 1 && x > -170 && x < rect.width + 170 && y > -90 && y < rect.height + 130;
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
    label.classList.toggle('is-hidden', !visible);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetItems.map((item) => item.mesh), true);
    const hit = hits.find((candidate) => candidate.object.userData.href);
    hovered = hit?.object || null;
    canvas.classList.toggle('is-hovering', Boolean(hovered));
    planetItems.forEach(({ label, mesh }) => label?.classList.toggle('is-active', hovered === mesh));
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    updatePointer(event);
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    targetRotY += dx * 0.008;
    targetRotX = Math.max(-0.98, Math.min(-0.22, targetRotX + dy * 0.006));
  }, { passive: true });
  canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    canvas.classList.remove('is-dragging');
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    canvas.classList.remove('is-hovering');
    planetItems.forEach(({ label }) => label?.classList.remove('is-active'));
  });
  canvas.addEventListener('click', () => {
    if (hovered?.userData?.href) window.location.href = hovered.userData.href;
  });

  const reusableScale = new THREE.Vector3();
  let last = 0;
  function animate(time = 0) {
    const delta = Math.min((time - last) / 1000 || 0.016, 0.04);
    last = time;
    root.rotation.x += (targetRotX - root.rotation.x) * 0.08;
    root.rotation.y += (targetRotY - root.rotation.y) * 0.08;
    starSphere.rotation.y += delta * 0.006;
    sun.rotation.y += delta * 0.23;

    planetItems.forEach(({ mesh, pivot, project, label }) => {
      if (!reduceMotion && !dragging) pivot.rotation.y += delta * project.speed;
      mesh.rotation.y += delta * (project.type === 'jupiter' ? 0.3 : 0.48);
      const scale = hovered === mesh ? 1.13 : 1;
      reusableScale.set(scale, scale, scale);
      mesh.scale.lerp(reusableScale, 0.12);
    });
    scene.updateMatrixWorld(true);
    planetItems.forEach(({ mesh, project, label }) => {
      projectToScreen(mesh, label, project.labelOffset);
    });
    if (sunLabel) projectToScreen(sun, sunLabel, { x: 0, y: 104 });

    renderer.render(scene, camera);
    window.__solarFrame = (window.__solarFrame || 0) + 1;
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  function scrollToOrbit() {
    if (location.hash !== '#project-orbit') return;
    const section = stage.closest('#project-orbit');
    if (!section) return;
    const headerOffset = 86;
    const top = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }
  if (location.hash === '#project-orbit') {
    [90, 320, 760].forEach((delay) => setTimeout(scrollToOrbit, delay));
  }
  stage.dataset.solarReady = 'true';
  window.__solarReady = true;
  window.__solarObjects = planetItems.length;
  animate();
}

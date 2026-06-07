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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x05070d, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  const root = new THREE.Group();
  scene.add(root);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(9, 9);
  const textureLoader = new THREE.TextureLoader();
  const planetItems = [];
  const labels = Array.from(document.querySelectorAll('[data-planet-label]'));
  const sunLabel = document.querySelector('[data-sun-label]');
  let hovered = null;
  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;
  let orbitAzimuth = -0.62;
  let orbitElevation = 0.58;
  let orbitDistance = 29;
  let targetAzimuth = orbitAzimuth;
  let targetElevation = orbitElevation;
  let targetDistance = orbitDistance;

  const texturePaths = {
    mercury: 'assets/planets/2k_mercury.jpg',
    venus: 'assets/planets/2k_venus_surface.jpg',
    venusAtmosphere: 'assets/planets/2k_venus_atmosphere.jpg',
    earth: 'assets/planets/2k_earth_daymap.jpg',
    earthNight: 'assets/planets/2k_earth_nightmap.jpg',
    mars: 'assets/planets/2k_mars.jpg',
    jupiter: 'assets/planets/2k_jupiter.jpg',
    saturn: 'assets/planets/2k_saturn.jpg',
    neptune: 'assets/planets/2k_neptune.jpg'
  };

  function makeFallbackTexture(type) {
    const size = 384;
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
      neptune: ['#62a6ff', '#1d63bc', '#09285f']
    }[type] || ['#ddd', '#777', '#222'];
    const g = ctx.createLinearGradient(0, 0, size, size);
    colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function loadTexture(path, fallback) {
    const texture = textureLoader.load(path, undefined, undefined, () => {
      if (fallback) texture.image = fallback.image;
      texture.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  const fallbackTextures = {};
  ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'neptune'].forEach((type) => {
    fallbackTextures[type] = makeFallbackTexture(type);
  });
  const textures = Object.fromEntries(
    Object.entries(texturePaths).map(([key, path]) => [key, loadTexture(path, fallbackTextures[key])])
  );

  function makeSunTexture() {
    const size = 768;
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
        const wave = Math.sin((nx * 18 + ny * 9) * Math.PI) * 0.2 + Math.sin((nx * 58 - ny * 41) * Math.PI) * 0.08;
        const grain = Math.sin((x * 17.19 + y * 91.7) * 0.017) * 41137.3;
        const hot = Math.max(0, wave + (grain - Math.floor(grain)) * 0.7);
        const i = (y * size + x) * 4;
        data[i] = 214 + hot * 41;
        data[i + 1] = 86 + hot * 130;
        data[i + 2] = 8 + hot * 36;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function makeGlow(color, size, opacity) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(0.34, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
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

  function makeOrbit(distance, opacity = 0.56) {
    const curve = new THREE.EllipseCurve(0, 0, distance, distance * 0.56, 0, Math.PI * 2);
    const points = curve.getPoints(192).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
  }

  function makeSaturnRingTexture() {
    const size = 512;
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
        const gap = (band > 0.37 && band < 0.42) || (band > 0.69 && band < 0.72);
        const stripe = Math.sin(band * Math.PI * 29) * 0.08;
        const alpha = (gap ? 0.32 : 0.74) + stripe;
        data[i] = 226;
        data[i + 1] = 199;
        data[i + 2] = 144;
        data[i + 3] = Math.max(0, Math.min(255, alpha * 255));
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  scene.add(new THREE.AmbientLight(0xb9d2ff, 0.78));
  const sunLight = new THREE.PointLight(0xffcf74, 5.5, 72, 1.15);
  sunLight.position.set(0, 5, 0);
  root.add(sunLight);
  const rimLight = new THREE.DirectionalLight(0x9beaff, 0.9);
  rimLight.position.set(-5, 10, -8);
  scene.add(rimLight);

  const starGeo = new THREE.BufferGeometry();
  const starPositions = [];
  const starColors = [];
  for (let i = 0; i < 220; i += 1) {
    starPositions.push((Math.random() - 0.5) * 38, -3, (Math.random() - 0.5) * 22);
    const tone = i % 7 === 0 ? [0.55, 0.82, 1] : [1, 0.96, 0.82];
    starColors.push(...tone);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.86
  })));

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.72, 48, 48),
    new THREE.MeshBasicMaterial({ map: makeSunTexture(), color: 0xffc05a })
  );
  root.add(sun);
  root.add(makeGlow('rgba(255,118,22,.64)', 7.4, 0.42));
  root.add(makeGlow('rgba(255,207,74,.24)', 11.4, 0.22));

  const asteroidGeo = new THREE.BufferGeometry();
  const asteroidPositions = [];
  for (let i = 0; i < 480; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 7.3 + Math.random() * 0.72;
    asteroidPositions.push(Math.cos(a) * d, 0.02, Math.sin(a) * d * 0.56);
  }
  asteroidGeo.setAttribute('position', new THREE.Float32BufferAttribute(asteroidPositions, 3));
  root.add(new THREE.Points(asteroidGeo, new THREE.PointsMaterial({
    size: 0.032,
    color: 0xbfc4c7,
    transparent: true,
    opacity: 0.56
  })));

  const projects = [
    { label: 'Bài 1', name: 'Sao Thủy', href: 'bai-1-thao-tac-tep-thu-muc.html', radius: 0.42, distance: 2.75, angle: -0.2, speed: 0.32, type: 'mercury', labelOffset: { x: 34, y: -6 } },
    { label: 'Bài 2', name: 'Sao Kim', href: 'bai-2-tim-kiem-danh-gia-thong-tin.html', radius: 0.56, distance: 4.0, angle: 0.72, speed: 0.27, type: 'venus', labelOffset: { x: 38, y: 30 } },
    { label: 'Bài 3', name: 'Trái Đất', href: 'bai-3-viet-prompt-hieu-qua.html', radius: 0.58, distance: 5.32, angle: 1.52, speed: 0.24, type: 'earth', labelOffset: { x: -10, y: 36 } },
    { label: 'Bài 4', name: 'Sao Hỏa', href: 'bai-4-hop-tac-truc-tuyen.html', radius: 0.48, distance: 6.52, angle: 2.18, speed: 0.2, type: 'mars', labelOffset: { x: -28, y: 28 } },
    { label: 'Bài 5', name: 'Sao Mộc', href: 'bai-5-ai-sang-tao-noi-dung.html', radius: 0.98, distance: 8.7, angle: 3.04, speed: 0.16, type: 'jupiter', labelOffset: { x: 0, y: 42 } },
    { label: 'Bài 6', name: 'Sao Thổ', href: 'bai-6-ai-co-trach-nhiem.html', radius: 0.88, distance: 10.85, angle: -2.28, speed: 0.13, type: 'saturn', ring: true, labelOffset: { x: 0, y: 48 } },
    { label: 'Bài 7', name: 'Sao Hải Vương', href: 'bai-7-phan-tich-tai-lieu-voi-ai.html', radius: 0.76, distance: 12.72, angle: -0.82, speed: 0.1, type: 'neptune', labelOffset: { x: 0, y: 42 } }
  ];

  projects.forEach((project, index) => {
    root.add(makeOrbit(project.distance, index > 4 ? 0.7 : 0.48));
    const x = Math.cos(project.angle) * project.distance;
    const z = Math.sin(project.angle) * project.distance * 0.56;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(project.radius, 40, 40),
      new THREE.MeshStandardMaterial({
        map: textures[project.type],
        roughness: 0.54,
        metalness: 0.02
      })
    );
    mesh.position.set(x, 0, z);
    mesh.userData = { ...project, index };
    root.add(mesh);

    if (project.type === 'earth') {
      const cityLights = new THREE.Mesh(
        new THREE.SphereGeometry(project.radius * 1.012, 36, 36),
        new THREE.MeshBasicMaterial({
          map: textures.earthNight,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      mesh.add(cityLights);
    }

    if (project.type === 'venus') {
      mesh.add(new THREE.Mesh(
        new THREE.SphereGeometry(project.radius * 1.015, 36, 36),
        new THREE.MeshStandardMaterial({
          map: textures.venusAtmosphere,
          transparent: true,
          opacity: 0.42,
          roughness: 0.8,
          depthWrite: false
        })
      ));
    }

    if (project.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(project.radius * 1.32, project.radius * 2.56, 96),
        new THREE.MeshBasicMaterial({
          map: makeSaturnRingTexture(),
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          alphaTest: 0.04,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = -0.36;
      ring.scale.y = 0.46;
      mesh.add(ring);
    }

    planetItems.push({ mesh, project, label: labels[index] });
  });

  function resize() {
    const rect = stage.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / Math.max(rect.height, 1);
    camera.aspect = aspect;
    targetDistance = aspect < 1.1 ? Math.max(targetDistance, 34) : Math.min(targetDistance, 32);
    camera.updateProjectionMatrix();
  }

  function updateCamera(strength = 0.12) {
    orbitAzimuth += (targetAzimuth - orbitAzimuth) * strength;
    orbitElevation += (targetElevation - orbitElevation) * strength;
    orbitDistance += (targetDistance - orbitDistance) * strength;
    const flat = Math.cos(orbitElevation) * orbitDistance;
    camera.position.set(
      Math.sin(orbitAzimuth) * flat,
      Math.sin(orbitElevation) * orbitDistance,
      Math.cos(orbitAzimuth) * flat
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }

  function projectToScreen(object, label, offset = {}) {
    if (!label) return;
    const rect = stage.getBoundingClientRect();
    const pos = new THREE.Vector3();
    object.getWorldPosition(pos);
    pos.project(camera);
    const x = (pos.x * 0.5 + 0.5) * rect.width + (offset.x || 0);
    const y = (-pos.y * 0.5 + 0.5) * rect.height + (offset.y || 0);
    const visible = pos.z < 1 && x > -120 && x < rect.width + 120 && y > -80 && y < rect.height + 100;
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
    label.classList.toggle('is-hidden', !visible);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetItems.map((item) => item.mesh), false);
    hovered = hits[0]?.object || null;
    canvas.classList.toggle('is-hovering', Boolean(hovered));
    planetItems.forEach(({ label, mesh }) => label?.classList.toggle('is-active', hovered === mesh));
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragMoved = false;
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
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    targetAzimuth -= dx * 0.0085;
    targetElevation = Math.max(-0.2, Math.min(1.32, targetElevation + dy * 0.0065));
  }, { passive: true });
  canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    canvas.classList.remove('is-dragging');
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    targetDistance = Math.max(20, Math.min(42, targetDistance + event.deltaY * 0.018));
  }, { passive: false });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    canvas.classList.remove('is-hovering');
    planetItems.forEach(({ label }) => label?.classList.remove('is-active'));
  });
  canvas.addEventListener('click', () => {
    if (dragMoved) return;
    if (hovered?.userData?.href) window.location.href = hovered.userData.href;
  });

  const scale = new THREE.Vector3();
  let last = 0;
  let lastRender = 0;
  function animate(time = 0) {
    requestAnimationFrame(animate);
    if (time - lastRender < 34) return;
    const delta = Math.min((time - last) / 1000 || 0.016, 0.06);
    last = time;
    lastRender = time;

    if (!reduceMotion && !dragging) targetAzimuth -= delta * 0.045;
    updateCamera(dragging ? 0.26 : 0.1);
    sun.rotation.y += delta * 0.16;
    planetItems.forEach(({ mesh, project }) => {
      mesh.rotation.y += reduceMotion ? 0 : delta * project.speed;
      const s = hovered === mesh ? 1.1 : 1;
      scale.set(s, s, s);
      mesh.scale.lerp(scale, 0.18);
    });

    scene.updateMatrixWorld(true);
    planetItems.forEach(({ mesh, project, label }) => projectToScreen(mesh, label, project.labelOffset));
    if (sunLabel) projectToScreen(sun, sunLabel, { x: 0, y: 50 });

    renderer.render(scene, camera);
    window.__solarFrame = (window.__solarFrame || 0) + 1;
    window.__solarOrbitState = {
      azimuth: Number(orbitAzimuth.toFixed(4)),
      elevation: Number(orbitElevation.toFixed(4)),
      distance: Number(orbitDistance.toFixed(2)),
      camera: [
        Number(camera.position.x.toFixed(2)),
        Number(camera.position.y.toFixed(2)),
        Number(camera.position.z.toFixed(2))
      ]
    };
  }

  resize();
  window.addEventListener('resize', resize);

  stage.dataset.solarReady = 'true';
  stage.dataset.solarControl = 'orbit-360';
  window.__solarReady = true;
  window.__solarObjects = planetItems.length;
  animate();
}

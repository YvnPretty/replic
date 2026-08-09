/* global THREE */
(() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x260742); // Vibrant deep purple
  scene.fog = new THREE.FogExp2(0x260742, 0.006);

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(21, 11, 29);
  camera.lookAt(-3, 8, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  document.body.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(-5, 7, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 1.15;
  controls.rotateSpeed = .72;
  controls.minDistance = 3;
  controls.maxDistance = 250;
  controls.minPolarAngle = .04;
  controls.maxPolarAngle = Math.PI * .94;
  const soundButton = document.getElementById('sound-toggle');
  const dialogue = document.getElementById('dialogue');
  let nextDialogue = 2;
  function sayDialogue(line) {
    dialogue.textContent = `“${line}”`;
    dialogue.classList.add('visible');
    clearTimeout(sayDialogue.timer);
    sayDialogue.timer = setTimeout(() => dialogue.classList.remove('visible'), 4200);
    if (audio.enabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const voice = new SpeechSynthesisUtterance(line);
      voice.lang = 'en-US';
      voice.rate = 1.08; voice.pitch = .92; voice.volume = .72;
      speechSynthesis.speak(voice);
    }
  }
  const audio = { context: null, enabled: false, wind: null, quake: null };
  function enableSound() {
    if (!audio.context) {
      audio.context = new (window.AudioContext || window.webkitAudioContext)();
      const makeNoise = () => {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 2, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = audio.context.createBufferSource(); source.buffer = buffer; source.loop = true; return source;
      };
      const wind = makeNoise(); const windFilter = audio.context.createBiquadFilter();
      windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = .55;
      audio.wind = audio.context.createGain(); audio.wind.gain.value = 0;
      wind.connect(windFilter).connect(audio.wind).connect(audio.context.destination); wind.start();
      const quakeOsc = audio.context.createOscillator(); quakeOsc.type = 'sine'; quakeOsc.frequency.value = 34;
      audio.quake = audio.context.createGain(); audio.quake.gain.value = 0;
      quakeOsc.connect(audio.quake).connect(audio.context.destination); quakeOsc.start();
    }
    audio.context.resume(); audio.enabled = true;
    soundButton.textContent = '🔊 Sonido activado';
  }
  function thunderSound() {
    if (!audio.enabled) return;
    const osc = audio.context.createOscillator(), gain = audio.context.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(92, audio.context.currentTime); osc.frequency.exponentialRampToValueAtTime(38, audio.context.currentTime + 1.15);
    gain.gain.setValueAtTime(.0001, audio.context.currentTime); gain.gain.exponentialRampToValueAtTime(.17, audio.context.currentTime + .04); gain.gain.exponentialRampToValueAtTime(.0001, audio.context.currentTime + 1.35);
    osc.connect(gain).connect(audio.context.destination); osc.start(); osc.stop(audio.context.currentTime + 1.4);
  }
  soundButton.addEventListener('click', enableSound);

  const world = new THREE.Group();
  scene.add(world);
  // Cielo de tormenta en capas: da profundidad incluso cuando la cámara mira arriba.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x190847) }, // Dark indigo
      horizon: { value: new THREE.Color(0xb81878) }, // Vibrant magenta
      time: { value: 0 },
      flash: { value: 0 }
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform float time; uniform float flash; varying vec3 vPos;
      float cloudField(vec2 p){
        float a=sin(p.x*.85+time*.025)*.34+sin(p.y*1.28-time*.018)*.28;
        a+=sin((p.x+p.y)*2.1+time*.012)*.16+sin(p.x*4.7-p.y*2.9)*.09;
        return a;
      }
      void main(){
        vec3 d=normalize(vPos); float h=smoothstep(-.22,.72,d.y);
        vec3 col=mix(horizon,top,h);
        float cloud=smoothstep(.02,.38,cloudField(d.xz*8.0+d.xy*3.2));
        col=mix(col,col*.20,cloud*(.58+.35*h));
        float rim=smoothstep(.04,.0,abs(d.y-.08));
        col+=vec3(.42,.28,.59)*rim*(1.0-cloud)*.5;
        col+=vec3(.55,.72,1.0)*flash;
        gl_FragColor=vec4(col,1.0);
      }`
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(350, 32, 20),
    skyMaterial
  );
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xa059c2, 0x140c21, 1.8));
  const sun = new THREE.DirectionalLight(0xff9900, 1.5); // Golden street light / moon
  sun.position.set(-15, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -100;
  sun.shadow.camera.right = sun.shadow.camera.top = 100;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshPhysicalMaterial({ color: 0x111317, roughness: 0.08, metalness: 0.85, clearcoat: 1.0, clearcoatRoughness: 0.1 }) // Wet reflective asphalt
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);
  const seismicWaves = new THREE.Group();
  world.add(seismicWaves);
  const rubblePieces = [];
  const buildings = [];
  const trafficLights = [];
  let copter, rotor, searchlightCone, copterSpot, copterRed, copterBlue;
  
  let newsCanvas, newsCtx, newsTexture;

  // Mar abierto al oeste: el tornado se forma aquí antes de tocar tierra.
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = waterCanvas.height = 128;
  const waterCtx = waterCanvas.getContext('2d');
  waterCtx.fillStyle = '#102123'; waterCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { waterCtx.fillStyle = `rgba(210,235,235,${Math.random() * .05})`; waterCtx.fillRect(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 16, 1); }
  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(18, 35);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(168, 400, 150, 150), // More resolution for better waves
    new THREE.MeshPhysicalMaterial({ color: 0x122425, emissive: 0x050c0c, map: waterTexture, roughness: 0.05, metalness: 0.95, clearcoat: 1.0, clearcoatRoughness: 0.05 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-116, 0.02, 0);
  sea.receiveShadow = true;
  world.add(sea);
  const seaPosition = sea.geometry.attributes.position;
  // Segundo desastre: una compuerta cede y una crecida invade la ciudad.
  const floodWater = new THREE.Mesh(
    new THREE.PlaneGeometry(232, 400, 70, 70),
    new THREE.MeshPhysicalMaterial({ color: 0x122425, emissive: 0x050c0c, map: waterTexture, transparent: true, opacity: .75, roughness: .1, metalness: .7, clearcoat: .8, side: THREE.DoubleSide })
  );
  floodWater.rotation.x = -Math.PI / 2;
  floodWater.position.set(84, -1.5, 0); // Center the flood water to cover map
  floodWater.visible = false;
  world.add(floodWater);
  const floodPosition = floodWater.geometry.attributes.position;
  const floodCols = 71, floodRows = 71;
  let floodWaveNow = new Float32Array(floodCols * floodRows);
  let floodWavePrev = new Float32Array(floodCols * floodRows);
  let floodWaveNext = new Float32Array(floodCols * floodRows);
  const floodGate = new THREE.Group();
  const gateWallMaterial = new THREE.MeshStandardMaterial({ color: 0x475052, roughness: .82, metalness: .16 });
  const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(23, 9, 1.5), gateWallMaterial);
  const gateRight = gateLeft.clone();
  gateLeft.position.set(-15, 4.5, 51); gateRight.position.set(15, 4.5, 51);
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(54, 1.2, 1.8), gateWallMaterial);
  gateTop.position.set(0, 9.4, 51);
  const gateDoor = new THREE.Mesh(new THREE.BoxGeometry(7, 7.8, .55), new THREE.MeshStandardMaterial({ color: 0x303a3d, roughness: .6, metalness: .32 }));
  gateDoor.position.set(0, 4, 50.2);
  floodGate.add(gateLeft, gateRight, gateTop, gateDoor);
  // Frente de tsunami curvado, con una cresta blanca que se desplaza por las calles.
  const surge = new THREE.Group();
  const waveHeight = 12.5; // Tsunami height increased
  const waveGeometry = new THREE.PlaneGeometry(400, waveHeight, 200, 18);
  const wavePosition = waveGeometry.attributes.position;
  for (let i = 0; i < wavePosition.count; i++) {
    const x = wavePosition.getX(i), y = wavePosition.getY(i);
    const n = (y + waveHeight / 2) / waveHeight;
    const globalCurve = Math.pow(x / 200, 2) * -15; // Viscous curve trailing at edges
    wavePosition.setZ(i, Math.sin(x * .45) * (.08 + n * .16) + Math.pow(n, 3.2) * 1.75 + globalCurve);
  }
  wavePosition.needsUpdate = true;
  const wave = new THREE.Mesh(waveGeometry, new THREE.MeshPhysicalMaterial({ color: 0x122425, emissive: 0x050c0c, transparent: true, opacity: .9, roughness: .05, metalness: .95, clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false }));
  surge.add(wave);
  const foamPoints = [];
  for (let x = -200; x <= 200; x += 1.5) {
      const globalCurve = Math.pow(x / 200, 2) * -15;
      foamPoints.push(new THREE.Vector3(x, waveHeight / 2 + Math.sin(x * .8) * .12, 1.82 + Math.sin(x * .45) * .22 + globalCurve));
  }
  surge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(foamPoints), new THREE.LineBasicMaterial({ color: 0xf2fbf6, transparent: true, opacity: .95 })));
  surge.visible = false;
  world.add(surge);
  let floodLevel = -1.5;
  let tsunami = null;

  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0617, roughness: 0.8 });
  const roadA = new THREE.Mesh(new THREE.PlaneGeometry(7, 400), roadMaterial);
  roadA.rotation.x = -Math.PI / 2;
  roadA.position.y = 0.012;
  world.add(roadA);
  const roadB = new THREE.Mesh(new THREE.PlaneGeometry(400, 6), roadMaterial);
  roadB.rotation.x = -Math.PI / 2;
  roadB.position.set(0, 0.014, -16);
  world.add(roadB);

  const bridge = new THREE.Group();
  const deckGeometry = new THREE.PlaneGeometry(168, 6, 64, 1);
  const bridgeWidth = 168;
  const bridgeCenterX = -116;
  const halfBridgeWidth = bridgeWidth / 2;
  const deckPos = deckGeometry.attributes.position;
  for(let i = 0; i < deckPos.count; i++) {
     const nx = deckPos.getX(i) / halfBridgeWidth; // -1 to 1
     deckPos.setZ(i, 6.0 * (1 - nx * nx)); // Arc height
  }
  const deck = new THREE.Mesh(deckGeometry, roadMaterial);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(bridgeCenterX, 0.02, -16); // Overlap slightly to hide seams
  bridge.add(deck);

  for (let px = -190; px <= -40; px += 20) {
      const nx = (px - bridgeCenterX) / halfBridgeWidth;
      const h = 6.0 * (1 - nx * nx);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, h, 8), new THREE.MeshStandardMaterial({ color: 0x111213 }));
      pillar.position.set(px, h/2, -16);
      bridge.add(pillar);
      
      // Dim bridge lights
      const bLight = new THREE.PointLight(0xffddaa, 0.6, 15);
      bLight.position.set(px, h + 1, -16);
      const bBulb = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffddaa }));
      bBulb.position.set(px, h + 1, -16);
      bridge.add(bLight, bBulb);
  }

  const railMat = new THREE.MeshStandardMaterial({ color: 0x222627, roughness: 0.6, metalness: 0.4 });
  for(let side of [-3, 3]) {
      const points = [];
      for(let px = -200; px <= -32; px += 4) {
          const nx = (px - bridgeCenterX) / halfBridgeWidth;
          points.push(new THREE.Vector3(px, 6.0 * (1 - nx*nx) + 0.6, side));
      }
      const railGeom = new THREE.BufferGeometry().setFromPoints(points);
      const rail = new THREE.Line(railGeom, railMat);
      rail.position.set(0, 0, -16);
      bridge.add(rail);
  }
  world.add(bridge);

  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xa8b0b5 }); // Faded white lines
  for (let z = -55; z < 55; z += 5) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.5), lineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, z);
    world.add(line);
  }

  // 50 / 50 Road Marking
  const roadCanv = document.createElement('canvas');
  roadCanv.width = 512; roadCanv.height = 256;
  const roadCtx = roadCanv.getContext('2d');
  roadCtx.fillStyle = '#a8b0b5';
  roadCtx.font = 'bold 90px sans-serif';
  roadCtx.textAlign = 'center';
  roadCtx.textBaseline = 'middle';
  roadCtx.fillText('50 / 50', 256, 128);
  const roadMarkTex = new THREE.CanvasTexture(roadCanv);
  const roadMarkMat = new THREE.MeshBasicMaterial({ map: roadMarkTex, transparent: true, opacity: 0.7 });
  const roadMark = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), roadMarkMat);
  roadMark.rotation.x = -Math.PI / 2;
  roadMark.rotation.z = Math.PI / 2;
  roadMark.position.set(2, 0.035, 12);
  world.add(roadMark);

  // Traffic Lights & Telephone Poles (Anime style)
  for(let tz = -135; tz <= 135; tz += 15) {
     if (tz === 0) continue; // Skip intersection center
     const side = tz > 0 ? 1 : -1;
     // Telephone Pole
     const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x221820 }));
     pole.position.set(-6 * side, 6, tz);
     world.add(pole);
     buildings.push({ group: pole, home: pole.position.clone(), width: 1.2, height: 12, cracks: null, crackMaterial: null, damage: 0, tornadoDamage: 0, tsunamiCarried: false, collapsing: false, collapseAge: 0, collapseDirection: side, collapseAxis: 'z', destroyed: false, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), isPole: true });
     
     // Crossbars
     for(let hy of [10.5, 9.5, 8.5]) {
         const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
         bar.position.set(-6 * side, hy, tz);
         world.add(bar);
     }
     
     // Wires stretching to the next pole (if not the last one)
     if (tz < 135) {
         const wireMat = new THREE.LineBasicMaterial({ color: 0x05020a });
         for(let w = 0; w < 4; w++) {
             const pts = [];
             const startY = 10.5 - Math.random() * 2;
             const endY = 10.5 - Math.random() * 2;
             const ox1 = -6 * side + (Math.random()-0.5)*2.5;
             const ox2 = -6 * (tz+15 > 0 ? 1 : -1) + (Math.random()-0.5)*2.5;
             for(let i=0; i<=10; i++) {
                 const t = i/10;
                 const x = ox1 + (ox2 - ox1) * t;
                 const z = tz + 15 * t;
                 // Catenary curve dip
                 const y = startY + (endY - startY) * t - Math.sin(t * Math.PI) * (1.5 + Math.random());
                 pts.push(new THREE.Vector3(x, y, z));
             }
             const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
             world.add(wire);
         }
     }
  }

  for(let tz of [20, -20]) {
     // Warm Traffic Lights
     const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x221820 }));
     arm.rotation.z = Math.PI/2;
     arm.position.set(0, 8, tz);
     const box = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
     box.position.set(0, 7.6, tz);
     const tLight = new THREE.PointLight(0xff3300, 1.5, 15);
     tLight.position.set(0, 7.6, tz);
     const tBulbRed = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
     tBulbRed.position.set(0.6, 7.6, tz+0.32);
     const tBulbGold = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffb84d }));
     tBulbGold.position.set(-0.6, 7.6, tz+0.32);
     const tBulbGreen = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0x00ffaa }));
     tBulbGreen.position.set(0, 7.6, tz+0.32);
     world.add(arm, box, tLight, tBulbRed, tBulbGold, tBulbGreen);
     trafficLights.push({ tLight, tBulbRed, tBulbGold, tBulbGreen, timer: Math.random() * 9 });
  }

  const facadePalette = [0x261a29, 0x1c1724, 0x30232b, 0x18151c, 0x36233a, 0x1b1621]; // Dark violet/grey concrete
  const buildingMaterials = facadePalette.map((color, index) => createFacadeMaterial(color, index));
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending }); // Golden glowing windows
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const roofGeometry = new THREE.BoxGeometry(1, 1, 1);


  function makeBuilding(x, z, w, h, d) {
    const building = new THREE.Group();
    const body = new THREE.Mesh(buildingGeometry, buildingMaterials[(Math.abs(x * 7 + z * 3) | 0) % buildingMaterials.length]);
    body.scale.set(w, h, d);
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    building.add(body);

    const rows = Math.max(2, Math.floor(h / 1.5));
    const cols = Math.max(2, Math.floor(w / 1.2));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w / (cols + 1) * 0.56, 0.38), windowMaterial);
        win.position.set(-w / 2 + (col + 1) * w / (cols + 1), 0.9 + row * (h - 1.5) / rows, d / 2 + 0.006);
        building.add(win);
      }
    }
    const roof = new THREE.Mesh(roofGeometry, new THREE.MeshStandardMaterial({ color: 0x555a58, roughness: 0.85 }));
    roof.scale.set(w * 0.72, 0.16, d * 0.72);
    roof.position.y = h + 0.1;
    building.add(roof);
    // Equipamiento realista de cubierta: caja de maquinaria y antena.
    const utility = new THREE.Mesh(new THREE.BoxGeometry(w * .22, .32, d * .25), new THREE.MeshStandardMaterial({ color: 0x3d4444, roughness: .72 }));
    utility.position.set(w * .08, h + .35, 0);
    building.add(utility);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .75, 5), new THREE.MeshBasicMaterial({ color: 0x303536 }));
    antenna.position.set(-w * .22, h + .55, 0);
    building.add(antenna);

    // Japanese Shop Sign
    if (Math.random() > 0.4 && h > 4) {
       const signW = 0.4 + Math.random() * 0.4;
       const signH = 1.5 + Math.random() * 2.0;
       const signCanv = document.createElement('canvas');
       signCanv.width = 64; signCanv.height = 256;
       const signCtx = signCanv.getContext('2d');
       const isWarm = Math.random() > 0.4;
       signCtx.fillStyle = isWarm ? '#d1c0a5' : '#8da7a8'; // Warm beige or muted teal
       signCtx.fillRect(0,0,64,256);
       signCtx.fillStyle = '#111';
       signCtx.font = 'bold 36px sans-serif';
       signCtx.textAlign = 'center';
       signCtx.textBaseline = 'top';
       const chars = ['大', '阪', '食', '堂', '薬', '酒', '本', '電', '気', '屋', '麺', '茶', '肉', '魚'];
       const numChars = 3 + Math.floor(Math.random()*4);
       for(let i=0; i<numChars; i++) {
          signCtx.fillText(chars[(Math.random()*chars.length)|0], 32, 10 + i * (230/numChars));
       }
       const signTex = new THREE.CanvasTexture(signCanv);
       const signMat = new THREE.MeshBasicMaterial({ map: signTex });
       const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), signMat);
       const side = Math.random() > 0.5 ? 1 : -1;
       const isX = Math.random() > 0.5;
       if (isX) {
           signMesh.position.set((w/2 - 0.2) * (Math.random() - 0.5), signH/2 + Math.random() * (h - signH - 1), (d/2 + 0.02) * side);
           signMesh.rotation.y = side === 1 ? 0 : Math.PI;
       } else {
           signMesh.position.set((w/2 + 0.02) * side, signH/2 + Math.random() * (h - signH - 1), (d/2 - 0.2) * (Math.random() - 0.5));
           signMesh.rotation.y = side === 1 ? Math.PI/2 : -Math.PI/2;
       }
       building.add(signMesh);
       
    }

    building.position.set(x, 0, z);
    world.add(building);
    const crackPoints = [];
    for (let crack = 0; crack < 3; crack++) {
      let cx = (random() - .5) * w * .7, cy = h * (.25 + random() * .5);
      for (let segment = 0; segment < 5; segment++) {
        const nx = cx + (random() - .5) * w * .22, ny = cy - (.22 + random() * .5) * h / 5;
        crackPoints.push(cx, cy, d / 2 + .018, nx, ny, d / 2 + .018);
        cx = nx; cy = ny;
      }
    }
    const crackMaterial = new THREE.LineBasicMaterial({ color: 0x201d1a, transparent: true, opacity: 0 });
    const cracks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(crackPoints, 3)), crackMaterial);
    building.add(cracks);
    buildings.push({ group: building, home: building.position.clone(), width: w, height: h, cracks, crackMaterial, damage: 0, tornadoDamage: 0, tsunamiCarried: false, collapsing: false, collapseAge: 0, collapseDirection: 1, collapseAxis: 'z', destroyed: false, velocity: new THREE.Vector3(), spin: new THREE.Vector3() });
  }

  const trees = [];
  function makeAnimeTree(x, z) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 5), new THREE.MeshStandardMaterial({ color: 0x3d2817 }));
      trunk.position.y = 1;
      const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({ color: 0x3e185c, roughness: 0.8 })); // Dark anime purple leaves
      leaves.position.y = 2.5;
      tree.add(trunk, leaves);
      tree.position.set(x, 0, z);
      tree.castShadow = true;
      world.add(tree);
      trees.push({ tree, phase: Math.random() * 8 });
      buildings.push({ group: tree, home: tree.position.clone(), width: 2, height: 4, cracks: null, crackMaterial: null, damage: 0, tornadoDamage: 0, tsunamiCarried: false, collapsing: false, collapseAge: 0, collapseDirection: 1, collapseAxis: 'x', destroyed: false, velocity: new THREE.Vector3(), spin: new THREE.Vector3() });
  }

  const random = seededRandom(37);
  for (let x = -130; x <= 130; x += 5) {
    for (let z = -140; z <= 130; z += 5) {
      if (Math.abs(x) < 5 || (z > -20 && z < -12)) continue; // Roads
      if (x < -32) continue; // Sea area
      if (x >= 24 && x <= 50 && z >= -22 && z <= 45) continue; // Airport area
      if (x >= -32 && x <= -8 && z >= 63 && z <= 87) continue; // Stadium area
      if (x >= -20 && x <= -10 && z >= 10 && z <= 20) continue; // Times Square building area
      
      const dist = Math.hypot(x, z+16);
      const isOutskirts = dist > 70;
      
      if (isOutskirts) {
          if (random() > 0.6) {
              makeAnimeTree(x + (random() - .5) * 2, z + (random() - .5) * 2);
          }
      } else {
          if (random() > 0.15) { // Denser city core
              const w = 2.7 + random() * 1.6;
              const d = 2.8 + random() * 1.8;
              const h = (dist > 40 ? 2.0 : 3.5) + random() * (dist > 40 ? 5 : 15);
              makeBuilding(x + (random() - .5), z + (random() - .5), w, h, d);
          }
      }
    }
  }

  const cars = [];
  function makeCar(x, z, color, axis, isPolice = false) {
    const car = new THREE.Group();
    // Police car body is black/white
    const bodyColor = isPolice ? 0x111111 : color;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 1.65), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.22 }));
    body.position.y = 0.29;
    body.castShadow = true;
    car.add(body);
    
    // For police car, add white side decals/doors
    if (isPolice) {
      const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      leftDoor.position.set(-0.435, 0.29, 0);
      const rightDoor = leftDoor.clone();
      rightDoor.position.set(0.435, 0.29, 0);
      car.add(leftDoor, rightDoor);
    }
    
    const cabinColor = isPolice ? 0x111111 : 0x1e3136;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.27, 0.72), new THREE.MeshStandardMaterial({ color: cabinColor, roughness: 0.2, metalness: 0.35 }));
    cabin.position.set(0, 0.54, -0.06);
    car.add(cabin);
    
    let lightbarRed = null, lightbarBlue = null, policeLight = null;
    if (isPolice) {
      // Emergency lightbar on the roof
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
      barBase.position.set(0, 0.695, -0.06);
      car.add(barBase);
      
      lightbarRed = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.15), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      lightbarRed.position.set(-0.13, 0.77, -0.06);
      
      lightbarBlue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.15), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
      lightbarBlue.position.set(0.13, 0.77, -0.06);
      
      policeLight = new THREE.PointLight(0xff0000, 2.5, 12);
      policeLight.position.set(0, 0.8, -0.06);
      
      car.add(lightbarRed, lightbarBlue, policeLight);
    }
    
    car.position.set(x, 0, z);
    if (axis === 'x') car.rotation.y = Math.PI / 2;
    world.add(car);
    cars.push({ 
      car, 
      axis, 
      speed: 2 + random() * 2, 
      destroyed: false, 
      velocity: new THREE.Vector3(),
      isPolice,
      lightbarRed,
      lightbarBlue,
      policeLight,
      lightPhase: 0
    });
  }
  // Spawn more cars along the expanded Road A (Z axis)
  for (let i = 0; i < 18; i++) {
      const color = [0xff3300, 0xffaa00, 0xcc00ff, 0x00ffff, 0xff00aa, 0xffffff][i % 6];
      makeCar(-2.1 + (i % 2) * 4.2, -130 + i * 15, color, 'z', i % 6 === 0);
  }
  // Spawn more cars along the expanded Road B (X axis)
  for (let i = 0; i < 18; i++) {
      const color = [0xff3300, 0xffaa00, 0xcc00ff, 0x00ffff, 0xff00aa, 0xffffff][i % 6];
      makeCar(-190 + i * 17, -18.1 + (i % 2) * 3.7, color, 'x', i % 6 === 3);
  }

  const buses = [];
  [0xff0055, 0x0055ff, 0x00ff55, 0xffaa00, 0x00ffcc].forEach((color, i) => {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(1.15, .85, 3.25), new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .18 }));
    bus.position.set(-2.5 + (i % 2) * 5, .63, -130 + i * 50); world.add(bus); buses.push({ bus, speed: .016 + i * .004, destroyed: false });
  });

  const cityLights = [];
  function makeStreetLamp(x, z, tint) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, 2.7, 7), new THREE.MeshStandardMaterial({ color: 0x283236, roughness: .55, metalness: .45 }));
    pole.position.y = 1.35;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.14, 9, 8), new THREE.MeshBasicMaterial({ color: tint }));
    bulb.position.y = 2.7;
    lamp.add(pole, bulb); lamp.position.set(x, 0, z); world.add(lamp);
    cityLights.push({ bulb, phase: Math.random() * 8 });
  }

  // Streetlamps along the entire Road A (Z axis)
  for (let z = -140; z <= 130; z += 12) { 
      makeStreetLamp(-4.1, z, 0xffa844); 
      makeStreetLamp(4.1, z + 6, 0xffa844); 
  }
  // Streetlamps along the entire Road B (X axis)
  for (let x = -190; x <= 130; x += 12) { 
      if (Math.abs(x) < 5) continue; // Skip intersection
      makeStreetLamp(x, -19.1, 0xffa844); 
      makeStreetLamp(x + 6, -12.9, 0xffa844); 
  }

  // Anime Trees inside the city core area
  for (let z = -65; z < 65; z += 8) { 
      makeAnimeTree(6.2, z); 
      makeAnimeTree(-6.2, z + 4); 
  }

  // Aeropuerto urbano al borde del distrito: pista iluminada, terminal y torre.
  const airport = new THREE.Group();
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(18, 58), new THREE.MeshStandardMaterial({ color: 0x1a0b2e, roughness: .85 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(37, .025, 7); airport.add(runway);
  for (let z = -20; z < 36; z += 4) { const mark = new THREE.Mesh(new THREE.PlaneGeometry(.28, 1.5), new THREE.MeshBasicMaterial({ color: 0xff00aa })); mark.rotation.x = -Math.PI / 2; mark.position.set(37, .045, z); airport.add(mark); }
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(25, 4.8, 7), new THREE.MeshStandardMaterial({ color: 0x3d0066, roughness: .58, metalness: .16 })); terminal.position.set(37, 2.4, 41); airport.add(terminal);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(21, 2, .08), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004455, emissiveIntensity: 2.0, roughness: .18, metalness: .35 })); glass.position.set(37, 2.2, 37.45); airport.add(glass);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.8, 12, 8), new THREE.MeshStandardMaterial({ color: 0x220044, roughness: .62 })); tower.position.set(25, 6, 39); airport.add(tower);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.55, 2.3, 8), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, emissiveIntensity: .8, roughness: .2, metalness: .4 })); cab.position.set(25, 12.5, 39); airport.add(cab);

  const radar = new THREE.Group();
  const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
  radarBase.position.y = 13.8;
  const radarDish = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  radarDish.position.y = 14.2;
  radar.add(radarBase, radarDish);
  radar.position.set(25, 0, 39);
  airport.add(radar);

  const beacon = new THREE.PointLight(0xff0000, 2, 20);
  beacon.position.set(25, 14.5, 39);
  airport.add(beacon);

  const airportCanvas = document.createElement('canvas'); airportCanvas.width = 512; airportCanvas.height = 80;
  const airportCtx = airportCanvas.getContext('2d'); airportCtx.fillStyle = '#102c39'; airportCtx.fillRect(0, 0, 512, 80); airportCtx.fillStyle = '#f5c85d'; airportCtx.font = 'bold 40px Arial'; airportCtx.textAlign = 'center'; airportCtx.fillText('SKYLINE AIRPORT', 256, 53);
  const airportSign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(airportCanvas), transparent: true })); airportSign.position.set(37, 5.3, 37.4); airport.add(airportSign);
  const airportTraffic = [];
  for (let i = 0; i < 10; i++) {
    const service = new THREE.Mesh(new THREE.BoxGeometry(.78, .34, 1.6), new THREE.MeshStandardMaterial({ color: [0x00ffcc, 0xff00aa, 0xffff00][i % 3], roughness: .52 }));
    service.position.set(34.5 + (i % 2) * 5, .3, -20 + i * 7); airport.add(service); airportTraffic.push({ mesh: service, speed: .02 + i * .002 });
  }
  const airportPlane = new THREE.Group();
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.1, .35, 3.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: .22 }));
  const wng = new THREE.Mesh(new THREE.BoxGeometry(4.2, .1, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 }));
  airportPlane.add(fuse, wng);
  airportPlane.position.set(37, .55, -15); airport.add(airportPlane); airportTraffic.push({ mesh: airportPlane, speed: .08, isPlane: true });
  world.add(airport);

  // Vida urbana: peatones que pueden huir al acercarse el tornado.
  const people = [];
  const skin = [0xffcc00, 0x00ffcc, 0xff00aa]; // Alien/surreal skins
  function makePerson(x, z, shirt) {
    const person = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .48, 7), new THREE.MeshStandardMaterial({ color: shirt, roughness: .8 }));
    body.position.y = .34;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.115, 8, 7), new THREE.MeshStandardMaterial({ color: skin[(random() * skin.length) | 0], roughness: .9 }));
    head.position.y = .68;
    person.add(body, head);
    person.position.set(x, 0, z);
    world.add(person);
    people.push({ 
      person, 
      direction: new THREE.Vector3(random() - .5, 0, random() - .5).normalize(), 
      basePace: .015 + random() * .01, 
      pace: 0, 
      fleeing: false,
      state: random() > 0.5 ? 'walk' : 'idle',
      stateTimer: random() * 4,
      bobPhase: random() * Math.PI * 2
    });
  }
  for (let i = 0; i < 62; i++) makePerson(4 + random() * 27, -30 + random() * 54, [0xff0000, 0x0000ff, 0x00ff00, 0xffff00][i % 4]);
  // People at airport
  for (let i = 0; i < 15; i++) makePerson(32 + random() * 8, 30 + random() * 10, [0xffaa00, 0x00ffaa][i % 2]);

  // Barcos y vehículos acuáticos en el mar.
  const boats = [];
  function makeWaterVehicle(x, z, type) {
    const boat = new THREE.Group();
    
    if (type === 'jetski') {
      // Jetski: small, wedge hull, colored top
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 1.4), new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2 }));
      hull.position.y = 0.15;
      
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      seat.position.set(0, 0.3, -0.15);
      
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.5), new THREE.MeshBasicMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.02, 1.8);
      
      boat.add(hull, seat, wake);
      boat.position.set(x, 0, z);
      world.add(boat);
      boats.push({ boat, type, speed: 0.06 + random() * 0.03, capsizing: false, sink: 0, roll: 0 });
      
    } else if (type === 'yacht') {
      // Yacht: sleek luxury boat
      const hullGeom = new THREE.BoxGeometry(1.6, 0.4, 4.8);
      const pos = hullGeom.attributes.position;
      for(let i=0; i<pos.count; i++) {
        if(pos.getZ(i) > 0) pos.setX(i, pos.getX(i) * 0.25);
      }
      const hull = new THREE.Mesh(hullGeom, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.85 }));
      hull.position.y = 0.3;
      
      const deck1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }));
      deck1.position.set(0, 0.65, -0.6);
      
      const deck2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      deck2.position.set(0, 1.0, -0.8);
      
      const neonTrim = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 2.45), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      neonTrim.position.set(0, 0.42, -0.6);
      
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 6.5), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }));
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.02, 3.8);
      
      boat.add(hull, deck1, deck2, neonTrim, wake);
      boat.position.set(x, 0, z);
      world.add(boat);
      boats.push({ boat, type, speed: 0.028 + random() * 0.015, capsizing: false, sink: 0, roll: 0 });
      
    } else if (type === 'cruise') {
      // Cruise Ship: giant multi-deck liner
      const hullGeom = new THREE.BoxGeometry(3.8, 1.5, 12.0);
      const pos = hullGeom.attributes.position;
      for(let i=0; i<pos.count; i++) {
        if(pos.getZ(i) > 0) pos.setX(i, pos.getX(i) * 0.35);
      }
      const hull = new THREE.Mesh(hullGeom, new THREE.MeshStandardMaterial({ color: 0x111155, roughness: 0.3 }));
      hull.position.y = 0.75;
      
      const superstructure = new THREE.Group();
      
      const deck1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 9.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      deck1.position.set(0, 1.95, -0.8);
      
      const deck2 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 7.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      deck2.position.set(0, 2.8, -1.8);
      
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
      funnel.position.set(0, 3.8, -2.5);
      const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      funnelCap.position.set(0, 4.4, -2.5);
      
      superstructure.add(deck1, deck2, funnel, funnelCap);
      
      for (let side of [-1.82, 1.82]) {
        for (let row = 0; row < 2; row++) {
          for (let col = -4; col <= 3; col++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.35), new THREE.MeshBasicMaterial({ color: 0xffb84d }));
            win.position.set(side, 1.65 + row * 0.45, -0.8 + col * 0.9);
            superstructure.add(win);
          }
        }
      }
      
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 16.0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }));
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.02, 10.0);
      
      boat.add(hull, superstructure, wake);
      boat.position.set(x, 0, z);
      world.add(boat);
      boats.push({ boat, type, speed: 0.009 + random() * 0.005, capsizing: false, sink: 0, roll: 0 });
    }
  }
  makeWaterVehicle(-38, -38, 'yacht');
  makeWaterVehicle(-28, -2, 'jetski');
  makeWaterVehicle(-47, 26, 'yacht');
  makeWaterVehicle(-22, 42, 'jetski');
  makeWaterVehicle(-45, -80, 'cruise');

  // Tráfico aéreo de fondo para dar escala al temporal.
  const planes = [];
  function makePlane(x, y, z, speed) {
    const plane = new THREE.Group();
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 2.5, 10), new THREE.MeshStandardMaterial({ color: 0xe5e9e8, roughness: .32, metalness: .25 }));
    fuselage.rotation.z = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(.18, .06, 2.5), new THREE.MeshStandardMaterial({ color: 0xc8d3d2, roughness: .35 }));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.12, .55, .48), new THREE.MeshStandardMaterial({ color: 0x4d6e7b, roughness: .45 }));
    tail.position.x = -1;
    plane.add(fuselage, wing, tail);
    plane.position.set(x, y, z);
    world.add(plane);
    planes.push({ plane, speed, destroyed: false, velocity: new THREE.Vector3() });
  }
  makePlane(-54, 25, -25, .11); makePlane(38, 33, 13, -.075);

  // Times Square Building (News Screen)
  newsCanvas = document.createElement('canvas');
  newsCanvas.width = 256;
  newsCanvas.height = 128;
  newsCtx = newsCanvas.getContext('2d');
  newsTexture = new THREE.CanvasTexture(newsCanvas);
  
  function updateNewsScreen(text) {
    newsCtx.fillStyle = '#0a0a1a';
    newsCtx.fillRect(0, 0, 256, 128);
    newsCtx.fillStyle = '#ff0033';
    newsCtx.fillRect(0, 0, 256, 32);
    newsCtx.fillStyle = '#ffffff';
    newsCtx.font = 'bold 15px Arial';
    newsCtx.textAlign = 'center';
    newsCtx.fillText('NEWS 24 LIVE', 128, 22);
    newsCtx.fillStyle = '#ffff00';
    newsCtx.font = 'bold 18px Courier New';
    newsCtx.fillText(text, 128, 80);
    newsTexture.needsUpdate = true;
  }
  updateNewsScreen('SYSTEM OK');
  
  const newsBuilding = new THREE.Group();
  const towerBody = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6), new THREE.MeshStandardMaterial({ color: 0x1c1724, roughness: 0.5 }));
  towerBody.position.y = 9;
  newsBuilding.add(towerBody);
  
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), new THREE.MeshBasicMaterial({ map: newsTexture }));
  screenMesh.position.set(0, 11, 3.05);
  newsBuilding.add(screenMesh);
  
  newsBuilding.position.set(-15, 0, 15);
  world.add(newsBuilding);
  buildings.push({ 
    group: newsBuilding, 
    home: newsBuilding.position.clone(), 
    width: 6, 
    height: 18, 
    cracks: null, 
    crackMaterial: null, 
    damage: 0, 
    tornadoDamage: 0, 
    tsunamiCarried: false, 
    collapsing: false, 
    collapseAge: 0, 
    collapseDirection: 1, 
    collapseAxis: 'z', 
    destroyed: false, 
    velocity: new THREE.Vector3(), 
    spin: new THREE.Vector3() 
  });

  // Stadium creation
  const stadium = new THREE.Group();
  const field = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }));
  field.position.y = 0.05;
  stadium.add(field);
  
  const stands = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 2.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.5 }));
  stands.position.y = 1.1;
  stadium.add(stands);
  
  const boardPole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  boardPole.position.set(0, 2.5, -7.5);
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  board.position.set(0, 5, -7.5);
  stadium.add(boardPole, board);
  
  stadium.position.set(-20, 0, 75);
  world.add(stadium);
  
  buildings.push({ 
    group: stadium, 
    home: stadium.position.clone(), 
    width: 18, 
    height: 6, 
    cracks: null, 
    crackMaterial: null, 
    damage: 0, 
    tornadoDamage: 0, 
    tsunamiCarried: false, 
    collapsing: false, 
    collapseAge: 0, 
    collapseDirection: 1, 
    collapseAxis: 'x', 
    destroyed: false, 
    velocity: new THREE.Vector3(), 
    spin: new THREE.Vector3() 
  });

  // Police Helicopter Setup
  copter = new THREE.Group();
  const copterBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  copterBody.position.y = 15;
  copter.add(copterBody);
  
  const copterTail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  copterTail.position.set(0, 15, -1.2);
  copter.add(copterTail);
  
  rotor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.set(0, 15.35, 0);
  copter.add(rotor);
  
  const searchlightGeom = new THREE.CylinderGeometry(0.1, 3.5, 15, 16, 1, true);
  searchlightGeom.translate(0, -7.5, 0);
  searchlightCone = new THREE.Mesh(searchlightGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  searchlightCone.position.set(0, 15, 0.4);
  copter.add(searchlightCone);
  
  copterSpot = new THREE.SpotLight(0xffffff, 4, 25, Math.PI / 6, 0.5, 1);
  copterSpot.position.set(0, 15, 0.4);
  copterSpot.target.position.set(0, 0, 0);
  copter.add(copterSpot);
  world.add(copterSpot.target);
  
  copterRed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  copterRed.position.set(-0.32, 15, 0);
  copterBlue = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
  copterBlue.position.set(0.32, 15, 0);
  copter.add(copterRed, copterBlue);
  
  world.add(copter);

  // Textura suave, generada localmente, para que las partículas se mezclen
  // como nubes de condensación y no como puntos cuadrados.
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudCanvas.height = 96;
  const cloudContext = cloudCanvas.getContext('2d');
  const gradient = cloudContext.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.33, 'rgba(255,255,255,.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  cloudContext.fillStyle = gradient;
  cloudContext.fillRect(0, 0, 96, 96);
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  // Espuma y aerosol del tsunami: viajan con la cresta y rompen su silueta perfecta.
  const sprayCount = 900;
  const sprayPosition = new Float32Array(sprayCount * 3);
  const spraySeed = new Float32Array(sprayCount * 3);
  for (let i = 0; i < sprayCount; i++) spraySeed.set([(random() - .5) * 54, random(), random()], i * 3);
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute('position', new THREE.BufferAttribute(sprayPosition, 3));
  const spray = new THREE.Points(sprayGeometry, new THREE.PointsMaterial({ color: 0xe8f8f5, map: cloudTexture, size: .34, transparent: true, opacity: .82, depthWrite: false }));
  // La cresta se representa con espuma continua; el aerosol queda desactivado
  // para evitar que el tsunami se lea como lluvia.
  spray.visible = false;
  surge.add(spray);

  const tornado = new THREE.Group();
  tornado.position.set(-36, 0, 8);
  world.add(tornado);

  // Descargas eléctricas que nacen en la nube del embudo y alcanzan el suelo.
  const lightning = new THREE.Group();
  tornado.add(lightning);
  const flash = new THREE.PointLight(0xc8e7ff, 0, 48, 2);
  flash.position.set(0, 16, 0);
  tornado.add(flash);
  let lightningUntil = 0;
  let nextLightningAt = 3.5;
  function strikeLightning() {
    lightning.clear();
    for (let bolt = 0; bolt < 2 + (random() * 2 | 0); bolt++) {
      const points = [];
      let x = (random() - .5) * 6, z = (random() - .5) * 6;
      points.push(new THREE.Vector3(x, 31, z));
      for (let y = 28; y > 0; y -= 2.1) {
        x += (random() - .5) * 2.2;
        z += (random() - .5) * 2.2;
        points.push(new THREE.Vector3(x, y, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lightning.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: bolt ? 0x9abfff : 0xffffff, transparent: true, opacity: 1 })));
    }
    lightning.visible = true;
  }

  function explodeIntoTornadoDebris(building) {
    building.destroyed = true;
    building.tornadoCaught = true;
    const dx = building.group.position.x - tornado.position.x;
    const dz = building.group.position.z - tornado.position.z;
    building.velocity.set(-dz, 1.8 + random() * 2, dx).normalize().multiplyScalar(1.5 + random() * 2.0); 
    building.velocity.y = 1.8 + random() * 2;
    
    // Spawns some small sparks if it's a pole
    if (building.isPole) {
        const sparkLight = new THREE.PointLight(0x00ffff, 4, 15);
        sparkLight.position.set(building.home.x, 2, building.home.z);
        world.add(sparkLight);
        setTimeout(() => {
            world.remove(sparkLight);
        }, 150 + Math.random() * 200);
        
        // Spawn actual spark fragments
        for (let i = 0; i < 15; i++) {
          const size = 0.05 + random() * 0.1;
          const color = random() > 0.3 ? 0x00ffff : 0xffffff;
          const fragment = new THREE.Mesh(new THREE.BoxGeometry(size, size * (.7 + random()), size), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
          fragment.position.set(building.home.x + (random() - .5) * 1.2, 2 + random() * 8, building.home.z + (random() - .5) * 1.2);
          world.add(fragment);
          rubblePieces.push({ 
              mesh: fragment, 
              tornado: true, 
              velocity: new THREE.Vector3((random() - .5) * 4, random() * 5, (random() - .5) * 4), 
              spin: new THREE.Vector3(random() * .34, random() * .34, random() * .34), 
              life: 0,
              isSpark: true
          });
        }
    }
  }

  // Clic/tacto en el mapa: crea un epicentro de magnitud configurable.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart = null;
  let earthquake = null;
  const magnitudeInput = document.getElementById('magnitude');
  const magnitudeValue = document.getElementById('magnitude-value');
  const tsunamiButton = document.getElementById('tsunami-trigger');
  magnitudeInput.addEventListener('input', () => { magnitudeValue.textContent = magnitudeInput.value; });
  tsunamiButton.addEventListener('click', () => {
    enableSound();
    floodWaveNow.fill(0); floodWavePrev.fill(0); floodWaveNext.fill(0);
    tsunami = { age: 0, magnitude: Number(magnitudeInput.value), duration: 15 };
    document.getElementById('event-status').textContent = `Tsunami nivel ${magnitudeInput.value} · ola en camino`;
    sayDialogue(['WTF, that wave is huge!', 'Run, the water is coming in!', 'Motherf—, what is happening?'][Math.floor(Math.random() * 3)]);
  });
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) return;
    pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([ground, sea], false)[0];
    if (!hit) return;
    enableSound();
    seismicWaves.clear();
    const magnitude = Number(magnitudeInput.value);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 96), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xf0c86a : 0xa6d4dd, transparent: true, opacity: .78 - i * .16, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(hit.point); ring.position.y = .045 + i * .006;
      seismicWaves.add(ring);
    }
    earthquake = { center: hit.point.clone(), magnitude, age: 0, duration: 4.2 + magnitude * .32 };
    document.getElementById('event-status').textContent = `Sismo M${magnitudeInput.value} · epicentro activado`;
    sayDialogue(['Oh my God, it is shaking!', 'Get out of the building!', 'WTF, it will not stop!'][Math.floor(Math.random() * 3)]);
  });
  const cloudCount = 9500;
  const cloudPositions = new Float32Array(cloudCount * 3);
  const cloudSeed = new Float32Array(cloudCount * 4);
  for (let i = 0; i < cloudCount; i++) {
    const height = Math.pow(random(), 1.6) * 31;
    // El radio aumenta gradualmente hacia la nube madre: un embudo, no un cono perfecto.
    const core = .28 + Math.pow(height / 31, 1.45) * 4.5;
    cloudSeed.set([height, core + random() * (0.42 + height * .025), random() * Math.PI * 2, random()], i * 4);
  }
  const cloudGeometry = new THREE.BufferGeometry();
  cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
  const cloudMaterial = new THREE.PointsMaterial({ color: 0xc9c7bd, map: cloudTexture, transparent: true, opacity: .27, size: 1.45, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending });
  const funnelCloud = new THREE.Points(cloudGeometry, cloudMaterial);
  tornado.add(funnelCloud);

  const debrisCount = 760;
  const debrisPositions = new Float32Array(debrisCount * 3);
  const debrisSeed = new Float32Array(debrisCount * 4);
  for (let i = 0; i < debrisCount; i++) debrisSeed.set([random() * 12, .5 + random() * 3.5, random() * Math.PI * 2, random()], i * 4);
  const debrisGeometry = new THREE.BufferGeometry();
  debrisGeometry.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));
  const debris = new THREE.Points(debrisGeometry, new THREE.PointsMaterial({ color: 0x433d34, size: .13, transparent: true, opacity: .8, depthWrite: false }));
  tornado.add(debris);

  const mistCount = 1350;
  const mistGeometry = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(mistCount * 3);
  const mistSeed = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistSeed.set([(random() - .5) * 55, (random() - .5) * 36, random()], i * 3);
  }
  mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mist = new THREE.Points(mistGeometry, new THREE.PointsMaterial({ color: 0xd8ddd8, map: cloudTexture, size: 2.7, transparent: true, opacity: 0.22, depthWrite: false }));
  world.add(mist);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), .05);
    const t = clock.elapsedTime;
    skyMaterial.uniforms.time.value = t;
    if (audio.enabled) {
      audio.wind.gain.setTargetAtTime(.035, audio.context.currentTime, .45);
      audio.quake.gain.setTargetAtTime(earthquake ? .008 + earthquake.magnitude * .007 : 0, audio.context.currentTime, .08);
    }
    // Oleaje continuo; el mar reacciona visualmente al temporal.
    for (let i = 0; i < seaPosition.count; i++) {
      const x = seaPosition.getX(i), y = seaPosition.getY(i);
      const worldX = x + sea.position.x;
      const worldZ = -y;
      const tornadoDistance = Math.hypot(worldX - tornado.position.x, worldZ - tornado.position.z);
      const vortexWater = Math.exp(-tornadoDistance * .22) * Math.sin(t * 5.5 - tornadoDistance * 1.4) * .38;
      const tsunamiWater = tsunami ? Math.exp(-Math.pow(worldZ - surge.position.z, 2) / 48) * .55 : 0;
      seaPosition.setZ(i, Math.sin(t * 2.5 + worldX * .35 + worldZ * .2) * .25 + Math.cos(t * 1.5 + worldZ * .5) * .15 + vortexWater + tsunamiWater);
    }
    seaPosition.needsUpdate = true;
    const floodProgress = tsunami ? Math.min(1, tsunami.age / tsunami.duration) : 0;
    if (tsunami) tsunami.age += dt;
    const easedFlood = floodProgress * floodProgress * (3 - 2 * floodProgress);
    const tsunamiStrength = tsunami ? tsunami.magnitude / 10 : 0;
    floodLevel = tsunami ? -1.5 + easedFlood * (1.25 + tsunamiStrength * 1.65) : -1.5;
    floodWater.visible = Boolean(tsunami);
    // La superficie se calcula como una onda somera 2D, no como una pared rígida.
    floodWater.position.y = 0;
    surge.visible = Boolean(tsunami) && floodProgress > .02 && floodProgress < .96;
    surge.scale.y = .48 + tsunamiStrength * .9;
    surge.position.set(0, Math.max(.2, floodLevel + waveHeight * surge.scale.y / 2), 51 - floodProgress * 230);
    if (tsunami) {
      const damping = .018, propagation = .72;
      for (let row = 1; row < floodRows - 1; row++) {
        for (let col = 1; col < floodCols - 1; col++) {
          const i = row * floodCols + col;
          const lap = floodWaveNow[i - 1] + floodWaveNow[i + 1] + floodWaveNow[i - floodCols] + floodWaveNow[i + floodCols] - 4 * floodWaveNow[i];
          floodWaveNext[i] = (2 * floodWaveNow[i] - floodWavePrev[i] + propagation * lap) * (1 - damping);
        }
      }
      const sourceRow = floodRows - 5;
      if (tsunami.age < 1.25) {
        for (let col = 3; col < floodCols - 3; col++) {
          const distance = (col - floodCols / 2) / 18;
          floodWaveNext[sourceRow * floodCols + col] += Math.exp(-distance * distance) * tsunamiStrength * .16;
        }
      }
      const swap = floodWavePrev; floodWavePrev = floodWaveNow; floodWaveNow = floodWaveNext; floodWaveNext = swap;
    }
    const baseFlood = tsunami ? easedFlood * (.75 + tsunamiStrength * 1.35) : 0;
    let highestWater = 0;
    for (let i = 0; i < floodPosition.count; i++) {
      const h = tsunami ? floodWaveNow[i] : 0;
      highestWater = Math.max(highestWater, h);
      floodPosition.setZ(i, -1.5 + baseFlood + h);
    }
    floodLevel = tsunami ? -1.5 + baseFlood + highestWater : -1.5;
    floodPosition.needsUpdate = true;
    // La pared de agua se curva y vibra; la espuma se desprende de su cresta.
    for (let i = 0; i < wavePosition.count; i++) {
      const x = wavePosition.getX(i), y = wavePosition.getY(i), n = (y + waveHeight / 2) / waveHeight;
      const crestCurve = Math.pow(n, 4.0) * 8.5; 
      const globalCurve = Math.pow(x / 200, 2) * -15; // Curva global viscosa
      wavePosition.setZ(i, Math.sin(x * .45 + t * 1.8) * (.08 + n * .2) + Math.sin(x * 1.1 - t * 2.6) * n * .11 + crestCurve + globalCurve);
    }
    wavePosition.needsUpdate = true;
    for (let i = 0; i < sprayCount; i++) {
      const x = spraySeed[i * 3], rise = spraySeed[i * 3 + 1], phase = spraySeed[i * 3 + 2];
      sprayPosition[i * 3] = x + Math.sin(t * 3 + phase * 18) * .32;
      sprayPosition[i * 3 + 1] = waveHeight / 2 + rise * (2.1 + Math.sin(t * 2 + phase * 9) * .8);
      sprayPosition[i * 3 + 2] = 2.45 + rise * 2.4 + Math.sin(t * 3.5 + phase * 16) * .28;
    }
    sprayGeometry.attributes.position.needsUpdate = true;
    if (tsunami && tsunami.age > tsunami.duration + 7) { tsunami = null; floodWater.visible = false; surge.visible = false; document.getElementById('event-status').textContent = 'Toca el mapa para crear un terremoto'; }
    // Ciclo narrativo: nace sobre el mar, toca tierra y atraviesa la ciudad.
    const journey = (t % 62) / 62;
    const targetX = -36 + journey * 59;
    const targetZ = 8 + Math.sin(journey * Math.PI * 2.2) * 6;
    tornado.position.x += (targetX - tornado.position.x) * .024;
    tornado.position.z += (targetZ - tornado.position.z) * .024;
    if (t > nextDialogue && tornado.position.x > -15) {
      sayDialogue(['WTF, look at the tornado!', 'Run, it is taking everything!', 'Motherf—, the sky is falling!'][Math.floor(Math.random() * 3)]);
      nextDialogue = t + 7 + Math.random() * 7;
    }
    if (t > lightningUntil) {
      lightning.visible = false;
      flash.intensity = 0;
      if (t > nextLightningAt) { strikeLightning(); lightningUntil = t + .22; nextLightningAt = t + 4.5 + random() * 6; flash.intensity = 22 + random() * 28; thunderSound(); }
    }
    skyMaterial.uniforms.flash.value = lightning.visible ? .42 : 0;
    for (let i = 0; i < cloudCount; i++) {
      const h = cloudSeed[i * 4];
      const baseRadius = cloudSeed[i * 4 + 1];
      const seedAngle = cloudSeed[i * 4 + 2];
      const noise = cloudSeed[i * 4 + 3];
      const spin = t * (4.8 - h * .085) + seedAngle;
      const breathing = Math.sin(t * 1.4 + noise * 20 + h * .45) * (.12 + h * .012);
      const wobble = Math.sin(t * .72 + h * .18) * h * .025;
      cloudPositions[i * 3] = Math.cos(spin) * (baseRadius + breathing) + wobble;
      cloudPositions[i * 3 + 1] = h + Math.sin(t * 2 + noise * 12) * .12;
      cloudPositions[i * 3 + 2] = Math.sin(spin) * (baseRadius + breathing);
    }
    cloudGeometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < debrisCount; i++) {
      const h = debrisSeed[i * 4] + Math.sin(t * .45 + debrisSeed[i * 4 + 3] * 8) * 1.3;
      const r = debrisSeed[i * 4 + 1] + h * .085;
      const a = debrisSeed[i * 4 + 2] + t * (6.3 - h * .16);
      debrisPositions[i * 3] = Math.cos(a) * r;
      debrisPositions[i * 3 + 1] = Math.max(.1, h);
      debrisPositions[i * 3 + 2] = Math.sin(a) * r;
    }
    debrisGeometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < mistCount; i++) {
      const x = mistSeed[i * 3], z = mistSeed[i * 3 + 1], phase = mistSeed[i * 3 + 2] * 10;
      mistPositions[i * 3] = x + Math.sin(t * .35 + phase) * 2;
      mistPositions[i * 3 + 1] = 0.12 + Math.sin(t * .6 + phase) * .18;
      mistPositions[i * 3 + 2] = z + Math.cos(t * .28 + phase) * 2;
    }
    mistGeometry.attributes.position.needsUpdate = true;
    const vortexRadius = 5.3;
    buildings.forEach(building => {
      const dx = building.group.position.x - tornado.position.x;
      const dz = building.group.position.z - tornado.position.z;
      const distance = Math.hypot(dx, dz);
      if (!building.destroyed && distance < vortexRadius + 3) {
        const pull = Math.max(0, 1 - distance / (vortexRadius + 3));
        building.tornadoDamage += pull * dt * 2.5;
        if (building.tornadoDamage > 0 && building.crackMaterial) {
          building.crackMaterial.opacity = Math.min(.96, Math.max(building.crackMaterial.opacity, building.tornadoDamage * 1.2));
        }
        building.group.position.x = building.home.x + Math.sin(t * 18 + distance) * pull * .14;
        building.group.position.z = building.home.z + Math.cos(t * 21 + distance) * pull * .14;
        building.group.rotation.z = Math.sin(t * 13 + distance) * pull * .055;
        if (building.tornadoDamage > .9) explodeIntoTornadoDebris(building);
      }
      // Impacto de tsunami: el frente llega por la calle, abre grietas y derriba por empuje horizontal.
      if (tsunami && !building.destroyed && Math.abs(building.home.x - surge.position.x) < 29) {
        const frontDistance = Math.abs(building.home.z - surge.position.z);
        if (frontDistance < 3.8 && floodProgress > .08) {
          const impact = (1 - frontDistance / 3.8) * tsunamiStrength;
          building.damage = Math.min(1.2, building.damage + impact * dt * .72);
          if (building.crackMaterial) {
            building.crackMaterial.opacity = Math.max(building.crackMaterial.opacity, Math.min(.92, building.damage));
          }
          if (!building.tsunamiCarried) building.group.position.z = building.home.z - impact * .16;
          building.group.rotation.x = -impact * .035;
          if (building.damage > .52) building.tsunamiCarried = true;
          if (!building.collapsing && building.damage > .68 + random() * .17) {
            building.collapsing = true;
            building.collapseDirection = Math.sign(building.home.z - surge.position.z) || 1;
            building.collapseAxis = 'x';
          }
        }
      }
      if (tsunami && building.tsunamiCarried && !building.destroyed) {
        const dragSpeed = .45 + tsunamiStrength * 2.2;
        building.group.position.z -= dragSpeed * dt;
        building.group.position.y = Math.max(0, floodLevel * .22);
        building.group.rotation.x -= dt * (.12 + tsunamiStrength * .18);
        building.group.rotation.z += Math.sin(t * 4 + building.home.x) * dt * .08;
        if (building.group.position.z < surge.position.z - 8 || building.group.position.y > building.height * .35) building.collapsing = true;
      }
      if (building.destroyed) {
        if (building.tornadoCaught) {
          const dx = tornado.position.x - building.group.position.x, dz = tornado.position.z - building.group.position.z, d = Math.max(.3, Math.hypot(dx, dz));
          building.velocity.x += dx / d * .08 - dz / d * .06; building.velocity.z += dz / d * .08 + dx / d * .06; building.velocity.y += .045;
          if (building.group.position.y > 28) building.tornadoCaught = false;
        }
        building.velocity.y -= building.tornadoCaught ? .012 : .045;
        building.group.position.add(building.velocity);
        building.group.rotation.x += .06;
        building.group.rotation.z += .05;
        if (building.group.position.y < -2) building.group.visible = false;
      }
    });
    if (earthquake) {
      earthquake.age += dt;
      const life = Math.max(0, 1 - earthquake.age / earthquake.duration);
      const waveRadius = earthquake.age * (5.5 + earthquake.magnitude * 1.5);
      seismicWaves.children.forEach((ring, i) => {
        const radius = Math.max(.1, waveRadius - i * 5.8);
        ring.scale.set(radius, radius, 1);
        ring.material.opacity = Math.max(0, (.72 - i * .15) * life);
      });
      buildings.forEach(building => {
        if (building.destroyed) return;
        const dx = building.home.x - earthquake.center.x, dz = building.home.z - earthquake.center.z;
        const distance = Math.hypot(dx, dz);
        const local = Math.max(0, 1 - distance / (11 + earthquake.magnitude * 4)) * life;
        const waveImpact = Math.exp(-Math.pow(distance - waveRadius, 2) / 32) * life;
        if (local <= 0) return;
        const shake = local * earthquake.magnitude * .028;
        building.group.position.x = building.home.x + Math.sin(t * 24 + distance) * shake;
        building.group.position.z = building.home.z + Math.cos(t * 21 + distance) * shake;
        building.group.rotation.z = Math.sin(t * 17 + distance) * shake * .28;
        building.damage = Math.min(1.25, building.damage + waveImpact * earthquake.magnitude * dt * .42);
        if (building.damage > 0 && building.crackMaterial) {
          building.crackMaterial.opacity = Math.min(.88, building.damage * .9);
        }
        // Primero las grietas, después la inclinación: el colapso no es instantáneo.
        if (!building.collapsing && building.damage > .72 + random() * .18 && earthquake.magnitude >= 5.8) {
          building.collapsing = true;
          building.collapseDirection = dx >= 0 ? 1 : -1;
        }
      });
      if (earthquake.age >= earthquake.duration) { earthquake = null; seismicWaves.clear(); document.getElementById('event-status').textContent = 'Toca el mapa para crear un terremoto'; }
    } else {
      buildings.forEach(building => { if (!building.destroyed) { building.group.position.copy(building.home); building.group.rotation.z *= .82; } });
    }
    buildings.forEach(building => {
      if (!building.collapsing || building.destroyed) return;
      building.collapseAge += dt;
      const fall = Math.min(1, building.collapseAge / 1.65);
      building.group.rotation[building.collapseAxis] = building.collapseDirection * fall * 1.22;
      building.group.position.y = -fall * building.height * .18;
      if (fall > .82 && !building.destroyed) {
        building.destroyed = true;
        building.group.visible = false;
        for (let i = 0; i < 22; i++) {
          const fragment = new THREE.Mesh(new THREE.BoxGeometry(.18 + random() * .55, .14 + random() * .3, .18 + random() * .6), new THREE.MeshStandardMaterial({ color: 0x716f68, roughness: .9 }));
          fragment.position.set(building.home.x + (random() - .5) * building.width, .1 + random() * building.height * .28, building.home.z + (random() - .5) * building.width);
          world.add(fragment);
          rubblePieces.push({ mesh: fragment, velocity: new THREE.Vector3((random() - .5) * 1.8, .5 + random() * 1.8, (random() - .5) * 1.8), spin: new THREE.Vector3(random() * .18, random() * .18, random() * .18) });
        }
      }
    });
    rubblePieces.forEach(piece => {
      if (piece.tornado) {
        piece.life += dt;
        const dx = tornado.position.x - piece.mesh.position.x, dz = tornado.position.z - piece.mesh.position.z;
        const horizontal = Math.max(.25, Math.hypot(dx, dz));
        const inward = new THREE.Vector3(dx / horizontal, 0, dz / horizontal);
        const tangent = new THREE.Vector3(-inward.z, 0, inward.x);
        const lift = Math.max(0, 1 - horizontal / 17);
        piece.velocity.addScaledVector(inward, lift * .11);
        piece.velocity.addScaledVector(tangent, lift * (.085 + 1.25 / (horizontal + 2)));
        piece.velocity.y += lift * .085 - .018;
        piece.velocity.multiplyScalar(.985);
        piece.mesh.position.add(piece.velocity);
        // Cuando alcanza gran altura, el viento lo expulsa y vuelve a caer.
        if (piece.mesh.position.y > 26 || (piece.life > 11 && horizontal > 18)) piece.tornado = false;
      }
      if (!piece.tornado) {
        if (piece.mesh.position.y > .11) { piece.velocity.y -= .045; piece.mesh.position.add(piece.velocity); }
        else { piece.mesh.position.y = .1; piece.velocity.set(0, 0, 0); }
      }
      piece.mesh.rotation.x += piece.spin.x; piece.mesh.rotation.y += piece.spin.y; piece.mesh.rotation.z += piece.spin.z;
      if (piece.isSpark) {
          piece.mesh.material.opacity = Math.max(0, 1 - piece.life / 1.8);
          if (piece.mesh.material.opacity <= 0) {
              piece.mesh.visible = false;
          }
      }
    });
    cars.forEach(item => {
      const { car, axis, speed } = item;
      
      // Animate emergency lights for police cars
      if (item.isPolice) {
        item.lightPhase += dt;
        if (item.lightPhase > 0.15) {
          item.lightPhase = 0;
          const flash = Math.floor(t * 8) % 2 === 0;
          item.lightbarRed.material.color.setHex(flash ? 0xff0000 : 0x110000);
          item.lightbarBlue.material.color.setHex(flash ? 0x000011 : 0x0000ff);
          item.policeLight.color.setHex(flash ? 0xff0000 : 0x0000ff);
        }
      }
      const distance = Math.hypot(car.position.x - tornado.position.x, car.position.z - tornado.position.z);
      if (!item.destroyed && distance < vortexRadius + 1.5) {
        item.destroyed = true;
        const dx = car.position.x - tornado.position.x;
        const dz = car.position.z - tornado.position.z;
        item.tornadoCaught = true;
        item.velocity.set(-dz, 1.8 + random() * 2, dx).normalize().multiplyScalar(1.8 + random() * 2.5); item.velocity.y = 1.8 + random() * 2;
      }
      if (item.destroyed) {
        if (item.tornadoCaught) {
          const dx = tornado.position.x - car.position.x, dz = tornado.position.z - car.position.z, d = Math.max(.3, Math.hypot(dx, dz));
          item.velocity.x += dx / d * .08 - dz / d * .06; item.velocity.z += dz / d * .08 + dx / d * .06; item.velocity.y += .045;
          if (car.position.y > 22) item.tornadoCaught = false;
        }
        item.velocity.y -= item.tornadoCaught ? .012 : .045;
        car.position.add(item.velocity);
        car.rotation.x += .11;
        car.rotation.z += .08;
        if (car.position.y < -2) car.visible = false;
      } else {
        if (tsunami && Math.abs(car.position.z - surge.position.z) < 4.2 && Math.abs(car.position.x - surge.position.x) < 29) {
          item.destroyed = true;
          item.velocity.set((random() - .5) * .55, .25 + random() * .5, -.55 - random() * .75);
        }
        car.position[axis] += speed * .012;
        if (axis === 'x') {
            if (car.position.x > -200 && car.position.x < -32) {
                const nx = (car.position.x - bridgeCenterX) / halfBridgeWidth;
                car.position.y = Math.max(0, 6.0 * (1 - nx * nx));
            } else {
                car.position.y = 0;
            }
            if (car.position.x > 130) car.position.x = -200;
        } else {
            if (car.position.z > 130) car.position.z = -140;
        }
      }
    });
    buses.forEach(item => {
      const distance = Math.hypot(item.bus.position.x - tornado.position.x, item.bus.position.z - tornado.position.z);
      if (!item.destroyed && distance < vortexRadius + 1.7) { item.destroyed = true; item.bus.position.y = .9; }
      if (item.destroyed) { item.bus.position.y -= .04; item.bus.rotation.z += .08; }
      else { item.bus.position.z += item.speed; if (item.bus.position.z > 130) item.bus.position.z = -140; }
    });
    people.forEach(item => {
      const distance = item.person.position.distanceTo(tornado.position);
      
      if (distance < 15) {
        item.fleeing = true;
        item.state = 'walk';
        item.direction.set(item.person.position.x - tornado.position.x, 0, item.person.position.z - tornado.position.z).normalize();
      } else if (!item.fleeing) {
        item.stateTimer -= dt;
        if (item.stateTimer <= 0) {
           if (item.state === 'idle') {
               item.state = 'walk';
               item.stateTimer = 2 + random() * 5;
               if (random() > 0.3) {
                   item.direction.set(0, 0, random() > 0.5 ? 1 : -1);
               } else {
                   item.direction.set(random() - .5, 0, random() - .5).normalize();
               }
           } else {
               item.state = 'idle';
               item.stateTimer = 1 + random() * 4;
           }
        }
      }
      
      const speedMult = item.fleeing ? 5.5 : 1;
      item.pace = item.state === 'walk' ? item.basePace * speedMult : 0;
      item.person.position.addScaledVector(item.direction, item.pace);
      
      if (item.pace > 0) {
          item.bobPhase += dt * (item.fleeing ? 25 : 12);
          item.person.position.y = Math.abs(Math.sin(item.bobPhase)) * 0.08;
          item.person.rotation.x = item.fleeing ? 0.4 : 0.15;
          let targetRotY = Math.atan2(item.direction.x, item.direction.z);
          let diff = targetRotY - item.person.rotation.y;
          while(diff < -Math.PI) diff += Math.PI*2;
          while(diff > Math.PI) diff -= Math.PI*2;
          item.person.rotation.y += diff * dt * 5;
      } else {
          item.person.position.y = 0;
          item.person.rotation.x = 0;
      }

      if (distance < 3.8) item.person.visible = false;
      if (floodLevel > .42 && item.person.position.x > -8) item.person.visible = false;
    });
    boats.forEach(item => {
      const quakeDistance = earthquake ? Math.hypot(item.boat.position.x - earthquake.center.x, item.boat.position.z - earthquake.center.z) : Infinity;
      const waveHit = earthquake && Math.abs(quakeDistance - earthquake.age * (5.5 + earthquake.magnitude * 1.5)) < 3.2;
      const tornadoHit = Math.hypot(item.boat.position.x - tornado.position.x, item.boat.position.z - tornado.position.z) < 7;
      const tsunamiHit = tsunami && Math.abs(item.boat.position.z - surge.position.z) < 5 && Math.abs(item.boat.position.x - surge.position.x) < 29;
      if (!item.capsizing && ((waveHit && earthquake.magnitude > 5.5) || tornadoHit || tsunamiHit)) item.capsizing = true;
      if (item.capsizing) {
        item.roll += dt * .62;
        item.boat.rotation.z = Math.min(1.58, item.roll);
        item.boat.position.y -= dt * Math.max(0, item.roll - .5) * .32;
        if (item.boat.position.y < -1.25) item.boat.visible = false;
      } else {
        item.boat.position.z += item.speed;
        item.boat.position.y = Math.sin(t * 1.4 + item.boat.position.x) * .05;
        item.boat.rotation.z = Math.sin(t * 1.4 + item.boat.position.x) * .025;
        if (item.boat.position.z > 130) item.boat.position.z = -140;
      }
    });
    planes.forEach(item => {
      const distance = Math.hypot(item.plane.position.x - tornado.position.x, item.plane.position.z - tornado.position.z);
      if (!item.destroyed && distance < 8.5 && item.plane.position.y < 38) {
        item.destroyed = true;
        const dx = tornado.position.x - item.plane.position.x, dz = tornado.position.z - item.plane.position.z, d = Math.max(.4, Math.hypot(dx, dz));
        item.velocity.set(dx / d + (-dz / d) * .8, .85, dz / d + (dx / d) * .8).multiplyScalar(1.15);
      }
      if (item.destroyed) {
        const dx = tornado.position.x - item.plane.position.x, dz = tornado.position.z - item.plane.position.z, d = Math.max(.4, Math.hypot(dx, dz));
        item.velocity.x += dx / d * .055 - dz / d * .035;
        item.velocity.z += dz / d * .055 + dx / d * .035;
        item.velocity.y += .028;
        item.velocity.multiplyScalar(.987);
        item.plane.position.add(item.velocity);
        item.plane.rotation.x += .08; item.plane.rotation.z += .13; item.plane.rotation.y += .06;
        if (item.plane.position.y > 58) { item.destroyed = false; item.plane.position.y = 25; item.plane.rotation.set(0, 0, 0); }
      } else {
        item.plane.position.x += item.speed;
        if (item.plane.position.x > 58) item.plane.position.x = -58;
        if (item.plane.position.x < -58) item.plane.position.x = 58;
      }
    });
    radar.rotation.y += dt * 2.0; // Spin radar
    beacon.position.x = 25 + Math.sin(t * 3) * 1.5;
    beacon.position.z = 39 + Math.cos(t * 3) * 1.5;

    // Helicopter circular flight and searchlight sweeping
    const copterAngle = t * 0.18;
    const copterRadius = 38;
    copter.position.x = Math.sin(copterAngle) * copterRadius;
    copter.position.z = Math.cos(copterAngle) * copterRadius;
    copter.rotation.y = copterAngle + Math.PI / 2;
    copter.rotation.x = 0.08;
    rotor.rotation.y += dt * 25;
    const copterFlash = Math.floor(t * 8) % 2 === 0;
    copterRed.material.color.setHex(copterFlash ? 0xff0000 : 0x220000);
    copterBlue.material.color.setHex(copterFlash ? 0x000022 : 0x0000ff);
    copterSpot.target.position.set(
      copter.position.x + Math.sin(t * 1.5) * 8,
      0,
      copter.position.z + Math.cos(t * 1.2) * 8
    );
    searchlightCone.lookAt(copterSpot.target.position);
    searchlightCone.rotation.x += Math.PI / 2;

    // Animate traffic lights cycle
    trafficLights.forEach(light => {
      light.timer += dt;
      const cycle = light.timer % 9;
      if (cycle < 4) {
        light.tLight.color.setHex(0x00ffaa);
        light.tLight.intensity = 1.5;
        light.tBulbGreen.material.color.setHex(0x00ffaa);
        light.tBulbRed.material.color.setHex(0x220000);
        light.tBulbGold.material.color.setHex(0x221100);
      } else if (cycle < 5) {
        light.tLight.color.setHex(0xffb84d);
        light.tLight.intensity = 1.8;
        light.tBulbGreen.material.color.setHex(0x001100);
        light.tBulbRed.material.color.setHex(0x220000);
        light.tBulbGold.material.color.setHex(0xffb84d);
      } else {
        light.tLight.color.setHex(0xff3300);
        light.tLight.intensity = 1.5;
        light.tBulbGreen.material.color.setHex(0x001100);
        light.tBulbRed.material.color.setHex(0xff3300);
        light.tBulbGold.material.color.setHex(0x221100);
      }
    });

    cityLights.forEach(light => {
      const pulse = .78 + Math.sin(t * 2.4 + light.phase) * .22;
      light.bulb.scale.setScalar(.88 + pulse * .2);
    });

    // Update Times Square News Warning Screen
    let currentWarning = 'WEATHER: CLEAR';
    if (tornado) currentWarning = 'TORNADO ALERT!';
    else if (tsunami) currentWarning = 'TSUNAMI ALERT!';
    else if (earthquake) currentWarning = 'QUAKE WARNING!';
    updateNewsScreen(currentWarning);
    airportTraffic.forEach(item => {
      item.mesh.position.z += item.speed;
      if (item.isPlane) {
         if (item.mesh.position.z > 50) {
             item.mesh.position.z = -40;
             item.mesh.position.y = 15;
         }
         if (item.mesh.position.z > 0) {
             item.mesh.position.y += dt * 5.0;
             item.mesh.rotation.x = -0.2;
         } else {
             item.mesh.position.y = 0.55;
             item.mesh.rotation.x = 0;
         }
      } else {
         if (item.mesh.position.z > 43) item.mesh.position.z = -20;
         item.mesh.rotation.y = Math.sin(t * .5 + item.mesh.position.z) * .025;
      }
    });
    trees.forEach(item => {
      const wind = Math.sin(t * 2.2 + item.phase) * .055 + Math.sin(t * .7 + item.phase) * .035;
      const proximity = Math.max(0, 1 - item.tree.position.distanceTo(tornado.position) / 18);
      item.tree.rotation.z = wind + proximity * Math.sin(t * 13 + item.phase) * .21;
    });
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  function seededRandom(seed) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function createFacadeMaterial(color, variation) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 256);
    // Juntas, balcones y ventanas con luz irregular para evitar bloques planos.
    ctx.fillStyle = 'rgba(45,47,45,.22)';
    for (let y = 4; y < 256; y += 29) ctx.fillRect(0, y, 256, 2);
    for (let y = 12; y < 250; y += 29) {
      for (let x = 12; x < 250; x += 28) {
        const lit = ((x * 3 + y * 7 + variation * 13) % 5) === 0;
        ctx.fillStyle = lit ? '#d6bf86' : '#35515a';
        ctx.fillRect(x, y, 13, 14);
        ctx.fillStyle = 'rgba(230,235,231,.32)';
        ctx.fillRect(x + 1, y + 1, 11, 1);
        if ((x + y + variation) % 3 === 0) { ctx.fillStyle = 'rgba(65,58,52,.45)'; ctx.fillRect(x - 2, y + 15, 18, 2); }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return new THREE.MeshStandardMaterial({ color, map: texture, roughness: .67, metalness: .05 });
  }
})();

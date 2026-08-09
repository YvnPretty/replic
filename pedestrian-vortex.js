/* Pedestrian panic + tornado interaction. Stylized, non-graphic disaster simulation. */
(() => {
  if (!window.THREE) return;

  const people = [];
  let scene = null;
  let world = null;
  let tornado = null;
  let last = performance.now();
  let lastVoice = 0;
  const START = new THREE.Vector3(-36, 0, 8);
  const temp = new THREE.Vector3();

  const phrases = [
    '¡Corran!',
    '¡Cuidado!',
    '¡Viene el tornado!',
    '¡Todos afuera!',
    '¡Muévanse!',
    '¡Por aquí!'
  ];

  function person(x, z, seed) {
    const g = new THREE.Group();
    g.name = 'pedestrian';
    const shirtColors = [0x365f8a, 0x8a3d3d, 0x47724d, 0x8a6d35, 0x5f4d78];
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColors[seed % shirtColors.length], roughness: .82 });
    const skin = new THREE.MeshStandardMaterial({ color: [0xc98f68,0xa96e4e,0xe0ad82][seed % 3], roughness: .9 });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,.55,7), new THREE.MeshStandardMaterial({color:0x252932,roughness:.9}));
    legs.position.y=.28;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.58,7), shirt); torso.position.y=.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.14,8,7), skin); head.position.y=1.14;
    const armA = new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.48,6), shirt); armA.position.set(-.18,.72,0); armA.rotation.z=-.22;
    const armB = armA.clone(); armB.position.x=.18; armB.rotation.z=.22;
    g.add(legs,torso,head,armA,armB);
    g.position.set(x,0,z);
    world.add(g);
    people.push({ group:g, velocity:new THREE.Vector3((Math.random()-.5)*.08,0,(Math.random()-.5)*.08), seed, panicked:false, airborne:false, home:g.position.clone() });
  }

  function populate() {
    if (!world || people.length) return;
    // Peatones repartidos en zonas urbanas; conservan el estilo sencillo de los muñecos de la escena.
    const spots = [
      [-8,-76],[-5,-62],[5,-54],[8,-42],[-7,-28],[6,-18],[-8,-4],[7,9],[-6,22],[6,36],[-8,51],[7,68],[-5,82],
      [-12,-34],[12,-10],[-12,12],[12,42]
    ];
    spots.forEach((p,i)=>person(p[0],p[1],i));
  }

  function findObjects() {
    if (!scene) return;
    world = world || scene.children.find(o => o.name === 'world') || scene.children.find(o => o.isGroup && o.children.length > 30);
    if (!tornado) scene.traverse(o => { if (!tornado && /tornado/i.test(o.name || '')) tornado=o; });
    if (!tornado) tornado = new THREE.Group();
    populate();
  }

  function panicVoice(distance) {
    if (!window.__replicSound || !window.__replicSound.enabled || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (now-lastVoice < 4200 || distance > 24) return;
    lastVoice = now;
    const u = new SpeechSynthesisUtterance(phrases[Math.floor(Math.random()*phrases.length)]);
    u.lang='es-MX'; u.rate=.92+Math.random()*.18; u.pitch=.82+Math.random()*.32; u.volume=Math.max(.15,.75*(1-distance/24));
    speechSynthesis.speak(u);
  }

  function update(now) {
    requestAnimationFrame(update);
    if (!scene) return;
    const dt=Math.min((now-last)/1000,.035); last=now;
    if (!world || !people.length) findObjects();
    if (!world) return;
    const center=tornado && tornado.position ? tornado.getWorldPosition(temp) : START;
    const strength=Math.max(.1,Math.min(1,(window.replicTornadoStrength||6)/10));
    const radius=13+strength*7;
    let nearest=999;

    for (const p of people) {
      const pos=p.group.position;
      const dx=pos.x-center.x, dz=pos.z-center.z, dist=Math.hypot(dx,dz);
      nearest=Math.min(nearest,dist);
      if (dist<radius) {
        const influence=Math.pow(1-dist/radius,1.55)*strength;
        const tangent=new THREE.Vector3(-dz,0,dx).normalize();
        const inward=new THREE.Vector3(center.x-pos.x,0,center.z-pos.z).normalize();
        p.velocity.addScaledVector(tangent,dt*(5+7*influence));
        p.velocity.addScaledVector(inward,dt*(2.5*influence));
        if (dist<7) { p.airborne=true; p.velocity.y += dt*(5+8*influence); }
        p.panicked=true;
        p.group.rotation.y += dt*(3+influence*9);
        p.group.rotation.z += dt*influence*2.5;
        if (p.airborne) p.group.position.y += p.velocity.y*dt;
        p.group.position.x += p.velocity.x*dt;
        p.group.position.z += p.velocity.z*dt;
        p.velocity.multiplyScalar(Math.max(0,1-dt*.55));
      } else if (!p.airborne) {
        p.group.position.x += p.velocity.x*dt;
        p.group.position.z += p.velocity.z*dt;
        p.group.position.x = THREE.MathUtils.clamp(p.group.position.x,p.home.x-1.8,p.home.x+1.8);
        p.group.position.z = THREE.MathUtils.clamp(p.group.position.z,p.home.z-2.5,p.home.z+2.5);
        p.group.rotation.y += Math.sin(now*.002+p.seed)*.001;
      }
      if (p.airborne && (p.group.position.y>10 || Math.hypot(pos.x-center.x,pos.z-center.z)>radius*2.2)) {
        p.group.visible=false;
      }
    }
    if (nearest<24) panicVoice(nearest);
  }

  const originalRender=THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render=function(s,c){ scene=s; return originalRender.call(this,s,c); };
  setTimeout(findObjects,1000);
  setTimeout(findObjects,2800);
  requestAnimationFrame(update);
})();

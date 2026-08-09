/* Tornado vortex interaction: lightweight, non-graphic environmental physics. */
(() => {
  if (!window.THREE) return;

  const START = new THREE.Vector3(-36, 0, 8);
  const EFFECT_RADIUS = 18;
  const LIFT_RADIUS = 11;
  const MAX_DEBRIS = 90;
  const tracked = [];
  const debris = [];
  let scene = null;
  let world = null;
  let tornado = null;
  let lastTime = performance.now();
  let screamTimer = 0;

  const v = new THREE.Vector3();
  const local = new THREE.Vector3();
  const axis = new THREE.Vector3();

  function collect() {
    if (!scene) return;
    if (!world) {
      scene.traverse(o => { if (!world && o.name === 'world') world = o; });
      world = world || scene;
    }
    if (!tornado) {
      scene.traverse(o => {
        if (tornado) return;
        if (o.name === 'tornado-audio-source' || /tornado/i.test(o.name || '')) tornado = o;
      });
    }
    tracked.length = 0;
    scene.traverse(o => {
      if (!o.isMesh || !o.visible || o.userData.vortexIgnore) return;
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      if (p.y < 0.05 || p.y > 30) return;
      const n = (o.name || '').toLowerCase();
      if (n.includes('ground') || n.includes('sea') || n.includes('water') || n.includes('sky')) return;
      if (o.parent === scene && o.geometry && o.geometry.type === 'SphereGeometry') return;
      tracked.push({ mesh:o, home:p.clone(), velocity:new THREE.Vector3(), spin:(Math.random()-.5)*2, affected:false, baseRot:o.rotation.clone() });
    });
  }

  function addDebris(pos, velocity) {
    if (!world || debris.length >= MAX_DEBRIS) return;
    const size = .08 + Math.random() * .28;
    const geom = Math.random() > .45 ? new THREE.BoxGeometry(size, size, size) : new THREE.TetrahedronGeometry(size * .8, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x66686a, roughness: .85, metalness: .05 });
    const piece = new THREE.Mesh(geom, mat);
    piece.position.copy(pos);
    piece.castShadow = true;
    world.add(piece);
    debris.push({ mesh:piece, velocity:velocity.clone(), life:3 + Math.random()*4, spin:new THREE.Vector3(Math.random()*8,Math.random()*8,Math.random()*8) });
  }

  function distressSound(distance) {
    if (!window.__replicSound || !window.__replicSound.ctx || !window.__replicSound.enabled) return;
    const ctx = window.__replicSound.ctx;
    const master = window.__replicSound.master || ctx.destination;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = 420 + Math.random()*130;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base*.62, now+.42);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.045, now+.04);
    gain.gain.exponentialRampToValueAtTime(.0001, now+.48);
    osc.connect(gain).connect(master);
    osc.start(now); osc.stop(now+.52);
  }

  function update(now) {
    requestAnimationFrame(update);
    if (!scene) return;
    const dt = Math.min((now-lastTime)/1000, .033); lastTime=now;
    if (!world || tracked.length === 0) collect();

    const center = tornado ? tornado.getWorldPosition(v) : START;
    center.y = Math.max(center.y, 2);
    const strength = Math.max(0, Math.min(1, (window.replicTornadoStrength ?? 6) / 10));
    const radius = EFFECT_RADIUS + strength*7;

    for (const item of tracked) {
      const p = item.mesh.getWorldPosition(local);
      const dx=p.x-center.x, dz=p.z-center.z;
      const dist=Math.hypot(dx,dz);
      if (dist > radius) continue;
      const influence=Math.pow(1-dist/radius,1.7) * strength;
      if (influence < .035) continue;
      const tangent = axis.set(-dz,0,dx).normalize();
      const inward = new THREE.Vector3(center.x-p.x,0,center.z-p.z).normalize();
      const lift = new THREE.Vector3(0,1,0);
      const outward = inward.clone().multiplyScalar(-1);
      const force = tangent.multiplyScalar(5.5*influence).add(inward.multiplyScalar(1.8*influence)).add(lift.multiplyScalar(2.2*influence));
      if (dist < LIFT_RADIUS) force.add(outward.multiplyScalar(5.5*influence));
      item.velocity.addScaledVector(force, dt*6);
      item.velocity.multiplyScalar(Math.max(0,1-dt*.65));
      const next=p.clone().addScaledVector(item.velocity,dt);
      // Keep the simulation grounded enough that objects fly outward but don't disappear instantly.
      item.mesh.position.lerp(next, .82);
      item.mesh.rotation.x += item.spin*dt*(2+influence*8);
      item.mesh.rotation.y += influence*dt*7;
      item.mesh.rotation.z += item.spin*dt*3;
      item.affected=true;
      if (Math.random() < dt * influence * 2.8) addDebris(p, item.velocity.clone().addScaledVector(tangent,2));
    }

    for (let i=debris.length-1;i>=0;i--) {
      const d=debris[i];
      d.life-=dt;
      const p=d.mesh.position;
      const dx=p.x-center.x, dz=p.z-center.z;
      const dist=Math.hypot(dx,dz);
      const tangent=new THREE.Vector3(-dz,0,dx).normalize();
      d.velocity.addScaledVector(tangent,dt*(4+strength*10));
      d.velocity.y += dt*(2.5+strength*3);
      d.mesh.position.addScaledVector(d.velocity,dt);
      d.mesh.rotation.x+=d.spin.x*dt; d.mesh.rotation.y+=d.spin.y*dt; d.mesh.rotation.z+=d.spin.z*dt;
      if (d.life<=0 || d.mesh.position.y>55 || dist>radius*2.8) {
        world.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); debris.splice(i,1);
      }
    }

    // Short, sparse distress sounds when the vortex is actively affecting the scene.
    if (strength>.25 && now-screamTimer>6500) {
      const active = tracked.some(x=>x.affected && x.mesh.position.distanceTo(center)<radius*.7);
      if (active) { screamTimer=now; distressSound(0); }
    }
  }

  // Expose a single strength value used by this module without touching the original UI logic.
  window.setReplicTornadoStrength = value => { window.replicTornadoStrength = Number(value)||6; };
  window.replicTornadoStrength = 6;

  const hook = () => {
    if (!scene) {
      const renderer = document.querySelector('canvas') && THREE.WebGLRenderer.prototype;
      // The main scene is captured through the renderer prototype after main.js creates it.
    }
    requestAnimationFrame(hook);
  };
  const originalRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function(s,c) {
    scene=s;
    if (!world) s.traverse(o => { if (!world && (o.name==='world')) world=o; });
    return originalRender.call(this,s,c);
  };
  setTimeout(collect, 900);
  setTimeout(collect, 2600);
  requestAnimationFrame(update);
})();

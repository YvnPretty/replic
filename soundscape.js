/* Spatial storm soundscape. One audio engine only; avoids stacking the old main.js audio. */
(() => {
  const button = document.getElementById('sound-toggle');
  if (!button || !window.THREE) return;

  let ctx = null, master = null, started = false, muted = false;
  let state = { scene: null, camera: null }, lastThunder = 0;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => v * v * (3 - 2 * v);
  const distanceGain = (d, near, far, max = 1) => max * (1 - smooth(clamp01((d - near) / (far - near))));

  function noiseSource(seconds = 3) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  function layer(filterType, freq, q, base) {
    const source = noiseSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    filter.type = filterType; filter.frequency.value = freq; filter.Q.value = q; gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(master); source.start();
    return { source, filter, gain, base };
  }

  function start() {
    if (started) { muted = false; master.gain.setTargetAtTime(.72, ctx.currentTime, .08); ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .72; master.connect(ctx.destination);

    const rain = layer('highpass', 1900, .35, .035);
    const wind = layer('bandpass', 360, .62, .085);
    const sea = layer('lowpass', 430, .22, .085);
    const traffic = layer('bandpass', 720, .38, .018);

    // Distant siren: two tones with a slow sweep.
    const siren = ctx.createOscillator(), sirenGain = ctx.createGain();
    siren.type = 'sine'; sirenGain.gain.value = 0; siren.connect(sirenGain).connect(master); siren.start();
    // Helicopter rotor: low-frequency pulse, kept subtle so it does not dominate.
    const rotor = ctx.createOscillator(), rotorGain = ctx.createGain();
    rotor.type = 'triangle'; rotor.frequency.value = 58; rotorGain.gain.value = 0; rotor.connect(rotorGain).connect(master); rotor.start();

    // Natural modulation for waves and rain.
    const seaLfo = ctx.createOscillator(), seaLfoGain = ctx.createGain();
    seaLfo.frequency.value = .13; seaLfoGain.gain.value = .022; seaLfo.connect(seaLfoGain).connect(sea.gain); seaLfo.start();
    const rainLfo = ctx.createOscillator(), rainLfoGain = ctx.createGain();
    rainLfo.frequency.value = .055; rainLfoGain.gain.value = .012; rainLfo.connect(rainLfoGain).connect(rain.gain); rainLfo.start();

    window.__replicSound = { rain, wind, sea, traffic, siren, sirenGain, rotor, rotorGain };
    started = true; muted = false; ctx.resume();
    button.textContent = '🔊'; button.setAttribute('aria-label', 'Desactivar sonido');
  }

  // Capture phase intentionally takes control before main.js's old sound handler.
  // This prevents two independent WebAudio engines from playing simultaneously.
  button.addEventListener('click', e => {
    e.stopImmediatePropagation();
    if (!started || muted) start();
    else { muted = true; master.gain.setTargetAtTime(0, ctx.currentTime, .1); button.textContent = '🔇'; button.setAttribute('aria-label', 'Activar sonido'); }
  }, true);

  const originalRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    state.scene = scene; state.camera = camera;
    return originalRender.call(this, scene, camera);
  };

  function findTornado() {
    if (!state.scene) return new THREE.Vector3(-36, 0, 8);
    let result = null;
    state.scene.traverse(obj => {
      if (result || !obj.isGroup) return;
      if (Math.abs(obj.position.x + 36) < .15 && Math.abs(obj.position.z - 8) < .15) result = obj.getWorldPosition(new THREE.Vector3());
    });
    return result || new THREE.Vector3(-36, 0, 8);
  }

  function thunder(distance) {
    if (!started || muted) return;
    const now = ctx.currentTime, osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(78 + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.8);
    filter.type = 'lowpass'; filter.frequency.value = 430;
    const volume = Math.max(.015, .18 * Math.exp(-distance / 65));
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .07);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 2.2);
    osc.connect(filter).connect(gain).connect(master); osc.start(now); osc.stop(now + 2.25);
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!started || muted || !state.camera || !window.__replicSound) return;
    const s = window.__replicSound, cam = state.camera.position;
    const tornadoD = cam.distanceTo(findTornado());
    const seaD = cam.distanceTo(new THREE.Vector3(-116, 0, 0));
    const cityD = Math.min(Math.abs(cam.x), Math.abs(cam.z + 16));
    const airportD = cam.distanceTo(new THREE.Vector3(37, 0, 28));
    const storm = distanceGain(tornadoD, 4, 105);
    const sea = distanceGain(seaD, 8, 140);
    const city = distanceGain(cityD, 6, 120);
    const airport = distanceGain(airportD, 8, 65);
    const now = ctx.currentTime;

    // Crossfaded by distance, not fixed volume.
    s.wind.gain.setTargetAtTime(s.wind.base * (.18 + storm * 1.65), now, .12);
    s.wind.filter.frequency.setTargetAtTime(280 + storm * 900, now, .15);
    s.rain.gain.setTargetAtTime(s.rain.base * (.12 + storm * 1.25), now, .18);
    s.sea.gain.setTargetAtTime(s.sea.base * sea, now, .22);
    s.traffic.gain.setTargetAtTime(s.traffic.base * city, now, .35);
    s.rotorGain.gain.setTargetAtTime(.014 * airport, now, .22);
    s.rotor.frequency.setTargetAtTime(48 + airport * 18, now, .2);

    const pulse = (t % 22) / 22;
    const active = pulse > .68 ? Math.min(1, (pulse - .68) / .16) * Math.min(1, (1 - pulse) / .16) : 0;
    s.sirenGain.gain.setTargetAtTime(.014 * city * active, now, .08);
    s.siren.frequency.setTargetAtTime(620 + Math.sin(t * 4.8) * 330, now, .08);

    if (storm > .22 && t - lastThunder > 8 + Math.random() * 9) { lastThunder = t; thunder(tornadoD); }
  }

  window.addEventListener('replic:lightning', e => thunder(e.detail?.distance ?? 80));
  requestAnimationFrame(tick);
})();

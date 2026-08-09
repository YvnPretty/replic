/* Procedural spatial soundscape: no external audio files required. */
(() => {
  const button = document.getElementById('sound-toggle');
  if (!button || !window.THREE) return;

  let ctx = null;
  let master = null;
  let started = false;
  let state = { scene: null, camera: null };
  let lastThunder = 0;

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => v * v * (3 - 2 * v);
  const distanceGain = (distance, near, far, max = 1) => max * (1 - smooth(clamp01((distance - near) / (far - near))));

  function noiseSource(bufferSize = 2) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function makeLayer(type, frequency, q, gain) {
    const source = noiseSource(2);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    source.connect(filter).connect(g).connect(master);
    source.start();
    return { source, filter, gain: g, base: gain };
  }

  function start() {
    if (started) {
      ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.62;
    master.connect(ctx.destination);

    // Rain: bright filtered noise with a slow amplitude modulation.
    const rain = makeLayer('highpass', 1800, .35, .055);
    // Wind: low band noise, deeper near the tornado.
    const wind = makeLayer('bandpass', 310, .7, .09);
    // Ocean: low-passed noise plus slow wave modulation.
    const sea = makeLayer('lowpass', 480, .2, .075);
    // City: distant filtered broadband traffic bed.
    const traffic = makeLayer('lowpass', 850, .55, .035);

    const siren = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    siren.type = 'sine'; siren.frequency.value = 700; sirenGain.gain.value = 0;
    siren.connect(sirenGain).connect(master); siren.start();

    const rotor = ctx.createOscillator();
    const rotorGain = ctx.createGain();
    rotor.type = 'sawtooth'; rotor.frequency.value = 52; rotorGain.gain.value = 0;
    rotor.connect(rotorGain).connect(master); rotor.start();

    const seaLfo = ctx.createOscillator();
    const seaLfoGain = ctx.createGain();
    seaLfo.frequency.value = .17; seaLfoGain.gain.value = .025;
    seaLfo.connect(seaLfoGain).connect(sea.gain); seaLfo.start();

    const rainLfo = ctx.createOscillator();
    const rainLfoGain = ctx.createGain();
    rainLfo.frequency.value = .075; rainLfoGain.gain.value = .018;
    rainLfo.connect(rainLfoGain).connect(rain.gain); rainLfo.start();

    const data = { rain, wind, sea, traffic, siren, sirenGain, rotor, rotorGain };
    window.__replicSound = data;
    started = true;
    ctx.resume();
    button.textContent = '🔊';
    button.setAttribute('aria-label', 'Sonido activado');
  }

  button.addEventListener('click', start, { passive: true });

  // Capture the active Three.js camera/scene without changing the simulation loop.
  const originalRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    state.scene = scene;
    state.camera = camera;
    return originalRender.call(this, scene, camera);
  };

  function findPosition(name, fallback) {
    if (!state.scene) return fallback;
    let found = null;
    state.scene.traverse(obj => {
      if (found || !obj.isGroup) return;
      if (obj.name === name) found = obj.getWorldPosition(new THREE.Vector3());
    });
    return found || fallback;
  }

  function thunder() {
    if (!started || !ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95 + Math.random() * 35, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.8);
    filter.type = 'lowpass'; filter.frequency.value = 420;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.16, now + .06);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 2.2);
    osc.connect(filter).connect(gain).connect(master);
    osc.start(now); osc.stop(now + 2.25);
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!started || !state.camera || !window.__replicSound) return;
    const s = window.__replicSound;
    const cam = state.camera.position;
    const tornado = findPosition('tornado-audio-source', new THREE.Vector3(-36, 0, 8));
    const seaPos = new THREE.Vector3(-116, 0, 0);
    const city = new THREE.Vector3(0, 0, 0);
    const airport = new THREE.Vector3(37, 0, 28);

    const tornadoD = cam.distanceTo(tornado);
    const seaD = cam.distanceTo(seaPos);
    const cityD = cam.distanceTo(city);
    const airportD = cam.distanceTo(airport);

    const tornadoVol = distanceGain(tornadoD, 5, 90, 1);
    const seaVol = distanceGain(seaD, 12, 125, 1);
    const cityVol = distanceGain(cityD, 8, 120, 1);
    const airportVol = distanceGain(airportD, 10, 65, 1);

    const now = ctx.currentTime;
    s.rain.gain.setTargetAtTime(s.rain.base * (.65 + tornadoVol * .9), now, .12);
    s.wind.gain.setTargetAtTime(s.wind.base * (.25 + tornadoVol * 1.8), now, .1);
    s.sea.gain.setTargetAtTime(s.sea.base * seaVol, now, .18);
    s.traffic.gain.setTargetAtTime(s.traffic.base * cityVol, now, .35);

    // Helicopter becomes audible around the airport; it fades naturally with distance.
    s.rotorGain.gain.setTargetAtTime(.018 * airportVol, now, .18);
    s.rotor.frequency.setTargetAtTime(45 + airportVol * 25, now, .18);

    // Occasional distant siren, louder near the urban/airport area.
    const sirenPulse = (t % 19) / 19;
    const sirenActive = sirenPulse > .72 ? (sirenPulse - .72) / .28 : 0;
    s.sirenGain.gain.setTargetAtTime(.018 * cityVol * sirenActive, now, .08);
    s.siren.frequency.setTargetAtTime(620 + Math.sin(t * 5.2) * 360, now, .08);

    // Storm thunder gets more noticeable as you approach the tornado.
    if (t - lastThunder > 9 + Math.random() * 8) {
      lastThunder = t;
      const thunderLevel = tornadoVol * .16;
      if (thunderLevel > .025) thunder();
    }
  }

  // The tornado itself is tagged after the first scene render if its known position exists.
  const tagTornado = () => {
    if (!state.scene) return;
    state.scene.traverse(obj => {
      if (!obj.isGroup || obj.name === 'tornado-audio-source') return;
      const p = obj.position;
      if (Math.abs(p.x + 36) < .1 && Math.abs(p.z - 8) < .1) obj.name = 'tornado-audio-source';
    });
  };
  setInterval(tagTornado, 1000);
  requestAnimationFrame(tick);
})();

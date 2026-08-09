/* Mobile polish + tornado behaviour fixes. Loaded before main.js. */
(() => {
  // The original simulation starts the funnel at x=-36. Capture that exact
  // Vector3, then drive it farther into the sea before each simulation frame.
  const originalSet = THREE.Vector3.prototype.set;
  let tornadoPosition = null;
  let tornadoCaptured = false;

  THREE.Vector3.prototype.set = function (x, y, z) {
    if (!tornadoCaptured && Math.abs(x + 36) < 0.001 && Math.abs(y) < 0.001 && Math.abs(z - 8) < 0.001) {
      tornadoCaptured = true;
      tornadoPosition = this;
      return originalSet.call(this, -70, y, z);
    }
    return originalSet.call(this, x, y, z);
  };

  // Reset the tornado position immediately before main.js updates damage,
  // so the collision logic uses the same open-water path that the player sees.
  const originalRAF = window.requestAnimationFrame.bind(window);
  const journeyStart = performance.now();
  window.requestAnimationFrame = callback => originalRAF(timestamp => {
    if (tornadoPosition) {
      const elapsed = (timestamp - journeyStart) / 1000;
      const cycle = 78;
      const journey = Math.min(1, (elapsed % cycle) / cycle);
      const desiredX = -70 + journey * 93;
      const desiredZ = 8 + Math.sin(journey * Math.PI * 2.2) * 6;
      originalSet.call(tornadoPosition, desiredX, 0, desiredZ);
    }
    callback(timestamp);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const originalPanel = document.getElementById('tornado-intensity');
    const slider = document.getElementById('magnitude');
    const value = document.getElementById('magnitude-value');
    if (!originalPanel || !slider) return;

    originalPanel.style.display = 'none';
    originalPanel.id = 'tornado-control-panel';

    const toggle = document.createElement('button');
    toggle.id = 'tornado-control-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Mostrar controles');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '⚙';

    const panel = originalPanel;
    panel.innerHTML = `
      <div class="tornado-control-head">
        <span>TORNADO</span>
        <output id="tornado-strength-value">6</output>
      </div>
      <input id="tornado-strength" type="range" min="1" max="10" step="0.1" value="6" aria-label="Intensidad del tornado">
      <div class="tornado-control-caption">Intensidad visual</div>
    `;

    const strength = panel.querySelector('#tornado-strength');
    const strengthValue = panel.querySelector('#tornado-strength-value');
    document.body.append(toggle, panel);

    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '×' : '⚙';
    });

    strength.addEventListener('input', () => {
      strengthValue.textContent = strength.value;
      window.__tornadoStrength = Number(strength.value);
      // Do not let the tornado slider change earthquake/tsunami magnitude.
      slider.value = '6';
      value.textContent = '6';
    });
    window.__tornadoStrength = 6;

    const originalRender = THREE.WebGLRenderer.prototype.render;
    let capturedGroup = null;
    THREE.WebGLRenderer.prototype.render = function (scene, camera) {
      if (!capturedGroup) {
        scene.traverse(obj => {
          if (!capturedGroup && obj.type === 'Group' && obj.children.some(child => child.geometry?.attributes?.position?.count === 9500)) {
            capturedGroup = obj;
          }
        });
      }
      if (capturedGroup) {
        const strengthScale = 0.82 + ((window.__tornadoStrength || 6) - 1) / 9 * 0.26;
        capturedGroup.scale.setScalar(strengthScale);
      }
      return originalRender.call(this, scene, camera);
    };
  });
})();

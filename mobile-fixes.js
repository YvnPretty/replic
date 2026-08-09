/* Mobile polish + tornado behaviour fixes. Loaded before main.js. */
(() => {
  // Keep the tornado in open water longer. The simulation itself uses this
  // Vector3, so the collision radius moves with the visible funnel too.
  const originalSet = THREE.Vector3.prototype.set;
  let tornadoPosition = null;
  let patched = false;

  THREE.Vector3.prototype.set = function (x, y, z) {
    if (!patched && Math.abs(x + 36) < 0.001 && Math.abs(y) < 0.001 && Math.abs(z - 8) < 0.001) {
      tornadoPosition = this;
      originalSet.call(this, -70, y, z);
      let actualX = -70;
      Object.defineProperty(this, 'x', {
        configurable: true,
        enumerable: true,
        get() { return actualX; },
        set(value) {
          // Main simulation path is -36..23. Remap it to -70..23 so the
          // funnel spends real time over open water before reaching town.
          const mapped = -70 + ((value + 36) / 59) * 93;
          actualX = Math.max(-70, Math.min(23, mapped));
        }
      });
      patched = true;
      return this;
    }
    return originalSet.call(this, x, y, z);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const originalPanel = document.getElementById('tornado-intensity');
    const slider = document.getElementById('magnitude');
    const value = document.getElementById('magnitude-value');
    if (!originalPanel || !slider) return;

    // Replace the always-visible control with a small, easy-to-find toggle.
    originalPanel.style.display = 'none';
    originalPanel.id = 'tornado-control-panel';

    const toggle = document.createElement('button');
    toggle.id = 'tornado-control-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Mostrar controles del tornado');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☰';

    const panel = originalPanel;
    panel.innerHTML = `
      <div class="tornado-control-head">
        <span>TORNADO</span>
        <output id="tornado-strength-value">6</output>
      </div>
      <input id="tornado-strength" type="range" min="1" max="10" step="0.1" value="6" aria-label="Intensidad del tornado">
      <div class="tornado-control-caption">Intensidad visual · no afecta edificios a distancia</div>
    `;

    const strength = panel.querySelector('#tornado-strength');
    const strengthValue = panel.querySelector('#tornado-strength-value');

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const closePanel = () => {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    };
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '×' : '☰';
    });

    strength.addEventListener('input', () => {
      strengthValue.textContent = strength.value;
      // Keep the original earthquake/tsunami magnitude independent.
      slider.value = '6';
      value.textContent = '6';
      window.__tornadoStrength = Number(strength.value);
    });
    window.__tornadoStrength = 6;

    // Capture the Three.js scene through the renderer without changing the
    // existing simulation architecture.
    const originalRender = THREE.WebGLRenderer.prototype.render;
    let captured = null;
    THREE.WebGLRenderer.prototype.render = function (scene, camera) {
      if (!captured) {
        scene.traverse(obj => {
          if (!captured && obj.type === 'Group' && obj.children.some(child => {
            const count = child.geometry?.attributes?.position?.count;
            return count === 9500;
          })) captured = obj;
        });
      }

      if (captured) {
        const s = 0.78 + ((window.__tornadoStrength || 6) - 1) / 9 * 0.34;
        captured.scale.setScalar(s);
        captured.userData.mobileTornado = true;
      }
      return originalRender.call(this, scene, camera);
    };

    // Subtle mobile quality tuning.
    const isSmall = Math.min(innerWidth, innerHeight) <= 768;
    if (isSmall) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = '#12051f';
    }
  });
})();

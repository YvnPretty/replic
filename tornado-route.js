/* Continuous tornado route: sweeps the entire map instead of returning to the center. */
(() => {
  if (!window.THREE) return;

  let tornado = null;
  let startedAt = performance.now();
  const cycleSeconds = 110;
  const target = new THREE.Vector3();

  function findTornado(scene) {
    let found = null;
    scene.traverse(obj => {
      if (found || !obj.isGroup) return;
      const p = obj.position;
      if (Math.abs(p.x + 36) < 0.5 && Math.abs(p.z - 8) < 0.5 && obj.children.length >= 2) {
        found = obj;
      }
    });
    return found;
  }

  const originalRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    if (!tornado) tornado = findTornado(scene);

    if (tornado) {
      const elapsed = (performance.now() - startedAt) / 1000;
      const u = (elapsed % cycleSeconds) / cycleSeconds;
      const angle = u * Math.PI * 2;

      // Large continuous sweep: sea -> coast -> city -> airport -> outskirts -> sea.
      target.set(
        -5 - 115 * Math.cos(angle),
        0,
        2 + 92 * Math.sin(angle)
      );

      // Smooth movement, with no abrupt jumps when the cycle restarts.
      tornado.position.x += (target.x - tornado.position.x) * 0.035;
      tornado.position.z += (target.z - tornado.position.z) * 0.035;
      tornado.position.y = 0;
    }

    return originalRender.call(this, scene, camera);
  };
})();

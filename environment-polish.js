/* Real-world environment polish + mobile visibility cleanup. */
(() => {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let initialized = false;

  function mat(color, roughness = .8, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function addStreetFurniture(world) {
    const group = new THREE.Group();
    group.name = 'realistic-environment';
    const concrete = mat(0x55595a, .9), dark = mat(0x202426, .72, .25), yellow = mat(0xc49a35, .62, .25);
    const glass = new THREE.MeshStandardMaterial({ color: 0x527579, roughness: .25, metalness: .15, transparent: true, opacity: .72 });
    const green = mat(0x29382d, .95);
    const curbA = new THREE.Mesh(new THREE.BoxGeometry(.42, .18, 290), concrete); curbA.position.set(-3.65, .09, -5);
    const curbB = curbA.clone(); curbB.position.x = 3.65; group.add(curbA, curbB);
    for (let z = -125; z <= 115; z += 24) for (const x of [-5, 5]) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(.65, .95, .38), dark); cabinet.position.set(x, .48, z + (x > 0 ? 3 : 0)); group.add(cabinet);
    }
    for (let z = -120; z <= 110; z += 18) {
      const hydrant = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.12, .15, .32, 8), yellow); base.position.y = .16;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.075, .1, .25, 8), yellow); neck.position.y = .42;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.095, 8, 6), yellow); cap.position.y = .57;
      hydrant.add(base, neck, cap); hydrant.position.set(5.35, 0, z); group.add(hydrant);
      if (z % 36 === 0) {
        const bin = new THREE.Mesh(new THREE.BoxGeometry(.55, .72, .55), green); bin.position.set(-5.15, .36, z + 5); group.add(bin);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(.6, .07, .6), dark); lid.position.set(-5.15, .75, z + 5); group.add(lid);
      }
    }
    const carColors = [0x4b4f54, 0x8d332e, 0xddd8c8, 0x25364a, 0x5e665f];
    for (let i = 0; i < 18; i++) {
      const z = -125 + i * 14, x = i % 2 ? -5.8 : 5.8, car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, .34, 2.45), mat(carColors[i % carColors.length], .5, .08)); body.position.y = .34;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(.88, .32, 1.15), glass); cabin.position.set(0, .62, -.05);
      car.add(body, cabin); car.position.set(x, 0, z); car.rotation.y = x > 0 ? Math.PI : 0; group.add(car);
    }
    const trunkMat = mat(0x4a3325, .95), leafMat = mat(0x334b35, .92);
    for (let z = -105; z <= 105; z += 15) for (const x of [-8.2, 8.2]) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .19, 1.8, 7), trunkMat); trunk.position.y = .9;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.9, 8, 7), leafMat); crown.position.y = 2.05;
      tree.add(trunk, crown); tree.position.set(x, 0, z + (x > 0 ? 4 : 0)); group.add(tree);
    }
    for (const z of [-72, -12, 48, 108]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 2.1, 7), dark); pole.position.set(-5.7, 1.05, z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(.62, .5, .035), new THREE.MeshStandardMaterial({ color: 0xe9e1b1, roughness: .65, metalness: .1 })); sign.position.set(-5.7, 2.05, z);
      group.add(pole, sign);
    }
    world.add(group);
  }

  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    // The large gray sphere was the exponential scene fog. It is not part of the environment,
    // so remove it completely rather than merely hiding a particle layer.
    scene.fog = null;
    if (!initialized) {
      scene.traverse(obj => {
        if (obj.isPoints && obj.geometry?.attributes?.position?.count === 1350) obj.visible = false;
      });
      const world = scene.children.find(obj => obj.isGroup && obj.children.length > 30);
      if (world) { addStreetFurniture(world); initialized = true; }
    }
    return originalRender.call(this, scene, camera);
  };
})();

/* Environment polish: remove intrusive fog bubbles and add lightweight city props. */
(() => {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let initialized = false;

  function makeProp(THREE, type, x, z, scene) {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x252a2c, roughness: .72, metalness: .18 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x596062, roughness: .55, metalness: .55 });
    const warm = new THREE.MeshBasicMaterial({ color: 0xffb84d });

    if (type === 'lamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,2.8,7), dark);
      pole.position.y = 1.4;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.48,.045,.045), dark);
      arm.position.set(.2,2.7,0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12,8,8), warm);
      bulb.position.set(.42,2.64,0);
      g.add(pole,arm,bulb);
    } else if (type === 'hydrant') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.5,8), metal);
      body.position.y=.25;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.12,8), metal);
      cap.position.y=.55;
      g.add(body,cap);
    } else if (type === 'barrier') {
      const a = new THREE.Mesh(new THREE.BoxGeometry(.12,.7,.12), metal);
      const b = a.clone(); a.position.set(-.8,.35,0); b.position.set(.8,.35,0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.8,.12,.12), new THREE.MeshStandardMaterial({color:0xffa51f,roughness:.6}));
      rail.position.y=.55;
      g.add(a,b,rail);
    } else if (type === 'dumpster') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.05,.75,.7), dark);
      box.position.y=.38;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.12,.08,.74), metal);
      lid.position.y=.79;
      g.add(box,lid);
    } else if (type === 'bench') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.25,.1,.4), metal); seat.position.y=.65;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.25,.55,.08), metal); back.position.set(0,.9,-.16);
      for (const sx of [-.48,.48]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.65,.08),dark); leg.position.set(sx,.32,0); g.add(leg); }
      g.add(seat,back);
    } else if (type === 'bollard') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,.65,8), metal); body.position.y=.33;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.08,8), new THREE.MeshStandardMaterial({color:0xffb84d,roughness:.5})); ring.position.y=.45;
      g.add(body,ring);
    } else if (type === 'sign') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,2,6), metal); pole.position.y=1;
      const board = new THREE.Mesh(new THREE.BoxGeometry(.85,.42,.05), new THREE.MeshStandardMaterial({color:0x174f70,roughness:.65,metalness:.1})); board.position.y=1.8;
      g.add(pole,board);
    }
    g.position.set(x,0,z);
    g.rotation.y = Math.random()*Math.PI*2;
    scene.add(g);
  }

  THREE.WebGLRenderer.prototype.render = function(scene, camera) {
    if (!initialized) {
      initialized = true;

      // The broad low-opacity mist was being perceived as gray bubbles while
      // orbiting on mobile. Remove only that layer; tornado/cloud particles stay.
      scene.traverse(obj => {
        if (obj.type !== 'Points' || !obj.material || Array.isArray(obj.material)) return;
        const color = obj.material.color;
        if (obj.material.size > 2 && color && color.r > .7 && color.g > .7 && color.b > .7) {
          obj.visible = false;
        }
      });

      // Lightweight street furniture to make the city read as a lived-in place.
      const props = [
        ['lamp',-8,-42],['lamp',8,-54],['lamp',-8,38],['lamp',8,50],
        ['hydrant',-7,-30],['hydrant',7,-4],['hydrant',-7,28],
        ['barrier',12,16],['barrier',14,18],['barrier',-12,-28],
        ['dumpster',15,24],['dumpster',-14,42],
        ['bench',10,30],['bench',-11,34],
        ['bollard',20,8],['bollard',20,10],['bollard',20,12],['bollard',-20,8],['bollard',-20,10],
        ['sign',18,-8],['sign',-18,-8],['sign',16,54],['sign',-16,54]
      ];
      props.forEach(p => makeProp(THREE,p[0],p[1],p[2],scene));
    }
    return originalRender.call(this, scene, camera);
  };
})();

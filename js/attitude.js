/* ============================================================
   attitude.js — Three.js 3D 姿态视图
   程序化生成的低多边形战机 + 天空渐变 + 网格地面
   ============================================================ */
(function (global) {
  'use strict';

  var renderer, scene, camera, model, clock;
  var pitch = 0, roll = 0, hdg = 0, curHdg = 0;
  var aoa = 0, aos = 0;
  var velGroup = null;

  // 自由视角（鼠标拖动旋转 / 滚轮缩放 / 双击复位）
  var orbit = { theta: 0, phi: 0, zoom: 1, tTheta: 0, tPhi: 0, tZoom: 1 };
  var baseCam = null;
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var curPitch = 0, curRoll = 0;
  var ready = false;

  // ---- 姿态符号约定（显示方向反了就改这里，或运行时按 I / O）----
  var PITCH_SIGN = -1;
  var ROLL_SIGN = 1;

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05090c, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a171c, 30, 165);

    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1500);
    camera.position.set(5.6, 3.2, -11.8);
    camera.lookAt(0, 0.10, 0.0);

    var target = new THREE.Vector3(0, 0.15, 0);
    var off = camera.position.clone().sub(target);
    var sph0 = new THREE.Spherical().setFromVector3(off);
    baseCam = { r: sph0.radius, theta: sph0.theta, phi: sph0.phi, target: target };
    bindOrbit(canvas);

    buildSky();
    buildGround();
    buildLights();

    buildWorldAxes();
    model = buildBodyFrame();
    model.userData.isFrame = true;
    scene.add(model);

    clock = new THREE.Clock();
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);

    ready = true;
    loop();
  }

  function bindOrbit(canvas) {
    var drag = false, lx = 0, ly = 0, id = null;
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', function (e) {
      var v = document.getElementById('view3d');
      if (v && v.classList.contains('scope-on')) return;
      drag = true; id = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { canvas.setPointerCapture(id); } catch (err) { }
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      orbit.tTheta -= dx * 0.006;
      orbit.tPhi = clampN(orbit.tPhi + dy * 0.005, -1.0, 0.22);
    });
    function end(e) {
      if (!drag) return;
      drag = false;
      try { if (id !== null) canvas.releasePointerCapture(id); } catch (err) { }
      canvas.style.cursor = 'grab';
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', function (e) {
      var v = document.getElementById('view3d');
      if (v && v.classList.contains('scope-on')) return;
      e.preventDefault();
      orbit.tZoom = clampN(orbit.tZoom * (1 + e.deltaY * 0.0012), 0.45, 3.0);
    }, { passive: false });
    canvas.addEventListener('dblclick', resetView);
    canvas.style.cursor = 'grab';
  }

  function resetView() {
    orbit.tTheta = 0; orbit.tPhi = 0; orbit.tZoom = 1;
  }

  function resize() {
    if (!renderer) return;
    var c = renderer.domElement;
    var r = c.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = Math.max(0.2, r.width / Math.max(1, r.height));
    camera.updateProjectionMatrix();
  }

  /* ---------------- 天空 ---------------- */
  function buildSky() {
    var geo = new THREE.SphereGeometry(700, 32, 20);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        cTop: { value: new THREE.Color(0x081d2a) },
        cMid: { value: new THREE.Color(0x1a4351) },
        cBot: { value: new THREE.Color(0x04080b) }
      },
      vertexShader: [
        'varying vec3 vP;',
        'void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot; varying vec3 vP;',
        'void main(){',
        '  float h = normalize(vP).y;',
        '  vec3 col = h > 0.0 ? mix(cMid, cTop, pow(h,0.72)) : mix(cMid, cBot, pow(-h,0.45));',
        '  gl_FragColor = vec4(col,1.0);',
        '}'
      ].join('\n')
    });
    scene.add(new THREE.Mesh(geo, mat));
  }

  /* ---------------- 地面 ---------------- */
  function buildGround() {
    var plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ color: 0x050d10, roughness: 1, metalness: 0 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -5.2;
    scene.add(plane);

    var grid = new THREE.GridHelper(64, 64, 0x2a6b7d, 0x123039);
    grid.position.y = -5.15;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    scene.add(grid);


    // 机影
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.9, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.15, 0.5, 1);
    shadow.position.set(0.4, -5.12, 0.6);
    scene.add(shadow);
  }

  /* ---------------- 灯光 ---------------- */
  function buildLights() {
    scene.add(new THREE.HemisphereLight(0xbcd2de, 0x0b1418, 0.55));

    var key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(6, 9, 8);
    scene.add(key);

    var rim = new THREE.DirectionalLight(0x53b3d8, 0.65);
    rim.position.set(-8, 3, -9);
    scene.add(rim);

    var fill = new THREE.DirectionalLight(0x8fa6b3, 0.25);
    fill.position.set(0, -5, 6);
    scene.add(fill);
  }

  /* ---------------- 程序化机模 ---------------- */
  function planform(pts, depth) {
    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }

  /* ---------------- 坐标系（空间直角坐标系） ---------------- */
  function makeLabel(text, color) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 88px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 70);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(0.62, 0.62, 1);
    return sp;
  }

  function arrow(dir, len, color, headScale) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: color });
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), mat);
    shaft.position.y = len / 2;
    g.add(shaft);
    var head = new THREE.Mesh(new THREE.ConeGeometry(0.075 * (headScale || 1), 0.22 * (headScale || 1), 10), mat);
    head.position.y = len + 0.11 * (headScale || 1);
    g.add(head);
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.quaternion.copy(q);
    return g;
  }

  function buildWorldAxes() {
    var g = new THREE.Group();
    var dim = 0x3a5560;
    var lens = { x: 3.0, y: 2.2, z: 3.0 };
    var dirs = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1)
    };
    var cols = { x: '#c96a5f', y: '#6fae7d', z: '#5e8fb8' };
    ['x', 'y', 'z'].forEach(function (k) {
      // 正方向细线
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dirs[k].clone().multiplyScalar(lens[k])
      ]);
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: dim, transparent: true, opacity: 0.55 })));
      // 负方向
      var geo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dirs[k].clone().multiplyScalar(-lens[k] * 0.55)
      ]);
      g.add(new THREE.Line(geo2, new THREE.LineBasicMaterial({ color: dim, transparent: true, opacity: 0.28 })));
      // 轴标签
      var lab = makeLabel(k.toUpperCase(), cols[k]);
      var pos = dirs[k].clone().multiplyScalar(lens[k] + 0.34);
      lab.position.copy(pos);
      g.add(lab);
    });
    scene.add(g);
    return g;
  }

  function buildBodyFrame() {
    var g = new THREE.Group();
    // 机体轴：X 右（红）、Y 上（绿）、Z 前（蓝）
    g.add(arrow(new THREE.Vector3(1, 0, 0), 1.7, 0xff6b5e));
    g.add(arrow(new THREE.Vector3(0, 1, 0), 1.3, 0x7ee787));
    g.add(arrow(new THREE.Vector3(0, 0, 1), 1.7, 0x58a6ff));
    // 机头指向（白）
    var nose = arrow(new THREE.Vector3(0, 0, 1), 2.6, 0xe8eef2);
    g.add(nose);
    var noseLab = makeLabel('NOSE', '#e8eef2');
    noseLab.position.set(0, 0.22, 2.95);
    noseLab.scale.set(0.5, 0.5, 1);
    g.add(noseLab);
    // 速度矢量（品红），随后按迎角/侧滑偏转
    velGroup = new THREE.Group();
    velGroup.add(arrow(new THREE.Vector3(0, 0, 1), 2.3, 0xff5cd2));
    var velLab = makeLabel('VEL', '#ff5cd2');
    velLab.position.set(0, -0.24, 2.55);
    velLab.scale.set(0.46, 0.46, 1);
    velGroup.add(velLab);
    g.add(velGroup);
    // 原点
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xdfe7dc })));
    // 机体示意：机头锥 + 机翼
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0xaab6bd }));
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.34;
    g.add(nose);
    var wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x8b979e }));
    g.add(wing);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x8b979e }));
    fin.position.set(0, 0.17, -0.12);
    g.add(fin);
    return g;
  }

  function buildJet() {
    var g = new THREE.Group();

    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d474e, metalness: 0.25, roughness: 0.72, flatShading: true });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x141a1e, metalness: 0.7, roughness: 0.35, flatShading: true });
    var accentMat = new THREE.MeshStandardMaterial({ color: 0xa8441b, metalness: 0.4, roughness: 0.52, flatShading: true });
    var glassMat = new THREE.MeshStandardMaterial({
      color: 0x2b5468, metalness: 0.98, roughness: 0.06,
      transparent: true, opacity: 0.88
    });

    /* 机身 */
    var prof = [
      [0.02, -3.05], [0.20, -2.95], [0.33, -2.62], [0.44, -2.00],
      [0.50, -1.20], [0.54, -0.30], [0.55, 0.42], [0.50, 1.10],
      [0.40, 1.80], [0.26, 2.50], [0.10, 3.00], [0.02, 3.25]
    ].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var fus = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), bodyMat);
    fus.rotation.x = Math.PI / 2;
    g.add(fus);

    /* 主翼 */
    var wingPts = [[0.44, -0.95], [2.60, 0.18], [2.60, 0.72], [0.44, 0.55]];
    var wingGeo = planform(wingPts, 0.12);
    [-1, 1].forEach(function (sx) {
      var w = new THREE.Mesh(wingGeo, bodyMat);
      w.rotation.x = -Math.PI / 2;
      w.scale.x = sx;
      w.position.set(0, -0.06, 0.05);
      g.add(w);
    });

    /* 平尾 */
    var tpPts = [[0.30, 2.00], [1.22, 2.32], [1.22, 2.70], [0.30, 2.74]];
    var tpGeo = planform(tpPts, 0.09);
    [-1, 1].forEach(function (sx) {
      var t = new THREE.Mesh(tpGeo, bodyMat);
      t.rotation.x = -Math.PI / 2;
      t.scale.x = sx;
      t.position.set(0, 0.06, 0);
      g.add(t);
    });

    /* 垂尾 */
    var finPts = [[0.58, 0.0], [-0.70, 0.0], [-0.78, 0.68], [-0.28, 0.80]];
    var fin = new THREE.Mesh(planform(finPts, 0.10), bodyMat);
    fin.rotation.y = -Math.PI / 2;
    fin.position.set(0, 0.30, -2.15);
    g.add(fin);

    var finTip = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.09, 0.44), accentMat);
    finTip.position.set(0, 1.02, -2.46);
    g.add(finTip);

    /* 座舱 */
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 14), glassMat);
    canopy.scale.set(0.64, 0.50, 1.45);
    canopy.position.set(0, 0.34, 1.55);
    g.add(canopy);

    /* 机头雷达罩 */
    var radome = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.55, 18), darkMat);
    radome.rotation.x = Math.PI / 2;
    radome.position.set(0, 0, 3.02);
    g.add(radome);

    /* 座舱框 */
    var frame = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.022, 6, 22), darkMat);
    frame.rotation.x = Math.PI / 2;
    frame.scale.set(1, 1.9, 1);
    frame.position.set(0, 0.31, 1.55);
    g.add(frame);

    /* 进气道（机腹） */
    var intake = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.34, 1.75), darkMat);
    intake.position.set(0, -0.30, 1.05);
    g.add(intake);
    var intakeLip = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.38, 0.10), accentMat);
    intakeLip.position.set(0, -0.30, 1.94);
    g.add(intakeLip);

    /* 尾喷口 */
    var noz = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.26, 0.52, 18, 1, true), darkMat);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(0, -0.02, -3.02);
    g.add(noz);
    var glow = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20),
      new THREE.MeshBasicMaterial({ color: 0xff8a35, transparent: true, opacity: 0.55 }));
    glow.position.set(0, -0.02, -3.30);
    glow.rotation.y = Math.PI;
    g.add(glow);

    /* 翼尖挂轨 + 标识 */
    [-1, 1].forEach(function (sx) {
      var tip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.95), accentMat);
      tip.position.set(sx * 2.55, -0.02, 0.22);
      g.add(tip);
    });


    return g;
  }

  /* ---------------- 主循环 ---------------- */
  function loop() {
    requestAnimationFrame(loop);
    if (!ready) return;
    var dt = Math.min(clock.getDelta(), 0.1);
    var k = 1 - Math.exp(-dt / 0.10);
    curPitch += (pitch - curPitch) * k;
    curRoll += (roll - curRoll) * k;
    curHdg += (hdg - curHdg) * k;

    model.rotation.x = PITCH_SIGN * curPitch * Math.PI / 180;
    model.rotation.z = ROLL_SIGN * curRoll * Math.PI / 180;
    if (model.userData && model.userData.isFrame) model.rotation.y = -curHdg * Math.PI / 180;
    if (velGroup) {
      // 速度矢量相对机头：抬头按迎角下偏，侧滑按侧滑角偏航
      velGroup.rotation.x = aoa * Math.PI / 180;
      velGroup.rotation.y = -aos * Math.PI / 180;
    }

    // 自由视角平滑插值
    orbit.theta += (orbit.tTheta - orbit.theta) * Math.min(1, dt * 12);
    orbit.phi += (orbit.tPhi - orbit.phi) * Math.min(1, dt * 12);
    orbit.zoom += (orbit.tZoom - orbit.zoom) * Math.min(1, dt * 12);
    if (baseCam) {
      var sph = new THREE.Spherical(
        baseCam.r * orbit.zoom,
        clampN(baseCam.phi + orbit.phi, 0.30, 1.53),
        baseCam.theta + orbit.theta
      );
      camera.position.setFromSpherical(sph).add(baseCam.target);
      camera.lookAt(baseCam.target);
    }

    // 小飞机仪表模式下不渲染 3D，省 GPU
    var v = document.getElementById('view3d');
    if (!v || !v.classList.contains('scope-on')) renderer.render(scene, camera);
  }

  /* ---------------- 外部模型（GLB / GLTF / OBJ） ----------------
     用法：把模型放到 models/ 下，命名 aircraft.glb（或 .gltf / .obj），
     或用 URL 参数 ?model=models/xxx.glb 指定。
     模型朝向约定：机头 +Z、机背 +Y；不对就用 ?modelYaw=180 旋转。
     ------------------------------------------------------------- */
  var modelName = 'BUILT-IN';
  var userYaw = 0, userScale = 1;

  function applyUserTransform() {
    if (!model) return;
    var b = model.userData || {};
    model.rotation.y = (b.baseYaw || 0) + userYaw * Math.PI / 180;
    model.scale.setScalar((b.baseScale || 1) * userScale);
  }

  function normalizeModel(obj) {
    var box = new THREE.Box3().setFromObject(obj);
    var size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var s = 5.0 / maxDim;

    var wrap = new THREE.Group();
    obj.position.set(-center.x, -center.y, -center.z);
    wrap.add(obj);
    wrap.scale.setScalar(s);
    // 若最长的轴是 X（翼展/机身没对齐），自动把长轴转到 Z
    wrap.userData.longX = size.x > size.z * 1.15;
    return wrap;
  }

  function loadModel(url, onDone) {
    var name = url.split('/').pop().split('?')[0];

    function install(obj) {
      // 模型修正：补法线、双面渲染、去掉骨架蒙皮的异常偏移
      obj.traverse(function (n) {
        if (!n.isMesh || !n.geometry) return;
        var g = n.geometry;
        if (!g.attributes.normal) { try { g.computeVertexNormals(); } catch (e) { } }
        n.frustumCulled = false;
        n.castShadow = false;
        n.receiveShadow = false;
        var mats = n.material;
        if (!mats) return;
        if (!mats.length) mats = [mats];
        for (var i = 0; i < mats.length; i++) {
          var m = mats[i];
          if (!m) continue;
          m.side = THREE.DoubleSide;
          if (m.flatShading) m.flatShading = false;
          m.needsUpdate = true;
        }
      });
      // 蒙皮网格按静态姿态显示：清掉骨骼绑定，避免姿势错乱
      if (obj.isSkinnedMesh) { try { obj.bindMode = 'detached'; } catch (e) { } }

      var wrap = normalizeModel(obj);
      if (wrap.userData.longX) wrap.rotation.y += Math.PI / 2;
      var yaw = parseFloat(new URLSearchParams(location.search).get('modelYaw') || '0');
      if (!isNaN(yaw)) wrap.rotation.y += yaw * Math.PI / 180;
      wrap.userData.baseYaw = wrap.rotation.y;
      wrap.userData.baseScale = wrap.scale.x;
      scene.remove(model);
      model = wrap;
      scene.add(model);
      applyUserTransform();
      modelName = name;
      if (onDone) onDone(name);
    }

    if (/\.(glb|gltf)($|\?)/i.test(url)) {
      if (!THREE.GLTFLoader) { console.warn('GLTFLoader 未加载'); return; }
      new THREE.GLTFLoader().load(url, function (g) { install(g.scene); },
        undefined, function (e) { console.warn('模型加载失败：' + url, e); });
    } else if (/\.obj($|\?)/i.test(url)) {
      if (!THREE.OBJLoader) { console.warn('OBJLoader 未加载'); return; }
      new THREE.OBJLoader().load(url, function (o) { install(o); },
        undefined, function (e) { console.warn('模型加载失败：' + url, e); });
    } else {
      console.warn('不支持的模型格式：' + url);
    }
  }

  global.Attitude3D = {
    init: init,
    set: function (p, r, h, a, b) { pitch = p || 0; roll = r || 0; hdg = h || 0; aoa = a || 0; aos = b || 0; },
    resize: resize,
    loadModel: function (url, cb) { try { loadModel(url, cb); } catch (e) { console.warn(e); } },
    resetView: resetView,
    cam: function () { return camera ? camera.position.toArray().map(function (v) { return +v.toFixed(2); }) : null; },
    setTransform: function (yawDeg, scale) {
      userYaw = isFinite(yawDeg) ? yawDeg : 0;
      userScale = isFinite(scale) && scale > 0 ? scale : 1;
      applyUserTransform();
    },
    modelName: function () { return modelName; }
  };
})(window);








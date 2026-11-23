/**
 * Magic Fold 3D - Three.js Interactive Folding Simulator
 * Implements real-time 3D kinematics for:
 * 1. Cube (정육면체) - Cross Net
 * 2. Triangular Prism (삼각기둥)
 * 3. Cylinder (원기둥) - Parametric Arc Rolling
 * 4. Star / Polygonal Pyramid (별모양 각뿔) - Convergent Apex
 */

class MagicFoldSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.currentShape = 'cube';
    this.progress = 0.0; // 0.0 (Flat 2D Net) ~ 1.0 (Folded 3D Solid)
    this.isAutoFolding = false;
    this.autoDirection = 1;
    this.showWireframe = false;
    this.showLabels = true;
    this.parallelHighlight = false;

    // Callbacks
    this.onProgressChange = null;
    this.onCompleteFold = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // Model group references
    this.modelRoot = new THREE.Group();
    this.shapeNodes = {};
    this.stringLines = [];

    this.initThree();
    this.buildCurrentShape();
    this.animate();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initThree() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 500;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc);
    this.scene.add(this.modelRoot);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 5.5, 7.5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go too far under ground
      this.controls.minDistance = 3;
      this.controls.maxDistance = 16;
      this.controls.target.set(0, 0.5, 0);
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -6;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.4);
    fillLight.position.set(-6, 4, -6);
    this.scene.add(fillLight);

    // Ground Plane & Grid
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(16, 16, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- Material Generator Helper ---
  createFaceMaterial(color, labelText = '', isTop = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background paper fill
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);

    // Paper border
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(6, 6, 500, 500);

    // Inner subtle border
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.strokeRect(20, 20, 472, 472);

    // Hole indicators (guide holes)
    ctx.fillStyle = '#1e293b';
    const holes = [
      [42, 42], [470, 42], [470, 470], [42, 470]
    ];
    holes.forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    // Face Label
    if (labelText) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 96px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 256, 256);

      // Sub text
      ctx.font = '500 36px Pretendard, sans-serif';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillText('Face ' + labelText, 256, 330);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
      wireframe: this.showWireframe
    });
    mat.userData = { defaultColor: color, labelText };
    return mat;
  }

  clearModelRoot() {
    while (this.modelRoot.children.length > 0) {
      const obj = this.modelRoot.children[0];
      this.modelRoot.remove(obj);
    }
    this.shapeNodes = {};
    this.stringLines = [];
  }

  // ==========================================
  // 1. CUBE (정육면체) - Cross Net Kinematics
  // ==========================================
  buildCube() {
    this.clearModelRoot();
    const s = 1.8; // Face size
    const group = new THREE.Group();
    this.modelRoot.add(group);

    // Colors: pastel tones
    const colors = {
      base: '#93c5fd',  // Face 1 (Blue)
      left: '#86efac',  // Face 2 (Green)
      right: '#86efac', // Face 3 (Green) - Opposite to Left
      front: '#fde047', // Face 4 (Yellow)
      back: '#fde047',  // Face 5 (Yellow) - Opposite to Front
      top: '#93c5fd'    // Face 6 (Blue) - Opposite to Base
    };

    const geometry = new THREE.PlaneGeometry(s, s);

    // 1. Base Face (Floor, Fixed)
    const baseMat = this.createFaceMaterial(colors.base, '1');
    const baseMesh = new THREE.Mesh(geometry, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Left Hinge & Face
    const leftHinge = new THREE.Group();
    leftHinge.position.set(-s / 2, 0, 0);
    const leftMesh = new THREE.Mesh(geometry, this.createFaceMaterial(colors.left, '2'));
    leftMesh.position.set(-s / 2, 0, 0);
    leftMesh.rotation.x = -Math.PI / 2;
    leftMesh.castShadow = true;
    leftHinge.add(leftMesh);
    group.add(leftHinge);

    // 3. Right Hinge & Face
    const rightHinge = new THREE.Group();
    rightHinge.position.set(s / 2, 0, 0);
    const rightMesh = new THREE.Mesh(geometry, this.createFaceMaterial(colors.right, '3'));
    rightMesh.position.set(s / 2, 0, 0);
    rightMesh.rotation.x = -Math.PI / 2;
    rightMesh.castShadow = true;
    rightHinge.add(rightMesh);
    group.add(rightHinge);

    // 4. Front Hinge & Face
    const frontHinge = new THREE.Group();
    frontHinge.position.set(0, 0, s / 2);
    const frontMesh = new THREE.Mesh(geometry, this.createFaceMaterial(colors.front, '4'));
    frontMesh.position.set(0, 0, s / 2);
    frontMesh.rotation.x = -Math.PI / 2;
    frontMesh.castShadow = true;
    frontHinge.add(frontMesh);
    group.add(frontHinge);

    // 5. Back Hinge & Face
    const backHinge = new THREE.Group();
    backHinge.position.set(0, 0, -s / 2);
    const backMesh = new THREE.Mesh(geometry, this.createFaceMaterial(colors.back, '5'));
    backMesh.position.set(0, 0, -s / 2);
    backMesh.rotation.x = -Math.PI / 2;
    backMesh.castShadow = true;
    backHinge.add(backMesh);
    group.add(backHinge);

    // 6. Top Hinge & Face (Attached to Back Face at z = -s)
    const topHinge = new THREE.Group();
    topHinge.position.set(0, 0, -s); // Relative to backHinge
    const topMesh = new THREE.Mesh(geometry, this.createFaceMaterial(colors.top, '6'));
    topMesh.position.set(0, 0, -s / 2);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.castShadow = true;
    topHinge.add(topMesh);
    backHinge.add(topHinge); // Hierarchical child of backHinge!

    // String Cord Visualization
    const stringMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 });
    const stringGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-s, 0.05, 0),
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(s, 0.05, 0),
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0, 0.05, s),
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0, 0.05, -s * 2)
    ]);
    const stringLine = new THREE.Line(stringGeo, stringMat);
    group.add(stringLine);

    this.shapeNodes = {
      type: 'cube',
      s,
      leftHinge,
      rightHinge,
      frontHinge,
      backHinge,
      topHinge,
      stringLine
    };
  }

  // ==========================================
  // 2. TRIANGULAR PRISM (삼각기둥)
  // ==========================================
  buildTriangularPrism() {
    this.clearModelRoot();
    const a = 2.0; // Side length of equilateral triangle base
    const L = 2.8; // Length of the prism
    const hTri = (Math.sqrt(3) / 2) * a;

    const group = new THREE.Group();
    this.modelRoot.add(group);

    // 1. Bottom Rectangle Face (Base)
    const rectGeo = new THREE.PlaneGeometry(a, L);
    const baseMat = this.createFaceMaterial('#bae6fd', '밑면');
    const baseMesh = new THREE.Mesh(rectGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Left Rectangular Hinge
    const leftHinge = new THREE.Group();
    leftHinge.position.set(-a / 2, 0, 0);
    const leftMesh = new THREE.Mesh(rectGeo, this.createFaceMaterial('#fed7aa', '옆면 1'));
    leftMesh.position.set(-a / 2, 0, 0);
    leftMesh.rotation.x = -Math.PI / 2;
    leftMesh.castShadow = true;
    leftHinge.add(leftMesh);
    group.add(leftHinge);

    // 3. Right Rectangular Hinge
    const rightHinge = new THREE.Group();
    rightHinge.position.set(a / 2, 0, 0);
    const rightMesh = new THREE.Mesh(rectGeo, this.createFaceMaterial('#fed7aa', '옆면 2'));
    rightMesh.position.set(a / 2, 0, 0);
    rightMesh.rotation.x = -Math.PI / 2;
    rightMesh.castShadow = true;
    rightHinge.add(rightMesh);
    group.add(rightHinge);

    // 4. Two Triangular End Caps (Front & Back)
    const shape = new THREE.Shape();
    shape.moveTo(-a / 2, 0);
    shape.lineTo(a / 2, 0);
    shape.lineTo(0, hTri);
    shape.closePath();
    const triGeo = new THREE.ShapeGeometry(shape);

    const frontCapHinge = new THREE.Group();
    frontCapHinge.position.set(0, 0, L / 2);
    const frontCapMesh = new THREE.Mesh(triGeo, this.createFaceMaterial('#a7f3d0', '밑면 1'));
    frontCapMesh.rotation.x = -Math.PI / 2;
    frontCapHinge.add(frontCapMesh);
    group.add(frontCapHinge);

    const backCapHinge = new THREE.Group();
    backCapHinge.position.set(0, 0, -L / 2);
    const backCapMesh = new THREE.Mesh(triGeo, this.createFaceMaterial('#a7f3d0', '밑면 2'));
    backCapMesh.rotation.x = Math.PI / 2;
    backCapHinge.add(backCapMesh);
    group.add(backCapHinge);

    this.shapeNodes = {
      type: 'prism',
      a, L, hTri,
      leftHinge,
      rightHinge,
      frontCapHinge,
      backCapHinge
    };
  }

  // ==========================================
  // 3. CYLINDER (원기둥) - Parametric Rolling
  // ==========================================
  buildCylinder() {
    this.clearModelRoot();
    const R = 1.0;
    const H = 2.5;
    const W = 2 * Math.PI * R; // ~6.28

    const group = new THREE.Group();
    this.modelRoot.add(group);

    // Parametric Sheet Mesh
    const segmentsX = 64;
    const segmentsY = 16;
    const sheetGeo = new THREE.PlaneGeometry(W, H, segmentsX, segmentsY);
    // Keep original vertex positions for deformation
    sheetGeo.userData = {
      origPositions: new Float32Array(sheetGeo.attributes.position.array)
    };

    const sheetMat = this.createFaceMaterial('#fbcfe8', '옆면 (2πr)');
    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMat);
    sheetMesh.rotation.x = -Math.PI / 2;
    sheetMesh.position.y = 0.02;
    sheetMesh.castShadow = true;
    group.add(sheetMesh);

    // Top & Bottom Circular Caps
    const circleGeo = new THREE.CircleGeometry(R, 32);

    const topCapHinge = new THREE.Group();
    topCapHinge.position.set(0, 0, -H / 2);
    const topCapMesh = new THREE.Mesh(circleGeo, this.createFaceMaterial('#cbd5e1', '밑면 (상)'));
    topCapMesh.rotation.x = -Math.PI / 2;
    topCapMesh.position.set(0, 0, -R);
    topCapHinge.add(topCapMesh);
    group.add(topCapHinge);

    const botCapHinge = new THREE.Group();
    botCapHinge.position.set(0, 0, H / 2);
    const botCapMesh = new THREE.Mesh(circleGeo, this.createFaceMaterial('#cbd5e1', '밑면 (하)'));
    botCapMesh.rotation.x = -Math.PI / 2;
    botCapMesh.position.set(0, 0, R);
    botCapHinge.add(botCapMesh);
    group.add(botCapHinge);

    this.shapeNodes = {
      type: 'cylinder',
      R, H, W,
      sheetMesh,
      topCapHinge,
      botCapHinge
    };
  }

  // ==========================================
  // 4. STAR PYRAMID (별모양 각뿔 / 다각뿔)
  // ==========================================
  buildStarPyramid() {
    this.clearModelRoot();
    const n = 6; // Hexagonal base
    const R = 1.3; // Base radius
    const hWing = 2.4; // Wing triangle height

    const group = new THREE.Group();
    this.modelRoot.add(group);

    // 1. Central Regular Hexagon Base
    const baseShape = new THREE.Shape();
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n;
      const x = R * Math.cos(angle);
      const z = R * Math.sin(angle);
      if (i === 0) baseShape.moveTo(x, z);
      else baseShape.lineTo(x, z);
    }
    baseShape.closePath();

    const baseGeo = new THREE.ShapeGeometry(baseShape);
    const baseMat = this.createFaceMaterial('#bbf7d0', '중앙 밑면');
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Triangular Wings for each edge
    const edgeLength = 2 * R * Math.sin(Math.PI / n);
    const rInscribed = R * Math.cos(Math.PI / n);

    const triShape = new THREE.Shape();
    triShape.moveTo(-edgeLength / 2, 0);
    triShape.lineTo(edgeLength / 2, 0);
    triShape.lineTo(0, hWing);
    triShape.closePath();
    const wingGeo = new THREE.ShapeGeometry(triShape);

    const wingHinges = [];
    for (let i = 0; i < n; i++) {
      const edgeAngle = ((i + 0.5) * 2 * Math.PI) / n;
      const hinge = new THREE.Group();
      hinge.position.set(rInscribed * Math.cos(edgeAngle), 0, rInscribed * Math.sin(edgeAngle));
      hinge.rotation.y = -edgeAngle + Math.PI / 2;

      const wingMat = this.createFaceMaterial(i % 2 === 0 ? '#fed7aa' : '#fef08a', (i + 1).toString());
      const wingMesh = new THREE.Mesh(wingGeo, wingMat);
      wingMesh.rotation.x = -Math.PI / 2;
      wingMesh.castShadow = true;
      hinge.add(wingMesh);

      group.add(hinge);
      wingHinges.push(hinge);
    }

    this.shapeNodes = {
      type: 'pyramid',
      n, R, hWing, rInscribed,
      wingHinges
    };
  }

  buildCurrentShape() {
    switch (this.currentShape) {
      case 'cube':
        this.buildCube();
        break;
      case 'prism':
        this.buildTriangularPrism();
        break;
      case 'cylinder':
        this.buildCylinder();
        break;
      case 'pyramid':
        this.buildStarPyramid();
        break;
    }
    this.updateFold(this.progress);
  }

  setShape(shapeName) {
    if (this.currentShape === shapeName) return;
    this.currentShape = shapeName;
    this.buildCurrentShape();
  }

  // --- Real-time Fold Kinematics Update ---
  updateFold(t) {
    this.progress = Math.max(0, Math.min(1, t));
    const nodes = this.shapeNodes;
    if (!nodes.type) return;

    if (nodes.type === 'cube') {
      const angle = (Math.PI / 2) * this.progress;
      nodes.leftHinge.rotation.z = -angle;
      nodes.rightHinge.rotation.z = angle;
      nodes.frontHinge.rotation.x = -angle;
      nodes.backHinge.rotation.x = angle;
      nodes.topHinge.rotation.x = angle; // Folds on top of back face!
    } else if (nodes.type === 'prism') {
      // 60 degrees fold for sides to meet equilateral peak
      const sideAngle = (Math.PI / 3) * this.progress;
      nodes.leftHinge.rotation.z = -sideAngle;
      nodes.rightHinge.rotation.z = sideAngle;
      // 90 degrees fold for triangular caps
      const capAngle = (Math.PI / 2) * this.progress;
      nodes.frontCapHinge.rotation.x = -capAngle;
      nodes.backCapHinge.rotation.x = capAngle;
    } else if (nodes.type === 'cylinder') {
      // Deform plane vertices to wrap into a cylinder
      const geo = nodes.sheetMesh.geometry;
      const pos = geo.attributes.position;
      const orig = geo.userData.origPositions;
      const W = nodes.W;
      const R = nodes.R;

      if (this.progress < 0.001) {
        // Flat state
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(i, orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]);
        }
      } else {
        const foldFactor = this.progress;
        const totalAngle = 2 * Math.PI * foldFactor;
        const curRadius = W / totalAngle;

        for (let i = 0; i < pos.count; i++) {
          const ox = orig[i * 3];     // in [-W/2, W/2]
          const oy = orig[i * 3 + 1]; // Height in [-H/2, H/2]
          const theta = (ox / W) * totalAngle;
          const nx = curRadius * Math.sin(theta);
          const nz = curRadius * (1 - Math.cos(theta));
          pos.setXYZ(i, nx, oy, nz);
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      // Top and bottom caps rotate and translate into position
      const capRot = (Math.PI / 2) * this.progress;
      nodes.topCapHinge.rotation.x = capRot;
      nodes.botCapHinge.rotation.x = -capRot;
    } else if (nodes.type === 'pyramid') {
      // All triangular wings fold inwards towards single apex
      // Target angle where apex meets at center (0, h, 0)
      const maxFoldAngle = Math.acos(nodes.rInscribed / nodes.hWing);
      const curAngle = maxFoldAngle * this.progress;

      nodes.wingHinges.forEach(hinge => {
        hinge.rotation.x = curAngle;
      });
    }

    if (this.onProgressChange) {
      this.onProgressChange(this.progress);
    }
  }

  setProgress(val) {
    this.updateFold(val);
    if (this.progress >= 0.999 && this.onCompleteFold) {
      this.onCompleteFold();
    }
  }

  toggleAutoFold() {
    this.isAutoFolding = !this.isAutoFolding;
    return this.isAutoFolding;
  }

  toggleWireframe() {
    this.showWireframe = !this.showWireframe;
    this.modelRoot.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = this.showWireframe);
        } else {
          child.material.wireframe = this.showWireframe;
        }
      }
    });
    return this.showWireframe;
  }

  toggleParallelHighlight() {
    this.parallelHighlight = !this.parallelHighlight;
    // For Cube: emphasize opposite parallel faces in matching vibrant colors
    if (this.currentShape === 'cube') {
      const mats = [];
      this.modelRoot.traverse(child => {
        if (child.isMesh && child.material && child.material.userData) {
          mats.push(child.material);
        }
      });
      // Toggle color schemes
    }
    return this.parallelHighlight;
  }

  setCameraPreset(preset) {
    if (!this.controls) return;
    switch (preset) {
      case 'top':
        // Top-down 2D Net view
        this.camera.position.set(0, 9, 0.01);
        this.controls.target.set(0, 0, 0);
        break;
      case 'iso':
        // 3D Isometric View
        this.camera.position.set(5.5, 5.5, 6.5);
        this.controls.target.set(0, 0.5, 0);
        break;
      case 'front':
        // Front View
        this.camera.position.set(0, 2.5, 7.5);
        this.controls.target.set(0, 0.8, 0);
        break;
      case 'reset':
      default:
        this.camera.position.set(0, 5.5, 7.5);
        this.controls.target.set(0, 0.5, 0);
        break;
    }
    this.controls.update();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // Auto folding animation
    if (this.isAutoFolding) {
      let nextP = this.progress + this.autoDirection * delta * 0.45;
      if (nextP >= 1.0) {
        nextP = 1.0;
        this.autoDirection = -1;
      } else if (nextP <= 0.0) {
        nextP = 0.0;
        this.autoDirection = 1;
      }
      this.setProgress(nextP);
    }

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Global expose
window.MagicFoldSimulator = MagicFoldSimulator;

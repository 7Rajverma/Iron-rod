// Iron Rod 3D Visualizer Application

// Global Three.js variables
let scene, camera, renderer, controls;
let rodMesh, rodGeometry, rodMaterial;
let gridHelper;
let bumpTexture;

// UI Elements
const widthSlider = document.getElementById('width-slider');
const heightSlider = document.getElementById('height-slider');
const widthVal = document.getElementById('width-val');
const heightVal = document.getElementById('height-val');
const volumeVal = document.getElementById('volume-val');

// Initialize the Application
function init() {
    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d12);
    // Add subtle fog to blend the grid into the dark background
    scene.fog = new THREE.FogExp2(0x0c0d12, 0.07);

    // 2. Camera setup
    camera = new THREE.PerspectiveCamera(
        45, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        100
    );
    // Position camera at a nice angle looking down at the rod
    camera.position.set(7, 6, 8);

    // 3. Renderer setup
    const canvas = document.getElementById('webgl-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Tone mapping for a premium rendering look
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // 4. Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above floor
    controls.minDistance = 2.0;
    controls.maxDistance = 25.0;

    // 5. Lighting Setup
    // Ambient light for general soft illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // Key Light - strong white directional light casting shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(8, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    const d = 8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Fill Light - soft bluish light from front-left to soften shadows
    const fillLight = new THREE.DirectionalLight(0x6688aa, 0.6);
    fillLight.position.set(-8, 4, 8);
    scene.add(fillLight);

    // Rim Light - highlight edges from behind the model
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rimLight.position.set(-4, 6, -8);
    scene.add(rimLight);

    // 6. Ground grid & shadow receiver
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x101216,
        roughness: 0.85,
        metalness: 0.15
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper overlay
    gridHelper = new THREE.GridHelper(30, 30, 0x242936, 0x151821);
    gridHelper.position.y = 0.005; // avoid z-fighting
    scene.add(gridHelper);

    // 7. Generate procedural iron texture
    bumpTexture = generateProceduralMetal();

    // 8. Create Iron Rod Material
    rodMaterial = new THREE.MeshStandardMaterial({
        color: 0x3e4249, // Forged dark iron base
        metalness: 0.92,
        roughness: 0.42,
        bumpMap: bumpTexture,
        bumpScale: 0.003,
        roughnessMap: bumpTexture, // reuse for rough specularity details
    });

    // 9. Initial build of the rod
    updateRodGeometry();

    // 10. Event listeners
    window.addEventListener('resize', onWindowResize);
    widthSlider.addEventListener('input', updateRodGeometry);
    heightSlider.addEventListener('input', updateRodGeometry);

    // Start render loop
    animate();
}

// Procedural metal texture generator (using Canvas 2D)
function generateProceduralMetal() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill with neutral middle gray base
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // Draw horizontal brushed lines (fine scratches)
    for (let i = 0; i < 400; i++) {
        const y = Math.random() * size;
        const opacity = Math.random() * 0.12;
        const val = Math.random() > 0.5 ? 255 : 0; // white or black fine line
        ctx.strokeStyle = `rgba(${val}, ${val}, ${val}, ${opacity})`;
        ctx.lineWidth = Math.random() * 1.5;
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }

    // Add random spots & blemishes (simulating pitted texture of raw iron)
    for (let i = 0; i < 1500; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 2;
        const brightness = Math.random() > 0.6 ? 20 : -25;
        const opacity = Math.random() * 0.18;
        
        ctx.fillStyle = `rgba(${128 + brightness}, ${128 + brightness}, ${128 + brightness}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Rebuilds cylinder geometry in real-time based on slider parameters
function updateRodGeometry() {
    // Read current slider inputs
    const diameter = parseFloat(widthSlider.value);
    const height = parseFloat(heightSlider.value);
    const radius = diameter / 2;

    // Update readouts in HUD
    widthVal.innerHTML = `${diameter.toFixed(2)} <span class="unit">m</span>`;
    heightVal.innerHTML = `${height.toFixed(1)} <span class="unit">m</span>`;

    // Calculate Volume: V = pi * r^2 * h
    const volume = Math.PI * Math.pow(radius, 2) * height;
    volumeVal.innerHTML = `${volume.toFixed(2)} <span class="unit">m³</span>`;

    // Rebuild geometry to prevent texture stretching
    if (rodGeometry) rodGeometry.dispose();
    
    // Cylinder parameters: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
    rodGeometry = new THREE.CylinderGeometry(radius, radius, height, 64, 8, false);
    
    // If mesh doesn't exist, create it
    if (!rodMesh) {
        rodMesh = new THREE.Mesh(rodGeometry, rodMaterial);
        rodMesh.castShadow = true;
        rodMesh.receiveShadow = true;
        scene.add(rodMesh);
    } else {
        rodMesh.geometry = rodGeometry;
    }

    // Position rod to stand exactly on the ground plane
    rodMesh.position.y = height / 2;

    // Repeat textures proportionally so scale changes don't stretch the brushed finish
    // S-wrapping matches the circumference, T-wrapping matches the height
    const circ = diameter * Math.PI;
    bumpTexture.repeat.set(Math.ceil(circ * 2), Math.ceil(height));
    bumpTexture.needsUpdate = true;

    // Dynamically adjust OrbitControls target to center of the rod height smoothly
    // but keep camera tracking comfortable
    controls.target.set(0, height / 2, 0);
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Render and Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Update controls (handles damping effect)
    controls.update();

    // Render the scene
    renderer.render(scene, camera);
}

// Launch application on load
window.onload = init;

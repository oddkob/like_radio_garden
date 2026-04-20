// Radio Garden Desktop - 3D Globe & Player Logic

// Three.js globals
let scene, camera, renderer, globe, atmosphere, stars;
let raycaster, mouse;
let markers = [];
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotation = { x: 0, y: 0 };
let currentStation = null;
let isPlaying = false;
let stations = [];

// DOM Elements
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const stationList = document.getElementById('station-list');
const visualizer = document.getElementById('visualizer');
const loading = document.getElementById('loading');

// Initialize Application
async function init() {
    try {
        // Load stations from API
        const response = await fetch('/api/stations');
        stations = await response.json();
        
        // Update station count
        document.getElementById('global-station-count').textContent = stations.length;
        
        // Setup Three.js
        setupScene();
        createGlobe();
        createAtmosphere();
        createStars();
        createMarkers();
        setupEventListeners();
        
        // Hide loading
        setTimeout(() => {
            loading.classList.add('opacity-0');
            setTimeout(() => loading.remove(), 1000);
        }, 1500);
        
        animate();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

function setupScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('globe-container').appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00ff88, 0.5);
    pointLight.position.set(-5, -3, -5);
    scene.add(pointLight);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
}

function createGlobe() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Create procedural earth texture
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Deep ocean
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Continents (simplified shapes)
    ctx.fillStyle = '#1a3a2f';
    
    const continents = [
        // North America
        [[200, 200], [400, 150], [500, 250], [450, 400], [300, 350], [250, 280]],
        // South America
        [[450, 500], [550, 450], [520, 650], [480, 750], [420, 650], [430, 550]],
        // Europe
        [[900, 200], [1000, 180], [1050, 250], [1020, 300], [950, 280], [920, 240]],
        // Africa
        [[900, 350], [1050, 320], [1080, 450], [1020, 600], [950, 580], [880, 480], [890, 400]],
        // Asia
        [[1100, 150], [1400, 180], [1550, 250], [1600, 350], [1500, 450], [1350, 420], [1200, 380], [1150, 280]],
        // Australia
        [[1450, 650], [1600, 630], [1650, 720], [1580, 780], [1480, 760]],
        // Greenland
        [[450, 100], [550, 90], [530, 150], [480, 160]],
        // Japan
        [[1550, 280], [1580, 270], [1590, 300], [1560, 310]],
        // UK
        [[830, 210], [850, 205], [855, 230], [835, 235]],
        // Madagascar
        [[1020, 620], [1050, 615], [1045, 660], [1015, 655]]
    ];
    
    continents.forEach(points => {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            const xc = (points[i][0] + points[i-1][0]) / 2;
            const yc = (points[i][1] + points[i-1][1]) / 2;
            ctx.quadraticCurveTo(points[i-1][0], points[i-1][1], xc, yc);
        }
        ctx.closePath();
        ctx.fill();
        
        // Add subtle glow to continents
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        emissive: 0x112244,
        emissiveIntensity: 0.1,
        shininess: 25,
        specular: new THREE.Color(0x111111)
    });
    
    globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Wireframe overlay
    const wireframeGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(1.01, 32, 32));
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.03 });
    const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
    globe.add(wireframe);
}

function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.2, 64, 64);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            c: { type: "f", value: 0.6 },
            p: { type: "f", value: 4.0 },
            glowColor: { type: "c", value: new THREE.Color(0x00ff88) },
            viewVector: { type: "v3", value: camera.position }
        },
        vertexShader: `
            uniform vec3 viewVector;
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                vec3 vNormel = normalize(normalMatrix * viewVector);
                intensity = pow(0.6 - dot(vNormal, vNormel), 4.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            varying float intensity;
            void main() {
                vec3 glow = glowColor * intensity;
                gl_FragColor = vec4(glow, 1.0);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });
    
    atmosphere = new THREE.Mesh(geometry, material);
    scene.add(atmosphere);
}

function createStars() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    
    for (let i = 0; i < 5000; i++) {
        vertices.push(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        
        // Random star colors (white, blue-ish, yellow-ish)
        const colorType = Math.random();
        if (colorType > 0.9) {
            colors.push(0.8, 0.8, 1.0); // Blue-ish
        } else if (colorType > 0.7) {
            colors.push(1.0, 1.0, 0.8); // Yellow-ish
        } else {
            colors.push(1.0, 1.0, 1.0); // White
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        vertexColors: true,
        sizeAttenuation: true
    });
    
    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function createMarkers() {
    stations.forEach((station, index) => {
        const marker = createMarker(station.lat, station.lon);
        marker.userData = { ...station, index };
        globe.add(marker);
        markers.push(marker);
    });
}

function createMarker(lat, lon) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -(1.02 * Math.sin(phi) * Math.cos(theta));
    const z = (1.02 * Math.sin(phi) * Math.sin(theta));
    const y = (1.02 * Math.cos(phi));
    
    const geometry = new THREE.SphereGeometry(0.015, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5
    });
    
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, y, z);
    
    // Glow effect
    const glowGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    marker.add(glow);
    
    // Outer ring
    const ringGeo = new THREE.RingGeometry(0.04, 0.045, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.lookAt(new THREE.Vector3(0, 0, 0));
    marker.add(ring);
    
    return marker;
}

function setupEventListeners() {
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onGlobeClick);
    
    window.addEventListener('resize', onWindowResize);
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
}

function onMouseMove(event) {
    if (isDragging) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };
        
        targetRotation.y += deltaMove.x * 0.005;
        targetRotation.x += deltaMove.y * 0.005;
        targetRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, targetRotation.x));
        
        previousMousePosition = { x: event.clientX, y: event.clientY };
    }
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Hover effect
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers);
    
    document.body.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
}

function onMouseUp() {
    isDragging = false;
}

function onWheel(event) {
    event.preventDefault();
    camera.position.z += event.deltaY * 0.002;
    camera.position.z = Math.max(2, Math.min(6, camera.position.z));
}

function zoomCamera(delta) {
    camera.position.z += delta;
    camera.position.z = Math.max(2, Math.min(6, camera.position.z));
}

function onGlobeClick(event) {
    if (isDragging) return;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers);
    
    if (intersects.length > 0) {
        const station = intersects[0].object.userData;
        selectStation(station);
    }
}

async function selectStation(station) {
    currentStation = station;
    
    // Update UI
    document.getElementById('location-name').textContent = `${station.city}, ${station.country}`;
    document.getElementById('station-location').textContent = `${station.city}, ${station.country}`;
    document.getElementById('current-station').textContent = station.name;
    document.getElementById('station-genre').textContent = station.genre;
    document.getElementById('station-bitrate').textContent = station.bitrate;
    document.getElementById('station-language').textContent = station.language;
    document.getElementById('station-listeners').textContent = station.listeners;
    
    // Show panels
    leftPanel.classList.remove('-translate-x-full', 'opacity-0');
    rightPanel.classList.remove('translate-x-full');
    
    // Generate nearby station list
    await generateStationList(station);
    
    // Rotate globe to station
    rotateToStation(station);
    
    // Auto-play
    await playStation(station.id);
}

async function generateStationList(selectedStation) {
    try {
        const response = await fetch(`/api/stations/nearby?lat=${selectedStation.lat}&lon=${selectedStation.lon}&radius=15`);
        const nearby = await response.json();
        
        document.getElementById('station-count-display').textContent = `${nearby.length} stations nearby`;
        
        stationList.innerHTML = nearby.map(s => `
            <div class="station-item glass-panel p-3 rounded-lg ${s.id === selectedStation.id ? 'active border-green-400/30' : ''}" 
                 onclick="selectStationById(${s.id})">
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-white text-sm truncate">${s.name}</h4>
                        <p class="text-xs text-gray-400">${s.city} • ${s.distance}° away</p>
                    </div>
                    <span class="text-xs text-green-400 ml-2 whitespace-nowrap">${s.genre}</span>
                </div>
                <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        ${s.listeners}
                    </span>
                    <span>•</span>
                    <span>${s.bitrate}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching nearby stations:', error);
    }
}

async function selectStationById(id) {
    const station = stations.find(s => s.id === id);
    if (station) await selectStation(station);
}

function rotateToStation(station) {
    const phi = (90 - station.lat) * (Math.PI / 180);
    const theta = (station.lon + 180) * (Math.PI / 180);
    
    gsap.to(globe.rotation, {
        x: phi - Math.PI / 2,
        y: -theta + Math.PI,
        duration: 1.5,
        ease: "power2.inOut"
    });
}

async function playStation(stationId) {
    try {
        const response = await fetch('/api/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station_id: stationId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isPlaying = true;
            updatePlayButton();
            visualizer.classList.remove('opacity-0');
            document.getElementById('live-badge').classList.remove('hidden');
            playBtn.disabled = false;
            stopBtn.disabled = false;
        }
    } catch (error) {
        console.error('Playback error:', error);
        // Fallback to simulation if Python backend fails
        simulatePlayback();
    }
}

function simulatePlayback() {
    isPlaying = true;
    updatePlayButton();
    visualizer.classList.remove('opacity-0');
    document.getElementById('live-badge').classList.remove('hidden');
    playBtn.disabled = false;
    stopBtn.disabled = false;
}

async function togglePlay() {
    if (isPlaying) {
        await stopPlayback();
    } else if (currentStation) {
        await playStation(currentStation.id);
    }
}

async function stopPlayback() {
    try {
        await fetch('/api/stop', { method: 'POST' });
    } catch (e) {
        console.log('Stop error:', e);
    }
    
    isPlaying = false;
    updatePlayButton();
    visualizer.classList.add('opacity-0');
    document.getElementById('live-badge').classList.add('hidden');
}

function updatePlayButton() {
    playBtn.innerHTML = isPlaying ? 
        `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>` :
        `<svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
}

function handleVolume(value) {
    const volume = value / 100;
    document.getElementById('volume-display').textContent = `${value}%`;
    
    fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume })
    }).catch(e => console.log('Volume error:', e));
}

function closeLeftPanel() {
    leftPanel.classList.add('-translate-x-full', 'opacity-0');
}

async function playRandom() {
    try {
        const response = await fetch('/api/random');
        const station = await response.json();
        await selectStation(station);
    } catch (error) {
        console.error('Random station error:', error);
    }
}

// Search functionality
async function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (!query) return;
        
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            showSearchResults(results, query);
        } catch (error) {
            console.error('Search error:', error);
        }
    }
}

function showSearchResults(results, query) {
    const modal = document.getElementById('search-modal');
    const content = document.getElementById('search-content');
    const container = document.getElementById('search-results');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p>No stations found for "${query}"</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = results.map(s => `
        <div class="station-item glass-panel p-3 rounded-lg cursor-pointer" onclick="selectStationById(${s.id}); closeSearch();">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-medium text-white text-sm">${s.name}</h4>
                    <p class="text-xs text-gray-400">${s.city}, ${s.country}</p>
                </div>
                <span class="text-xs text-green-400">${s.genre}</span>
            </div>
        </div>
    `).join('');
}

function closeSearch() {
    const modal = document.getElementById('search-modal');
    const content = document.getElementById('search-content');
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('search-input').value = '';
    }, 300);
}

// Window controls for frameless window
window.minimize = function() {
    if (window.pywebview) window.pywebview.api.minimize_window();
};

window.toggleFullscreen = function() {
    if (window.pywebview) window.pywebview.api.toggle_fullscreen();
};

window.close = function() {
    if (window.pywebview) window.pywebview.api.close_window();
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Smooth rotation
    if (!isDragging) {
        globe.rotation.y += 0.0005;
        targetRotation.y = globe.rotation.y;
        targetRotation.x = globe.rotation.x;
    } else {
        globe.rotation.x += (targetRotation.x - globe.rotation.x) * 0.1;
        globe.rotation.y += (targetRotation.y - globe.rotation.y) * 0.1;
    }
    
    // Rotate stars
    if (stars) {
        stars.rotation.y += 0.0001;
        stars.rotation.x += 0.00005;
    }
    
    // Update atmosphere
    if (atmosphere) {
        atmosphere.material.uniforms.viewVector.value = camera.position;
    }
    
    // Animate markers
    const time = Date.now() * 0.001;
    markers.forEach((marker, i) => {
        const scale = 1 + Math.sin(time * 2 + i * 0.5) * 0.2;
        marker.children[0].scale.setScalar(scale);
        
        // Rotate ring
        if (marker.children[2]) {
            marker.children[2].rotation.z += 0.01;
        }
    });
    
    renderer.render(scene, camera);
}

// Start
init();
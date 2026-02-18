const socket = io("https://070450bcfbcb45.lhr.life");
let scene, camera, renderer;
let playerMesh;
let playerTexture = null;
let username;
let myId = null;
let otherPlayers = {};
let otherPlayerTextures = {};
let physicsBalls = [];

let cameraAngleX = 0;
let cameraAngleY = 0.5;
let cameraDistance = 10;

let joystickVector = { x: 0, y: 0 };
let cameraVector = { x: 0, y: 0 };

let overrideActive = false;
let overrideCooldown = false;

initScene();

function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(50, 1, 50),
        new THREE.MeshStandardMaterial({ color: 0x007700 })
    );
    base.position.y = -0.5;
    scene.add(base);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

socket.on("connect", () => { myId = socket.id; });

function createPropTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("im a prop", 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function createBall(data) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({ map: createPropTexture() });
    const ball = new THREE.Mesh(geometry, material);
    ball.position.set(data.x, data.y || 3, data.z);
    ball.userData.velocity = { x: data.vx || 0, y: data.vy || 0, z: data.vz || 0 };
    scene.add(ball);
    physicsBalls.push(ball);
}

function spawnPlayer(textureUrl) {
    playerTexture = textureUrl;
    const texture = new THREE.TextureLoader().load(textureUrl);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(2, 2);
    playerMesh = new THREE.Mesh(geometry, material);
    playerMesh.position.set(0, 1, 0);
    scene.add(playerMesh);
    socket.emit("newPlayer", { name: username, x: 0, z: 0, texture: textureUrl });
}

function applyTextureOverride(textureUrl, duration) {
    overrideActive = true;

    // Collect all player meshes and save their original textures
    let allMeshes = [];
    if (playerMesh) allMeshes.push(playerMesh);
    Object.values(otherPlayers).forEach(m => allMeshes.push(m));

    // Save originals
    let savedTextures = allMeshes.map(m => m.material.map);

    // Load override texture then apply to everyone
    new THREE.TextureLoader().load(textureUrl, (tex) => {
        allMeshes.forEach(m => {
            m.material.map = tex;
            m.material.needsUpdate = true;
        });
    });

    // Show countdown timer
    const timerEl = document.getElementById("override-timer");
    timerEl.style.display = "block";
    let remaining = duration / 1000;
    timerEl.textContent = `Texture Override: ${remaining}s`;
    const interval = setInterval(() => {
        remaining--;
        timerEl.textContent = `Texture Override: ${remaining}s`;
        if (remaining <= 0) clearInterval(interval);
    }, 1000);

    // Restore after duration
    setTimeout(() => {
        allMeshes.forEach((m, i) => {
            if (savedTextures[i]) {
                m.material.map = savedTextures[i];
                m.material.needsUpdate = true;
            }
        });
        overrideActive = false;
        timerEl.style.display = "none";
    }, duration);
}

document.getElementById("joinBtn").onclick = () => {
    username = document.getElementById("username").value;
    if (!username) return;
    document.getElementById("login").style.display = "none";
    document.getElementById("gui").style.display = "flex";
    spawnPlayer("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
};

document.getElementById("pngUpload").addEventListener("change", e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        if (playerMesh) scene.remove(playerMesh);
        spawnPlayer(event.target.result);
    };
    reader.readAsDataURL(file);
});

document.getElementById("spawnBtn").onclick = () => {
    if (!playerMesh) return;
    const data = {
        x: playerMesh.position.x,
        y: 3,
        z: playerMesh.position.z - 3,
        vx: (Math.random() - 0.5) * 0.1,
        vy: 0,
        vz: (Math.random() - 0.5) * 0.1
    };
    createBall(data);
    socket.emit("spawnBall", data);
};

// Change these to whatever words you want!
const overridePhrases = ["im a noob", "skill issue", "L + ratio", "touch grass", "get rekt"];

function makeTextTexture(phrase) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Word wrap
    const words = phrase.split(" ");
    let line = "";
    let y = 100;
    words.forEach(word => {
        const test = line + word + " ";
        if (ctx.measureText(test).width > 220) {
            ctx.fillText(line, 128, y);
            line = word + " ";
            y += 50;
        } else {
            line = test;
        }
    });
    ctx.fillText(line, 128, y);
    return canvas.toDataURL();
}

document.getElementById("overrideBtn").onclick = () => {
    if (overrideCooldown) return;
    overrideCooldown = true;
    const btn = document.getElementById("overrideBtn");
    btn.disabled = true;

    const phrase = overridePhrases[Math.floor(Math.random() * overridePhrases.length)];
    const textureUrl = makeTextTexture(phrase);

    applyTextureOverride(textureUrl, 10000);
    socket.emit("textureOverride", { texture: textureUrl });

    setTimeout(() => {
        overrideCooldown = false;
        btn.disabled = false;
    }, 20000);
};

socket.on("init", data => {
    if (data.balls) data.balls.forEach(b => createBall(b));
    // Load players already in the game
    if (data.players) {
        Object.keys(data.players).forEach(id => {
            if (id === socket.id) return;
            const p = data.players[id];
            const tex = new THREE.TextureLoader().load(p.texture);
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            const geo = new THREE.PlaneGeometry(2, 2);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(p.x, 1, p.z);
            scene.add(mesh);
            otherPlayers[id] = mesh;
        });
    }
});

socket.on("spawnBall", data => { createBall(data); });

socket.on("spawnProp", data => {
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    box.position.set(data.x, 1, data.z);
    scene.add(box);
});

// Someone else triggered texture override on you
socket.on("textureOverride", data => {
    applyTextureOverride(data.texture, 10000);
});

socket.on("updatePlayers", players => {
    Object.keys(players).forEach(id => {
        if (id === myId) return;
        if (!otherPlayers[id]) {
            const tex = new THREE.TextureLoader().load(players[id].texture);
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            const geo = new THREE.PlaneGeometry(2, 2);
            const mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            otherPlayers[id] = mesh;
        }
        otherPlayers[id].position.set(players[id].x, 1, players[id].z);
        otherPlayers[id].lookAt(camera.position);
    });
    Object.keys(otherPlayers).forEach(id => {
        if (!players[id]) {
            scene.remove(otherPlayers[id]);
            delete otherPlayers[id];
        }
    });
});

var joystickLeft = nipplejs.create({
    zone: document.getElementById('joystick-left'),
    mode: 'static',
    position: { left: '60px', bottom: '60px' },
    color: '#00ff00'
});
joystickLeft.on('move', (evt, data) => {
    if (data.vector) { joystickVector.x = data.vector.x; joystickVector.y = data.vector.y; }
});
joystickLeft.on('end', () => { joystickVector.x = 0; joystickVector.y = 0; });

var joystickRight = nipplejs.create({
    zone: document.getElementById('joystick-right'),
    mode: 'static',
    position: { right: '60px', bottom: '60px' },
    color: '#00ffff'
});
joystickRight.on('move', (evt, data) => {
    if (data.vector) { cameraVector.x = data.vector.x; cameraVector.y = data.vector.y; }
});
joystickRight.on('end', () => { cameraVector.x = 0; cameraVector.y = 0; });

function animate() {
    requestAnimationFrame(animate);

    if (playerMesh && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
        const speed = 0.1;
        const moveX = Math.cos(cameraAngleX) * joystickVector.x - Math.sin(cameraAngleX) * (-joystickVector.y);
        const moveZ = Math.sin(cameraAngleX) * joystickVector.x + Math.cos(cameraAngleX) * (-joystickVector.y);
        playerMesh.position.x += moveX * speed;
        playerMesh.position.z += moveZ * speed;
        socket.emit("movePlayer", { x: playerMesh.position.x, z: playerMesh.position.z });
    }

    if (cameraVector.x !== 0 || cameraVector.y !== 0) {
        cameraAngleX += cameraVector.x * 0.03;
        cameraAngleY += cameraVector.y * 0.02;
        cameraAngleY = Math.max(0.1, Math.min(1.2, cameraAngleY));
    }

    physicsBalls.forEach(ball => {
        ball.userData.velocity.y -= 0.005;
        ball.position.x += ball.userData.velocity.x;
        ball.position.y += ball.userData.velocity.y;
        ball.position.z += ball.userData.velocity.z;
        ball.rotation.x += 0.02;
        ball.rotation.y += 0.02;
        if (ball.position.y <= 0.5) {
            ball.position.y = 0.5;
            ball.userData.velocity.y *= -0.6;
        }
        if (playerMesh) {
            const dx = ball.position.x - playerMesh.position.x;
            const dy = ball.position.y - playerMesh.position.y;
            const dz = ball.position.z - playerMesh.position.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 1.2) {
                const nx = dx/dist, ny = dy/dist, nz = dz/dist;
                ball.userData.velocity.x = nx * 0.2;
                ball.userData.velocity.y = Math.abs(ny * 0.2) + 0.1;
                ball.userData.velocity.z = nz * 0.2;
            }
        }
        Object.values(otherPlayers).forEach(other => {
            const dx = ball.position.x - other.position.x;
            const dy = ball.position.y - other.position.y;
            const dz = ball.position.z - other.position.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 1.2) {
                const nx = dx/dist, ny = dy/dist, nz = dz/dist;
                ball.userData.velocity.x = nx * 0.2;
                ball.userData.velocity.y = Math.abs(ny * 0.2) + 0.1;
                ball.userData.velocity.z = nz * 0.2;
            }
        });
    });

    if (playerMesh) {
        camera.position.x = playerMesh.position.x + cameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
        camera.position.y = playerMesh.position.y + cameraDistance * Math.sin(cameraAngleY);
        camera.position.z = playerMesh.position.z + cameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);
        camera.lookAt(playerMesh.position);
    }

    renderer.render(scene, camera);
}

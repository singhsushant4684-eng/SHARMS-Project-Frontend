const API_BASE_URL = 'http://127.0.0.1:5000/api';

// CORE SYSTEM STATE
let devices = [
  { id: 'dev-1', name: 'Main Ceiling Light', type: 'LIGHT', room: 'Living Room', status: 'ONLINE', isPoweredOn: true },
  { id: 'dev-2', name: 'Climate Thermostat', type: 'THERMOSTAT', room: 'Living Room', status: 'ONLINE', targetTemp: 22 },
  { id: 'dev-3', name: 'Front Smart Lock', type: 'LOCK', room: 'Entrance', status: 'ONLINE', isLocked: true },
  { id: 'dev-4', name: 'Bedroom Mood Lamp', type: 'LIGHT', room: 'Bedroom', status: 'ONLINE', isPoweredOn: false },
  { id: 'dev-5', name: 'Kitchen Leak Sensor', type: 'LIGHT', room: 'Kitchen', status: 'OFFLINE', isPoweredOn: false }
];

let currentFilter = 'ALL';
let chartsInitialized = false;

// AUTO-LOAD SAVED SESSION ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
  const savedName = localStorage.getItem('sharms_user_name');
  const savedInitials = localStorage.getItem('sharms_user_initials');

  if (savedName) {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.innerText = savedName;
  }
  
  if (savedInitials) {
    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.innerText = savedInitials;
  }
});

// AUTHENTICATION FLOW
async function handleLogin(e) {
  e.preventDefault();

  // 1. Explicitly target the email/username input
  const emailInput = document.getElementById('login-email');
  const fullNameInput = document.getElementById('login-fullname');

  const emailValue = emailInput ? emailInput.value.trim() : '';
  const fullNameValue = fullNameInput ? fullNameInput.value.trim() : '';

  // 2. Validate strict domain suffix on email input
  if (!emailValue.toLowerCase().endsWith('@sharms.local')) {
    alert('Access Denied: Email/Username must end with @sharms.local (e.g. admin@sharms.local)');
    if (emailInput) emailInput.focus();
    return; // Block login execution
  }

  // Extract username prefix (e.g., "admin" from "admin@sharms.local") for backend check
  const usernamePrefix = emailValue.split('@')[0];
  const passwordInput = document.getElementById('login-password'); // Ensure you have a password field or prompt
  const passwordValue = passwordInput ? passwordInput.value : 'admin123'; // fallback for mock test

  try {
    // 3. Authenticate against your Node.js/Express backend
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernamePrefix, password: passwordValue })
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.message || 'Backend authentication failed.');
      return;
    }

    // Save JWT token returned from backend
    localStorage.setItem('sharms_token', data.token);

  } catch (error) {
    console.error('Server connection error:', error);
    alert('Could not connect to the SHARMS backend server on port 5000.');
    return;
  }

  // 4. Determine display name (prefer Full Name input if filled, otherwise extract from email)
  let displayName = fullNameValue;
  if (!displayName) {
    let rawName = emailValue.split('@')[0];
    displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }

  // 5. Generate initials dynamically
  const parts = displayName.split(' ').filter(p => p.length > 0);
  let initials = 'US';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0].slice(0, 2).toUpperCase();
  }

  // 6. Update UI header
  const userNameEl = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar');

  if (userNameEl) userNameEl.innerText = displayName;
  if (userAvatarEl) userAvatarEl.innerText = initials;

  // 7. Persist session
  localStorage.setItem('sharms_user_name', displayName);
  localStorage.setItem('sharms_user_initials', initials);

  // 8. Toggle view visibility
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('system-view').classList.remove('hidden');

  // 9. Render devices & initialize charts
  fetchAndRenderDevices();
  if (!chartsInitialized) {
    try {
      initCharts();
      chartsInitialized = true;
    } catch (e) {
      console.error('Chart init error safely caught:', e);
    }
  }

  // 10. Add formatted system audit log entry
  addLog('Admin Auth', 'INFO', `User ${displayName} (${emailValue}) authenticated successfully.`);
}

function handleLogout() {
  // Clear persistent session storage on logout
  localStorage.removeItem('sharms_user_name');
  localStorage.removeItem('sharms_user_initials');

  document.getElementById('system-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
}

// RENDER DEVICES IN DEVICE CONTROL MODULE
function renderDevices() {
  const grid = document.getElementById('device-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = currentFilter === 'ALL' ? devices : devices.filter(d => d.room === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="color: #94a3b8; grid-column: 1/-1; text-align: center; padding: 2rem;">No devices found in this location.</div>';
    return;
  }

  filtered.forEach(dev => {
    const card = document.createElement('div');
    card.className = `card ${dev.status === 'OFFLINE' ? 'offline' : ''}`;

    // Inside renderDevices() loop:
   const isOnline = dev.status === 'ONLINE';
    let controlsHTML = '';

    if (dev.type === 'LIGHT' || dev.type === 'PLUG' || dev.type === 'OTHER') {
      controlsHTML = `
        <button 
          onclick="togglePower('${dev.id}')" 
          class="toggle-btn ${dev.isPoweredOn && isOnline ? 'on' : ''}" 
          ${!isOnline ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          Power: ${dev.isPoweredOn && isOnline ? 'ON' : 'OFF'}
        </button>
      `;
    } else if (dev.type === 'THERMOSTAT') {
      controlsHTML = `
        <div class="temp-controls" style="${!isOnline ? 'opacity: 0.5; pointer-events: none;' : ''}">
          <button onclick="adjustTemp('${dev.id}', -1)" class="temp-btn" ${!isOnline ? 'disabled' : ''}>-</button>
          <span class="temp-val">${dev.targetTemp}°C</span>
          <button onclick="adjustTemp('${dev.id}', 1)" class="temp-btn" ${!isOnline ? 'disabled' : ''}>+</button>
        </div>
      `;
    } else if (dev.type === 'LOCK') {
      controlsHTML = `
        <button 
          onclick="toggleLock('${dev.id}')" 
          class="toggle-btn ${dev.isLocked && isOnline ? 'on' : ''}" 
          ${!isOnline ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          State: ${dev.isLocked ? 'LOCKED' : 'UNLOCKED'}
        </button>
      `;
    } else if (dev.type === 'SENSOR') {
      controlsHTML = `
        <div class="toggle-btn ${dev.isPoweredOn && isOnline ? 'on' : ''}" style="text-align: center; cursor: default; ${!isOnline ? 'opacity: 0.5;' : ''}">
          Status: ${isOnline ? (dev.isPoweredOn ? 'ARMED / ACTIVE' : 'STANDBY') : 'DISCONNECTED'}
        </div>
      `;
    } else if (dev.type === 'CAMERA') {
      controlsHTML = `
        <button 
          onclick="togglePower('${dev.id}')" 
          class="toggle-btn ${dev.isPoweredOn && isOnline ? 'on' : ''}" 
          ${!isOnline ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          Feed: ${isOnline && dev.isPoweredOn ? 'STREAMING' : 'OFFLINE'}
        </button>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="room-tag">${dev.room}</span>
          <span onclick="toggleStatus('${dev.id}')" class="status ${dev.status}" style="cursor: pointer;" title="Click to toggle status">● ${dev.status}</span>
        </div>
        <h3 class="card-title">${dev.name}</h3>
      </div>
      ${controlsHTML}
      <div class="card-footer">
        <button onclick="removeDevice('${dev.id}')" class="unbind-btn">Unbind Device</button>
        <span>ID: ${dev.id}</span>
      </div>
    `;

    grid.appendChild(card);
  });

  // Dynamic Device Count & Operational Percentage Calculation
  const totalCount = devices.length;
  const onlineCount = devices.filter(d => d.status === 'ONLINE').length;
  const percentage = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;

  // Update KPI Card Numbers (e.g. "5 / 5" or "4 / 5")
  const statElement = document.getElementById('stat-active');
  if (statElement) {
    statElement.innerText = `${onlineCount} / ${totalCount}`;
  }

  // Update Operational Percentage Subtext (e.g. "● 100% Operational" or "● 80% Operational")
  const operationalElement = document.getElementById('stat-operational');
  if (operationalElement) {
    operationalElement.innerText = `● ${percentage}% Operational`;
  }
}

async function fetchAndRenderDevices() {
  // 1. Render immediately using local default devices so the UI/buttons never disappear on load
  renderDevices();

  try {
    // 2. Fetch fresh data from backend in the background
    const response = await fetch(`${API_BASE_URL}/devices`);
    const data = await response.json();
    if (data.success && data.devices && data.devices.length > 0) {
      devices = data.devices; 
      renderDevices();       // 3. Re-render with live server data once received
    }
  } catch (error) {
    console.error('Failed to fetch devices from backend:', error);
  }
}

// DEVICE OPERATIONS
async function togglePower(id) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.isPoweredOn = !dev.isPoweredOn;
  addLog(dev.name, 'INFO', `Power toggled to ${dev.isPoweredOn ? 'ON' : 'OFF'}`);
  renderDevices();
  await updateDeviceOnBackend(id, { isPoweredOn: dev.isPoweredOn });
}

async function toggleStatus(id) {
  const dev = devices.find(d => d.id === id);
  if (!dev) return;

  dev.status = dev.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
  
  addLog(
    dev.name, 
    dev.status === 'OFFLINE' ? 'WARNING' : 'INFO', 
    `Device connection state toggled to ${dev.status}`
  );

  renderDevices();
  await updateDeviceOnBackend(id, { status: dev.status });
}

async function adjustTemp(id, delta) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.targetTemp += delta;
  addLog(dev.name, 'INFO', `Target temperature changed to ${dev.targetTemp}°C`);
  renderDevices();
  await updateDeviceOnBackend(id, { targetTemp: dev.targetTemp });
}

async function toggleLock(id) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.isLocked = !dev.isLocked;
  addLog(dev.name, 'INFO', `Door lock set to ${dev.isLocked ? 'LOCKED' : 'UNLOCKED'}`);
  renderDevices();
  await updateDeviceOnBackend(id, { isLocked: dev.isLocked });
}

function removeDevice(id) {
  const dev = devices.find(d => d.id === id);
  if (dev) addLog(dev.name, 'WARNING', 'Device unbound from SHARMS workspace');
  devices = devices.filter(d => d.id !== id);
  renderDevices();
}

function handleRegisterDevice(e) {
  e.preventDefault();
  const nameInput = document.getElementById('reg-name');
  const name = nameInput.value.trim();
  const type = document.getElementById('reg-type').value;
  const room = document.getElementById('reg-room').value;

  // 1. Check for duplicate names in the same room
  const duplicate = devices.find(d => 
    d.name.toLowerCase() === name.toLowerCase() && d.room.toLowerCase() === room.toLowerCase()
  );

  if (duplicate) {
    alert(`A device named "${name}" already exists in ${room}. Please assign a unique name (e.g. "${name} 2").`);
    nameInput.focus();
    return;
  }

  // 2. Generate unique ID using timestamp or max index to avoid collisions after deletion
  const newId = 'dev-' + (Date.now().toString().slice(-4));

  devices.push({ 
    id: newId, 
    name, 
    type, 
    room, 
    status: 'ONLINE', 
    isPoweredOn: true, 
    targetTemp: 22, 
    isLocked: true 
  });

  addLog(name, 'INFO', `New ${type} registered as "${name}" in ${room}`);
  closeModal();
  renderDevices();
}

function filterDevices(room) {
  currentFilter = room;
  document.querySelectorAll('.room-btn').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`filter-${room}`);
  if (targetBtn) targetBtn.classList.add('active');
  renderDevices();
}

// NAVIGATION & TAB SWITCHING
function switchTab(tab) {
  ['dashboard', 'devices', 'resources', 'alerts'].forEach(t => {
    const section = document.getElementById(`view-${t}`);
    const nav = document.getElementById(`nav-${t}`);
    if (section) section.classList.add('hidden');
    if (nav) nav.classList.remove('active');
  });

  const activeSection = document.getElementById(`view-${tab}`);
  const activeNav = document.getElementById(`nav-${tab}`);
  if (activeSection) activeSection.classList.remove('hidden');
  if (activeNav) activeNav.classList.add('active');
}

// LOGGING SYSTEM
// LOGGING SYSTEM (Synced with Backend)
async function addLog(deviceName, severity, message) {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const severityClass = severity ? severity.toLowerCase() : 'info';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="mono-lime">${timeStr}</td>
    <td><span class="entity-badge">${deviceName}</span></td>
    <td><span class="badge-sev ${severityClass}">${severity.toUpperCase()}</span></td>
    <td>${message}</td>
  `;
  tbody.prepend(tr);

  // Send the log data to your Express backend
  try {
    await fetch(`${API_BASE_URL}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sharms_token')}`
      },
      body: JSON.stringify({
        title: deviceName,
        type: severity,
        message: message
      })
    });
  } catch (error) {
    console.error('Failed to sync audit log with backend server:', error);
  }
}

// MODAL CONTROLS
function openModal() { 
  document.getElementById('register-modal').classList.remove('hidden'); 
}

function closeModal() { 
  document.getElementById('register-modal').classList.add('hidden'); 
}

// CHART INITIALIZATION
function initCharts() {
  // Dashboard Live Telemetry
  const dashCanvas = document.getElementById('dashboardChart');
  if (dashCanvas) {
    const ctxDash = dashCanvas.getContext('2d');
    
    // Create soft gradient fill under the telemetry line
    const gradient = ctxDash.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    new Chart(ctxDash, {
      type: 'line',
      data: {
        labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [{
          label: 'Power Demand (kW)',
          data: [1.1, 1.3, 1.8, 1.5, 1.2, 1.45],
          borderColor: '#6366f1',
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#818cf8',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false } // Hidden for a clean modern dashboard card header
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.03)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.03)' } }
        }
      }
    });
  }

  // Energy Breakdown Chart
  // Modernized Multi-Room Energy Chart (Sunset Amber Theme)
  const energyCanvas = document.getElementById('energyChart');
  if (energyCanvas) {
    const ctxEnergy = energyCanvas.getContext('2d');

    const roomColors = {
      'Living Room': { bg: 'rgba(217, 119, 6, 0.85)', border: '#d97706' },  // Sunset Amber
      'Bedroom':     { bg: 'rgba(245, 158, 11, 0.75)', border: '#f59e0b' },  // Amber Accent
      'Entrance':    { bg: 'rgba(16, 185, 129, 0.75)', border: '#10b981' },  // Emerald
      'Kitchen':     { bg: 'rgba(99, 102, 241, 0.75)', border: '#6366f1' }   // Indigo
    };

    new Chart(ctxEnergy, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Living Room',
            data: [4.2, 5.1, 3.8, 4.5, 5.0, 6.2, 5.8],
            backgroundColor: roomColors['Living Room'].bg,
            borderColor: roomColors['Living Room'].border,
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Bedroom',
            data: [2.1, 2.5, 2.0, 2.3, 2.8, 3.4, 3.1],
            backgroundColor: roomColors['Bedroom'].bg,
            borderColor: roomColors['Bedroom'].border,
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Entrance',
            data: [0.8, 0.9, 0.7, 1.0, 1.2, 1.5, 1.1],
            backgroundColor: roomColors['Entrance'].bg,
            borderColor: roomColors['Entrance'].border,
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Kitchen',
            data: [3.5, 4.0, 3.2, 3.9, 4.6, 5.2, 4.8],
            backgroundColor: roomColors['Kitchen'].bg,
            borderColor: roomColors['Kitchen'].border,
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { 
                family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
                size: 13 
              },
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(217, 119, 6, 0.3)',
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', callback: v => `${v} kWh` }
          }
        }
      }
    });
  }
}

// REAL-TIME SYSTEM LOG SEARCH & FILTERING
function filterLogs() {
  const query = document.getElementById('logSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#logs-table-body tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterSeverity(sev) {
  const buttons = document.querySelectorAll('.log-filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (event && event.target) {
    event.target.classList.add('active');
  }

  const rows = document.querySelectorAll('#logs-table-body tr');
  rows.forEach(row => {
    if (sev === 'ALL') {
      row.style.display = '';
    } else {
      const badge = row.querySelector('.badge-sev');
      const isMatch = badge && badge.innerText.trim().toUpperCase() === sev;
      row.style.display = isMatch ? '' : 'none';
    }
  });
}

async function updateDeviceOnBackend(id, updates) {
  try {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sharms_token')}`
      },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (!data.success) {
      console.error('Failed to sync device update to server.');
    }
  } catch (error) {
    console.error('Error communicating with backend server:', error);
  }
}

// --- Three.js 3D Background Animation ---
const canvas = document.getElementById('bg-3d-canvas');
if (canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Create a futuristic wireframe shape (Torus knot or Torus)
  const geometry = new THREE.TorusKnotGeometry(3.5, 1, 100, 16);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0x00d2ff, 
    wireframe: true,
    transparent: true,
    opacity: 0.25 // Subtle ambient background effect
  });
  
  const wireframeMesh = new THREE.Mesh(geometry, material);
  scene.add(wireframeMesh);

  camera.position.z = 9;

  // Mouse movement interaction parallax effect
  let mouseX = 0;
  let mouseY = 0;
  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) - 0.5;
    mouseY = (event.clientY / window.innerHeight) - 0.5;
  });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Auto-rotate shape smoothly
    wireframeMesh.rotation.x += 0.002;
    wireframeMesh.rotation.y += 0.004;

    // Gentle parallax response to mouse movement
    wireframeMesh.position.x += (mouseX * 2 - wireframeMesh.position.x) * 0.05;
    wireframeMesh.position.y += (-mouseY * 2 - wireframeMesh.position.y) * 0.05;

    renderer.render(scene, camera);
  }
  animate();

  // Responsive window resize handling
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/* --- Header 3D Mini Globe Renderer --- */
document.addEventListener('DOMContentLoaded', () => {
  const globeCanvas = document.getElementById('header-3d-globe');
  if (globeCanvas) {
    const globeScene = new THREE.Scene();
    const globeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const globeRenderer = new THREE.WebGLRenderer({ canvas: globeCanvas, alpha: true, antialias: true });

    globeRenderer.setSize(60, 60);
    globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Icosahedron wireframe for a high-tech node core look
    const globeGeometry = new THREE.IcosahedronGeometry(1.8, 2);
    const globeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00d2ff, 
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeScene.add(globeMesh);

    globeCamera.position.z = 4.5;

    function animateGlobe() {
      requestAnimationFrame(animateGlobe);

      globeMesh.rotation.x += 0.005;
      globeMesh.rotation.y += 0.008;

      globeRenderer.render(globeScene, globeCamera);
    }
    animateGlobe();
  }
});


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

// AUTHENTICATION FLOW
function handleLogin(e) {
  e.preventDefault();
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('system-view').classList.remove('hidden');

  renderDevices();
  if (!chartsInitialized) {
    initCharts();
    chartsInitialized = true;
  }
  addLog('Admin Auth', 'INFO', 'User Sushant Singh authenticated successfully.');
}

function handleLogout() {
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

    let controlsHTML = '';
    if (dev.type === 'LIGHT') {
      controlsHTML = `
        <button onclick="togglePower('${dev.id}')" class="toggle-btn ${dev.isPoweredOn ? 'on' : ''}">
          Power: ${dev.isPoweredOn ? 'ON' : 'OFF'}
        </button>
      `;
    } else if (dev.type === 'THERMOSTAT') {
      controlsHTML = `
        <div class="temp-controls">
          <button onclick="adjustTemp('${dev.id}', -1)" class="temp-btn">-</button>
          <span class="temp-val">${dev.targetTemp}°C</span>
          <button onclick="adjustTemp('${dev.id}', 1)" class="temp-btn">+</button>
        </div>
      `;
    } else if (dev.type === 'LOCK') {
      controlsHTML = `
        <button onclick="toggleLock('${dev.id}')" class="toggle-btn ${dev.isLocked ? 'on' : ''}">
          State: ${dev.isLocked ? 'LOCKED' : 'UNLOCKED'}
        </button>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="room-tag">${dev.room}</span>
          <span class="status ${dev.status}">● ${dev.status}</span>
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

  // Update online count metric
  const onlineCount = devices.filter(d => d.status === 'ONLINE').length;
  const statElement = document.getElementById('stat-active');
  if (statElement) {
    statElement.innerText = `${onlineCount} / ${devices.length}`;
  }
}

// DEVICE OPERATIONS
function togglePower(id) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.isPoweredOn = !dev.isPoweredOn;
  addLog(dev.name, 'INFO', `Power toggled to ${dev.isPoweredOn ? 'ON' : 'OFF'}`);
  renderDevices();
}

function adjustTemp(id, delta) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.targetTemp += delta;
  addLog(dev.name, 'INFO', `Target temperature changed to ${dev.targetTemp}°C`);
  renderDevices();
}

function toggleLock(id) {
  const dev = devices.find(d => d.id === id);
  if (!dev || dev.status === 'OFFLINE') return;
  dev.isLocked = !dev.isLocked;
  addLog(dev.name, 'INFO', `Door lock set to ${dev.isLocked ? 'LOCKED' : 'UNLOCKED'}`);
  renderDevices();
}

function removeDevice(id) {
  const dev = devices.find(d => d.id === id);
  if (dev) addLog(dev.name, 'WARNING', 'Device unbound from SHARMS workspace');
  devices = devices.filter(d => d.id !== id);
  renderDevices();
}

function handleRegisterDevice(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const type = document.getElementById('reg-type').value;
  const room = document.getElementById('reg-room').value;

  const newId = 'dev-' + (devices.length + 1);
  devices.push({ id: newId, name, type, room, status: 'ONLINE', isPoweredOn: true, targetTemp: 22, isLocked: true });

  addLog(name, 'INFO', `New device registered and linked to ${room}`);
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
function addLog(deviceName, severity, message) {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  let badgeClass = 'badge-info';
  if (severity === 'WARNING') badgeClass = 'badge-warn';
  if (severity === 'CRITICAL') badgeClass = 'badge-alert';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${timeStr}</td>
    <td>${deviceName}</td>
    <td><span class="badge ${badgeClass}">${severity}</span></td>
    <td>${message}</td>
  `;
  tbody.prepend(tr);
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
    new Chart(ctxDash, {
      type: 'line',
      data: {
        labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [{
          label: 'Power Demand (kW)',
          data: [1.1, 1.3, 1.8, 1.5, 1.2, 1.45],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  // Energy Breakdown Chart
  const energyCanvas = document.getElementById('energyChart');
  if (energyCanvas) {
    const ctxEnergy = energyCanvas.getContext('2d');
    new Chart(ctxEnergy, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Living Room',
          data: [4.2, 5.1, 3.8, 4.5, 5.0, 6.2, 5.8],
          backgroundColor: '#4f46e5'
        }, {
          label: 'Bedroom',
          data: [2.1, 2.5, 2.0, 2.3, 2.8, 3.4, 3.1],
          backgroundColor: '#38bdf8'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
        }
      }
    });
  }
}
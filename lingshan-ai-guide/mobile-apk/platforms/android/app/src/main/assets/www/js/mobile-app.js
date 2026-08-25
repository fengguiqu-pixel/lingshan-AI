// ===== 灵山胜境 AI导游 - 手机版应用逻辑 =====

// 后端 API 地址：浏览器/PWA 用相对路径，Cordova APK 用 config.js 配置的服务器地址
function resolveBackendApi() {
  if (window.location.protocol === 'file:' && typeof window.APP_CONFIG !== 'undefined') {
    const url = (window.getSavedServer ? window.getSavedServer() : window.APP_CONFIG.SERVER_URL) || window.APP_CONFIG.SERVER_URL;
    const base = url.replace(/\/+$/, '');
    return base + '/api';
  }
  return '/api';
}
let BACKEND_API = resolveBackendApi();

let currentTab = 'home';
let currentSpot = null;
let currentUser = null;
let selectedInterests = [];
let isWaitingForAI = false;
let conversationHistory = [];

// 游客位置
let _userLocation = { lat: 31.4295, lng: 120.0870, name: '灵山胜境主入口' };
let _hasLocated = false;

// 地图相关
let _tmap = null;
let _markerLayer = null;
let _tmapInited = false;

// ===== Live2D 数字人辅助 =====
function live2dReady() {
  return !!(window.Live2DGuide && window.Live2DGuide.isReady && window.Live2DGuide.isReady());
}
function live2dSay(text) {
  if (window.Live2DGuide && window.Live2DGuide.say) {
    if (live2dReady()) { window.Live2DGuide.say(text); }
    else if (window.Live2DGuide.onReady) { window.Live2DGuide.onReady(function(){ window.Live2DGuide.say(text); }); }
  }
}
function live2dThink() {
  if (window.Live2DGuide && window.Live2DGuide.think) window.Live2DGuide.think();
}
function live2dStopThink() {
  if (window.Live2DGuide && window.Live2DGuide.stopThink) window.Live2DGuide.stopThink();
}
function live2dSetExpression(expr) {
  if (window.Live2DGuide && window.Live2DGuide.setExpression) window.Live2DGuide.setExpression(expr);
}
function updateLive2DPanelMode(tab) {
  var panel = document.getElementById('live2d-character');
  if (!panel) return;
  panel.classList.remove('chat-stage', 'map-stage');
  if (tab === 'chat') {
    panel.classList.add('chat-stage');
    panel.classList.remove('hidden');
  } else if (tab === 'map') {
    panel.classList.add('map-stage');
    panel.classList.remove('hidden');
  } else if (tab === 'profile') {
    panel.classList.add('hidden');
  } else {
    // 首页等：小浮窗
    panel.classList.remove('hidden');
  }
  if (window.Live2DGuide && window.Live2DGuide.resize) {
    setTimeout(function(){ window.Live2DGuide.resize(); }, 300);
  }
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
  loadCurrentUser();
  initSplash();
  renderHome();
  renderProfileInterests();
  initChat();
  updateProfileUI();
  registerSW();
  // 初始化 Live2D 面板模式（延迟等面板创建完成）
  setTimeout(function(){ updateLive2DPanelMode('home'); }, 500);
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function initSplash() {
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    // Cordova/APK 模式下询问服务器地址
    if (window.location.protocol === 'file:') {
      ensureServerUrl();
    }
  }, 1400);
}

function ensureServerUrl() {
  let saved = (typeof window.getSavedServer === 'function') ? window.getSavedServer() : (window.APP_CONFIG?.SERVER_URL || '');
  if (!saved || saved === 'http://192.168.1.100:3000') {
    const defaultUrl = saved || 'http://192.168.1.100:3000';
    const input = prompt(
      '首次启动，请输入电脑端服务器地址（手机和电脑需连同一WiFi）：\n\n例如 http://192.168.0.8:3000',
      defaultUrl
    );
    if (!input) return;
    saved = input.replace(/\/+$/, '');
    if (typeof window.saveServer === 'function') window.saveServer(saved);
  }
  BACKEND_API = saved.replace(/\/+$/, '') + '/api';
}

// ===== 底部 Tab 切换 =====
function switchTab(tab) {
  if (tab === currentTab && tab !== 'detail') return;

  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // 显示目标页
  const target = document.getElementById('page-' + tab);
  if (target) target.classList.add('active');

  // 更新 tab 高亮
  document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  currentTab = tab;
  updateHeader(tab);
  updateLive2DPanelMode(tab);

  if (tab === 'map') {
    setTimeout(initTencentMap, 200);
  } else if (tab === 'chat') {
    setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
  }

  window.scrollTo(0, 0);
}

function navigateTo(page) {
  if (page === 'detail') return;
  if (['home', 'map', 'chat', 'profile'].includes(page)) {
    switchTab(page);
  }
}

function updateHeader(tab) {
  const titles = {
    home: '灵山胜境',
    map: '景点地图',
    chat: '问小灵',
    profile: '我的'
  };
  document.getElementById('headerTitle').textContent = titles[tab] || '灵山胜境';
}

// ===== 首页渲染 =====
function renderHome() {
  const hour = new Date().getHours();
  let greet = '您好';
  if (hour < 12) greet = '上午好';
  else if (hour < 18) greet = '下午好';
  else greet = '晚上好';
  const name = currentUser ? currentUser.username : '游客';
  document.getElementById('homeGreeting').textContent = `${greet}，${name}，欢迎来到灵山胜境`;

  // 热门景点横向滚动
  const scroll = document.getElementById('homeSpotScroll');
  scroll.innerHTML = SCENIC_SPOTS.map((spot, i) => `
    <div class="spot-card" onclick="openDetail(${i})">
      <div class="spot-card-img" style="background-image:linear-gradient(135deg, ${spot.heroGradient || '#1a1a2e'} 0%, ${spot.tagColor}33 100%)">
        <div class="spot-card-num" style="background:${spot.tagColor}">${i + 1}</div>
      </div>
      <div class="spot-card-body">
        <div class="spot-card-name">${spot.name}</div>
        <div class="spot-card-tag">${spot.tag}</div>
        <button class="spot-card-btn">查看详情</button>
      </div>
    </div>
  `).join('');

  // 推荐路线
  const routeList = document.getElementById('homeRouteList');
  routeList.innerHTML = ROUTES.map(route => `
    <div class="route-card">
      <div class="route-card-header">
        <div class="route-card-name">${route.name}</div>
        <div class="route-card-meta">
          <span class="route-badge">⏱ ${route.duration}</span>
          <span class="route-badge" style="background:${route.difficultyColor}22;color:${route.difficultyColor}">${route.difficulty}</span>
        </div>
      </div>
      <div class="route-card-desc">${route.description}</div>
      <div class="route-stops">
        ${route.stops.slice(0, 3).map(stop => `
          <div class="route-stop">
            <div class="route-stop-time">${stop.time}</div>
            <div>
              <div class="route-stop-spot">${stop.spot}</div>
              <div class="route-stop-activity">${stop.activity}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // 票务
  const ticketList = document.getElementById('homeTicketList');
  ticketList.innerHTML = `
    <li>🎫 <span>成人通票</span>：${TICKET_INFO.price}</li>
    <li>👶 <span>半价票</span>：${TICKET_INFO.halfPrice}</li>
    <li>🆓 <span>免票政策</span>：${TICKET_INFO.free}</li>
    <li>🕐 <span>开放时间</span>：${TICKET_INFO.openTime}</li>
  `;

  // 数据
  const statsGrid = document.getElementById('homeStatsGrid');
  statsGrid.innerHTML = STATS.map(s => `
    <div class="stat-card">
      <div><span class="stat-value">${s.value}</span><span class="stat-unit">${s.unit}</span></div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

function focusSearch() {
  navigateTo('chat');
  setTimeout(() => {
    const input = document.getElementById('chatInput');
    input.placeholder = '搜索景点、路线、问题...';
    input.focus();
  }, 300);
}

function scrollToRoutes() {
  document.getElementById('routesSection').scrollIntoView({ behavior: 'smooth' });
}

function scrollToTickets() {
  document.getElementById('ticketsSection').scrollIntoView({ behavior: 'smooth' });
}

// ===== 地图 =====
function parseCoords(coordStr) {
  const m = coordStr.match(/([\d.]+)°N,\s*([\d.]+)°E/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return { lat: 31.4273, lng: 120.0833 };
}

function haversineDistance(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(m) {
  if (m < 1000) return Math.round(m) + ' 米';
  return (m / 1000).toFixed(2) + ' 公里';
}

function walkMinutes(m) {
  return Math.ceil(m / (5000 / 60));
}

function initTencentMap() {
  if (typeof TMap === 'undefined') {
    setTimeout(initTencentMap, 500);
    return;
  }

  const container = document.getElementById('tencentMap');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    setTimeout(initTencentMap, 300);
    return;
  }

  if (_tmapInited && _tmap) {
    _tmap.resize?.();
    return;
  }

  try {
    const center = new TMap.LatLng(31.4271, 120.1000);
    _tmap = new TMap.Map(container, {
      center: center,
      zoom: 16,
      maxZoom: 19,
      minZoom: 14,
      pitch: 0,
      rotation: 0,
      mapTypeId: 'roadmap'
    });
    _tmapInited = true;

    window.addEventListener('resize', () => _tmap?.resize?.(), { passive: true });
    [100, 300, 600].forEach(d => setTimeout(() => _tmap?.resize?.(), d));

    const geometries = SCENIC_SPOTS.map((spot, i) => {
      const c = parseCoords(spot.coordinates);
      return { id: String(i), position: new TMap.LatLng(c.lat, c.lng) };
    });

    _markerLayer = new TMap.MultiMarker({
      map: _tmap,
      styles: {
        default: new TMap.MarkerStyle({ width: 28, height: 36, anchor: { x: 14, y: 36 }, color: '#C8A357' }),
        active: new TMap.MarkerStyle({ width: 34, height: 44, anchor: { x: 17, y: 44 }, color: '#E54D2E' })
      },
      geometries: geometries.map(g => ({ ...g, styleId: 'default' }))
    });

    _markerLayer.on('click', evt => {
      const idx = parseInt(evt.geometry.id);
      onMarkerClick(idx);
    });

    // 默认用户位置标记
    addUserLocationMarker(_userLocation);

    console.log('[Mobile Map] 腾讯地图初始化完成');
  } catch (err) {
    console.error('[Mobile Map] 初始化失败:', err);
    _tmapInited = false;
    setTimeout(initTencentMap, 800);
  }
}

function addUserLocationMarker(loc) {
  if (!_tmap) return;
  const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56" width="40" height="56">' +
    '<path d="M20 2 C 11 16, 5 26, 5 36 A 15 15 0 0 0 35 36 C 35 26, 29 16, 20 2 Z" fill="#1976D2" stroke="#FFFFFF" stroke-width="2.5"/>' +
    '<circle cx="20" cy="34" r="5.5" fill="#FFFFFF"/><circle cx="20" cy="34" r="2.8" fill="#1976D2"/></svg>'
  );
  new TMap.MultiMarker({
    map: _tmap,
    styles: {
      me: new TMap.MarkerStyle({ width: 36, height: 50, src: svg, anchor: { x: 18, y: 48 } })
    },
    geometries: [{ id: 'me', styleId: 'me', position: new TMap.LatLng(loc.lat, loc.lng) }]
  });
}

function onMarkerClick(index) {
  currentSpot = SCENIC_SPOTS[index];
  const spot = currentSpot;
  const card = document.getElementById('mapSpotCard');
  card.style.display = 'block';
  document.getElementById('mapSpotNum').textContent = index + 1;
  document.getElementById('mapSpotNum').style.background = spot.tagColor;
  document.getElementById('mapSpotName').textContent = spot.name;
  document.getElementById('mapSpotTag').textContent = spot.tag;
  document.getElementById('mapSpotDesc').textContent = spot.description.substring(0, 90) + '...';

  const c = parseCoords(spot.coordinates);
  const d = haversineDistance(_userLocation, c);
  document.getElementById('mapSpotDistance').textContent = `距您 ${formatDistance(d)} · 步行约 ${walkMinutes(d)} 分钟`;

  const c2 = parseCoords(spot.coordinates);
  _tmap?.panTo(new TMap.LatLng(c2.lat, c2.lng));
}

function closeMapCard() {
  document.getElementById('mapSpotCard').style.display = 'none';
}

function openSpotDetailFromMap() {
  if (!currentSpot) return;
  const idx = SCENIC_SPOTS.indexOf(currentSpot);
  openDetail(idx);
}

function locateMe() {
  const btn = document.getElementById('locateBtn');
  btn.classList.add('locating');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const inLingshan = lat > 31.40 && lat < 31.45 && lng > 120.06 && lng < 120.12;
        if (inLingshan) {
          _userLocation = { lat, lng, name: 'GPS 当前位置' };
        }
        _hasLocated = true;
        applyUserLocation();
        btn.classList.remove('locating');
      },
      () => {
        _hasLocated = true;
        applyUserLocation();
        btn.classList.remove('locating');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  } else {
    _hasLocated = true;
    applyUserLocation();
    btn.classList.remove('locating');
  }
}

function applyUserLocation() {
  if (_tmap) {
    addUserLocationMarker(_userLocation);
    _tmap.panTo(new TMap.LatLng(_userLocation.lat, _userLocation.lng));
  }
  if (currentSpot) {
    const c = parseCoords(currentSpot.coordinates);
    const d = haversineDistance(_userLocation, c);
    document.getElementById('mapSpotDistance').textContent = `距您 ${formatDistance(d)} · 步行约 ${walkMinutes(d)} 分钟`;
  }
}

function navigateToNearest() {
  if (!_hasLocated) {
    locateMe();
    return;
  }
  let nearest = -1, minDist = Infinity;
  SCENIC_SPOTS.forEach((spot, i) => {
    const c = parseCoords(spot.coordinates);
    const d = haversineDistance(_userLocation, c);
    if (d < minDist) { minDist = d; nearest = i; }
  });
  if (nearest >= 0) {
    switchTab('map');
    setTimeout(() => onMarkerClick(nearest), 400);
    // 数字人语音引导
    live2dSay('距您最近的景点是「' + SCENIC_SPOTS[nearest].name + '」，我带您过去~');
  }
}

function startWalkNav() {
  if (!currentSpot) return;
  const c = parseCoords(currentSpot.coordinates);
  const url = 'https://apis.map.qq.com/uri/v1/routeplan?type=walk' +
    '&from=' + encodeURIComponent('我的位置') +
    '&fromcoord=' + _userLocation.lat + ',' + _userLocation.lng +
    '&to=' + encodeURIComponent(currentSpot.name) +
    '&tocoord=' + c.lat + ',' + c.lng +
    '&policy=1';
  window.open(url, '_blank');
}

// ===== 景点详情 =====
function openDetail(index) {
  currentSpot = SCENIC_SPOTS[index];
  const spot = currentSpot;

  document.getElementById('detailHero').style.backgroundImage = `linear-gradient(135deg, ${spot.heroGradient || '#1a1a2e'} 0%, ${spot.tagColor}22 100%)`;
  document.getElementById('detailTag').textContent = spot.tag;
  document.getElementById('detailTag').style.background = spot.tagColor;
  document.getElementById('detailName').textContent = spot.name;
  document.getElementById('detailSubtitle').textContent = spot.subtitle;

  document.getElementById('detailInfoBar').innerHTML = `
    <div class="detail-info-item">⏱ 游览时间<strong>${spot.duration}</strong></div>
    <div class="detail-info-item">🌟 最佳时间<strong>${spot.bestTime}</strong></div>
    <div class="detail-info-item">⭐ 评分<strong>${spot.rating}</strong></div>
  `;

  document.getElementById('detailDesc').textContent = spot.description;
  document.getElementById('detailHighlights').innerHTML = spot.highlights.map(h => `
    <div class="highlight-item">
      <div class="highlight-icon">${h.icon}</div>
      <div>
        <div class="highlight-title">${h.title}</div>
        <div class="highlight-text">${h.text}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('detailTips').innerHTML = spot.tips.map(t => `
    <div class="tip-item">
      <div class="tip-icon">${t.icon}</div>
      <div>
        <div class="tip-title">${t.title}</div>
        <div class="tip-text">${t.text}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('page-detail').classList.add('active');
  document.getElementById('tabBar').style.display = 'none';

  // 详情页隐藏 Live2D 浮窗（避免遮挡内容）
  var l2dPanel = document.getElementById('live2d-character');
  if (l2dPanel) l2dPanel.style.display = 'none';

  // 数字人介绍景点
  live2dSetExpression('smile');
  live2dSay('欢迎来到' + spot.name + '！' + spot.description.substring(0, 60));
}

function closeDetail() {
  document.getElementById('page-detail').classList.remove('active');
  document.getElementById('tabBar').style.display = 'flex';
  // 恢复 Live2D 浮窗
  var l2dPanel = document.getElementById('live2d-character');
  if (l2dPanel) l2dPanel.style.display = '';
}

// ===== AI 聊天 =====
const QUICK_QUESTIONS = [
  '灵山大佛有多高？',
  '推荐一条亲子游览路线',
  '灵山梵宫有什么看点？',
  '门票多少钱？',
  '九龙灌浴几点开始？'
];

function initChat() {
  const messages = document.getElementById('chatMessages');
  const welcome = '您好！我是小灵，灵山胜境AI数字人导游 🧘\n\n很高兴为您服务！我可以为您：\n• 介绍五大景点详情\n• 推荐个性化游览路线\n• 解答票务、交通等问题\n\n请问有什么可以帮您的？';
  addChatMessage('ai', welcome);

  // 数字人说欢迎语
  live2dSetExpression('wave');
  live2dSay('您好！我是小灵，灵山胜境AI数字人导游，很高兴为您服务！');

  const quick = document.getElementById('chatQuick');
  quick.innerHTML = QUICK_QUESTIONS.map(q => `
    <button class="quick-chip" onclick="askQuick('${q}')">${q}</button>
  `).join('');
}

function askQuick(question) {
  document.getElementById('chatInput').value = question;
  sendChat();
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isWaitingForAI) return;

  addChatMessage('user', text);
  input.value = '';
  isWaitingForAI = true;
  showThinking();
  live2dThink();

  callBackendChat(text).then(reply => {
    removeThinking();
    addChatMessage('ai', reply);
    live2dStopThink();
    live2dSay(reply);
  }).catch(err => {
    removeThinking();
    addChatMessage('ai', '抱歉，我暂时无法连接到AI服务，请稍后再试。😔 您可以拨打景区客服热线 400-828-9766 获取帮助。');
    live2dStopThink();
  }).finally(() => {
    isWaitingForAI = false;
  });
}

async function callBackendChat(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });
  const personalizedContext = sessionStorage.getItem('ls_mobile_personalized') || '';

  try {
    const resp = await fetch(BACKEND_API + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        user_id: currentUser ? currentUser.username : 'guest',
        history: conversationHistory.slice(-20),
        preferences: personalizedContext
      })
    });
    if (!resp.ok) throw new Error('API error: ' + resp.status);
    const data = await resp.json();
    const reply = data.reply || '小灵正在学习中，暂时无法回答这个问题。';
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[Chat] 失败:', err);
    throw err;
  }
}

function addChatMessage(type, text) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-message ' + type;
  const avatar = type === 'ai' ? '🧘‍♀️' : '👤';
  div.innerHTML = `
    <div class="chat-avatar-mini">${avatar}</div>
    <div class="chat-bubble ${type}">${text.replace(/\n/g, '<br>')}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showThinking() {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-message ai';
  div.id = 'chatThinking';
  div.innerHTML = `
    <div class="chat-avatar-mini">🧘‍♀️</div>
    <div class="chat-bubble ai chat-thinking"><span></span><span></span><span></span></div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeThinking() {
  const el = document.getElementById('chatThinking');
  if (el) el.remove();
}

// ===== 用户认证 =====
function loadCurrentUser() {
  const saved = localStorage.getItem('ls_mobile_user');
  currentUser = saved ? JSON.parse(saved) : null;
}

function updateProfileUI() {
  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const btn = document.getElementById('profileLoginBtn');
  if (currentUser) {
    nameEl.textContent = currentUser.username;
    emailEl.textContent = currentUser.email || '';
    btn.textContent = '退出登录';
    btn.onclick = logout;
  } else {
    nameEl.textContent = '游客';
    emailEl.textContent = '登录后可同步偏好';
    btn.textContent = '登录 / 注册';
    btn.onclick = toggleLoginPanel;
  }
}

function toggleLoginPanel() {
  const panel = document.getElementById('loginPanel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display === 'flex') {
    document.getElementById('loginMsg').textContent = '';
    document.getElementById('registerMsg').textContent = '';
  }
}

function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  if (tab === 'login') {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginTitle').textContent = '登录';
  } else {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginTitle').textContent = '注册';
  }
}

function showLoginMsg(form, text, type) {
  const el = document.getElementById(form + 'Msg');
  el.textContent = text;
  el.className = 'login-msg ' + type;
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) {
    showLoginMsg('login', '请填写完整信息', 'error');
    return;
  }
  const users = JSON.parse(localStorage.getItem('ls_mobile_users') || '[]');
  const user = users.find(u => (u.username === username || u.email === username) && u.password === password);
  if (!user) {
    showLoginMsg('login', '用户名或密码错误', 'error');
    return;
  }
  currentUser = { username: user.username, email: user.email };
  localStorage.setItem('ls_mobile_user', JSON.stringify(currentUser));
  showLoginMsg('login', '登录成功！', 'success');
  updateProfileUI();
  renderHome();
  setTimeout(toggleLoginPanel, 600);
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;

  if (!username || !email || !password || !confirm) {
    showLoginMsg('register', '请填写所有字段', 'error'); return;
  }
  if (username.length < 2 || username.length > 16) {
    showLoginMsg('register', '用户名长度2-16字符', 'error'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showLoginMsg('register', '邮箱格式不正确', 'error'); return;
  }
  if (password.length < 6 || password.length > 20) {
    showLoginMsg('register', '密码长度6-20位', 'error'); return;
  }
  if (password !== confirm) {
    showLoginMsg('register', '两次密码不一致', 'error'); return;
  }

  const users = JSON.parse(localStorage.getItem('ls_mobile_users') || '[]');
  if (users.some(u => u.username === username)) {
    showLoginMsg('register', '用户名已存在', 'error'); return;
  }
  if (users.some(u => u.email === email)) {
    showLoginMsg('register', '邮箱已注册', 'error'); return;
  }

  users.push({ username, email, password });
  localStorage.setItem('ls_mobile_users', JSON.stringify(users));
  currentUser = { username, email };
  localStorage.setItem('ls_mobile_user', JSON.stringify(currentUser));
  showLoginMsg('register', '注册成功！', 'success');
  updateProfileUI();
  renderHome();
  setTimeout(toggleLoginPanel, 600);
}

function logout() {
  if (confirm('确定要退出登录吗？')) {
    localStorage.removeItem('ls_mobile_user');
    currentUser = null;
    updateProfileUI();
    renderHome();
  }
}

// ===== 兴趣标签 =====
const INTEREST_TAGS = [
  { id: 'history', emoji: '🏛️', label: '历史文化' },
  { id: 'nature', emoji: '🌿', label: '自然风光' },
  { id: 'architecture', emoji: '🏗️', label: '建筑艺术' },
  { id: 'buddhism', emoji: '🙏', label: '佛教文化' },
  { id: 'photo', emoji: '📸', label: '摄影打卡' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', label: '亲子同游' },
  { id: 'zen', emoji: '🍵', label: '禅意慢游' },
  { id: 'food', emoji: '🍜', label: '美食体验' }
];

function renderProfileInterests() {
  const saved = localStorage.getItem('ls_mobile_interests');
  selectedInterests = saved ? JSON.parse(saved) : [];
  const grid = document.getElementById('profileInterests');
  grid.innerHTML = INTEREST_TAGS.map(tag => `
    <button class="interest-chip ${selectedInterests.includes(tag.id) ? 'selected' : ''}" onclick="toggleInterest('${tag.id}')">
      ${tag.emoji} ${tag.label}
    </button>
  `).join('');
}

function toggleInterest(id) {
  const idx = selectedInterests.indexOf(id);
  if (idx === -1) selectedInterests.push(id);
  else selectedInterests.splice(idx, 1);
  renderProfileInterests();
}

function saveInterests() {
  localStorage.setItem('ls_mobile_interests', JSON.stringify(selectedInterests));
  // 生成个性化上下文
  const contexts = {
    history: '游客对历史文化非常感兴趣，请重点讲解历史背景、建造故事、时代变迁。',
    nature: '游客热爱自然风光，请重点介绍自然景观特色、四季变化、最佳拍照取景位。',
    architecture: '游客对建筑艺术有浓厚兴趣，请重点讲解建筑风格、设计理念、材料工艺。',
    buddhism: '游客对佛教文化非常虔诚，请重点讲解佛教教义、礼仪仪式、祈福方式。',
    photo: '游客是摄影爱好者，请重点推荐最佳拍摄机位、最佳时间、取景角度技巧。',
    family: '游客是亲子家庭出行，请采用亲切活泼的语气，推荐互动性强的景点和活动。',
    zen: '游客追求慢节奏禅意旅行，请采用温和从容的语气，讲解重点放在心灵体验。',
    food: '游客对美食很感兴趣，请多推荐灵山素斋特色菜品、品茶体验、无锡本地美食。'
  };
  const ctx = selectedInterests.map(id => contexts[id]).filter(Boolean).join('\n');
  sessionStorage.setItem('ls_mobile_personalized', ctx);
  alert('兴趣偏好已保存！小灵会优先按您的喜好讲解。');
}

// ===== 页面返回键处理 =====
window.addEventListener('popstate', function(e) {
  const detail = document.getElementById('page-detail');
  if (detail.classList.contains('active')) {
    closeDetail();
  }
});

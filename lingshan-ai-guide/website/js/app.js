// ===== 灵山胜境 AI数字人导游系统 - 应用逻辑 =====

// 当前状态
let currentPage = 'home';
let currentSpotIndex = 0;

// ===== 初始化 =====
function init() {
  updateNavUserBtn();
  renderParticles();
  renderStats();
  renderAIGuideFeatures();
  renderMapSpotGrid();
  renderRoutes();
  renderTicketInfo();
  initChat();
  initMapChatDrag();
  navigateTo('home');
}

// ===== 导航 =====
function navigateTo(page, params) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // 显示目标页面
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) {
    targetPage.classList.add('active');
    currentPage = page;
  }

  // 更新导航高亮
  document.querySelectorAll('.nav-menu a').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === page);
  });

  // 特殊页面处理
  if (page === 'detail' && params !== undefined) {
    currentSpotIndex = params;
    renderDetail(params);
  }

  // Live2D 面板模式切换
  const l2dPanel = document.getElementById('live2d-character');
  if (l2dPanel) {
    // 先移除所有特殊模式
    l2dPanel.classList.remove('hero-mode', 'map-stage', 'ai-chat-stage');
  }

  if (page === 'ai-chat') {
    if (l2dPanel) {
      // AI 导游页：数字人放到右侧
      l2dPanel.classList.add('ai-chat-stage');
      l2dPanel.classList.remove('hidden');
      setTimeout(() => window.Live2DGuide?.resize(), 400);
    }
    setTimeout(() => {
      document.getElementById('chatInput')?.focus();
    }, 300);
  } else if (page === 'map') {
    // 景点导览页：数字人进入 map-stage 模式
    if (l2dPanel) {
      l2dPanel.classList.add('map-stage');
      l2dPanel.classList.remove('hidden');
      setTimeout(() => window.Live2DGuide?.resize(), 400);
    }
    // 默认显示地图模式
    switchMapMode('map');
    // 初始化腾讯地图
    setTimeout(() => initTencentMap(), 500);
    // 初始化地图页常驻对话
    setTimeout(() => initMapChat(), 600);
  } else {
    // 其他页面：恢复默认小浮窗
    if (l2dPanel) {
      l2dPanel.classList.remove('hidden');
      setTimeout(() => window.Live2DGuide?.resize(), 200);
    }
  }

  // 滚动到顶部
  window.scrollTo(0, 0);
}

// ===== 首页 - 粒子动画 =====
function renderParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (8 + Math.random() * 12) + 's';
    particle.style.animationDelay = Math.random() * 10 + 's';
    particle.style.width = (2 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;
    particle.style.opacity = 0.3 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}

// ===== 首页 - 统计数据 =====
function renderStats() {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  grid.innerHTML = STATS.map(s => `
    <div class="stat-card">
      <div>
        <span class="stat-value">${s.value}</span><span class="stat-unit">${s.unit}</span>
      </div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

// ===== 首页 - AI导游功能 =====
function renderAIGuideFeatures() {
  const container = document.getElementById('aiGuideFeatures');
  if (!container) return;
  container.innerHTML = AI_GUIDE_INTRO.features.map(f => `
    <div class="ai-feature">
      <div class="ai-feature-icon">${f.icon}</div>
      <div class="ai-feature-content">
        <h4>${f.title}</h4>
        <p>${f.text}</p>
      </div>
    </div>
  `).join('');
}

// ===== 景点导览 - 模式切换（地图 / 景点列表） =====
function switchMapMode(mode) {
  const mapBtn = document.getElementById('sidebarMapBtn');
  const listBtn = document.getElementById('sidebarListBtn');
  const mapContent = document.getElementById('mapContent');
  const listContent = document.getElementById('mapListContent');
  const l2dPanel = document.getElementById('live2d-character');

  if (mode === 'map') {
    mapBtn.classList.add('active');
    listBtn.classList.remove('active');
    mapContent.style.setProperty('display', 'flex', 'important');
    listContent.style.setProperty('display', 'none', 'important');
    listContent.classList.remove('active');
    // 数字人保持在 map-stage 模式
    if (l2dPanel) {
      l2dPanel.classList.add('map-stage');
      l2dPanel.classList.remove('hidden');
      setTimeout(() => window.Live2DGuide?.resize(), 300);
    }
    // 确保地图已初始化
    setTimeout(() => initTencentMap(), 300);
  } else {
    listBtn.classList.add('active');
    mapBtn.classList.remove('active');
    mapContent.style.setProperty('display', 'none', 'important');
    listContent.style.setProperty('display', 'block', 'important');
    listContent.classList.add('active');
    // 列表模式下数字人回到默认小浮窗
    if (l2dPanel) {
      l2dPanel.classList.remove('map-stage');
      setTimeout(() => window.Live2DGuide?.resize(), 300);
    }
  }
}

// ===== 腾讯地图初始化 =====
let _tmap = null;
let _markerLayer = null;
let _tmapInited = false;
let _userLocationMarker = null;   // 游客位置水滴标记
let _userLocationLatLng = null;   // 游客当前位置 {lat, lng}
let _userLocationLabel = null;    // 游客位置文字标签

// 默认虚拟游客位置：灵山胜境主入口（位于景区北侧马山路上）
// 落在景区内且不与其他标记重叠，方便演示步行距离
const DEFAULT_USER_LOCATION = { lat: 31.4295, lng: 120.0870, name: '灵山胜境主入口' };

// 两点间球面距离（Haversine），单位米
function haversineDistance(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat/2) ** 2 + Math.sin(dLng/2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(m) {
  if (m < 1000) return Math.round(m) + ' 米';
  return (m / 1000).toFixed(2) + ' 公里';
}

// 估算步行时间（按 5km/h 慢步）
function walkMinutes(m) {
  return Math.ceil(m / (5000 / 60));
}

function parseCoords(coordStr) {
  // "31.4270°N, 120.0830°E" -> { lat, lng }
  const m = coordStr.match(/([\d.]+)°N,\s*([\d.]+)°E/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return { lat: 31.4273, lng: 120.0833 };
}

function initTencentMap() {
  // 等待 TMap 加载完成
  if (typeof TMap === 'undefined') {
    console.log('[Map] TMap SDK 尚未加载，等待中...');
    setTimeout(initTencentMap, 500);
    return;
  }

  const mapContainer = document.getElementById('tencentMap');
  if (!mapContainer) return;

  // 确保容器已经可见且有尺寸；如果还在 display:none 或高度为0，则稍后重试
  const rect = mapContainer.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[Map] 容器尚未就绪，稍后重试...', rect);
    setTimeout(initTencentMap, 300);
    return;
  }

  if (_tmapInited && _tmap) {
    _tmap.resize?.();
    return;
  }

  try {
    // 灵山胜境中心点
    const center = new TMap.LatLng(31.4271, 120.1000);

    _tmap = new TMap.Map(mapContainer, {
      center: center,
      zoom: 17,
      maxZoom: 19,
      minZoom: 14,
      pitch: 0,
      rotation: 0,
      mapTypeId: 'roadmap'
    });

    _tmapInited = true;

    // 窗口大小变化时重新计算地图尺寸
    window.addEventListener('resize', function() {
      if (_tmap && _tmap.resize) _tmap.resize();
    }, { passive: true });

    // 多次延迟 resize，确保容器布局稳定后地图填满
    [100, 300, 600, 1000].forEach(function(delay) {
      setTimeout(function() {
        if (_tmap && _tmap.resize) {
          _tmap.resize();
          console.log('[Map] resized after ' + delay + 'ms');
        }
      }, delay);
    });

    // 添加5个景点标记
    const geometries = SCENIC_SPOTS.map(function(spot, i) {
      const c = parseCoords(spot.coordinates);
      return {
        id: String(i),
        position: new TMap.LatLng(c.lat, c.lng)
      };
    });

    _markerLayer = new TMap.MultiMarker({
      map: _tmap,
      styles: {
        default: new TMap.MarkerStyle({
          width: 28,
          height: 36,
          anchor: { x: 14, y: 36 },
          color: '#C8A357'
        }),
        active: new TMap.MarkerStyle({
          width: 36,
          height: 46,
          anchor: { x: 18, y: 46 },
          color: '#E54D2E'
        })
      },
      geometries: geometries.map(function(g) {
        return Object.assign({}, g, { styleId: 'default' });
      })
    });

    // 点击标记事件
    _markerLayer.on('click', function(evt) {
      const index = parseInt(evt.geometry.id);
      onMarkerClick(index);
    });

    // 添加游客位置水滴标记（默认就在景区内显示）
    addUserLocationMarker(DEFAULT_USER_LOCATION);

    console.log('[Map] 腾讯地图初始化完成');
  } catch (err) {
    console.error('[Map] 腾讯地图初始化失败:', err);
    _tmap = null;
    _tmapInited = false;
    setTimeout(initTencentMap, 800);
  }
}

// ===== 游客位置（水滴状标记） =====
function makeUserLocationSvg() {
  // 蓝色水滴 + 白色内圈 + 阴影，凸显"我的位置"
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56" width="40" height="56">' +
      '<defs>' +
        '<filter id="ds" x="-50%" y="-30%" width="200%" height="200%">' +
          '<feGaussianBlur stdDeviation="1.5" result="b"/>' +
          '<feOffset in="b" dx="0" dy="2" result="o"/>' +
          '<feComponentTransfer in="o" result="t"><feFuncA type="linear" slope="0.45"/></feComponentTransfer>' +
          '<feMerge><feMergeNode in="t"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
      '</defs>' +
      '<path filter="url(#ds)" ' +
            'd="M20 2 C 11 16, 5 26, 5 36 A 15 15 0 0 0 35 36 C 35 26, 29 16, 20 2 Z" ' +
            'fill="#1976D2" stroke="#FFFFFF" stroke-width="2.5"/>' +
      '<circle cx="20" cy="34" r="5.5" fill="#FFFFFF"/>' +
      '<circle cx="20" cy="34" r="2.8" fill="#1976D2"/>' +
    '</svg>'
  );
}

function addUserLocationMarker(loc) {
  if (!_tmap) return;
  _userLocationLatLng = { lat: loc.lat, lng: loc.lng };

  if (_userLocationMarker) {
    // 已存在则更新位置
    _userLocationMarker.setGeometries([{ id: 'me', position: new TMap.LatLng(loc.lat, loc.lng) }]);
  } else {
    _userLocationMarker = new TMap.MultiMarker({
      map: _tmap,
      styles: {
        me: new TMap.MarkerStyle({
          width: 40,
          height: 56,
          src: makeUserLocationSvg(),
          anchor: { x: 20, y: 54 }
        })
      },
      geometries: [{
        id: 'me',
        styleId: 'me',
        position: new TMap.LatLng(loc.lat, loc.lng)
      }]
    });

    _userLocationMarker.on('click', function() {
      onUserLocationClick();
    });
  }

  // 在水滴下方放置一个"我的位置"小标签
  if (typeof TMap !== 'undefined' && TMap.MultiLabel) {
    if (_userLocationLabel) {
      _userLocationLabel.setGeometries([{
        id: 'meLabel',
        position: new TMap.LatLng(loc.lat, loc.lng),
        content: '我的位置 · ' + (loc.name || '')
      }]);
    } else {
      try {
        _userLocationLabel = new TMap.MultiLabel({
          map: _tmap,
          styles: {
            meLabel: new TMap.LabelStyle({
              color: '#1976D2',
              size: 13,
              fontWeight: 700,
              backgroundColor: 'rgba(255,255,255,0.95)',
              borderColor: '#1976D2',
              borderWidth: 1.5,
              borderRadius: 6,
              padding: { x: 8, y: 4 }
            })
          },
          geometries: [{
            id: 'meLabel',
            styleId: 'meLabel',
            position: new TMap.LatLng(loc.lat, loc.lng),
            content: '我的位置 · ' + (loc.name || ''),
            offset: { x: 0, y: -60 }
          }]
        });
      } catch (e) {
        console.warn('[Map] MultiLabel 不可用，跳过文字标签:', e);
      }
    }
  }
}

function onUserLocationClick() {
  if (!_tmap || !_userLocationLatLng) return;
  _tmap.panTo(new TMap.LatLng(_userLocationLatLng.lat, _userLocationLatLng.lng));
  updateSpotDistances();
}

// 更新所有景点到游客位置的距离，并刷新 UI
function updateSpotDistances() {
  if (!_userLocationLatLng) return;
  // 浮层距离更新
  const distEl = document.getElementById('mapSpotDistance');
  const walkBtn = document.getElementById('mapSpotWalkBtn');
  if (window._currentSpotIndex != null) {
    const spot = SCENIC_SPOTS[window._currentSpotIndex];
    const c = parseCoords(spot.coordinates);
    const d = haversineDistance(_userLocationLatLng, c);
    if (distEl) {
      distEl.style.display = 'flex';
      distEl.textContent = '距您 ' + formatDistance(d) + ' · 步行约 ' + walkMinutes(d) + ' 分钟';
    }
    if (walkBtn) {
      walkBtn.style.display = 'block';
      walkBtn.dataset.dist = Math.round(d);
    }
  }
  // 景点列表重新渲染（带距离）
  renderMapSpotGrid();
}

function selectSpot(index) {
  navigateTo('detail', index);
}

// ===== 标记点击 - 小灵介绍景点 =====
function onMarkerClick(index) {
  window._currentSpotIndex = index;
  currentSpotIndex = index;
  const spot = SCENIC_SPOTS[index];

  // 更新信息浮层
  const card = document.getElementById('mapSpotCard');
  if (card) {
    card.style.display = 'block';
    document.getElementById('mapSpotNum').textContent = (index + 1);
    document.getElementById('mapSpotNum').style.background = spot.tagColor;
    document.getElementById('mapSpotName').textContent = spot.name;
    document.getElementById('mapSpotDesc').textContent = spot.description.substring(0, 80) + '...';

    // 绑定查看详情按钮（使用闭包，避免 inline onclick 作用域问题）
    const detailBtn = document.getElementById('mapSpotDetailBtn');
    if (detailBtn) {
      detailBtn.onclick = function() {
        navigateTo('detail', index);
      };
    }
    // 绑定步行导航按钮
    const walkBtn = document.getElementById('mapSpotWalkBtn');
    if (walkBtn) {
      walkBtn.onclick = function() { startWalkNavigation(); };
    }
  }

  // 地图移动到标记位置
  if (_tmap && _markerLayer) {
    const c = parseCoords(spot.coordinates);
    _tmap.panTo(new TMap.LatLng(c.lat, c.lng));
  }

  // 显示到游客位置的距离
  updateSpotDistances();

  // 小灵语音介绍
  const introText = '这里是' + spot.name + '。' + spot.description.substring(0, 60) + '... 建议游览时间约' + spot.duration + '。';

  if (window.Live2DGuide) {
    if (window.Live2DGuide.isReady && window.Live2DGuide.isReady()) {
      window.Live2DGuide.speak && window.Live2DGuide.speak(introText);
      window.Live2DGuide.say && window.Live2DGuide.say(introText);
      window.Live2DGuide.setExpression && window.Live2DGuide.setExpression('smile');
    } else {
      window.Live2DGuide.onReady && window.Live2DGuide.onReady(function() {
        window.Live2DGuide.say && window.Live2DGuide.say(introText);
        window.Live2DGuide.setExpression && window.Live2DGuide.setExpression('smile');
      });
    }
  }
}

// ===== 景点列表 - 卡片网格 =====
function renderMapSpotGrid() {
  const grid = document.getElementById('mapSpotGrid');
  if (!grid) return;

  // 计算每个景点到游客位置的距离，并找出最近
  const items = SCENIC_SPOTS.map(function(spot, i) {
    const c = parseCoords(spot.coordinates);
    const dist = _userLocationLatLng ? haversineDistance(_userLocationLatLng, c) : null;
    return { spot: spot, index: i, coord: c, dist: dist };
  });
  const minDist = items.reduce(function(m, it) { return it.dist != null && (m == null || it.dist < m) ? it.dist : m; }, null);

  grid.innerHTML = items.map(function(it) {
    const distHtml = it.dist != null
      ? `<div class="map-spot-card-item-distance${it.dist === minDist ? ' nearest' : ''}">📍 距您 ${formatDistance(it.dist)} · 步行约 ${walkMinutes(it.dist)} 分钟</div>`
      : '';
    return `
      <div class="map-spot-card-item" onclick="selectSpot(${it.index})">
        <div class="map-spot-card-item-header" style="background:${it.spot.tagColor}"></div>
        <div class="map-spot-card-item-body">
          <div class="map-spot-card-item-num" style="background:${it.spot.tagColor}">${it.index + 1}</div>
          <div class="map-spot-card-item-name">${it.spot.name}</div>
          <div class="map-spot-card-item-tag">${it.spot.tag}</div>
          <div class="map-spot-card-item-desc">${it.spot.description.substring(0, 100)}...</div>
          ${distHtml}
          <div class="map-spot-card-item-more">查看详情 →</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 景点详情页 =====
function renderDetail(index) {
  const spot = SCENIC_SPOTS[index];
  const container = document.getElementById('detailContent');
  if (!container) return;

  const prevIndex = (index - 1 + SCENIC_SPOTS.length) % SCENIC_SPOTS.length;
  const nextIndex = (index + 1) % SCENIC_SPOTS.length;

  const stars = '★'.repeat(Math.floor(spot.rating)) + '☆'.repeat(5 - Math.floor(spot.rating));

  container.innerHTML = `
    <!-- Hero区域 -->
    <div class="detail-hero" style="background-image: url('${spot.heroImage || ''}'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: #1a1a2e;">
      <div class="detail-hero-pattern"></div>
      <div class="detail-hero-content">
        <div class="detail-breadcrumb">
          <a onclick="navigateTo('home')">首页</a>
          <span>›</span>
          <a onclick="navigateTo('map')">景点导览</a>
          <span>›</span>
          <span style="color:white">${spot.name}</span>
        </div>
        <div class="detail-title-row">
          <div class="detail-title-group">
            <h1>${spot.name}</h1>
            <p class="detail-subtitle">${spot.subtitle}</p>
          </div>
          <div class="detail-rating">
            <span class="detail-rating-stars">${stars}</span>
            <span class="detail-rating-text">${spot.rating}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情内容 -->
    <div class="detail-body">
      <!-- 标签栏 -->
      <div class="detail-tag-row">
        <span class="detail-tag" style="background:${spot.tagColor}">${spot.tag}</span>
        <span class="detail-tag" style="background:var(--accent)">坐标 ${spot.coordinates}</span>
      </div>

      <!-- 信息栏 -->
      <div class="detail-info-bar">
        <div class="detail-info-item">
          <span>⏱️</span> 建议游览 <span>${spot.duration}</span>
        </div>
        <div class="detail-info-item">
          <span>🌟</span> 最佳时间 <span>${spot.bestTime}</span>
        </div>
        <div class="detail-info-item">
          <span>⭐</span> 评分 <span>${spot.rating} / 5.0</span>
        </div>
      </div>

      <!-- 景点介绍 -->
      <h2 class="detail-section-title">景点介绍</h2>
      <div class="detail-description">${spot.description}</div>

      <!-- 三大亮点 -->
      <h2 class="detail-section-title">核心亮点</h2>
      <div class="highlight-grid">
        ${spot.highlights.map(h => `
          <div class="highlight-card">
            <div class="highlight-icon">${h.icon}</div>
            <h3>${h.title}</h3>
            <p>${h.text}</p>
          </div>
        `).join('')}
      </div>

      <!-- 游览须知 -->
      <h2 class="detail-section-title">游览须知</h2>
      <div class="tips-list">
        ${spot.tips.map(t => `
          <div class="tip-item">
            <div class="tip-icon">${t.icon}</div>
            <div class="tip-content">
              <h4>${t.title}</h4>
              <p>${t.text}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- 导航按钮 -->
      <div class="detail-nav">
        <div class="detail-nav-btn prev" onclick="navigateTo('detail', ${prevIndex})">
          <span>←</span> ${SCENIC_SPOTS[prevIndex].name}
        </div>
        <div class="detail-nav-btn next" onclick="navigateTo('detail', ${nextIndex})">
          ${SCENIC_SPOTS[nextIndex].name} <span>→</span>
        </div>
      </div>
    </div>
  `;
}

// ===== 路线规划 =====
function renderRoutes() {
  const container = document.getElementById('routesContainer');
  if (!container) return;
  container.innerHTML = ROUTES.map(route => `
    <div class="route-card">
      <div class="route-card-header">
        <div class="route-card-name">${route.name}</div>
        <div class="route-card-meta">
          <span class="route-duration-badge">⏱️ ${route.duration}</span>
          <span class="route-difficulty-badge" style="background:${route.difficultyColor}">${route.difficulty}</span>
        </div>
      </div>
      <div class="route-card-desc">${route.description}</div>
      <div class="route-timeline">
        ${route.stops.map(stop => `
          <div class="route-stop">
            <div class="route-stop-time">${stop.time}</div>
            <div class="route-stop-content">
              <div class="route-stop-spot">${stop.spot}</div>
              <div class="route-stop-activity">${stop.activity}</div>
              <div class="route-stop-duration">📍 ${stop.duration}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="route-card-btn" onclick="navigateTo('map')">查看景点地图 →</button>
    </div>
  `).join('');
}

// ===== 票务信息 =====
function renderTicketInfo() {
  const list = document.getElementById('ticketList');
  if (!list) return;
  list.innerHTML = `
    <li>🎫 <span>成人通票</span>：¥210/人</li>
    <li>👶 <span>半价票</span>：${TICKET_INFO.halfPrice}</li>
    <li>🆓 <span>免票政策</span>：${TICKET_INFO.free}</li>
    <li>🕐 <span>开放时间</span>：${TICKET_INFO.openTime}</li>
    <li>✅ <span>通票包含</span>：${TICKET_INFO.includes}</li>
  `;
}

// ===== AI 对话 =====
const QUICK_QUESTIONS = [
  '灵山大佛有多高？',
  '推荐一条亲子游览路线',
  '灵山梵宫有什么看点？',
  '门票多少钱？',
  '九龙灌浴几点开始？'
];

const GPT_SOVITS_CONFIG = { character: '三月七' };
window.GPT_SOVITS_CONFIG = GPT_SOVITS_CONFIG;

// 后端 API 地址
const BACKEND_API = '/api';

let conversationHistory = [];
let chatInitialized = false;
let isWaitingForAI = false;

async function callBackendChat(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  // 检查是否有个性化推荐上下文
  const personalizedContext = sessionStorage.getItem('ls_personalized_context') || '';
  const userInterests = sessionStorage.getItem('ls_user_interests') || '';

  try {
    const resp = await fetch(BACKEND_API + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        user_id: window.currentUser ? window.currentUser.username : 'guest',
        history: conversationHistory.slice(-20), // 最近20轮对话
        preferences: personalizedContext, // 个性化讲解偏好
        interests: userInterests  // 兴趣标签
      })
    });

    if (!resp.ok) {
      throw new Error('API error: ' + resp.status);
    }

    const data = await resp.json();
    const reply = data.reply;
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[Chat] 后端 API 调用失败:', err);
    return '抱歉，我暂时无法连接到AI服务，请稍后再试。😔 您可以拨打景区客服热线 400-828-9766 获取帮助。';
  }
}

function initChat() {
  const messages = document.getElementById('chatMessages');
  if (!messages || chatInitialized) return;
  chatInitialized = true;

  const welcomeMsg = '您好！我是小灵，灵山胜境AI数字人导游 🧘\n\n很高兴为您服务！我可以为您：\n• 介绍五大景点详情\n• 推荐个性化游览路线\n• 解答票务、交通等问题\n\n请问有什么可以帮您的？';

  // 欢迎消息
  addChatMessage('ai', welcomeMsg);

  // Live2D 数字人说欢迎语
  if (window.Live2DGuide) {
    window.Live2DGuide.onReady(() => {
      window.Live2DGuide.setExpression('wave');
      window.Live2DGuide.speak('您好！我是小灵，很高兴为您服务！');
    });
  }

  // 快捷问题
  const quickContainer = document.getElementById('quickQuestions');
  quickContainer.innerHTML = QUICK_QUESTIONS.map(q => `
    <button class="chat-quick-btn" onclick="askQuickQuestion('${q}')">${q}</button>
  `).join('');
}

function askQuickQuestion(question) {
  document.getElementById('chatInput').value = question;
  sendMessage();
}

function addChatMessage(type, text) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const avatar = type === 'ai' ? '' : '👤';
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.innerHTML = `
    <div class="chat-avatar ${type}">${avatar}</div>
    <div class="chat-bubble ${type}">${text.replace(/\n/g, '<br>')}</div>
  `;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;

  // Live2D 角色交互：AI回复时让小灵说话
  if (type === 'ai' && window.Live2DGuide?.isReady()) {
    window.Live2DGuide.speak(text);
    // 根据回复内容匹配表情
    if (text.includes('😊') || text.includes('高兴') || text.includes('推荐')) {
      window.Live2DGuide.setExpression('smile');
    } else if (text.includes('🙏') || text.includes('佛') || text.includes('禅')) {
      window.Live2DGuide.setExpression('agree');
    } else if (text.includes('路线') || text.includes('建议') || text.includes('怎么')) {
      window.Live2DGuide.setExpression('think');
    } else if (text.includes('👋') || text.includes('欢迎') || text.includes('您好')) {
      window.Live2DGuide.setExpression('wave');
    }
  }
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isWaitingForAI) return;

  // 添加用户消息
  addChatMessage('user', text);
  input.value = '';

  // Live2D 角色 - 思考状态
  if (window.Live2DGuide?.isReady()) {
    window.Live2DGuide.setExpression('think');
    window.Live2DGuide.setStatusText('正在思考您的提问...');
  }

  isWaitingForAI = true;

  // 调用后端 AI API（通过本地知识库增强）
  callBackendChat(text).then(reply => {
    addChatMessage('ai', reply);
  }).finally(() => {
    isWaitingForAI = false;
  });
}

// ===== 地图页浮层对话 =====
let mapChatOpen = false;
let mapChatInitialized = false;

function initMapChat() {
  const panel = document.getElementById('mapChatPanel');
  if (!panel) return;

  panel.style.display = 'flex';

  if (!mapChatInitialized) {
    mapChatInitialized = true;
    const welcomeMsg = '您好！我是小灵，正在地图导览模式为您服务 🧘\n\n您可以问我：\n• 这个景点有什么特色\n• 推荐附近的路线\n• 门票和开放时间';
    addMapChatMessage('ai', welcomeMsg);
  }
}

// 地图页对话框拖拽
function initMapChatDrag() {
  const widget = document.getElementById('mapChatWidget');
  const header = document.getElementById('mapChatHeader');
  if (!widget || !header) return;

  let isDragging = false;
  let startX, startY, startRight, startBottom;

  function getClientPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function getComputedPos(el, prop) {
    const val = parseFloat(window.getComputedStyle(el)[prop]);
    return isNaN(val) ? 0 : val;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function startDrag(e) {
    if (e.button !== undefined && e.button !== 0) return;
    isDragging = true;
    const pos = getClientPos(e);
    startX = pos.x;
    startY = pos.y;
    startRight = getComputedPos(widget, 'right');
    startBottom = getComputedPos(widget, 'bottom');
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    header.style.cursor = 'grabbing';
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getClientPos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    const container = widget.offsetParent || document.body;
    const containerRect = container.getBoundingClientRect();
    const widgetRect = widget.getBoundingClientRect();

    // right/bottom 是相对于容器右下边缘的距离
    // 鼠标向右移动 -> right 减小；鼠标向下移动 -> bottom 减小
    const newRight = clamp(startRight - dx, 0, containerRect.width - widgetRect.width);
    const newBottom = clamp(startBottom - dy, 0, containerRect.height - widgetRect.height);

    widget.style.right = newRight + 'px';
    widget.style.bottom = newBottom + 'px';
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    header.style.cursor = '';
  }

  header.addEventListener('mousedown', startDrag);
  header.addEventListener('touchstart', startDrag, { passive: false });

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });

  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchend', stopDrag);
}

function sendMapChatMessage() {
  const input = document.getElementById('mapChatInput');
  const text = input.value.trim();
  if (!text || isWaitingForAI) return;

  addMapChatMessage('user', text);
  input.value = '';

  if (window.Live2DGuide?.isReady()) {
    window.Live2DGuide.setExpression('think');
    window.Live2DGuide.setStatusText('正在思考...');
  }

  isWaitingForAI = true;
  callBackendChat(text).then(reply => {
    addMapChatMessage('ai', reply);
  }).finally(() => {
    isWaitingForAI = false;
  });
}

function addMapChatMessage(type, text) {
  const messages = document.getElementById('mapChatMessages');
  if (!messages) return;

  const avatar = type === 'ai' ? '' : '👤';
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.innerHTML = `
    <div class="chat-avatar ${type}">${avatar}</div>
    <div class="chat-bubble ${type}">${text.replace(/\n/g, '<br>')}</div>
  `;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;

  // Live2D 说话：AI 回复时让小灵发声
  if (type === 'ai' && window.Live2DGuide?.isReady()) {
    window.Live2DGuide.speak(text);
    if (text.includes('😊') || text.includes('高兴') || text.includes('推荐')) {
      window.Live2DGuide.setExpression('smile');
    } else if (text.includes('🙏') || text.includes('佛') || text.includes('禅')) {
      window.Live2DGuide.setExpression('agree');
    } else if (text.includes('路线') || text.includes('建议') || text.includes('怎么')) {
      window.Live2DGuide.setExpression('think');
    } else if (text.includes('👋') || text.includes('欢迎') || text.includes('您好')) {
      window.Live2DGuide.setExpression('wave');
    } else {
      window.Live2DGuide.setExpression('smile');
    }
  }
}

function askMapQuickQuestion(question) {
  const input = document.getElementById('mapChatInput');
  if (input) input.value = question;
  sendMapChatMessage();
}

// ===== 用户认证 =====

// 从 localStorage 读取当前登录用户
let currentUser = JSON.parse(localStorage.getItem('ls_currentUser') || 'null');

// 初始化导航栏用户按钮
function updateNavUserBtn() {
  const btn = document.getElementById('navUserBtn');
  if (!btn) return;
  if (currentUser) {
    btn.textContent = currentUser.username;
    btn.style.cssText = 'background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;cursor:pointer;';
    btn.title = '点击查看账号 / 退出登录';
    btn.onclick = function() { toggleUserMenu(); };
  } else {
    btn.textContent = '登录 / 注册';
    btn.style.cssText = '';
    btn.title = '';
    btn.onclick = function() { navigateTo('auth'); };
  }
}

// 切换用户菜单（简单版：点击弹出确认退出）
function toggleUserMenu() {
  if (confirm('当前登录用户：' + currentUser.username + '\n\n是否退出登录？')) {
    logout();
  }
}

// 退出登录
function logout() {
  localStorage.removeItem('ls_currentUser');
  currentUser = null;
  updateNavUserBtn();
  navigateTo('home');
}

// 切换登录/注册 Tab
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'login') {
    document.querySelector('.auth-tab:first-child').classList.add('active');
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
  } else {
    document.querySelector('.auth-tab:last-child').classList.add('active');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'flex';
  }
  // 清除错误消息
  document.querySelectorAll('.auth-msg').forEach(m => { m.className = 'auth-msg'; m.textContent = ''; });
}

// 密码显示/隐藏
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// 获取所有用户
function getUsers() {
  return JSON.parse(localStorage.getItem('ls_users') || '[]');
}

// 保存用户列表
function saveUsers(users) {
  localStorage.setItem('ls_users', JSON.stringify(users));
}

// 显示消息
function showAuthMsg(formId, text, type) {
  const msgEl = document.getElementById(formId + 'Msg');
  msgEl.textContent = text;
  msgEl.className = 'auth-msg ' + type;
}

// 登录处理
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showAuthMsg('login', '请填写完整的登录信息', 'error');
    return;
  }

  const users = getUsers();
  const user = users.find(u => (u.username === username || u.email === username) && u.password === password);

  if (!user) {
    showAuthMsg('login', '用户名或密码错误，请重试', 'error');
    return;
  }

  // 登录成功
  currentUser = { username: user.username, email: user.email };
  localStorage.setItem('ls_currentUser', JSON.stringify(currentUser));
  showAuthMsg('login', '登录成功！正在跳转...', 'success');
  updateNavUserBtn();
  setTimeout(() => navigateTo('home'), 800);
}

// 注册处理
function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  // 验证
  if (!username || !email || !password || !passwordConfirm) {
    showAuthMsg('register', '请填写所有必填字段', 'error');
    return;
  }

  if (username.length < 2 || username.length > 16) {
    showAuthMsg('register', '用户名长度为2-16个字符', 'error');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthMsg('register', '请输入有效的邮箱地址', 'error');
    return;
  }

  if (password.length < 6 || password.length > 20) {
    showAuthMsg('register', '密码长度为6-20位', 'error');
    return;
  }

  if (password !== passwordConfirm) {
    showAuthMsg('register', '两次输入的密码不一致', 'error');
    return;
  }

  const users = getUsers();

  // 检查用户名是否已存在
  if (users.some(u => u.username === username)) {
    showAuthMsg('register', '该用户名已被注册，请更换', 'error');
    return;
  }

  // 检查邮箱是否已存在
  if (users.some(u => u.email === email)) {
    showAuthMsg('register', '该邮箱已被注册，请更换', 'error');
    return;
  }

  // 保存用户（生产环境应使用哈希密码，此处为演示用明文存储）
  users.push({ username, email, password });
  saveUsers(users);

  // 注册成功，自动登录
  currentUser = { username, email };
  localStorage.setItem('ls_currentUser', JSON.stringify(currentUser));
  showAuthMsg('register', '注册成功！正在跳转...', 'success');
  updateNavUserBtn();
  setTimeout(() => navigateTo('home'), 800);
}

// 跳转时自动检查登录状态（保护页面）
const _originalNavigateTo = navigateTo;
navigateTo = function(page, params) {
  // 如果已登录用户再进 auth 页，直接跳回首页
  if (page === 'auth' && currentUser) {
    page = 'home';
  }
  _originalNavigateTo(page, params);
};

// ==========================================
//  个性化推荐系统
// ==========================================

const selectedInterests = [];

// 兴趣标签 → 景点/路线/讲解 映射配置
const INTEREST_CONFIG = {
  history: {
    emoji: '🏛️',
    label: '历史文化',
    focusTitle: '千年古刹 · 佛教传承',
    focusItems: [
      { icon: '📜', title: '祥符禅寺千年史', desc: '从唐贞观年间的初建，到历代高僧驻锡、文人题咏，为您讲述千年古刹背后的历史故事与名人轶事。' },
      { icon: '🏗️', title: '灵山大佛建造历程', desc: '从选址到铸造、从设计理念到佛教寓意，深度解读88米青铜大佛的前世今生。' },
      { icon: '📖', title: '佛教中国化脉络', desc: '讲解灵山各景点如何展现佛教从印度传入中国后的本土化演变与文化融合。' }
    ],
    spotPriority: ['linghan-dafo', 'xiangfu-chansi', 'fanggong'],
    routeId: 'route-cultural',
    chatContext: '游客对历史文化非常感兴趣，请重点讲解各景点的历史背景、建造故事、时代变迁和名人轶事，多用历史典故和生动故事来吸引游客。'
  },
  nature: {
    emoji: '🌿',
    label: '自然风光',
    focusTitle: '太湖山水 · 园林景致',
    focusItems: [
      { icon: '🏔️', title: '灵山大佛登高望远', desc: '登217级台阶至佛脚平台，俯瞰太湖万顷碧波、马山群峰连绵，感受天地开阔。' },
      { icon: '🌳', title: '千年银杏与古松', desc: '祥符禅寺内的千年银杏春夏绿荫蔽日、秋日金黄如画，是灵山最具生命力的自然景观。' },
      { icon: '🌸', title: '四季花海与园林', desc: '灵山景区内四季花卉轮替，春日樱花、夏荷、秋菊、冬梅，结合禅意园林设计，处处皆是景。' }
    ],
    spotPriority: ['linghan-dafo', 'xiangfu-chansi', 'jiulong-guanyu'],
    routeId: 'route-easy',
    chatContext: '游客热爱自然风光，请重点介绍各景点的自然景观特色、四季变化之美、最佳拍照取景位，语言要富有画面感和诗意。'
  },
  architecture: {
    emoji: '🏗️',
    label: '建筑艺术',
    focusTitle: '梵宫壁画 · 坛城藏韵',
    focusItems: [
      { icon: '🎨', title: '梵宫穹顶天象图', desc: '解析64米穹顶的敦煌飞天壁画、华藏世界琉璃壁画背后的艺术手法与佛教表意。' },
      { icon: '🏛️', title: '五印坛城藏式建筑', desc: '从坛城（曼茶罗）理念到白墙金顶的藏式建筑美学，解读融合汉藏风格的建筑密码。' },
      { icon: '⛩️', title: '灵山胜境整体规划', desc: '从景观中轴线到各建筑的布局逻辑，揭示灵山胜境的"一佛一寺一坛一宫"空间叙事。' }
    ],
    spotPriority: ['fanggong', 'wuyin-tancheng', 'linghan-dafo'],
    routeId: 'route-cultural',
    chatContext: '游客对建筑艺术有浓厚兴趣，请重点讲解各建筑的风格特色、设计理念、材料工艺、空间布局，多用专业但不晦涩的建筑术语，结合佛教文化内涵。'
  },
  buddhism: {
    emoji: '🙏',
    label: '佛教文化',
    focusTitle: '礼佛祈福 · 禅意体验',
    focusItems: [
      { icon: '🤲', title: '佛教礼仪与手印', desc: '讲解大佛"施无畏印"与"与愿印"的深意，以及礼佛、绕佛、合十等基本佛教礼仪。' },
      { icon: '🎡', title: '转经祈福体验', desc: '在五印坛城体验转经筒祈福，了解藏传佛教的"转经"文化内涵与功德意义。' },
      { icon: '🕯️', title: '撞钟礼佛仪式', desc: '在祥符禅寺体验"江南第一钟"撞钟三响，了解福禄寿三星的含义。' }
    ],
    spotPriority: ['linghan-dafo', 'wuyin-tancheng', 'xiangfu-chansi'],
    routeId: 'route-cultural',
    chatContext: '游客对佛教文化非常虔诚，请重点讲解佛教教义、礼仪仪式、祈福方式、各佛像的宗教含义，语气要庄重而不失温暖，少用娱乐化表达。'
  },
  photo: {
    emoji: '📸',
    label: '摄影打卡',
    focusTitle: '出片圣地 · 光影之美',
    focusItems: [
      { icon: '🌅', title: '大佛剪影黄金机位', desc: '推荐大佛脚下日出剪影、台阶仰拍、佛掌特写等最佳机位，附拍摄参数建议。' },
      { icon: '🌈', title: '九龙灌浴七彩佛光', desc: '捕捉水雾与阳光交织形成的七彩佛光瞬间，是最具灵性的摄影作品素材。' },
      { icon: '🪟', title: '坛城彩窗光影', desc: '五印坛城下午时分彩色玻璃窗投射的斑斓光影，是人文摄影爱好者的挚爱场景。' }
    ],
    spotPriority: ['linghan-dafo', 'jiulong-guanyu', 'wuyin-tancheng', 'fanggong'],
    routeId: 'route-easy',
    chatContext: '游客是摄影爱好者，请重点推荐各景点的最佳拍摄机位、最佳时间、取景角度技巧，帮助游客拍出满意的打卡照片。'
  },
  family: {
    emoji: '👨‍👩‍👧‍👦',
    label: '亲子同游',
    focusTitle: '趣味互动 · 寓教于乐',
    focusItems: [
      { icon: '🐉', title: '九龙灌浴亲子奇观', desc: '大型动态水景表演震撼孩子的视觉感官，讲述"九龙浴太子"的生动故事。' },
      { icon: '🗿', title: '大佛登阶挑战赛', desc: '将217级台阶变成亲子挑战项目，边登边数台阶，登顶后再俯瞰太湖作为奖励。' },
      { icon: '🎡', title: '转经筒互动体验', desc: '让孩子亲手转动经筒，一边转一边了解藏传佛教的文化知识，寓教于乐。' }
    ],
    spotPriority: ['jiulong-guanyu', 'linghan-dafo', 'wuyin-tancheng'],
    routeId: 'route-family',
    chatContext: '游客是亲子家庭出行，请采用亲切活泼的语气，多用"小朋友""孩子""一起"等词语，讲解要生动有趣、寓教于乐，推荐互动性强的景点和活动。'
  },
  zen: {
    emoji: '🍵',
    label: '禅意慢游',
    focusTitle: '静心品茗 · 修身养性',
    focusItems: [
      { icon: '🌿', title: '祥符禅寺晨钟暮鼓', desc: '清晨或黄昏时分，在千年古刹聆听钟声悠远、梵音阵阵，感受佛门清幽宁静。' },
      { icon: '🧘', title: '禅坐与冥想体验', desc: '推荐灵山景区内适合静坐冥想的角落，远离喧嚣，与自己对话。' },
      { icon: '🏯', title: '五印坛城慢行禅', desc: '沿坛城外围缓步绕行，每一步都是修行。在藏式建筑与蓝天白云间，感受心灵的平静。' }
    ],
    spotPriority: ['xiangfu-chansi', 'wuyin-tancheng', 'linghan-dafo'],
    routeId: 'route-cultural',
    chatContext: '游客追求慢节奏禅意旅行，请采用温和从容的语气，减少emoji使用，讲解重点放在心灵体验、禅修感悟、宁静之美上，可以适当引用佛经名句。'
  },
  food: {
    emoji: '🍜',
    label: '美食体验',
    focusTitle: '素斋文化 · 地方风味',
    focusItems: [
      { icon: '🥬', title: '灵山素斋体验', desc: '灵山素斋以"形荤实素"著称，用豆制品、菌菇、面筋等食材模拟荤菜，口味惊艳。' },
      { icon: '🍵', title: '梵宫禅茶文化', desc: '灵山梵宫内可体验禅茶一味，在佛教艺术殿堂中品一杯清茶，感受"吃茶去"的禅机。' },
      { icon: '🥮', title: '无锡本地风味', desc: '推荐灵山周边及无锡市区的太湖三白、酱排骨、小笼包等地道美食，丰富旅行体验。' }
    ],
    spotPriority: ['fanggong', 'xiangfu-chansi', 'linghan-dafo'],
    routeId: 'route-family',
    chatContext: '游客对美食很感兴趣，请多推荐灵山素斋特色菜品、品茶体验、以及无锡本地的美食攻略，语气要热情生动。'
  }
};

// 切换兴趣标签
function toggleInterest(id, btn) {
  const idx = selectedInterests.indexOf(id);
  if (idx === -1) {
    selectedInterests.push(id);
    btn.classList.add('selected');
  } else {
    selectedInterests.splice(idx, 1);
    btn.classList.remove('selected');
  }

  // 更新提交按钮状态
  const submitBtn = document.getElementById('recommendSubmitBtn');
  submitBtn.disabled = selectedInterests.length === 0;
  submitBtn.textContent = selectedInterests.length > 0
    ? `生成推荐方案 ✨ (已选${selectedInterests.length}项)`
    : '请至少选择一个兴趣标签';
}

// 生成推荐方案
function generateRecommendation() {
  if (selectedInterests.length === 0) return;

  // 切换到 Step 2
  document.getElementById('recommendStep1').style.display = 'none';
  document.getElementById('recommendStep2').style.display = 'block';

  // 显示兴趣摘要
  const summary = selectedInterests.map(id => INTEREST_CONFIG[id].emoji + ' ' + INTEREST_CONFIG[id].label).join('、');
  document.getElementById('recommendInterestSummary').textContent = '根据您对 ' + summary + ' 的兴趣偏好精选';

  // 确定推荐路线
  renderRecommendRoutes();
  // 渲染推荐景点
  renderRecommendSpots();
  // 渲染讲解侧重
  renderRecommendFocus();

  // 滚动到顶部
  document.getElementById('recommendStep2').scrollIntoView({ behavior: 'smooth' });
}

// 推荐路线
function renderRecommendRoutes() {
  const container = document.getElementById('recommendRoutes');
  const routeCounts = {};

  // 统计各路线被推荐的次数
  selectedInterests.forEach(id => {
    const routeId = INTEREST_CONFIG[id].routeId;
    if (routeId) routeCounts[routeId] = (routeCounts[routeId] || 0) + 1;
  });

  // 按推荐次数排序
  const sortedRoutes = Object.entries(routeCounts).sort((a, b) => b[1] - a[1]);

  container.innerHTML = sortedRoutes.map(([routeId, score]) => {
    const route = ROUTES.find(r => r.id === routeId);
    if (!route) return '';
    const matchPercent = Math.min(100, Math.round(score / selectedInterests.length * 100));
    return `
      <div class="recommend-route-card">
        <div class="recommend-route-card-top">
          <div class="recommend-route-card-left">
            <div class="recommend-route-card-name">${route.name}</div>
            <div class="recommend-route-card-desc">${route.description}</div>
          </div>
          <div class="recommend-route-card-meta">
            <span class="recommend-route-badge duration">⏱ ${route.duration}</span>
            <span class="recommend-route-badge match">匹配度 ${matchPercent}%</span>
          </div>
        </div>
        <div class="recommend-route-card-timeline">
          ${route.stops.map((stop, i) => `
            <div class="recommend-route-stop">
              <div class="recommend-route-stop-num">${i + 1}</div>
              <div class="recommend-route-stop-info">
                <div class="recommend-route-stop-spot">${stop.spot}</div>
                <div class="recommend-route-stop-activity">${stop.time} | ${stop.activity}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('') || '<p style="text-align:center;color:var(--text-muted);padding:40px;">暂无匹配路线，请返回选择更多兴趣</p>';
}

// 推荐景点
function renderRecommendSpots() {
  const container = document.getElementById('recommendSpots');
  const spotScores = {};
  const spotReasons = {};

  selectedInterests.forEach(id => {
    const config = INTEREST_CONFIG[id];
    config.spotPriority.forEach((spotId, idx) => {
      spotScores[spotId] = (spotScores[spotId] || 0) + (config.spotPriority.length - idx);
      if (!spotReasons[spotId]) spotReasons[spotId] = [];
      if (!spotReasons[spotId].includes(config.label)) {
        spotReasons[spotId].push(config.label);
      }
    });
  });

  // 按分数排序取前5个
  const topSpots = Object.entries(spotScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = topSpots.map(([spotId, score], idx) => {
    const spot = SCENIC_SPOTS.find(s => s.id === spotId);
    if (!spot) return '';
    const isTop = idx === 0;
    return `
      <div class="recommend-spot-mini" onclick="navigateTo('detail', ${SCENIC_SPOTS.indexOf(spot)})" style="border-top:4px solid ${spot.tagColor}">
        ${isTop ? '<span class="recommend-spot-priority">🏆 首选</span>' : ''}
        <div class="recommend-spot-mini-icon">${idx === 0 ? '⭐' : idx === 1 ? '🌟' : '📍'}</div>
        <div class="recommend-spot-mini-name">${spot.name}</div>
        <div class="recommend-spot-mini-reason">适合 ${spotReasons[spotId].join('·')} 爱好者</div>
      </div>
    `;
  }).join('');
}

// 讲解侧重
function renderRecommendFocus() {
  const container = document.getElementById('recommendFocusItems');
  const allItems = [];

  selectedInterests.forEach(id => {
    const config = INTEREST_CONFIG[id];
    config.focusItems.forEach(item => {
      if (!allItems.find(a => a.title === item.title)) {
        allItems.push(item);
      }
    });
  });

  // 去重取前6条
  const displayItems = allItems.slice(0, 6);

  container.innerHTML = displayItems.map(item => `
    <div class="recommend-focus-item">
      <span class="recommend-focus-item-icon">${item.icon}</span>
      <div>
        <div class="recommend-focus-item-title">${item.title}</div>
        <div class="recommend-focus-item-desc">${item.desc}</div>
      </div>
    </div>
  `).join('');
}

// 返回兴趣选择
function backToInterests() {
  document.getElementById('recommendStep1').style.display = '';
  document.getElementById('recommendStep2').style.display = 'none';
  document.getElementById('recommendStep1').scrollIntoView({ behavior: 'smooth' });
}

// 开始个性化AI导览
function startPersonalizedTour() {
  // 拼接兴趣专属的 system prompt
  const chatContexts = selectedInterests.map(id => INTEREST_CONFIG[id].chatContext).join('\n');
  const interestLabels = selectedInterests.map(id => INTEREST_CONFIG[id].emoji + INTEREST_CONFIG[id].label).join('、');

  // 存储个性化上下文到 sessionStorage（AI 对话页可读取）
  sessionStorage.setItem('ls_personalized_context', chatContexts);
  sessionStorage.setItem('ls_user_interests', interestLabels);

  // 跳转到 AI 导游页
  navigateTo('ai-chat');

  // 自动发送一条上下文设定消息（不显示在界面）
  setTimeout(() => {
    const chatMessages = document.getElementById('chatMessages');
    // 显示一条系统提示
    const sysDiv = document.createElement('div');
    sysDiv.className = 'chat-system-note';
    sysDiv.innerHTML = `<span>🎯 已为您切换到个性化导游模式：<strong>${interestLabels}</strong><br>小灵将重点从这些角度为您讲解</span>`;
    sysDiv.style.cssText = 'text-align:center;padding:12px;margin:8px 0;font-size:13px;color:var(--primary-dark);background:rgba(200,163,87,0.08);border-radius:12px;animation:fadeIn 0.5s ease;';
    chatMessages.appendChild(sysDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 500);
}

// ==========================================
//  数字人形象管理模块
// ==========================================

let avatarProfile = null;
let avatarCurrentTab = 'appearance';
const AVATAR_OUTFIT_COLORS = {
  'chan_yi_hanfu':    { bg: 'linear-gradient(135deg, #d4e8d4 0%, #c8dcc8 50%, #b0c8b0 100%)', icon: '🧘', accent: '#6b8e6b' },
  'su_ya_jushi':      { bg: 'linear-gradient(135deg, #f5f0e8 0%, #e8e0d0 50%, #ddd4c4 100%)', icon: '🙏', accent: '#b8a88a' },
  'lian_hua_xian':    { bg: 'linear-gradient(135deg, #fce4ec 0%, #f8d0dc 50%, #f0b8c8 100%)', icon: '🪷', accent: '#d4879a' },
  'tang_zhuang':      { bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 50%, #ffcc80 100%)', icon: '🏮', accent: '#c8a357' },
  'yun_shui_chan':    { bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)', icon: '☁️', accent: '#5c8db8' },
  'lingshan_zhuan':   { bg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 50%, #ffe082 100%)', icon: '🏔️', accent: '#c8a357' }
};

// 从后端加载形象配置
async function loadAvatarProfile() {
  try {
    const resp = await fetch(BACKEND_API + '/character/profile');
    const data = await resp.json();
    if (data.success) {
      avatarProfile = data.data;
      applyAvatarProfileToUI();
      console.log('[Avatar] 形象配置已加载');
      return;
    }
  } catch (e) {
    console.warn('[Avatar] 后端加载形象失败，使用本地缓存:', e.message);
  }
  // fallback: localStorage
  const cached = localStorage.getItem('ls_avatar_profile');
  if (cached) {
    avatarProfile = JSON.parse(cached);
    applyAvatarProfileToUI();
  }
}

// 将配置数据填到 UI
function applyAvatarProfileToUI() {
  if (!avatarProfile) return;

  const a = avatarProfile.appearance || {};
  const v = avatarProfile.voice || {};
  const b = avatarProfile.behavior || {};

  // 外观
  const nameInput = document.getElementById('amNameInput');
  const subtitleInput = document.getElementById('amSubtitleInput');
  const greetingInput = document.getElementById('amGreetingInput');
  const colorInput = document.getElementById('amColorInput');
  const bgColorInput = document.getElementById('amBgColorInput');
  const previewImage = document.getElementById('amPreviewImage');

  if (nameInput) nameInput.value = a.avatar_name || '小灵';
  if (subtitleInput) subtitleInput.value = a.avatar_subtitle || 'AI Digital Guide';
  if (greetingInput) greetingInput.value = b.greeting || '';
  if (colorInput) { colorInput.value = a.avatar_color || '#C8A357'; document.getElementById('amColorHex').textContent = a.avatar_color || '#C8A357'; }
  if (bgColorInput) { bgColorInput.value = a.avatar_bg_color || '#f5f0e8'; document.getElementById('amBgColorHex').textContent = a.avatar_bg_color || '#f5f0e8'; }
  if (previewImage && a.avatar_image) previewImage.src = a.avatar_image;

  // 预览
  updatePreview();

  // 声音
  const speedSlider = document.getElementById('amSpeedSlider');
  const pitchSlider = document.getElementById('amPitchSlider');
  const volumeSlider = document.getElementById('amVolumeSlider');
  if (speedSlider) { speedSlider.value = v.voice_speed || 1.0; updateSliderVal('amSpeedVal', speedSlider.value, 'x'); }
  if (pitchSlider) { pitchSlider.value = v.voice_pitch || 1.0; updateSliderVal('amPitchVal', pitchSlider.value, ''); }
  if (volumeSlider) { volumeSlider.value = (v.voice_volume || 0.8) * 100; updateSliderVal('amVolumeVal', volumeSlider.value, '%'); }

  // 情感
  if (v.voice_emotion) {
    document.querySelectorAll('.am-emotion-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.emotion === v.voice_emotion);
    });
  }

  // 渲染服装列表
  renderOutfitGrid();
  // 渲染声线卡片
  renderVoiceCards();
}

// 实时更新预览
function updatePreview() {
  const nameInput = document.getElementById('amNameInput');
  const subtitleInput = document.getElementById('amSubtitleInput');
  const colorInput = document.getElementById('amColorInput');
  const bgColorInput = document.getElementById('amBgColorInput');

  if (nameInput) document.getElementById('amPreviewName').textContent = nameInput.value || '小灵';
  if (subtitleInput) document.getElementById('amPreviewSubtitle').textContent = subtitleInput.value || 'AI Digital Guide';
  if (colorInput) {
    const stage = document.getElementById('amPreviewStage');
    if (stage) stage.style.background = 'linear-gradient(180deg, ' + colorInput.value + '15 0%, ' + bgColorInput.value + ' 100%)';
  }

  // 更新服装徽章
  const outfitId = avatarProfile && avatarProfile.clothing ? avatarProfile.clothing.current : null;
  if (outfitId) {
    const outfitName = AVATAR_OUTFIT_COLORS[outfitId] ?
      document.querySelector('.am-outfit-card[data-id="' + outfitId + '"] .am-outfit-name')?.textContent || '' : '';
    const badge = document.getElementById('amOutfitBadge');
    if (badge && outfitName) badge.textContent = outfitName;
  }

  // 更新声线信息
  const voiceEl = document.getElementById('amPreviewVoice');
  const emotionEl = document.getElementById('amPreviewEmotion');
  if (voiceEl && avatarProfile && avatarProfile.voice) {
    voiceEl.textContent = avatarProfile.voice.voice_name || '三月七 v3';
  }
  if (emotionEl && avatarProfile && avatarProfile.voice) {
    const emotionMap = { warm: '温暖亲切', gentle: '温柔婉约', professional: '专业沉稳', lively: '活泼灵动' };
    emotionEl.textContent = emotionMap[avatarProfile.voice.voice_emotion] || '温暖亲切';
  }
}

// ===== Tab 切换 =====
function switchAvatarTab(tab, btn) {
  avatarCurrentTab = tab;
  document.querySelectorAll('.am-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.am-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('amTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');

  if (tab === 'clothing') renderOutfitGrid();
  if (tab === 'voice') renderVoiceCards();
  if (tab === 'expression') { loadExpressionMappings(); loadLipSyncConfig(); }
  if (tab === 'motion') { loadMotionConfig(); loadMotionTriggers(); }
}

// ===== 外观保存 =====
async function saveAppearance() {
  const name = document.getElementById('amNameInput').value.trim();
  const subtitle = document.getElementById('amSubtitleInput').value.trim();
  const greeting = document.getElementById('amGreetingInput').value.trim();
  const color = document.getElementById('amColorInput').value;
  const bgColor = document.getElementById('amBgColorInput').value;

  // 本地即时更新
  if (!avatarProfile) avatarProfile = { appearance: {}, clothing: {}, voice: {}, behavior: {} };
  avatarProfile.appearance.avatar_name = name;
  avatarProfile.appearance.avatar_subtitle = subtitle;
  avatarProfile.appearance.avatar_color = color;
  avatarProfile.appearance.avatar_bg_color = bgColor;
  avatarProfile.behavior.greeting = greeting;
  localStorage.setItem('ls_avatar_profile', JSON.stringify(avatarProfile));
  updatePreview();

  // 同步到后端
  try {
    const resp = await fetch(BACKEND_API + '/character/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appearance: { avatar_name: name, avatar_subtitle: subtitle, avatar_color: color, avatar_bg_color: bgColor },
        behavior: { greeting: greeting }
      })
    });
    const data = await resp.json();
    if (data.success) {
      showSaveFeedback('外观设置已保存', true);
    }
  } catch (e) {
    showSaveFeedback('已本地保存（后端不可用）', false);
  }

  // 同步更新全局欢迎语
  localStorage.setItem('ls_greeting', greeting);
}

// ===== 服装网格渲染 =====
function renderOutfitGrid() {
  const grid = document.getElementById('amOutfitGrid');
  if (!grid) return;

  const currentId = avatarProfile && avatarProfile.clothing ? avatarProfile.clothing.current : 'chan_yi_hanfu';

  const outfits = [
    { id: 'chan_yi_hanfu', name: '禅意汉服', desc: '淡雅青白配色，宽袖飘逸，彰显佛门静雅之气' },
    { id: 'su_ya_jushi', name: '素雅居士', desc: '米白素衣，简约不染，体现修行者朴实本色' },
    { id: 'lian_hua_xian', name: '莲花仙裙', desc: '淡粉渐变长裙，裙摆绣莲花纹样，优雅灵动' },
    { id: 'tang_zhuang', name: '唐装古典', desc: '金色祥云纹唐装，庄重华贵，与梵宫艺术呼应' },
    { id: 'yun_shui_chan', name: '云水禅心', desc: '渐变蓝白长袍，如水墨晕染，空灵通透' },
    { id: 'lingshan_zhuan', name: '灵山专属', desc: '景区定制款，金色灵山LOGO刺绣，职业导览风' }
  ];

  grid.innerHTML = outfits.map(o => {
    const style = AVATAR_OUTFIT_COLORS[o.id] || { bg: '#eee', icon: '👘' };
    const isCurrent = o.id === currentId;
    return `
      <div class="am-outfit-card${isCurrent ? ' current' : ''}" data-id="${o.id}" onclick="selectOutfit('${o.id}')">
        <div class="am-outfit-preview" style="background:${style.bg}">${style.icon}</div>
        <div class="am-outfit-name">${o.name}</div>
        <div class="am-outfit-desc">${o.desc}</div>
      </div>
    `;
  }).join('');
}

async function selectOutfit(outfitId) {
  // 本地即时更新
  if (!avatarProfile) avatarProfile = { appearance: {}, clothing: {}, voice: {}, behavior: {} };
  if (!avatarProfile.clothing) avatarProfile.clothing = {};
  avatarProfile.clothing.current = outfitId;
  localStorage.setItem('ls_avatar_profile', JSON.stringify(avatarProfile));
  updatePreview();
  renderOutfitGrid();

  // 同步到后端
  try {
    await fetch(BACKEND_API + '/character/outfit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfitId: outfitId })
    });
    showSaveFeedback('服装已切换', true);
  } catch (e) {
    showSaveFeedback('已本地切换（后端不可用）', false);
  }
}

// ===== 声线卡片渲染 =====
function renderVoiceCards() {
  const container = document.getElementById('amVoiceCards');
  if (!container) return;

  const currentType = avatarProfile && avatarProfile.voice ? avatarProfile.voice.voice_type : 'march7th';

  const voices = [
    { id: 'march7th', name: '三月七 (March 7th)', desc: '年轻活泼女声，GPT-SoVITS v3 权重，特别适合导览讲解和景点介绍' }
  ];

  container.innerHTML = voices.map(v => {
    const isCurrent = v.id === currentType;
    return `
      <div class="am-voice-card${isCurrent ? ' current' : ''}" onclick="selectVoice('${v.id}')">
        <div class="am-voice-card-header">
          <span class="am-voice-card-name">${v.name}</span>
          <span class="am-voice-card-badge">${isCurrent ? '当前' : '可选'}</span>
        </div>
        <div class="am-voice-card-desc">${v.desc}</div>
      </div>
    `;
  }).join('');
}

async function selectVoice(voiceId) {
  if (!avatarProfile) avatarProfile = { appearance: {}, clothing: {}, voice: {}, behavior: {} };
  if (!avatarProfile.voice) avatarProfile.voice = {};
  avatarProfile.voice.voice_type = voiceId;
  if (voiceId === 'march7th') {
    avatarProfile.voice.voice_name = '三月七 (March 7th) v3';
  }
  localStorage.setItem('ls_avatar_profile', JSON.stringify(avatarProfile));
  updatePreview();
  renderVoiceCards();
}

// ===== 声音设置保存 =====
async function saveVoice() {
  const speed = parseFloat(document.getElementById('amSpeedSlider').value);
  const pitch = parseFloat(document.getElementById('amPitchSlider').value);
  const volume = parseInt(document.getElementById('amVolumeSlider').value) / 100;

  let emotion = 'warm';
  document.querySelectorAll('.am-emotion-btn').forEach(b => {
    if (b.classList.contains('active')) emotion = b.dataset.emotion;
  });

  // 本地更新
  if (!avatarProfile) avatarProfile = { appearance: {}, clothing: {}, voice: {}, behavior: {} };
  if (!avatarProfile.voice) avatarProfile.voice = {};
  avatarProfile.voice.voice_speed = speed;
  avatarProfile.voice.voice_pitch = pitch;
  avatarProfile.voice.voice_volume = volume;
  avatarProfile.voice.voice_emotion = emotion;
  localStorage.setItem('ls_avatar_profile', JSON.stringify(avatarProfile));
  updatePreview();

  // 同步 GPT_SOVITS_CONFIG
  window.GPT_SOVITS_CONFIG = window.GPT_SOVITS_CONFIG || {};
  window.GPT_SOVITS_CONFIG.speed = speed;
  window.GPT_SOVITS_CONFIG.pitch = pitch;
  window.GPT_SOVITS_CONFIG.volume = volume;
  window.GPT_SOVITS_CONFIG.emotion = emotion;

  // 同步到后端
  try {
    await fetch(BACKEND_API + '/character/voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_speed: String(speed),
        voice_pitch: String(pitch),
        voice_volume: String(volume),
        voice_emotion: emotion
      })
    });
    showSaveFeedback('声音设置已保存', true);
  } catch (e) {
    showSaveFeedback('已本地保存（后端不可用）', false);
  }
}

// ===== 情感风格切换 =====
function setVoiceEmotion(emotion, btn) {
  document.querySelectorAll('.am-emotion-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ===== 滑块值更新 =====
function updateSliderVal(elId, val, suffix) {
  const el = document.getElementById(elId);
  if (el) el.textContent = val + suffix;
}

// ===== 主题色选择 =====
function setAvatarColor(color) {
  const input = document.getElementById('amColorInput');
  const hex = document.getElementById('amColorHex');
  if (input) input.value = color;
  if (hex) hex.textContent = color;
  updatePreview();
}

// ===== 头像上传 =====
async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('amUploadStatus');
  status.className = 'am-upload-status';
  status.style.display = 'block';
  status.textContent = '上传中...';

  // 先本地预览
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('amPreviewImage');
    if (preview) preview.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // 上传到后端
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const resp = await fetch(BACKEND_API + '/character/avatar', {
      method: 'POST',
      body: formData
    });
    const data = await resp.json();

    if (data.success) {
      status.className = 'am-upload-status success';
      status.textContent = '头像上传成功！';

      // 更新本地配置
      if (!avatarProfile) avatarProfile = { appearance: {}, clothing: {}, voice: {}, behavior: {} };
      avatarProfile.appearance.avatar_image = data.frontend_path;
      localStorage.setItem('ls_avatar_profile', JSON.stringify(avatarProfile));

      setTimeout(() => { status.style.display = 'none'; }, 3000);
    } else {
      throw new Error(data.error || '上传失败');
    }
  } catch (e) {
    status.className = 'am-upload-status error';
    status.textContent = '上传失败: ' + e.message + '（已本地预览）';
    // 本地预览仍然有效
    setTimeout(() => { status.style.display = 'none'; }, 5000);
  }
}

// ===== 试听声音 =====
function testVoice() {
  // 播放一条测试语音
  const testText = '您好！我是小灵，灵山胜境AI数字人导游，很高兴为您服务。';

  if (window.Live2DGuide && window.Live2DGuide.isReady && window.Live2DGuide.isReady()) {
    window.Live2DGuide.say && window.Live2DGuide.say(testText);
    window.Live2DGuide.speak && window.Live2DGuide.speak(testText);
    window.Live2DGuide.setExpression && window.Live2DGuide.setExpression('wave');
  } else if (window.Live2DGuide && window.Live2DGuide.onReady) {
    window.Live2DGuide.onReady(function() {
      window.Live2DGuide.say && window.Live2DGuide.say(testText);
      window.Live2DGuide.setExpression && window.Live2DGuide.setExpression('wave');
    });
  } else {
    // 使用浏览器原生 TTS 作为回退
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.lang = 'zh-CN';
      utterance.rate = parseFloat(document.getElementById('amSpeedSlider')?.value || 1.0);
      speechSynthesis.speak(utterance);
    } else {
      showSaveFeedback('语音引擎未就绪，请先切换到AI导游页激活数字人', false);
    }
  }

  showSaveFeedback('试听中... ' + testText.substring(0, 20) + '...', true);
}

// ===== 保存反馈 =====
function showSaveFeedback(msg, success) {
  // 在所有保存按钮上显示反馈
  const saveBtns = document.querySelectorAll('.am-save-btn');
  saveBtns.forEach(btn => {
    const originalText = btn.textContent;
    btn.textContent = msg;
    btn.classList.toggle('saved', success);
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('saved');
    }, 2000);
  });
}

// ===== 初始化形象管理 =====
function initAvatarManager() {
  loadAvatarProfile();

  // 绑定外观字段输入事件
  ['amNameInput', 'amSubtitleInput', 'amGreetingInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
  document.getElementById('amColorInput')?.addEventListener('input', function() {
    document.getElementById('amColorHex').textContent = this.value;
    updatePreview();
  });
  document.getElementById('amBgColorInput')?.addEventListener('input', function() {
    document.getElementById('amBgColorHex').textContent = this.value;
    updatePreview();
  });
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', function() {
  init();
  initAvatarManager();
});

// ===== 游客位置定位 / 导航 =====

// 顶部状态条辅助
function showLocateStatus(text, kind) {
  const el = document.getElementById('locateStatus');
  const txt = document.getElementById('locateStatusText');
  if (!el || !txt) return;
  el.style.display = 'flex';
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
  txt.textContent = text;
}

function hideLocateStatus() {
  const el = document.getElementById('locateStatus');
  if (el) el.style.display = 'none';
}

// 定位游客位置：优先浏览器 GPS；失败时使用默认的景区内虚拟位置
function locateMe() {
  if (!_tmap) {
    showLocateStatus('地图尚未加载完成，请稍后再试', 'error');
    setTimeout(hideLocateStatus, 2000);
    return;
  }

  const btn = document.getElementById('locateMeBtn');
  if (btn) btn.classList.add('locating');
  showLocateStatus('正在定位...', null);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // GPS 落在灵山胜境附近则采纳（粗略范围 31.40-31.45, 120.06-120.12）
        const inLingshan = lat > 31.40 && lat < 31.45 && lng > 120.06 && lng < 120.12;
        if (inLingshan) {
          applyUserLocation({ lat, lng, name: 'GPS 当前位置' });
          showLocateStatus('已使用 GPS 定位（精度 ±' + Math.round(pos.coords.accuracy || 0) + 'm）', 'success');
        } else {
          applyUserLocation(DEFAULT_USER_LOCATION);
          showLocateStatus('GPS 偏离景区，已使用「' + DEFAULT_USER_LOCATION.name + '」', 'success');
        }
        setTimeout(hideLocateStatus, 2500);
        if (btn) btn.classList.remove('locating');
      },
      function() {
        applyUserLocation(DEFAULT_USER_LOCATION);
        showLocateStatus('无法获取 GPS，已使用「' + DEFAULT_USER_LOCATION.name + '」', 'error');
        setTimeout(hideLocateStatus, 2500);
        if (btn) btn.classList.remove('locating');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  } else {
    applyUserLocation(DEFAULT_USER_LOCATION);
    showLocateStatus('浏览器不支持定位，已使用「' + DEFAULT_USER_LOCATION.name + '」', 'error');
    setTimeout(hideLocateStatus, 2500);
    if (btn) btn.classList.remove('locating');
  }
}

function applyUserLocation(loc) {
  // 更新地图标记
  if (_tmapInited) {
    addUserLocationMarker(loc);
  } else {
    _userLocationLatLng = { lat: loc.lat, lng: loc.lng };
  }
  // 移动地图视角
  if (_tmap) {
    _tmap.panTo(new TMap.LatLng(loc.lat, loc.lng));
    if (_tmap.getZoom() < 17) _tmap.zoomTo(17);
  }
  // 刷新距离显示
  updateSpotDistances();
  // 显示"导航到最近"按钮
  const nb = document.getElementById('nearestBtn');
  if (nb) nb.style.display = 'flex';
  const lb = document.getElementById('locateMeBtn');
  if (lb) lb.classList.add('active');
}

// 找到距离游客位置最近的景点并打开详情
function navigateToNearestSpot() {
  if (!_userLocationLatLng) {
    locateMe();
    return;
  }
  let nearest = -1;
  let minDist = Infinity;
  SCENIC_SPOTS.forEach(function(spot, i) {
    const c = parseCoords(spot.coordinates);
    const d = haversineDistance(_userLocationLatLng, c);
    if (d < minDist) { minDist = d; nearest = i; }
  });
  if (nearest < 0) return;
  // 在地图上选中最远点
  const spot = SCENIC_SPOTS[nearest];
  if (window.Live2DGuide && window.Live2DGuide.say) {
    window.Live2DGuide.say('距您最近的景点是「' + spot.name + '」，步行约 ' + walkMinutes(minDist) + ' 分钟，我带您过去~');
  }
  onMarkerClick(nearest);
}

// 步行导航：拉起腾讯地图 APP 或 Web 路线规划（H5）
function startWalkNavigation() {
  const idx = window._currentSpotIndex;
  if (idx == null) return;
  const spot = SCENIC_SPOTS[idx];
  if (!_userLocationLatLng) {
    showLocateStatus('请先点击"定位我的位置"', 'error');
    setTimeout(hideLocateStatus, 2000);
    return;
  }
  const c = parseCoords(spot.coordinates);
  // 拉起腾讯地图 H5 路线页（from=游客位置 to=景点）
  const url = 'https://apis.map.qq.com/uri/v1/routeplan?type=walk' +
    '&from=' + encodeURIComponent('我的位置') +
    '&fromcoord=' + _userLocationLatLng.lat + ',' + _userLocationLatLng.lng +
    '&to=' + encodeURIComponent(spot.name) +
    '&tocoord=' + c.lat + ',' + c.lng +
    '&referer=灵山胜境AI导游';
  window.open(url, '_blank');
}

// ===== 表情映射 & 口型同步管理 =====

let _exprSubTab = 'expression';
let _expressionMappings = [];
let _lipSyncConfig = null;
let _lipSyncAnimTimer = null;

function switchExprSubTab(tab, btn) {
  _exprSubTab = tab;
  document.querySelectorAll('.am-subtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.am-expr-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tab === 'expression' ? 'amExprPanel' : 'amLipSyncPanel').classList.add('active');
}

function toggleExprMotionFields() {
  const kind = document.getElementById('amNewExprKind').value;
  document.getElementById('amExprNameField').style.display = kind === 'expression' ? '' : 'none';
  document.getElementById('amExprGroupField').style.display = kind === 'motion' ? '' : 'none';
  document.getElementById('amExprIndexField').style.display = kind === 'motion' ? '' : 'none';
}

async function loadExpressionMappings() {
  try {
    const resp = await fetch(BACKEND_API + '/character/expressions');
    const data = await resp.json();
    if (data.success) {
      _expressionMappings = data.data || [];
    }
  } catch (e) {
    // 从 localStorage 加载后备
    const cached = localStorage.getItem('ls_expr_mappings');
    _expressionMappings = cached ? JSON.parse(cached) : getDefaultExpressions();
  }
  if (!_expressionMappings.length) _expressionMappings = getDefaultExpressions();
  renderExpressionList();
}

function getDefaultExpressions() {
  return [
    { trigger: 'smile', kind: 'expression', name: 'smile', group: '', index: 0 },
    { trigger: 'happy', kind: 'expression', name: 'smile', group: '', index: 0 },
    { trigger: 'think', kind: 'expression', name: 'think', group: '', index: 0 },
    { trigger: 'sad', kind: 'expression', name: 'sad', group: '', index: 0 },
    { trigger: 'surprise', kind: 'expression', name: 'surprise', group: '', index: 0 },
    { trigger: 'shy', kind: 'expression', name: 'shy', group: '', index: 0 },
    { trigger: 'angry', kind: 'expression', name: 'angry', group: '', index: 0 },
    { trigger: 'wave', kind: 'motion', name: '', group: 'Greeting', index: 0 }
  ];
}

function renderExpressionList() {
  const list = document.getElementById('amExprList');
  if (!list) return;

  list.innerHTML = _expressionMappings.map((m, i) => {
    const kindLabel = m.kind === 'expression' ? '表情' : '动作';
    const nameDisplay = m.kind === 'expression' ? m.name : (m.group + ' #' + m.index);
    return `
      <div class="am-expr-item">
        <span class="am-expr-item-trigger">${escHtml(m.trigger)}</span>
        <span class="am-expr-item-arrow">→</span>
        <span class="am-expr-item-kind">${kindLabel}</span>
        <span class="am-expr-item-name">${escHtml(nameDisplay)}</span>
        <button class="am-expr-item-del" onclick="deleteExpressionMapping(${i})" title="删除">×</button>
      </div>
    `;
  }).join('');
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function addExpressionMapping() {
  const trigger = document.getElementById('amNewExprTrigger').value.trim();
  const kind = document.getElementById('amNewExprKind').value;
  let name = '', group = '', index = 0;

  if (kind === 'expression') {
    name = document.getElementById('amNewExprName').value.trim();
    if (!trigger || !name) { alert('请填写触发词和表情名'); return; }
  } else {
    group = document.getElementById('amNewExprGroup').value.trim();
    index = parseInt(document.getElementById('amNewExprIndex').value) || 0;
    if (!trigger || !group) { alert('请填写触发词和动作组名'); return; }
  }

  const newMapping = { trigger, kind, name, group, index };

  // 去重
  const exists = _expressionMappings.findIndex(m => m.trigger === trigger && m.kind === kind);
  if (exists >= 0) _expressionMappings[exists] = newMapping;
  else _expressionMappings.push(newMapping);

  // 保存到后端
  try {
    await fetch(BACKEND_API + '/character/expressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMapping)
    });
  } catch (e) { /* 静默回退到本地 */ }

  localStorage.setItem('ls_expr_mappings', JSON.stringify(_expressionMappings));
  syncExprMapToLive2D();
  renderExpressionList();

  // 清空表单
  document.getElementById('amNewExprTrigger').value = '';
  if (kind === 'expression') document.getElementById('amNewExprName').value = '';
  else document.getElementById('amNewExprGroup').value = '';
}

function deleteExpressionMapping(index) {
  const removed = _expressionMappings[index];
  _expressionMappings.splice(index, 1);

  try {
    fetch(BACKEND_API + '/character/expressions/' + encodeURIComponent(removed.trigger), {
      method: 'DELETE'
    });
  } catch (e) { /**/ }

  localStorage.setItem('ls_expr_mappings', JSON.stringify(_expressionMappings));
  syncExprMapToLive2D();
  renderExpressionList();
}

function syncExprMapToLive2D() {
  if (!window.Live2DGuide || !window.Live2DGuide.setExpressionMap) return;
  const map = {};
  _expressionMappings.forEach(m => {
    map[m.trigger] = { kind: m.kind, name: m.name, group: m.group, index: m.index };
  });
  window.Live2DGuide.setExpressionMap(map);
}

// 后端 snake_case ↔ 前端 camelCase 映射
const LIPSYNC_KEY_MAP = {
  param_id: 'paramId', amplitude: 'amplitude', smooth_factor: 'smoothFactor',
  poll_interval: 'pollInterval', speed_base: 'speedBase', volume_smooth: 'volumeSmooth'
};
const LIPSYNC_KEY_MAP_REV = Object.fromEntries(Object.entries(LIPSYNC_KEY_MAP).map(([k, v]) => [v, k]));

async function loadLipSyncConfig() {
  try {
    const resp = await fetch(BACKEND_API + '/character/lip-sync');
    const data = await resp.json();
    if (data.success && data.data) {
      // 后端返回 snake_case → 前端 camelCase
      _lipSyncConfig = {};
      for (const [snakeKey, val] of Object.entries(data.data)) {
        const camelKey = LIPSYNC_KEY_MAP[snakeKey] || snakeKey;
        _lipSyncConfig[camelKey] = val;
      }
    }
  } catch (e) {
    _lipSyncConfig = JSON.parse(localStorage.getItem('ls_lipsync_config') || '{}') || {};
  }

  if (!_lipSyncConfig || Object.keys(_lipSyncConfig).length === 0) {
    _lipSyncConfig = {
      paramId: 'ParamMouthOpenY',
      amplitude: 0.6,
      smoothFactor: 0.15,
      pollInterval: 50,
      speedBase: 10
    };
  }

  applyLipSyncConfigToUI();
}

function applyLipSyncConfigToUI() {
  const c = _lipSyncConfig;
  const el = id => document.getElementById(id);
  if (el('amLipParamId')) el('amLipParamId').value = c.paramId || 'ParamMouthOpenY';
  if (el('amLipAmplitude')) { el('amLipAmplitude').value = c.amplitude || 0.6; updateSliderVal('amLipAmpVal', c.amplitude || 0.6, ''); }
  if (el('amLipSmoothFactor')) { el('amLipSmoothFactor').value = c.smoothFactor || 0.15; updateSliderVal('amLipSmoothVal', c.smoothFactor || 0.15, ''); }
  if (el('amLipPollInterval')) { el('amLipPollInterval').value = c.pollInterval || 50; updateSliderVal('amLipPollVal', c.pollInterval || 50, 'ms'); }
  if (el('amLipSpeedBase')) { el('amLipSpeedBase').value = c.speedBase || 10; updateSliderVal('amLipSpeedVal', c.speedBase || 10, ''); }
}

async function saveLipSync() {
  const el = id => document.getElementById(id);
  _lipSyncConfig = {
    paramId: el('amLipParamId').value.trim() || 'ParamMouthOpenY',
    amplitude: parseFloat(el('amLipAmplitude').value) || 0.6,
    smoothFactor: parseFloat(el('amLipSmoothFactor').value) || 0.15,
    pollInterval: parseInt(el('amLipPollInterval').value) || 50,
    speedBase: parseInt(el('amLipSpeedBase').value) || 10
  };

  localStorage.setItem('ls_lipsync_config', JSON.stringify(_lipSyncConfig));

  // 推送到 Live2D 集成
  if (window.Live2DGuide && window.Live2DGuide.updateConfig) {
    window.Live2DGuide.updateConfig({
      speakParamId: _lipSyncConfig.paramId,
      speakParamValue: _lipSyncConfig.amplitude,
      smoothFactor: _lipSyncConfig.smoothFactor,
      pollInterval: _lipSyncConfig.pollInterval
    });
  }

  // 保存到后端（camelCase → snake_case）
  const backendPayload = {};
  for (const [camelKey, val] of Object.entries(_lipSyncConfig)) {
    const snakeKey = LIPSYNC_KEY_MAP_REV[camelKey] || camelKey;
    backendPayload[snakeKey] = val;
  }
  try {
    const resp = await fetch(BACKEND_API + '/character/lip-sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload)
    });
    const data = await resp.json();
    if (data.success) {
      showSaveFeedback('口型配置已保存', true);
      return;
    }
  } catch (e) { /* fallback */ }
  showSaveFeedback('已本地保存（后端不可用）', false);
}

function testLipSyncPreview() {
  if (_lipSyncAnimTimer) {
    clearInterval(_lipSyncAnimTimer);
    _lipSyncAnimTimer = null;
    const btn = document.getElementById('amLipSyncTestBtn');
    if (btn) { btn.classList.remove('active'); btn.textContent = '▶ 预览动画'; }
    resetMouthSvg();
    return;
  }

  const btn = document.getElementById('amLipSyncTestBtn');
  if (btn) { btn.classList.add('active'); btn.textContent = '⏸ 停止预览'; }

  const cfg = _lipSyncConfig || { amplitude: 0.6, smoothFactor: 0.15, pollInterval: 50, speedBase: 10 };
  const scale = 0.6;
  let mouthValue = 0;
  let direction = 1;

  _lipSyncAnimTimer = setInterval(() => {
    // 正弦 + 随机扰动模拟说话节奏
    const target = Math.abs(Math.sin(Date.now() / (1000 / cfg.speedBase) + Math.random()));
    mouthValue = mouthValue + (target - mouthValue) * cfg.smoothFactor;
    const openY = mouthValue * cfg.amplitude * scale * 30;
    const svg = document.getElementById('amMouthSvg');
    if (svg) {
      const cy = 20 + openY / 2;
      const ry = Math.max(2, openY / 2);
      svg.innerHTML = '<ellipse cx="40" cy="' + cy + '" rx="25" ry="' + ry + '" fill="none" stroke="#5D4037" stroke-width="2" stroke-linecap="round"/>';
    }
  }, cfg.pollInterval);
}

function resetMouthSvg() {
  const svg = document.getElementById('amMouthSvg');
  if (svg) {
    svg.innerHTML = '<path d="M15,20 Q40,25 65,20" fill="none" stroke="#5D4037" stroke-width="2" stroke-linecap="round"/>';
  }
}

// ============================================================
//  数字人动作管理
// ============================================================
let _motionConfig = null;
let _motionTriggers = [];
let _motions = [];

const MOTION_ICONS = {
  '眨眼': '😉',
  '托脸': '🤗',
  'greet': '👋',
  'welcome': '🙋',
  'bye': '👋',
  'happy': '😄',
  'default': '🏃'
};

/** 加载动作配置 */
async function loadMotionConfig() {
  try {
    const resp = await fetch(BACKEND_API + '/character/motion-config');
    const data = await resp.json();
    if (data.success && data.data) {
      _motionConfig = data.data;
      _motions = data.data.motions || [];
      _motionTriggers = data.data.triggers || [];
    }
  } catch (e) {
    _motionConfig = JSON.parse(localStorage.getItem('ls_motion_config') || '{}');
  }

  if (!_motionConfig) {
    _motionConfig = { idleAuto: true, idleInterval: 12, idleRandomize: true, idleEnabled: ['zhaiyan','tuolian'], autoPlayOnEmotion: true };
  }

  // 清理旧缓存：zhaoxiang → tuolian，去重
  if (_motionConfig.idleEnabled) {
    const cleaned = _motionConfig.idleEnabled
      .map(n => n === 'zhaoxiang' ? 'tuolian' : n)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (cleaned.length !== _motionConfig.idleEnabled.length ||
        cleaned.some((v, i) => v !== _motionConfig.idleEnabled[i])) {
      _motionConfig.idleEnabled = cleaned;
      localStorage.setItem('ls_motion_config', JSON.stringify(_motionConfig));
    }
  }

  applyMotionConfigToUI();
  renderMotionCards();

  // 同步到 Live2D 引擎
  if (window.Live2DGuide && window.Live2DGuide.updateConfig) {
    window.Live2DGuide.updateConfig({
      idleAuto: _motionConfig.idleAuto,
      idleInterval: _motionConfig.idleInterval,
      idleRandomize: _motionConfig.idleRandomize,
      idleEnabled: _motionConfig.idleEnabled,
      autoPlayOnEmotion: _motionConfig.autoPlayOnEmotion
    });
  }
}

function applyMotionConfigToUI() {
  const cfg = _motionConfig;
  if (!cfg) return;

  const elAuto = document.getElementById('amMotionIdleAuto');
  const elRand = document.getElementById('amMotionRandomize');
  const elInt = document.getElementById('amMotionInterval');
  const elVal = document.getElementById('amMotionIntVal');
  const elEmo = document.getElementById('amMotionAutoEmotion');

  if (elAuto) elAuto.checked = cfg.idleAuto !== false;
  if (elRand) elRand.checked = cfg.idleRandomize !== false;
  if (elInt) elInt.value = cfg.idleInterval || 12;
  if (elVal) elVal.textContent = (cfg.idleInterval || 12) + '秒';
  if (elEmo) elEmo.checked = cfg.autoPlayOnEmotion !== false;

  // 渲染启用动作复选框
  const container = document.getElementById('amMotionCheckboxes');
  if (container && _motions.length > 0) {
    const enabled = cfg.idleEnabled || [];
    container.innerHTML = _motions.map(m => {
      const id = m.filename ? m.filename.replace('.motion3.json', '') : m.name;
      return '<label class="am-motion-checkbox" style="cursor:pointer;">' +
        '<input type="checkbox" value="' + id + '" ' + (enabled.includes(id) ? 'checked' : '') +
        ' onchange="saveMotionCheckboxes()">&nbsp;' + m.name +
        '</label>';
    }).join('');
  }
}

/** 保存复选框变更 */
async function saveMotionCheckboxes() {
  const checks = document.querySelectorAll('#amMotionCheckboxes input[type="checkbox"]:checked');
  const enabled = Array.from(checks).map(c => c.value);
  _motionConfig.idleEnabled = enabled;
  localStorage.setItem('ls_motion_config', JSON.stringify(_motionConfig));
  await saveMotionConfig();
}

/** 渲染动作卡片 */
function renderMotionCards() {
  const container = document.getElementById('amMotionCards');
  if (!container || !_motions.length) return;

  container.innerHTML = _motions.map(m => {
    const icon = MOTION_ICONS[m.name] || MOTION_ICONS['default'];
    const id = m.filename ? m.filename.replace('.motion3.json', '') : m.name;
    return '<div class="am-motion-card" id="amMotionCard_'+id+'">' +
      '<div class="am-motion-card-icon">' + icon + '</div>' +
      '<div class="am-motion-card-info">' +
        '<div class="am-motion-card-name">' + m.name + '</div>' +
        '<div class="am-motion-card-desc">' + (m.desc || '动作') + '</div>' +
        '<div class="am-motion-card-meta">' + m.group + '[' + m.index + '] · ' + (m.filename || '') + '</div>' +
      '</div>' +
      '<div class="am-motion-card-actions">' +
        '<button class="am-motion-preview-btn" id="amMotionBtn_'+id+'" onclick="previewMotion(\'' + m.group + '\',' + m.index + ',\'' + id + '\')">▶ 预览</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // 渲染触发动作映射的新增下拉框
  const select = document.getElementById('amNewTriggerMotion');
  if (select) {
    select.innerHTML = _motions.map(m =>
      '<option value="' + m.group + ':' + m.index + '">' + m.name + ' (' + m.group + '[' + m.index + '])</option>'
    ).join('');
  }
}

/** 预览动作（在数字人身上播放） */
function previewMotion(group, index, id) {
  const btn = document.getElementById('amMotionBtn_' + id);
  const card = document.getElementById('amMotionCard_' + id);

  // Visual feedback
  if (btn) { btn.textContent = '⏸ 播放中...'; btn.classList.add('active'); }
  if (card) card.classList.add('playing');

  // 在 Live2D 数字人上播放
  if (window.Live2DGuide && window.Live2DGuide.isReady && typeof window.__live2dPlayMotion === 'function') {
    window.__live2dPlayMotion(group, index);
  } else if (window.Live2DGuide && window.Live2DGuide.isReady) {
    // 通过 expression map 的方式触发
    window.Live2DGuide.setExpressionMap({
      '_motion_preview': { kind: 'motion', name: '', group: group, index: index }
    });
    window.Live2DGuide.setExpression('_motion_preview');
  }

  // 恢复按钮
  setTimeout(() => {
    if (btn) { btn.textContent = '▶ 预览'; btn.classList.remove('active'); }
    if (card) card.classList.remove('playing');
  }, 3000);
}

/** 保存动作配置到后端 */
async function saveMotionConfig() {
  const elAuto = document.getElementById('amMotionIdleAuto');
  const elRand = document.getElementById('amMotionRandomize');
  const elInt = document.getElementById('amMotionInterval');
  const elEmo = document.getElementById('amMotionAutoEmotion');

  // 去重 + 兼容旧缓存
  const raw = _motionConfig ? (_motionConfig.idleEnabled || ['zhaiyan','tuolian']) : ['zhaiyan','tuolian'];
  const idleEnabled = [...new Set(raw.map(n => n === 'zhaoxiang' ? 'tuolian' : n))];
  
  const config = {
    idleAuto: elAuto ? elAuto.checked : true,
    idleRandomize: elRand ? elRand.checked : true,
    idleInterval: elInt ? parseInt(elInt.value) : 12,
    idleEnabled,
    autoPlayOnEmotion: elEmo ? elEmo.checked : true
  };

  // 本地缓存
  _motionConfig = { ..._motionConfig, ...config };
  localStorage.setItem('ls_motion_config', JSON.stringify(_motionConfig));

  // 同步到 Live2D
  if (window.Live2DGuide && window.Live2DGuide.updateConfig) {
    window.Live2DGuide.updateConfig({ motion: config });
  }

  // 后端持久化
  try {
    await fetch(BACKEND_API + '/character/motion-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch (e) {
    console.warn('[Motion] 保存动作配置失败:', e.message);
  }
}

/** 加载触发动作映射 */
async function loadMotionTriggers() {
  if (_motionTriggers.length === 0) {
    try {
      const resp = await fetch(BACKEND_API + '/character/motion-config');
      const data = await resp.json();
      if (data.success && data.data) {
        _motionTriggers = data.data.triggers || [];
      }
    } catch (e) {}
  }
  renderMotionTriggers();
}

function renderMotionTriggers() {
  const container = document.getElementById('amMotionTriggers');
  if (!container) return;

  if (_motionTriggers.length === 0) {
    container.innerHTML = '<div style="color:#999;font-size:13px;padding:10px 0;">暂无触发映射，请在下方添加</div>';
    return;
  }

  container.innerHTML = _motionTriggers.map((t, i) => {
    const icon = MOTION_ICONS[t.trigger] || MOTION_ICONS[t.name] || MOTION_ICONS['default'];
    return '<div class="am-motion-trigger-item">' +
      '<span class="am-motion-trigger-word">' + t.trigger + '</span>' +
      '<span class="am-motion-trigger-arrow">→</span>' +
      '<span class="am-motion-trigger-icon">' + icon + '</span>' +
      '<span class="am-motion-trigger-name">' + (t.name || (t.group + '[' + t.index + ']')) + '</span>' +
      '<span class="am-motion-trigger-desc">' + (t.desc || '') + '</span>' +
      '<button class="am-motion-trigger-delete" onclick="deleteMotionTrigger(\'' + t.trigger + '\')" title="删除">×</button>' +
    '</div>';
  }).join('');
}

/** 新增触发动作映射 */
async function addMotionTrigger() {
  const wordInput = document.getElementById('amNewTriggerWord');
  const select = document.getElementById('amNewTriggerMotion');
  const trigger = wordInput.value.trim();
  if (!trigger) { wordInput.focus(); return; }
  if (!select.value) return;

  const [group, indexStr] = select.value.split(':');
  const index = parseInt(indexStr) || 0;
  const motion = _motions.find(m => m.group === group && m.index === index);
  const name = motion ? motion.name : (group + '[' + index + ']');

  try {
    const resp = await fetch(BACKEND_API + '/character/motion-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger, group, index, name, desc: name + '触发' })
    });
    const data = await resp.json();
    if (data.success) {
      _motionTriggers.push({ trigger, group, index, name, desc: name + '触发' });
      renderMotionTriggers();
      wordInput.value = '';
      showSaveFeedback('触发映射已添加 ✓');
    }
  } catch (e) {
    console.warn('[Motion] 添加触发映射失败:', e.message);
  }
}

/** 删除触发动作映射 */
async function deleteMotionTrigger(trigger) {
  if (!confirm('确认删除触发映射 "' + trigger + '" 吗？')) return;

  try {
    const resp = await fetch(BACKEND_API + '/character/motion-trigger/' + trigger, {
      method: 'DELETE'
    });
    const data = await resp.json();
    if (data.success) {
      _motionTriggers = _motionTriggers.filter(t => t.trigger !== trigger);
      renderMotionTriggers();
      showSaveFeedback('触发映射已删除 ✓');
    }
  } catch (e) {
    console.warn('[Motion] 删除触发映射失败:', e.message);
  }
}

// ===== 小提示反馈 =====
function showSaveFeedback(msg) {
  let fb = document.getElementById('amSaveFeedback');
  if (!fb) {
    fb = document.createElement('div');
    fb.id = 'amSaveFeedback';
    fb.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#D4A846;color:#fff;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(180,130,50,0.3);transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(fb);
  }
  fb.textContent = msg;
  fb.style.opacity = '1';
  clearTimeout(fb._timeout);
  fb._timeout = setTimeout(() => { fb.style.opacity = '0'; }, 2000);
}

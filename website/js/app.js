// ===== 灵山胜境 AI数字人导游系统 - 应用逻辑 =====

// 当前状态
let currentPage = 'home';
let currentSpotIndex = 0;

// ===== 初始化 =====
function init() {
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

    console.log('[Map] 腾讯地图初始化完成');
  } catch (err) {
    console.error('[Map] 腾讯地图初始化失败:', err);
    _tmap = null;
    _tmapInited = false;
    setTimeout(initTencentMap, 800);
  }
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
  }

  // 地图移动到标记位置
  if (_tmap && _markerLayer) {
    const c = parseCoords(spot.coordinates);
    _tmap.panTo(new TMap.LatLng(c.lat, c.lng));
  }

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
  grid.innerHTML = SCENIC_SPOTS.map(function(spot, i) {
    return `
      <div class="map-spot-card-item" onclick="selectSpot(${i})">
        <div class="map-spot-card-item-header" style="background:${spot.tagColor}"></div>
        <div class="map-spot-card-item-body">
          <div class="map-spot-card-item-num" style="background:${spot.tagColor}">${i + 1}</div>
          <div class="map-spot-card-item-name">${spot.name}</div>
          <div class="map-spot-card-item-tag">${spot.tag}</div>
          <div class="map-spot-card-item-desc">${spot.description.substring(0, 100)}...</div>
          <div class="map-spot-card-item-more">查看详情 →</div>
        </div>
      </div>
    `;
  }).join('');
}

function selectSpot(index) {
  navigateTo('detail', index);
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

const DEEPSEEK_CONFIG = {
  apiKey: 'sk-7410ad40f3be457da3439339b533e735',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat'
};

const GPT_SOVITS_CONFIG = { character: '三月七' };
window.GPT_SOVITS_CONFIG = GPT_SOVITS_CONFIG;

const SYSTEM_PROMPT = {
  role: 'system',
  content: '你是小灵，灵山胜境AI数字人导游。你热情友好、知识渊博，专门回答关于灵山胜境旅游的问题。灵山胜境位于江苏省无锡市滨湖区马山国家风景名胜区。\n\n景点信息：\n1. 灵山大佛：通高88米，铜铸，世界最高青铜立佛。有217级登阶台阶。建议游览40分钟。\n2. 灵山梵宫：建筑面积7.2万㎡，含穹顶天象图、华藏世界琉璃壁画、《吉祥颂》演出。建议游览60分钟。\n3. 九龙灌浴：每天4场表演（10:00/11:30/14:00/15:30），高27.5米雕塑，可接取祈福圣水。\n4. 五印坛城：藏传佛教文化展示，有转经筒和彩窗。\n5. 祥符禅寺：千年古刹。\n\n门票：成人通票¥210/人，半价票¥105/人（1.2-1.5米儿童、60-69岁老人），免票（1.2米以下儿童、70岁以上老人、残疾人）。开放时间07:00-17:30。\n\n路线：轻松游览2-3小时（大佛→九龙灌浴→梵宫）；深度文化4-5小时（禅寺→大佛→灌浴→梵宫→坛城）；亲子互动3-4小时（灌浴→大佛→梵宫→坛城）。\n\n请用中文回答，语气亲切友好，适当使用emoji。回答简洁有条理，每次回答控制在200字以内。'
};

let conversationHistory = [];
let chatInitialized = false;
let isWaitingForAI = false;

async function callDeepSeek(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  const messages = [SYSTEM_PROMPT, ...conversationHistory.slice(-10)];

  try {
    const resp = await fetch(DEEPSEEK_CONFIG.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_CONFIG.apiKey
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!resp.ok) {
      throw new Error('API error: ' + resp.status);
    }

    const data = await resp.json();
    const reply = data.choices[0].message.content;
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[DeepSeek] 调用失败:', err);
    return '抱歉，我暂时无法连接到AI服务，请稍后再试。😔';
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

  const avatar = type === 'ai' ? '🧘' : '👤';
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

  // 调用 DeepSeek API
  callDeepSeek(text).then(reply => {
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
  callDeepSeek(text).then(reply => {
    addMapChatMessage('ai', reply);
  }).finally(() => {
    isWaitingForAI = false;
  });
}

function addMapChatMessage(type, text) {
  const messages = document.getElementById('mapChatMessages');
  if (!messages) return;

  const avatar = type === 'ai' ? '🧘' : '👤';
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

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);

/* ===== 灵山胜境 AI数字人导游 - Live2D 模型管理器 ===== */

;(function () {
  'use strict'

  // ---- 配置（运行时可通过 Live2DGuide.updateConfig() 更新）----
  const CONFIG = {
    modelPath: 'live2d-models/ling/ling.model3.json',
    characterName: '小灵',
    idleMotionGroup: 'Idle',
    speakParamId: 'ParamMouthOpenY',
    speakParamValue: 0.6,
    expressionDuration: 2500,
    smoothFactor: 0.15,
    volumeSmoothFactor: 0.3,
    pollInterval: 50,
    speedBase: 10,
    statusPeriod: 30,
    // 动作配置
    idleAuto: true,
    idleInterval: 12,
    idleRandomize: true,
    idleEnabled: ['zhaiyan', 'tuolian'],
    autoPlayOnEmotion: true,
    thinkMessages: [
      '让我想想...', '嗯...', '我看看怎么回答您', '稍等一下...',
      '查询中...', '正在思考...'
    ]
  }

  // ---- 状态 ----
  let live2dModel = null
  let canvasEl = null
  let hostEl = null
  let isModelLoaded = false
  let isSpeaking = false
  let currentExpression = null
  let _isPlayingMotion = false
  let speakTimer = null
  let thinkTimer = null
  let idleInterval = null
  let statusIndex = 0
  let modelReadyResolve = null
  let modelReadyPromise = null

  // ---- DOM 缓存 ----
  let charPanel, charCanvas, charStatus, charLabel, toggleBtn, chatToggle

  // ---- 公共 API ----
  window.Live2DGuide = {
    isReady: () => isModelLoaded,
    say: speak,
    speak: speak,
    think: startThinking,
    stopThink: stopThinking,
    setExpression: setExpression,
    setStatusText: function(text) {
      var bubble = document.getElementById('l2dBubble')
      var bubbleText = document.getElementById('l2dBubbleText')
      if (bubbleText) bubbleText.textContent = text
      if (bubble) bubble.classList.add('show')
      setStatus('thinking', text)
    },
    show: showPanel,
    hide: hidePanel,
    toggle: togglePanel,
    resize: () => { if (live2dModel) setTimeout(() => live2dModel.resize(), 100) },
    onReady: (fn) => {
      if (isModelLoaded) { fn(); return }
      modelReadyPromise = new Promise(r => { modelReadyResolve = r })
      modelReadyPromise.then(fn)
    },
    playMotion: playMotion,
    triggerMotion: triggerMotionByName
  }

  // ============================================================
  //  初始化
  // ============================================================
  function init () {
    console.log('[Live2D] 初始化数字人导游...')
    createPanel()
    loadDependencies()
  }

  function createPanel () {
    // 使用 innerHTML 创建面板结构
    const container = document.createElement('div')
    container.id = 'live2d-character'
    container.className = 'l2d-character-panel'
    container.innerHTML = `
      <div class="l2d-character-toggle" id="l2dToggle">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div class="l2d-character-main" id="l2dMain">
        <div class="l2d-character-header">
          <div class="l2d-status-indicator" id="l2dStatus"></div>
          <span class="l2d-character-name" id="l2dName">小灵</span>
          <span class="l2d-badge">AI 导游</span>
          <div class="l2d-header-actions">
            <button class="l2d-icon-btn" id="l2dToggleBtn" title="展开/收起">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            <button class="l2d-icon-btn l2d-close-btn" id="l2dCloseBtn" title="隐藏">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="l2d-character-stage" id="l2dStage">
          <div class="l2d-canvas-container" id="l2dCanvasContainer">
            <canvas id="l2dCanvas"></canvas>
            <div class="l2d-loading-overlay" id="l2dLoading">
              <div class="l2d-loading-spinner"></div>
              <span>小灵加载中...</span>
            </div>
            <div class="l2d-error-overlay" id="l2dError">
              <span>😔</span>
              <span>模型加载失败</span>
              <button class="l2d-retry-btn" onclick="location.reload()">重试</button>
            </div>
          </div>
          <div class="l2d-speech-bubble" id="l2dBubble">
            <span id="l2dBubbleText">您好！我是小灵，灵山胜境AI数字人导游 🧘</span>
          </div>
        </div>
        <div class="l2d-character-footer">
          <button class="l2d-action-btn" onclick="document.getElementById('chatInput')?.focus(); navigateTo('ai-chat')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            和小灵聊天
          </button>
        </div>
      </div>
    `
    document.body.appendChild(container)

    charPanel = container
    charCanvas = container.querySelector('#l2dCanvas')
    charStatus = container.querySelector('#l2dStatus')
    charLabel = container.querySelector('#l2dName')
    toggleBtn = container.querySelector('#l2dToggleBtn')
    chatToggle = container.querySelector('#l2dCloseBtn')

    container.querySelector('#l2dToggle').addEventListener('click', togglePanel)
    toggleBtn.addEventListener('click', toggleSize)
    chatToggle.addEventListener('click', hidePanel)

    // 默认展开
    setTimeout(() => charPanel.classList.add('expanded'), 100)
  }

  function showPanel () { charPanel?.classList.remove('hidden') }
  function hidePanel () { charPanel?.classList.add('hidden') }
  function togglePanel () { charPanel?.classList.toggle('hidden') }

  function toggleSize () {
    const main = document.getElementById('l2dMain')
    const isSmall = main.classList.toggle('compact')
    toggleBtn.innerHTML = isSmall
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>'
    if (live2dModel) setTimeout(() => live2dModel.resize(), 100)
  }

  function setStatus (type, text) {
    if (!charStatus) return
    charStatus.className = 'l2d-status-indicator ' + type
    charStatus.title = text || ''
  }

  // ============================================================
  //  加载依赖脚本（已在 HTML 中预加载，直接跳过）
  // ============================================================
  function loadDependencies () {
    onAllLoaded()
  }

  // ============================================================
  //  所有脚本加载完成
  // ============================================================
  async function onAllLoaded () {
    console.log('[Live2D] SDK 加载完成，初始化模型...')
    setStatus('thinking', '正在加载模型...')

    // file:// 协议下（Cordova APK）也尝试加载模型
    if (location.protocol === 'file:') {
      console.log('[Live2D] file:// 协议检测到，尝试直接加载本地模型...')
    }

    // 通过 http:// 协议加载模型
    try {
      await loadModel()
      isModelLoaded = true
      document.getElementById('l2dLoading').style.display = 'none'
      setStatus('online', '在线 - 小灵已准备好')
      // 异步加载远程配置（表情映射 + 口型参数）
      loadLive2DConfig()
      // 自检：确认嘴形参数可用
      testMouthParameter()
      startIdleCycle()
      modelReadyResolve?.()
      console.log('[Live2D] 数字人导游已就绪！')
    } catch (err) {
      console.error('[Live2D] 模型加载错误:', err)
      document.getElementById('l2dLoading').style.display = 'none'
      showLoadError(err)
      setStatus('offline', '模型加载失败')
    }
  }

  function showProtocolWarning () {
    const container = document.getElementById('l2dCanvasContainer')
    if (!container) return
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;padding:16px;text-align:center;color:#999;">
        <div style="font-size:48px;line-height:1;">⚠️</div>
        <div style="font-size:13px;font-weight:600;color:#e67e22;">请通过本地服务器打开</div>
        <div style="font-size:10px;color:#999;max-width:240px;line-height:1.6;">
          当前使用 <b>file://</b> 协议，浏览器禁止加载本地模型文件。<br><br>
          请双击运行 <code style="background:#f5f5f5;padding:1px 6px;border-radius:4px;font-size:10px;">server.cmd</code> 启动本地服务器，然后访问 <b>http://localhost:3000</b>
        </div>
        <button class="l2d-retry-btn" onclick="location.reload()" style="margin-top:8px;padding:6px 16px;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">刷新页面</button>
      </div>
    `
  }

  function showLoadError (err) {
    const container = document.getElementById('l2dCanvasContainer')
    if (!container) return
    const msg = (err && err.message) ? err.message : String(err)
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:16px;text-align:center;color:#999;">
        <div style="font-size:48px;line-height:1;">😔</div>
        <div style="font-size:13px;font-weight:600;color:#c0392b;">模型加载失败</div>
        <div style="font-size:10px;color:#999;max-width:240px;line-height:1.5;">${msg}</div>
        <div style="font-size:10px;color:#ccc;margin-top:8px;max-width:240px;line-height:1.5;">请检查：<br>1. 通过 <b>本地服务器</b> 打开（<code>file://</code> 无法加载）<br>2. 浏览器控制台错误信息 (F12)</div>
        <button class="l2d-retry-btn" onclick="location.reload()" style="margin-top:8px;padding:6px 16px;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">重试</button>
      </div>
    `
  }

  function showFallbackAvatar () {
    const container = document.getElementById('l2dCanvasContainer')
    if (!container) return
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:#999;">
        <img src="assets/march7th-avatar.png" alt="小灵" style="width:120px;height:120px;border-radius:50%;object-fit:cover;">
        <div style="font-size:14px;font-weight:600;color:var(--primary);">小灵</div>
        <div style="font-size:11px;">AI 数字人导游</div>
        <div style="font-size:10px;color:#ccc;margin-top:12px;">请放入 Live2D 模型至<br><code style="background:#f5f5f5;padding:1px 6px;border-radius:4px;font-size:10px;">live2d-models/ling/</code></div>
      </div>
    `
  }

  // ============================================================
  //  加载 Live2D 模型
  // ============================================================
  async function loadModel () {
    const { CubismLive2DModel, isCubism2ModelPath, loadLive2DRuntime } = window.Live2DRuntime || {}
    if (!CubismLive2DModel) {
      throw new Error('Live2D Runtime 未加载，请检查 vendor/cubism/framework/live2d-runtime.min.js 是否成功引入')
    }

    // 检查 Live2D Cubism Core 是否已挂载
    if (!window.Live2DCubismCore) {
      throw new Error('Live2DCubismCore 未挂载到 window，请检查 vendor/live2dcubismcore.min.js 是否成功加载')
    }

    canvasEl = charCanvas
    hostEl = document.getElementById('l2dCanvasContainer')

    if (!canvasEl) throw new Error('Canvas 元素未找到')
    if (!hostEl) throw new Error('Canvas 容器未找到')

    // 等待容器有合理尺寸（CSS 可能需要时间渲染）
    if (hostEl.clientWidth === 0 || hostEl.clientHeight === 0) {
      await new Promise(r => setTimeout(r, 200))
    }

    console.log('[Live2D] 开始加载模型:', CONFIG.modelPath, '容器:', hostEl.clientWidth, 'x', hostEl.clientHeight)

    live2dModel = await CubismLive2DModel.from({
      canvas: canvasEl,
      modelPath: CONFIG.modelPath,
      autoIdle: false,
      onError: (err) => console.error('[Live2D] Runtime error:', err)
    })

    // 双重保险：强制关闭运行时内置的 autoIdle，避免和我们的调度器冲突
    if (live2dModel) {
      try {
        if (typeof live2dModel.setAutoIdle === 'function') live2dModel.setAutoIdle(false)
        if (live2dModel.autoIdle !== undefined) live2dModel.autoIdle = false
      } catch (e) {
        console.warn('[Live2D] 关闭 autoIdle 失败:', e.message)
      }
    }

    return live2dModel
  }

  // ============================================================
  //  自检：确认嘴形参数可用
  // ============================================================
  function testMouthParameter() {
    if (!live2dModel) return
    try {
      // 尝试设置嘴形参数
      live2dModel.setParameterValue(CONFIG.speakParamId, 0.5, 1)
      console.log('[Live2D] 嘴形参数自检: 设置 ParamMouthOpenY=0.5 ✓')
      // 1秒后恢复
      setTimeout(() => {
        if (live2dModel) {
          live2dModel.setParameterValue(CONFIG.speakParamId, 0, 1)
          console.log('[Live2D] 嘴形参数自检: 恢复 ParamMouthOpenY=0 ✓')
        }
      }, 1500)
    } catch (e) {
      console.error('[Live2D] 嘴形参数自检失败:', e.message)
    }
  }

  // ============================================================
  //  空闲动画循环
  // ============================================================
  let _idleMotionTimer = null;
  let _idleMotionIndex = 0;

  function startIdleCycle () {
    stopIdleCycle()
    idleInterval = setInterval(() => {
      if (isSpeaking || !live2dModel) return
      statusIndex = (statusIndex + 1) % CONFIG.thinkMessages.length
      setStatus('thinking', CONFIG.thinkMessages[statusIndex])
    }, CONFIG.statusPeriod * 1000)

    // 空闲动作定时器
    if (CONFIG.idleAuto && CONFIG.idleEnabled && CONFIG.idleEnabled.length > 0) {
      scheduleNextIdleMotion()
    }
  }

  function scheduleNextIdleMotion () {
    if (_idleMotionTimer) clearTimeout(_idleMotionTimer)
    const interval = (CONFIG.idleInterval || 12) * 1000

    _idleMotionTimer = setTimeout(() => {
      if (!isSpeaking && live2dModel && isModelLoaded) {
        playRandomIdleMotion()
      }
      if (CONFIG.idleAuto) scheduleNextIdleMotion()
    }, interval)
  }

  function playRandomIdleMotion () {
    if (!live2dModel || !isModelLoaded) return
    // 去重 + 兼容旧名
    const raw = CONFIG.idleEnabled || ['zhaiyan', 'tuolian']
    const enabled = [...new Set(raw.map(n => n === 'zhaoxiang' ? 'tuolian' : n))]
    if (enabled.length === 0) return

    if (CONFIG.idleRandomize) {
      const name = enabled[Math.floor(Math.random() * enabled.length)]
      triggerMotionByName(name)
    } else {
      _idleMotionIndex = (_idleMotionIndex + 1) % enabled.length
      triggerMotionByName(enabled[_idleMotionIndex])
    }
  }

  function triggerMotionByName (name) {
    if (!live2dModel || !isModelLoaded) return
    if (_isPlayingMotion) { console.log('[Live2D Idle] 跳过——已有动作播放中'); return }

    const known = {
      'zhaiyan': ['Idle', 0],   // 眨眼
      'tuolian': ['Idle', 1],   // 托脸
      'zhaoxiang': ['Idle', 1]  // 兼容旧缓存 → 同托脸
    }
    const [group, index] = known[name] || ['Idle', 0]
    const duration = name === 'zhaiyan' ? 2.267 : 2.667  // 从 motion3.json 读取
    _isPlayingMotion = true
    try {
      // 优先级3=Force，强制替换任何正在播放的动画；loop=false 不循环
      live2dModel.motion(group, index, 3, false).then(() => {
        _isPlayingMotion = false
        console.log('[Live2D Idle] 空闲动作完成:', name)
      }).catch(() => {
        _isPlayingMotion = false
      })
      console.log('[Live2D Idle] 播放空闲动作:', name, group + '[' + index + ']')
    } catch (e) {
      _isPlayingMotion = false
      console.warn('[Live2D Idle] 动作播放失败:', e.message)
    }
    // 保险：即使 promise 不 resolve，在动画时长后强制释放锁
    setTimeout(() => {
      _isPlayingMotion = false
    }, (duration + 0.5) * 1000)
  }

  function playMotion (group, index) {
    if (!live2dModel || !isModelLoaded) {
      console.warn('[Live2D] 模型未加载，无法播放动作')
      return
    }
    if (_isPlayingMotion) { console.log('[Live2D Motion] 跳过——已有动作播放中'); return }
    _isPlayingMotion = true
    try {
      live2dModel.motion(group, index, 3, false).then(() => {
        _isPlayingMotion = false
        console.log('[Live2D Motion] 播放完成:', group + '[' + index + ']')
      }).catch(() => {
        _isPlayingMotion = false
      })
      console.log('[Live2D Motion] 开始播放:', group + '[' + index + ']')
    } catch (e) {
      _isPlayingMotion = false
      console.warn('[Live2D Motion] 播放失败:', e.message)
    }
  }

  // 暴露到 window 供 app.js 使用
  window.__live2dPlayMotion = playMotion

  function stopIdleCycle () {
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null }
    if (_idleMotionTimer) { clearTimeout(_idleMotionTimer); _idleMotionTimer = null }
  }

  // ============================================================
  //  TTS 语音合成（GPT-SoVITS 三月七声线）
  // ============================================================
  let currentAudio = null
  let currentAbort = null

  function speakTTS (text, onDone) {
    const config = window.GPT_SOVITS_CONFIG
    if (!config) { onDone?.(); return }
    const plainText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2B50}]|[\u{2795}-\u{2797}]|[\u{2728}]|[\u{2764}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{25AA}-\u{25AB}]|[\u{25FB}-\u{25FE}]|[\u{23F0}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|🧘|🧧/gu, '').trim()
    if (!plainText) { onDone?.(); return }

    currentAbort = new AbortController()
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: plainText, character: config.character }),
      signal: currentAbort.signal
    })
    .then(resp => {
      if (!resp.ok) throw new Error('TTS error: ' + resp.status)
      return resp.blob()
    })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudio = audio
      audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; onDone?.() }
      audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; onDone?.() }
      audio.play().catch(() => { URL.revokeObjectURL(url); currentAudio = null; onDone?.() })
    })
    .catch(err => {
      if (err.name !== 'AbortError') console.warn('[TTS] GPT-SoVITS failed:', err)
      onDone?.()
    })
  }

  // ============================================================
  //  说话 - 嘴形同步 + TTS
  // ============================================================
  function speak (text, callback) {
    const bubble = document.getElementById('l2dBubble')
    const bubbleText = document.getElementById('l2dBubbleText')
    if (bubble && bubbleText) {
      bubbleText.textContent = text
      bubble.classList.add('active')
    }

    stopSpeaking()
    setStatus('speaking', '正在说话...')

    if (live2dModel && isModelLoaded) {
      isSpeaking = true

      // ===== 基于时间的正弦波嘴形动画 =====
      const startTime = Date.now()
      const amplitude = CONFIG.speakParamValue            // 最大张嘴幅度
      const speedHz = (CONFIG.speedBase || 8) + Math.random() * 4  // 每秒张合次数
      const periodMs = 1000 / speedHz                     // 一个周期 ms

      console.log('[Live2D Speak] 嘴形动画启动:', text.substring(0, 40),
        '| amp=' + amplitude, 'speedHz=' + speedHz.toFixed(1),
        'period=' + periodMs.toFixed(0) + 'ms',
        'paramId=' + CONFIG.speakParamId)

      speakTimer = setInterval(() => {
        if (!live2dModel || !isSpeaking) { clearInterval(speakTimer); return }

        const elapsed = Date.now() - startTime
        const phase = (elapsed % periodMs) / periodMs          // 0..1
        const mouthValue = phase < 0.5
          ? amplitude * (phase * 2)          // 张嘴 0 → max
          : amplitude * (2 - phase * 2)      // 闭嘴 max → 0

        live2dModel.setParameterValue(CONFIG.speakParamId, mouthValue, 1.0)

        // 每秒输出一次调试
        const sec = Math.floor(elapsed / 1000)
        if (!window._lastLipLogSec || window._lastLipLogSec !== sec) {
          window._lastLipLogSec = sec
          console.log('[Live2D Mouth] val=' + mouthValue.toFixed(3) +
            ' phase=' + phase.toFixed(2) + ' t=' + sec + 's')
        }
      }, CONFIG.pollInterval)
    }

    speakTTS(text, () => {
      stopSpeaking()
      if (callback) callback()
    })
  }

  function stopSpeaking () {
    if (currentAbort) { currentAbort.abort(); currentAbort = null }
    if (currentAudio) { currentAudio.pause(); currentAudio = null }
    if (speakTimer) { clearInterval(speakTimer); speakTimer = null }
    if (live2dModel) {
      live2dModel.setParameterValue(CONFIG.speakParamId, 0, 1)
    }
    isSpeaking = false
    const bubble = document.getElementById('l2dBubble')
    if (bubble) bubble.classList.remove('active')
    setStatus('online', '在线 - 小灵已准备好')
    console.log('[Live2D Speak] 嘴形动画结束')
  }

  // ============================================================
  //  思考状态
  // ============================================================
  function startThinking () {
    if (!live2dModel) return
    setStatus('thinking', '思考中...')
    if (thinkTimer) clearInterval(thinkTimer)
    let idx = 0

    // 显示气泡
    const bubble = document.getElementById('l2dBubble')
    const bubbleText = document.getElementById('l2dBubbleText')
    if (bubble && bubbleText) {
      bubbleText.textContent = '🤔 让我想想...'
      bubble.classList.add('active')
    }

    thinkTimer = setInterval(() => {
      idx = (idx + 1) % CONFIG.thinkMessages.length
      if (bubbleText) bubbleText.textContent = '🤔 ' + CONFIG.thinkMessages[idx]
    }, 3000)
  }

  function stopThinking () {
    if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null }
    const bubble = document.getElementById('l2dBubble')
    if (bubble) bubble.classList.remove('active')
    setStatus('online', '在线 - 小灵已准备好')
  }

  // ============================================================
  //  表情/动作
  // ============================================================
  function setExpression (name) {
    if (!live2dModel || !isModelLoaded) return
    if (currentExpression === name) return
    currentExpression = name

    // 查找映射的表情/动作组
    const match = EXPRESSION_MAP[name] || EXPRESSION_MAP['default']
    let matchedMotion = false
    if (match) {
      if (match.kind === 'expression') {
        live2dModel.expression(match.name, 0, 'normal').catch(() => {})
      } else if (match.kind === 'motion') {
        // 播放触发动作——先检查是否已有动作在播放
        if (_isPlayingMotion) {
          console.log('[Live2D Expr] 跳过动作——已有动作播放中:', name)
          return
        }
        _isPlayingMotion = true
        matchedMotion = true
        live2dModel.motion(match.group, match.index || 0, 3, false).then(() => {
          _isPlayingMotion = false
        }).catch(() => {
          _isPlayingMotion = false
        })
      }
    }

    // 表情联动动作——仅当主动作不是 motion 且没有动作正在播放时才触发
    if (CONFIG.autoPlayOnEmotion && !matchedMotion && !_isPlayingMotion &&
        CONFIG.idleEnabled && CONFIG.idleEnabled.length > 0) {
      const randMotion = CONFIG.idleEnabled[Math.floor(Math.random() * CONFIG.idleEnabled.length)]
      triggerMotionByName(randMotion)
    }

    // 重置
    setTimeout(() => {
      currentExpression = null
      if (!isSpeaking && live2dModel) {
        live2dModel.fadeExpressionToNeutral(0.3)
      }
    }, CONFIG.expressionDuration)
  }

  // 基础表情映射（可通过 Live2DGuide.updateConfig() 动态替换）
  let EXPRESSION_MAP = {
    'smile': { kind: 'expression', name: 'smile' },
    'happy': { kind: 'expression', name: 'smile' },
    'think': { kind: 'expression', name: 'think' },
    'wave': { kind: 'expression', name: 'normal' },
    'agree': { kind: 'expression', name: 'smile' },
    'sad': { kind: 'expression', name: 'sad' },
    'surprise': { kind: 'expression', name: 'surprise' },
    'shy': { kind: 'expression', name: 'shy' },
    'angry': { kind: 'expression', name: 'angry' },
    'default': { kind: 'expression', name: 'normal' },
    'greet': { kind: 'motion', name: '', group: 'Idle', index: 0 },
    'idle': { kind: 'motion', name: '', group: 'Idle', index: 0 }
  }

  /**
   * 从后端加载表情映射和口型配置（异步）
   * 调用后会自动更新 CONFIG 和 EXPRESSION_MAP
   */
  async function loadLive2DConfig () {
    try {
      // 加载表情映射
      const exprResp = await fetch('/api/character/expressions')
      if (exprResp.ok) {
        const exprData = await exprResp.json()
        if (exprData.success && exprData.data) {
          const newMap = {}
          exprData.data.forEach(e => {
            newMap[e.trigger] = {
              kind: e.kind,
              name: e.name,
              group: e.group,
              index: e.index
            }
          })
          EXPRESSION_MAP = Object.keys(newMap).length > 0 ? newMap : EXPRESSION_MAP
        }
      }

      // 加载口型配置
      const lipResp = await fetch('/api/character/lip-sync')
      if (lipResp.ok) {
        const lipData = await lipResp.json()
        if (lipData.success && lipData.data) {
          const ls = lipData.data
          if (ls.param_id) CONFIG.speakParamId = ls.param_id
          if (ls.amplitude !== undefined) CONFIG.speakParamValue = Number(ls.amplitude)
          if (ls.smooth_factor !== undefined) CONFIG.smoothFactor = Number(ls.smooth_factor)
          if (ls.poll_interval !== undefined) CONFIG.pollInterval = Number(ls.poll_interval)
          if (ls.speed_base !== undefined) CONFIG.speedBase = Number(ls.speed_base)
          if (ls.volume_smooth !== undefined) CONFIG.volumeSmoothFactor = Number(ls.volume_smooth)
        }
      }

      // 加载动作配置
      const motResp = await fetch('/api/character/motion-config')
      if (motResp.ok) {
        const motData = await motResp.json()
        if (motData.success && motData.data) {
          const mc = motData.data
          if (mc.idleAuto !== undefined) CONFIG.idleAuto = !!mc.idleAuto
          if (mc.idleInterval !== undefined) CONFIG.idleInterval = Number(mc.idleInterval)
          if (mc.idleRandomize !== undefined) CONFIG.idleRandomize = !!mc.idleRandomize
          if (mc.idleEnabled) CONFIG.idleEnabled = Array.isArray(mc.idleEnabled) ? mc.idleEnabled : String(mc.idleEnabled).split(',').filter(Boolean)
          if (mc.autoPlayOnEmotion !== undefined) CONFIG.autoPlayOnEmotion = !!mc.autoPlayOnEmotion
          // 从后端加载后重新调度
          stopIdleCycle()
          if (CONFIG.idleAuto && CONFIG.idleEnabled.length > 0) {
            scheduleNextIdleMotion()
          }
        }
      }
    } catch (e) {
      console.warn('[Live2D] 加载远程配置失败，使用默认值:', e.message)
    }
  }

  /**
   * 获取当前表情映射的快照（供外部读取）
   */
  window.Live2DGuide.getExpressionMap = () => {
    return JSON.parse(JSON.stringify(EXPRESSION_MAP))
  }

  /**
   * 获取当前口型配置的快照（供外部读取）
   */
  window.Live2DGuide.getLipSyncConfig = () => {
    return {
      speakParamId: CONFIG.speakParamId,
      speakParamValue: CONFIG.speakParamValue,
      smoothFactor: CONFIG.smoothFactor,
      pollInterval: CONFIG.pollInterval,
      speedBase: CONFIG.speedBase,
      volumeSmoothFactor: CONFIG.volumeSmoothFactor
    }
  }

  window.Live2DGuide.getMotionConfig = () => {
    return {
      idleAuto: CONFIG.idleAuto,
      idleInterval: CONFIG.idleInterval,
      idleRandomize: CONFIG.idleRandomize,
      idleEnabled: CONFIG.idleEnabled,
      autoPlayOnEmotion: CONFIG.autoPlayOnEmotion
    }
  }

  /**
   * 更新运行时配置（供外部管理界面实时同步）
   */
  window.Live2DGuide.updateConfig = (config) => {
    if (config.expressionMap) {
      EXPRESSION_MAP = { ...EXPRESSION_MAP, ...config.expressionMap }
    }
    if (config.lipSync) {
      if (config.lipSync.speakParamId) CONFIG.speakParamId = config.lipSync.speakParamId
      if (config.lipSync.speakParamValue !== undefined) CONFIG.speakParamValue = Number(config.lipSync.speakParamValue)
      if (config.lipSync.smoothFactor !== undefined) CONFIG.smoothFactor = Number(config.lipSync.smoothFactor)
      if (config.lipSync.pollInterval !== undefined) CONFIG.pollInterval = Number(config.lipSync.pollInterval)
      if (config.lipSync.speedBase !== undefined) CONFIG.speedBase = Number(config.lipSync.speedBase)
    }
    if (config.motion) {
      const m = config.motion
      if (m.idleAuto !== undefined) CONFIG.idleAuto = !!m.idleAuto
      if (m.idleInterval !== undefined) CONFIG.idleInterval = Number(m.idleInterval)
      if (m.idleRandomize !== undefined) CONFIG.idleRandomize = !!m.idleRandomize
      if (m.idleEnabled !== undefined) CONFIG.idleEnabled = Array.isArray(m.idleEnabled) ? m.idleEnabled : String(m.idleEnabled).split(',').filter(Boolean)
      if (m.autoPlayOnEmotion !== undefined) CONFIG.autoPlayOnEmotion = !!m.autoPlayOnEmotion

      // 重新应用空闲动作调度
      stopIdleCycle()
      if (CONFIG.idleAuto && CONFIG.idleEnabled && CONFIG.idleEnabled.length > 0) {
        scheduleNextIdleMotion()
      }
    }
  }

  // 导出表情映射以便外部自定义
  window.Live2DGuide.setExpressionMap = (map) => {
    Object.assign(EXPRESSION_MAP, map)
  }

  // 导出说话方法
  window.Live2DGuide.speak = speak
  window.Live2DGuide.setStatusText = (text) => setStatus('thinking', text)

  // ============================================================
  //  启动
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

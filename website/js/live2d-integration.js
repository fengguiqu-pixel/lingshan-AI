/* ===== 灵山胜境 AI数字人导游 - Live2D 模型管理器 ===== */

;(function () {
  'use strict'

  // ---- 配置 ----
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
    statusPeriod: 30,
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
    }
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

    // 检测是否通过 file:// 协议打开（fetch 在该协议下会被浏览器拦截）
    if (location.protocol === 'file:') {
      console.warn('[Live2D] 检测到 file:// 协议，请通过本地服务器（如 server.cmd）打开页面')
      document.getElementById('l2dLoading').style.display = 'none'
      showProtocolWarning()
      isModelLoaded = false
      setStatus('online', '请使用本地服务器')
      modelReadyResolve?.()
      return
    }

    // 通过 http:// 协议加载模型
    try {
      await loadModel()
      isModelLoaded = true
      document.getElementById('l2dLoading').style.display = 'none'
      setStatus('online', '在线 - 小灵已准备好')
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
        <div style="font-size:64px;line-height:1;">🧘</div>
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
      autoIdle: true,
      onError: (err) => console.error('[Live2D] Runtime error:', err)
    })

    return live2dModel
  }

  // ============================================================
  //  空闲动画循环
  // ============================================================
  function startIdleCycle () {
    stopIdleCycle()
    idleInterval = setInterval(() => {
      if (isSpeaking || !live2dModel) return
      statusIndex = (statusIndex + 1) % CONFIG.thinkMessages.length
      setStatus('thinking', CONFIG.thinkMessages[statusIndex])
    }, CONFIG.statusPeriod * 1000)
    // 其他空闲时播放 idel 动作由 CubismLive2DModel 的 autoIdle 处理
  }

  function stopIdleCycle () {
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null }
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
      let mouthValue = 0
      let mouthDirection = 1
      const amplitude = CONFIG.speakParamValue
      const speed = 8 + Math.random() * 4

      speakTimer = setInterval(() => {
        if (!live2dModel || !isSpeaking) { clearInterval(speakTimer); return }
        mouthValue += mouthDirection * speed * CONFIG.smoothFactor
        if (mouthValue > amplitude) { mouthValue = amplitude; mouthDirection = -1 }
        if (mouthValue < 0) { mouthValue = 0; mouthDirection = 1 }
        live2dModel.setParameterValue(CONFIG.speakParamId, mouthValue, 0.8)
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
    if (match) {
      if (match.kind === 'expression') {
        live2dModel.expression(match.name, 0, 'normal').catch(() => {})
      } else if (match.kind === 'motion') {
        live2dModel.motion(match.group, match.index || 0, 'normal').catch(() => {})
      }
    }

    // 重置
    setTimeout(() => {
      currentExpression = null
      if (!isSpeaking && live2dModel) {
        live2dModel.fadeExpressionToNeutral(0.3)
      }
    }, CONFIG.expressionDuration)
  }

  // 基础表情映射（适配三月七模型）
  const EXPRESSION_MAP = {
    'smile': { kind: 'expression', name: 'smile' },
    'happy': { kind: 'expression', name: 'smile' },
    'think': { kind: 'expression', name: 'think' },
    'wave': { kind: 'expression', name: 'normal' },
    'agree': { kind: 'expression', name: 'smile' },
    'sad': { kind: 'expression', name: 'sad' },
    'surprise': { kind: 'expression', name: 'surprise' },
    'shy': { kind: 'expression', name: 'shy' },
    'angry': { kind: 'expression', name: 'angry' },
    'default': { kind: 'expression', name: 'normal' }
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

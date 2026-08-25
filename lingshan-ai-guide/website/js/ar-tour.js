/**
 * 灵山AI导游 - AR 实景导览引擎
 * 调用真实摄像头 + GPS定位 + 方向传感器，对准景点后点击"介绍"按钮
 * 自动识别并显示景点详细信息。
 */
(function () {
  'use strict';

  console.log('[AR Camera] 实景导览引擎已加载');

  var container = null;
  var video = null, captureCanvas = null, previewImg = null;
  var stream = null, watchId = null;
  var userLoc = null, heading = null;
  var isOpen = false, isRecognizing = false, isSimulated = false;
  var currentSpotIndex = null;
  var spotCoords = [];
  var orientationActive = false;
  var orientationHandler = null;
  var permissionState = { camera: 'prompt', location: 'prompt', orientation: 'prompt' };
  var currentFacingMode = 'environment';

  var ui = {};

  // ===== 工具函数 =====

  function parseCoords(str) {
    if (!str || typeof str !== 'string') return null;
    var m = str.match(/([\d.]+)°\s*([NS]),?\s*([\d.]+)°\s*([EW])/i);
    if (!m) return null;
    var lat = parseFloat(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1);
    var lng = parseFloat(m[3]) * (m[4].toUpperCase() === 'W' ? -1 : 1);
    return { lat: lat, lng: lng };
  }

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateBearing(lat1, lng1, lat2, lng2) {
    var y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
    var brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  }

  function getSpotCoords() {
    if (spotCoords.length) return spotCoords;
    if (typeof SCENIC_SPOTS === 'undefined') return [];
    spotCoords = SCENIC_SPOTS.map(function (spot, i) {
      var c = parseCoords(spot.coordinates);
      return { index: i, name: spot.name, lat: c ? c.lat : 0, lng: c ? c.lng : 0, valid: !!c };
    });
    return spotCoords;
  }

  function normalizeHeading(h) {
    if (h === null || h === undefined || isNaN(h)) return null;
    return (h + 360) % 360;
  }

  function showToast(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type || 'warning');
      return;
    }
    // 兜底：浏览器 alert（仅在未禁止时）
    console.warn('[AR]', message);
  }

  // ===== DOM 创建 =====

  function createContainer() {
    if (container) return;
    // 移除页面上可能遗留的旧容器（避免与电脑版旧 DOM 冲突）
    var old = document.getElementById('arTourContainer');
    if (old) old.remove();

    container = document.createElement('div');
    container.id = 'arTourContainer';
    container.className = 'ar-cam-container';
    container.style.display = 'none';
    container.innerHTML = `
      <video class="ar-cam-video" id="arCamVideo" autoplay playsinline muted></video>
      <img class="ar-cam-fallback" id="arCamFallback" alt="景点图片">
      <canvas class="ar-cam-capture" id="arCamCapture"></canvas>

      <div class="ar-cam-header">
        <button class="ar-cam-close" id="arCamClose" aria-label="关闭">✕</button>
        <div class="ar-cam-title" id="arCamTitle">AR 实景导览</div>
        <div class="ar-cam-status">
          <span class="ar-cam-status-item" id="arCamGpsStatus">📡 等待权限</span>
          <span class="ar-cam-status-item" id="arCamDirStatus">🧭 等待权限</span>
        </div>
      </div>

      <div class="ar-cam-reticle" id="arCamReticle">
        <div class="ar-cam-reticle-ring"></div>
        <div class="ar-cam-reticle-dot"></div>
        <div class="ar-cam-reticle-hint" id="arCamReticleHint">对准景点</div>
      </div>

      <div class="ar-cam-compass" id="arCamCompass">--°</div>

      <div class="ar-cam-footer">
        <div class="ar-cam-hint" id="arCamHint">将手机对准景点，点击「介绍」识别</div>
        <button class="ar-cam-intro-btn" id="arCamIntroBtn">介绍</button>
        <button class="ar-cam-switch-btn" id="arCamSwitchBtn" title="切换摄像头" aria-label="切换摄像头">⟲</button>
      </div>

      <div class="ar-cam-scanning" id="arCamScanning" style="display:none;">
        <div class="ar-cam-scan-box">
          <div class="ar-cam-scan-line"></div>
          <div class="ar-cam-scan-corner tl"></div>
          <div class="ar-cam-scan-corner tr"></div>
          <div class="ar-cam-scan-corner bl"></div>
          <div class="ar-cam-scan-corner br"></div>
        </div>
        <div class="ar-cam-scan-text">AI 正在识别画面中的景点...</div>
      </div>

      <div class="ar-cam-result" id="arCamResult" style="display:none;">
        <button class="ar-cam-result-close" id="arCamResultClose">✕</button>
        <div class="ar-cam-result-img" id="arCamResultImg"></div>
        <div class="ar-cam-result-body">
          <div class="ar-cam-result-ai">🤖 AI 识别结果</div>
          <div class="ar-cam-result-name" id="arCamResultName"></div>
          <div class="ar-cam-result-tag" id="arCamResultTag"></div>
          <div class="ar-cam-result-desc" id="arCamResultDesc"></div>
          <div class="ar-cam-result-actions">
            <button class="ar-cam-result-btn primary" id="arCamResultDetailBtn">查看景点详情</button>
            <button class="ar-cam-result-btn" id="arCamResultOtherBtn">识别其他景点</button>
          </div>
        </div>
      </div>

      <div class="ar-cam-permission" id="arCamPermission" style="display:none;">
        <div class="ar-perm-card">
          <div class="ar-perm-icon">🥽</div>
          <div class="ar-perm-title">AR 实景导览</div>
          <div class="ar-perm-text" id="arPermText">需要摄像头、定位和方向传感器权限，以识别您眼前的景点。</div>
          <div class="ar-perm-warning" id="arPermWarning" style="display:none;"></div>
          <button class="ar-perm-btn" id="arCamPermBtn">开启 AR 导览</button>
          <button class="ar-perm-link" id="arCamManualBtn">手动选择景点</button>
        </div>
      </div>

      <div class="ar-cam-manual" id="arCamManual" style="display:none;">
        <div class="ar-manual-header">
          <button class="ar-manual-back" id="arCamManualBack">← 返回</button>
          <div class="ar-manual-title">选择景点</div>
        </div>
        <div class="ar-manual-list" id="arCamManualList"></div>
      </div>
    `;
    document.body.appendChild(container);

    ui.video = document.getElementById('arCamVideo');
    ui.fallback = document.getElementById('arCamFallback');
    ui.capture = document.getElementById('arCamCapture');
    ui.title = document.getElementById('arCamTitle');
    ui.gpsStatus = document.getElementById('arCamGpsStatus');
    ui.dirStatus = document.getElementById('arCamDirStatus');
    ui.reticle = document.getElementById('arCamReticle');
    ui.reticleHint = document.getElementById('arCamReticleHint');
    ui.compass = document.getElementById('arCamCompass');
    ui.hint = document.getElementById('arCamHint');
    ui.introBtn = document.getElementById('arCamIntroBtn');
    ui.switchBtn = document.getElementById('arCamSwitchBtn');
    ui.scanning = document.getElementById('arCamScanning');
    ui.result = document.getElementById('arCamResult');
    ui.resultImg = document.getElementById('arCamResultImg');
    ui.resultName = document.getElementById('arCamResultName');
    ui.resultTag = document.getElementById('arCamResultTag');
    ui.resultDesc = document.getElementById('arCamResultDesc');
    ui.permission = document.getElementById('arCamPermission');
    ui.permText = document.getElementById('arPermText');
    ui.permWarning = document.getElementById('arPermWarning');
    ui.manual = document.getElementById('arCamManual');
    ui.manualList = document.getElementById('arCamManualList');

    document.getElementById('arCamClose').addEventListener('click', close);
    document.getElementById('arCamPermBtn').addEventListener('click', onPermBtnClick);
    document.getElementById('arCamManualBtn').addEventListener('click', showManualSelector);
    ui.introBtn.addEventListener('click', onIntroClick);
    ui.switchBtn.addEventListener('click', switchCamera);
    document.getElementById('arCamResultClose').addEventListener('click', hideResult);
    document.getElementById('arCamResultDetailBtn').addEventListener('click', onResultDetail);
    document.getElementById('arCamResultOtherBtn').addEventListener('click', showManualSelector);
    document.getElementById('arCamManualBack').addEventListener('click', hideManual);
  }

  // ===== 权限与启动 =====

  function open(index) {
    if (isOpen) close();
    currentSpotIndex = (typeof index === 'number' && index >= 0) ? index : null;
    createContainer();
    container.style.display = 'flex';
    container.classList.add('active');
    container.style.opacity = '1';
    isOpen = true;
    isSimulated = false;
    currentFacingMode = 'environment';
    permissionState = { camera: 'prompt', location: 'prompt', orientation: 'prompt' };

    // 显示权限请求界面
    showPermissionUI();

    // 非安全上下文直接提示
    if (!window.isSecureContext) {
      var isLocalhost = /^localhost$/i.test(window.location.hostname);
      var msg = isLocalhost
        ? '当前为 localhost，浏览器应已允许摄像头/定位。点击下方按钮继续尝试。'
        : '当前页面通过 HTTP（非加密）访问，浏览器会阻止摄像头与定位权限。<br>请使用 <strong>https://' + window.location.host + window.location.pathname + '</strong> 访问，或在 localhost 上测试。';
      showPermWarning(msg);
      return;
    }

    // 安全上下文：尝试预查询权限状态（部分浏览器支持）
    queryPermissions();
  }

  function showPermissionUI() {
    if (!ui.permission) return;
    ui.permission.style.display = 'flex';
    ui.manual.style.display = 'none';
    ui.result.style.display = 'none';
    ui.scanning.style.display = 'none';
    ui.fallback.style.display = 'none';
    ui.video.style.display = 'none';
    updateStatus();
  }

  function showPermWarning(html) {
    if (!ui.permWarning) return;
    ui.permWarning.innerHTML = html;
    ui.permWarning.style.display = 'block';
  }

  function hidePermWarning() {
    if (!ui.permWarning) return;
    ui.permWarning.style.display = 'none';
    ui.permWarning.innerHTML = '';
  }

  function queryPermissions() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    // 摄像头
    navigator.permissions.query({ name: 'camera' }).then(function (s) {
      permissionState.camera = s.state;
      s.onchange = function () {
        permissionState.camera = s.state;
        if (s.state === 'granted' && !stream && isOpen) startCamera();
      };
    }).catch(function () {});
    // 定位
    navigator.permissions.query({ name: 'geolocation' }).then(function (s) {
      permissionState.location = s.state;
      s.onchange = function () {
        permissionState.location = s.state;
        if (s.state === 'granted' && !userLoc && isOpen) startLocation();
      };
    }).catch(function () {});
  }

  function onPermBtnClick() {
    if (!window.isSecureContext) {
      // 非安全上下文：直接进入手动/模拟模式
      showManualSelector();
      return;
    }
    startAll();
  }

  function startAll() {
    hidePermWarning();
    ui.permission.style.display = 'none';
    ui.video.style.display = 'block';

    // 先启动摄像头（会触发系统权限弹窗）
    startCamera().then(function (ok) {
      if (ok) {
        // 摄像头成功后，再启动定位和方向
        startLocation();
        startOrientation();
      } else {
        // 摄像头失败也尝试启动定位/方向，然后进模拟模式
        startLocation();
        startOrientation();
        setTimeout(function () {
          if (isOpen && !stream) enterSimulatedMode('camera');
        }, 1500);
      }
    });

    // 兜底：3.5 秒后若摄像头仍未启动，切换为模拟模式
    setTimeout(function () {
      if (isOpen && !stream) enterSimulatedMode('camera');
    }, 3500);
  }

  function enterSimulatedMode(reason) {
    if (isSimulated || !isOpen) return;
    isSimulated = true;
    console.log('[AR Camera] 进入模拟模式，原因:', reason || 'unknown');
    ui.video.style.display = 'none';
    ui.fallback.style.display = 'block';
    var spot = getDefaultSpot();
    if (spot) {
      ui.fallback.src = spot.heroImage;
      ui.title.textContent = spot.name + ' · AR模拟';
    }
    var reasonText = '';
    if (reason === 'camera') reasonText = '摄像头未授权或不可用';
    else if (reason === 'location') reasonText = '定位未授权或不可用';
    else if (reason === 'orientation') reasonText = '方向传感器未授权';
    ui.hint.textContent = '当前为模拟模式' + (reasonText ? '（' + reasonText + '）' : '') + '：点击「介绍」查看该景点详情';
    if (ui.gpsStatus) ui.gpsStatus.textContent = '📍 模拟定位';
    if (ui.dirStatus) ui.dirStatus.textContent = '🧭 模拟方向';
  }

  function getDefaultSpot() {
    if (typeof SCENIC_SPOTS === 'undefined') return null;
    if (currentSpotIndex !== null && SCENIC_SPOTS[currentSpotIndex]) return SCENIC_SPOTS[currentSpotIndex];
    return SCENIC_SPOTS[0];
  }

  function startCamera(facingMode) {
    facingMode = facingMode || currentFacingMode || 'environment';
    return new Promise(function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (ui.dirStatus) ui.dirStatus.textContent = '📷 不支持摄像头';
        console.warn('[AR Camera] 浏览器不支持 getUserMedia');
        resolve(false);
        return;
      }
      // 先停止旧流，再申请新流
      if (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }
      // 优先用 exact 强制指定摄像头；不支持时降级 ideal
      var constraints = {
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      navigator.mediaDevices.getUserMedia(constraints).then(function (s) {
        stream = s;
        currentFacingMode = facingMode;
        applyStream(stream);
        console.log('[AR Camera] 摄像头已启动:', facingMode);
        resolve(true);
      }).catch(function (err) {
        console.warn('[AR Camera] 摄像头启动失败:', err.name, err.message);
        // 降级：用 ideal 再次请求
        var fallbackConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        navigator.mediaDevices.getUserMedia(fallbackConstraints).then(function (s) {
          stream = s;
          currentFacingMode = facingMode;
          applyStream(stream);
          console.log('[AR Camera] 摄像头已启动（ideal）:', facingMode);
          resolve(true);
        }).catch(function (err2) {
          console.warn('[AR Camera] 摄像头二次尝试失败:', err2.name, err2.message);
          if (ui.dirStatus) ui.dirStatus.textContent = '📷 摄像头未授权';
          // 最后尝试不指定 facingMode
          navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (s) {
            stream = s;
            currentFacingMode = facingMode;
            applyStream(stream);
            console.log('[AR Camera] 摄像头已启动（默认）');
            resolve(true);
          }).catch(function (err3) {
            console.warn('[AR Camera] 摄像头三次尝试失败:', err3.name, err3.message);
            resolve(false);
          });
        });
      });
    });
  }

  function applyStream(s) {
    if (ui.video) {
      ui.video.srcObject = s;
      ui.video.onloadedmetadata = function () {
        ui.video.play().catch(function () {});
      };
    }
  }

  function switchCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    var next = currentFacingMode === 'environment' ? 'user' : 'environment';
    if (ui.switchBtn) ui.switchBtn.disabled = true;
    startCamera(next).then(function (ok) {
      if (ui.switchBtn) ui.switchBtn.disabled = false;
      if (ok) {
        showToast('已切换至' + (next === 'environment' ? '后置' : '前置') + '摄像头', 'success');
      } else {
        showToast('切换摄像头失败', 'error');
      }
    });
  }

  function startLocation() {
    if (!navigator.geolocation) {
      if (ui.gpsStatus) ui.gpsStatus.textContent = '📍 定位不可用';
      return;
    }
    if (ui.gpsStatus) ui.gpsStatus.textContent = '📡 定位中';

    var onSuccess = function (pos) {
      userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (ui.gpsStatus) ui.gpsStatus.textContent = '📍 已定位';
      updateReticle();
    };
    var onError = function (err) {
      console.warn('[AR Camera] 定位失败:', err.code, err.message);
      if (ui.gpsStatus) {
        if (err.code === 1) ui.gpsStatus.textContent = '📍 定位未授权';
        else if (err.code === 2) ui.gpsStatus.textContent = '📍 定位不可用';
        else if (err.code === 3) ui.gpsStatus.textContent = '📍 定位超时';
        else ui.gpsStatus.textContent = '📍 定位失败';
      }
    };

    watchId = navigator.geolocation.watchPosition(
      onSuccess, onError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    // 兜底：尝试一次性获取以尽快触发权限弹窗
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (!userLoc) {
          userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          if (ui.gpsStatus) ui.gpsStatus.textContent = '📍 已定位';
          updateReticle();
        }
      },
      function () {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function startOrientation() {
    orientationHandler = function (e) {
      var h = null;
      if (e.webkitCompassHeading !== undefined && !isNaN(e.webkitCompassHeading)) {
        h = e.webkitCompassHeading;
      } else if (e.alpha !== null && !isNaN(e.alpha)) {
        var abs = e.absolute || (e.webkitCompassAccuracy !== undefined);
        h = abs ? (360 - e.alpha) % 360 : null;
      }
      heading = normalizeHeading(h);
      if (heading !== null && ui.dirStatus) ui.dirStatus.textContent = '🧭 已校准';
      if (ui.compass) ui.compass.textContent = (heading !== null ? Math.round(heading) : '--') + '°';
      updateReticle();
    };

    // iOS 13+ 需要用户手势触发 requestPermission
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (state) {
        permissionState.orientation = state;
        if (state === 'granted') {
          window.addEventListener('deviceorientation', orientationHandler, true);
          orientationActive = true;
        } else {
          if (ui.dirStatus) ui.dirStatus.textContent = '🧭 方向未授权';
          console.warn('[AR Camera] 方向传感器未授权');
        }
      }).catch(function (err) {
        console.warn('[AR Camera] 方向权限请求失败:', err);
        if (ui.dirStatus) ui.dirStatus.textContent = '🧭 方向不可用';
      });
    } else {
      window.addEventListener('deviceorientationabsolute', orientationHandler, true);
      window.addEventListener('deviceorientation', orientationHandler, true);
      orientationActive = true;
    }
  }

  // ===== 景点匹配与识别 =====

  function updateReticle() {
    if (!userLoc || heading === null || !ui.reticle) return;
    var matched = matchSpot();
    if (matched && matched.best) {
      ui.reticle.classList.add('locked');
      ui.reticleHint.textContent = '已对准：' + matched.best.name;
      ui.hint.textContent = '已识别到「' + matched.best.name + '」，点击「介绍」查看详情';
    } else {
      ui.reticle.classList.remove('locked');
      ui.reticleHint.textContent = '对准景点';
      ui.hint.textContent = '将手机对准景点，点击「介绍」识别';
    }
  }

  function matchSpot() {
    if (!userLoc) return null;
    var spots = getSpotCoords();
    var candidates = [];
    spots.forEach(function (s) {
      if (!s.valid) return;
      var dist = calculateDistance(userLoc.lat, userLoc.lng, s.lat, s.lng);
      var bearing = calculateBearing(userLoc.lat, userLoc.lng, s.lat, s.lng);
      var diff = Math.abs(((bearing - heading + 540) % 360) - 180);
      candidates.push({ spot: s, dist: dist, bearing: bearing, diff: diff });
    });

    if (candidates.length === 0) return null;

    // 规则：距离 < 5km 且方向差 < 35° 才算"对准"
    var aimed = candidates.filter(function (c) { return c.dist < 5000 && c.diff < 35; });
    if (aimed.length) {
      aimed.sort(function (a, b) { return a.diff - b.diff; });
      return { best: aimed[0].spot, list: candidates.sort(function (a, b) { return a.dist - b.dist; }) };
    }

    // 没有对准的，按距离返回最近的
    candidates.sort(function (a, b) { return a.dist - b.dist; });
    return { best: null, list: candidates };
  }

  function onIntroClick() {
    if (isRecognizing || !isOpen) return;
    isRecognizing = true;
    ui.scanning.style.display = 'flex';

    // 截图
    var capturedDataUrl = null;
    try {
      capturedDataUrl = captureImage();
    } catch (e) {
      console.warn('[AR Camera] 截图失败:', e);
    }

    // 模拟 AI 处理耗时，同时匹配景点
    setTimeout(function () {
      ui.scanning.style.display = 'none';
      var match = matchSpot();
      var spotIndex = null;
      var spot = null;

      if (match && match.best) {
        spotIndex = match.best.index;
        spot = SCENIC_SPOTS[spotIndex];
      } else if (currentSpotIndex !== null && SCENIC_SPOTS[currentSpotIndex]) {
        // 默认使用打开时推荐的景点
        spotIndex = currentSpotIndex;
        spot = SCENIC_SPOTS[spotIndex];
      } else if (match && match.list && match.list.length) {
        spotIndex = match.list[0].spot.index;
        spot = SCENIC_SPOTS[spotIndex];
      }

      if (spot) {
        showResult(spot, capturedDataUrl);
      } else {
        showManualSelector();
      }
      isRecognizing = false;
    }, 1600);
  }

  function captureImage() {
    if (isSimulated) {
      // 模拟模式：从 fallback 图片截图
      if (!ui.fallback || !ui.fallback.src) return null;
      var img = ui.fallback;
      var w = img.naturalWidth || 640;
      var h = img.naturalHeight || 480;
      var cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return cvs.toDataURL('image/jpeg', 0.85);
    }

    if (!ui.video || !ui.video.videoWidth) return null;
    var w = ui.video.videoWidth;
    var h = ui.video.videoHeight;
    ui.capture.width = w;
    ui.capture.height = h;
    var ctx = ui.capture.getContext('2d');
    ctx.drawImage(ui.video, 0, 0, w, h);
    return ui.capture.toDataURL('image/jpeg', 0.85);
  }

  function showResult(spot, capturedDataUrl) {
    currentSpotIndex = SCENIC_SPOTS.indexOf(spot);
    ui.resultName.textContent = spot.name;
    ui.resultTag.textContent = spot.tag;
    ui.resultDesc.textContent = spot.description ? (spot.description.substring(0, 120) + '...') : '';
    ui.resultImg.style.backgroundImage = capturedDataUrl
      ? 'url(' + capturedDataUrl + ')'
      : 'url(' + spot.heroImage + ')';
    ui.result.style.display = 'flex';
    setTimeout(function () { ui.result.classList.add('show'); }, 10);

    // 语音播报
    if (typeof live2dSay === 'function') {
      live2dSay('识别到' + spot.name + '，' + (spot.description ? spot.description.substring(0, 40) : ''));
    }
  }

  function hideResult() {
    ui.result.classList.remove('show');
    setTimeout(function () { if (ui.result) ui.result.style.display = 'none'; }, 250);
  }

  function onResultDetail() {
    hideResult();
    close();
    if (typeof openDetail === 'function' && currentSpotIndex !== null) {
      openDetail(currentSpotIndex);
    }
  }

  // ===== 手动选择 =====

  function showManualSelector() {
    if (!ui.manual || !ui.manualList) return;
    ui.permission.style.display = 'none';
    ui.result.style.display = 'none';
    ui.manual.style.display = 'flex';

    if (typeof SCENIC_SPOTS === 'undefined') return;
    ui.manualList.innerHTML = SCENIC_SPOTS.map(function (spot, i) {
      return `
        <div class="ar-manual-item" onclick="window.ARTour._manualSelect(${i})">
          <div class="ar-manual-thumb" style="background-image:url('${spot.heroImage}')"></div>
          <div class="ar-manual-info">
            <div class="ar-manual-name">${spot.name}</div>
            <div class="ar-manual-tag">${spot.tag}</div>
          </div>
          <div class="ar-manual-arrow">→</div>
        </div>
      `;
    }).join('');
  }

  function hideManual() {
    ui.manual.style.display = 'none';
    if (isSimulated || !stream) {
      ui.permission.style.display = 'flex';
    }
  }

  function manualSelect(index) {
    ui.manual.style.display = 'none';
    if (typeof SCENIC_SPOTS === 'undefined' || !SCENIC_SPOTS[index]) return;
    var spot = SCENIC_SPOTS[index];
    currentSpotIndex = index;
    // 进入模拟模式展示该景点
    isSimulated = true;
    ui.video.style.display = 'none';
    ui.fallback.style.display = 'block';
    ui.fallback.src = spot.heroImage;
    ui.title.textContent = spot.name + ' · AR导览';
    ui.hint.textContent = '当前展示「' + spot.name + '」，点击「介绍」查看详情';
    setTimeout(function () {
      showResult(spot, null);
    }, 300);
  }

  // ===== 关闭与清理 =====

  function close() {
    if (!isOpen) return;
    isOpen = false;
    isRecognizing = false;

    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (orientationActive || orientationHandler) {
      window.removeEventListener('deviceorientation', orientationHandler || onOrientationDummy, true);
      window.removeEventListener('deviceorientationabsolute', orientationHandler || onOrientationDummy, true);
      orientationActive = false;
      orientationHandler = null;
    }

    if (ui.video) { ui.video.srcObject = null; }
    if (container) {
      container.classList.remove('active');
      container.style.opacity = '0';
      container.style.display = 'none';
    }
    userLoc = null;
    heading = null;
  }

  function onOrientationDummy() {}

  function updateStatus() {
    if (ui.gpsStatus) ui.gpsStatus.textContent = '📡 等待权限';
    if (ui.dirStatus) ui.dirStatus.textContent = '🧭 等待权限';
    if (ui.compass) ui.compass.textContent = '--°';
  }

  // 公共 API
  window.ARTour = {
    open: open,
    close: close,
    isOpen: function () { return isOpen; },
    _manualSelect: manualSelect
  };
})();

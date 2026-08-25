/**
 * 灵山胜境 AI 导游 - APK 客户端配置
 *
 * 重要：修改 SERVER_URL 为你电脑的局域网 IP！
 * 获取方法：电脑端双击「灵山AI导游.exe」启动后，命令行会显示
 *   [WLAN]  http://192.168.x.x:3000/
 * 把下面的 IP 改成你的电脑实际 IP。
 *
 * 也可以用 http://localhost:3000 在 Android 模拟器中访问（模拟器内部 localhost 映射）
 */
window.APP_CONFIG = {
  // 默认服务器地址（首次启动时使用）
  // - 局域网部署：'http://192.168.1.100:3000'  （改为你电脑的实际 IP）
  // - 模拟器部署：'http://10.0.2.2:3000'  （Android 模拟器访问宿主机）
  // - 远程部署：'https://your-domain.com'
  SERVER_URL: 'http://192.168.0.8:3000',

  APP_NAME: '灵山胜境AI数字人导游',
  VERSION: '1.0.0',

  // 首次启动是否让用户输入服务器地址
  ASK_FOR_SERVER: true,
};

// 本地保存服务器地址（用户输入后持久化）
window.getSavedServer = function () {
  try {
    return localStorage.getItem('lingshan_server_url') || window.APP_CONFIG.SERVER_URL;
  } catch (e) {
    return window.APP_CONFIG.SERVER_URL;
  }
};

window.saveServer = function (url) {
  try {
    localStorage.setItem('lingshan_server_url', url);
  } catch (e) {}
};

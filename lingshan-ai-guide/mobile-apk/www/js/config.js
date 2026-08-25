/**
 * 灵山胜境 AI导游 - APK 配置文件
 * 在 Cordova 打包的 APK 中使用 file:// 协议运行，需要显式配置服务器地址。
 */
(function () {
  'use strict';

  // 默认服务器地址（首次启动会提示用户修改）
  var DEFAULT_SERVER_URL = 'http://192.168.1.100:3000';
  var STORAGE_KEY = 'ls_server_url';

  function getSavedServer() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_SERVER_URL;
    } catch (e) {
      return DEFAULT_SERVER_URL;
    }
  }

  function saveServer(url) {
    try {
      localStorage.setItem(STORAGE_KEY, url);
    } catch (e) {}
  }

  window.APP_CONFIG = {
    SERVER_URL: getSavedServer(),
    DEFAULT_SERVER_URL: DEFAULT_SERVER_URL
  };
  window.getSavedServer = getSavedServer;
  window.saveServer = saveServer;
})();

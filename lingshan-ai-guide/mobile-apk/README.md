# 灵山胜境 AI 导游 — 手机版

本目录是**独立的手机版前端 + Cordova APK 编译项目**，与电脑版 (`website/` 和 `public/`) 完全隔离。

## 目录结构

```
mobile-apk/
├── www/                 # 手机版前端资源（独立 SPA）
│   ├── index.html       # 手机版主入口
│   ├── css/mobile.css   # 手机版样式
│   ├── js/data.js       # 景点/路线/票务数据（独立副本）
│   ├── js/mobile-app.js # 手机版交互逻辑
│   ├── manifest.json    # PWA 配置
│   ├── sw.js            # Service Worker 离线缓存
│   ├── config.js        # APK 服务器地址配置
│   └── icons/           # 应用图标
├── res/                 # Cordova 图标资源
├── config.xml           # Cordova 配置
├── package.json         # Cordova 项目配置
├── build-apk.bat        # 一键构建 APK 脚本
└── README.md            # 本文件
```

## 使用方式

### 方式一：PWA（推荐，立即可用）

1. 电脑端启动 `灵山AI导游.exe`
2. 手机与电脑连接**同一 WiFi**
3. 手机浏览器访问：`http://<电脑IP>:3000/mobile/`
4. 浏览器菜单 →「添加到主屏幕」→ 获得独立图标 APP

### 方式二：编译真 APK

前置要求：
- JDK 17（配置 JAVA_HOME）
- Android SDK（配置 ANDROID_HOME）
- Node.js 18+

步骤：
```cmd
cd D:\lingshandaolan_live2d1\lingshan-ai-guide\mobile-apk
双击 build-apk.bat
```

编译成功后，`灵山AI导游.apk` 会出现在项目根目录（和 `.exe` 放在一起）。

首次启动 APK 时，按提示输入电脑端服务器地址（例如 `http://192.168.0.8:3000`）。

## 隔离性说明

- 手机版所有文件都在 `mobile-apk/www/` 内
- 电脑版服务器通过 `/mobile` 路径**条件性**提供手机版静态资源
- **删除 `mobile-apk/` 整个文件夹后，电脑版仍能正常运行**，不会有任何报错
- 手机版与电脑版代码互不依赖，可独立升级

## 手机版功能

- 🏠 首页：景区概览、热门景点、推荐路线、票务信息
- 🗺️ 地图：腾讯地图、景点标记、定位、步行导航
- 💬 小灵：AI 问答、快捷问题、连续对话
- 👤 我的：登录/注册、兴趣偏好、个性化讲解

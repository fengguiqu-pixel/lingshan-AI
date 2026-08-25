# 灵山胜境 AI 导游 — APK 编译指南

> 如果你不想用 PWA 方案（手机浏览器安装），希望得到真正的 `.apk` 文件直接发给用户安装，按本文档操作。

## ⚠️ 前置条件

- 操作系统：Windows 10/11
- 硬盘空间：≥ 5GB 可用
- 网络：稳定（需下载约 1.7GB 资源）
- 时间：首次约 30-60 分钟

## 步骤 1：安装 JDK 17

> 你的电脑已有 JDK 8（`D:\jdk-8`），但版本太老且已损坏，**必须安装 JDK 17**。

1. 访问 https://adoptium.net/temurin/releases/?version=17
2. 下载 `Windows x64 MSI` 安装包（约 180MB）
3. 双击安装，**记住安装路径**（默认 `C:\Program Files\Eclipse Adoptium\jdk-17.x.x`）
4. 配置环境变量：
   - 此电脑 → 右键属性 → 高级系统设置 → 环境变量
   - 系统变量 → 新建 `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.x.x`
   - 系统变量 → `Path` → 编辑 → 新建 `%JAVA_HOME%\bin`
5. 验证：打开 cmd 输入 `java -version`，应显示 17.x

## 步骤 2：安装 Android SDK

### 2.1 下载命令行工具

1. 访问 https://developer.android.com/studio#command-line-tools-only
2. 下载 `commandlinetools-win-*.zip`（约 130MB）
3. 解压到 `D:\android-sdk\cmdline-tools\latest\`（必须这个目录结构！）
   ```
   D:\android-sdk\
   └── cmdline-tools\
       └── latest\
           ├── bin\
           ├── lib\
           └── source.properties
   ```

### 2.2 配置环境变量

- 系统变量 → 新建 `ANDROID_HOME` = `D:\android-sdk`
- 系统变量 → `Path` → 编辑 → 新建 `%ANDROID_HOME%\cmdline-tools\latest\bin` 和 `%ANDROID_HOME%\platform-tools`

### 2.3 接受许可 + 安装组件

打开 cmd 执行：

```cmd
sdkmanager --licenses
```

一路 `y` 接受所有许可。然后安装必要组件：

```cmd
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

下载约 1.5GB，时间 15-30 分钟。

## 步骤 3：安装 Node.js 和 Cordova

项目里已有 Node.js（`runtime/node.exe`），但 Cordova 需要 npm：

```cmd
npm install -g cordova
```

如果网络慢，配置淘宝镜像：
```cmd
npm config set registry https://registry.npmmirror.com
npm install -g cordova
```

## 步骤 4：创建 APK 构建项目

打开 cmd，进入 `lingshan-ai-guide/mobile-apk/` 目录（本仓库已包含项目骨架），执行：

```cmd
cd D:\lingshandaolan_live2d1\lingshan-ai-guide\mobile-apk
双击 build-apk.bat
```

`build-apk.bat` 会自动完成以下操作：
1. `cordova platform add android` — 添加 Android 平台
2. `cordova build android --release` — 编译 Release APK
3. 把生成的 `app-release-unsigned.apk` 复制到 `lingshan-ai-guide/灵山AI导游.apk`

## 步骤 5：在手机上安装

1. 把 `灵山AI导游.apk` 传到手机（微信/QQ/USB 均可）
2. 手机设置 → 安全 → 允许「安装未知来源应用」
3. 点击 APK 安装
4. 首次启动会让你填服务器地址（电脑 IP），填 `http://192.168.x.x:3000`

## 🔧 自定义 APK 配置

### 修改服务器地址默认值

编辑 `mobile-apk/www/config.js`：

```js
window.APP_CONFIG = {
  SERVER_URL: 'http://192.168.1.100:3000',  // ← 改这里
  APP_NAME: '灵山胜境AI数字人导游',
  VERSION: '1.0.0',
};
```

### 修改应用图标/启动画面

把新的图片放到 `mobile-apk/res/icon/` 和 `mobile-apk/res/screen/`，重新执行 `build-apk.bat`。

### 修改包名/应用名

编辑 `mobile-apk/config.xml`：
```xml
<widget id="com.lingshan.aiguide" version="1.0.0" ...>
  <name>灵山胜境AI数字人导游</name>
</widget>
```

## 🐛 常见错误

### `JAVA_HOME is not set`

JDK 17 没装好，回到步骤 1。

### `Android SDK not found`

`ANDROID_HOME` 没设，回到步骤 2.2。

### `Failed to install cordova`

网络问题，配置淘宝镜像：
```cmd
npm config set registry https://registry.npmmirror.com
```

### `Could not resolve all files for configuration ':app:debugRuntimeClasspath'`

Gradle 下载失败，配置 Gradle 国内镜像。编辑 `~/.gradle/init.gradle`：
```gradle
allprojects {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/public' }
        google()
        mavenCentral()
    }
}
```

### `INSTALL_PARSE_FAILED_NO_CERTIFICATES`

APK 没签名。`build-apk.bat` 已配置 debug 签名，重新编译即可。

## 📁 项目结构

```
mobile-apk/
├── config.xml              # Cordova 应用配置（包名、版本、权限）
├── package.json            # Cordova 依赖
├── build-apk.bat           # Windows 一键构建脚本
├── res/                    # 图标和启动画面
│   ├── icon/
│   │   ├── android/        # 各 dpi 图标
│   │   └── ios/
│   └── screen/
│       └── android/        # 启动画面
└── www/                    # APK 内置的 Web 资源
    ├── index.html          # 应用主页（WebView 加载）
    ├── config.js           # 服务器地址配置
    ├── css/
    ├── js/
    ├── icons/              # PWA 同款图标
    └── manifest.json       # PWA manifest
```

## 💡 备选方案

如果上面的步骤太复杂，**强烈推荐用 PWA 方案**（参见 `PWA手机端使用说明.md`），
效果和真 APP 几乎一样，但完全不需要 SDK / 编译。

---

**遇到问题？** 编译失败时把 `cordova build android` 的完整错误日志贴出来分析。

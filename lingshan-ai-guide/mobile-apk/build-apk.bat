@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM   灵山胜境 AI 导游 — 手机版 APK 一键构建脚本
REM
REM   用途: 把 mobile-apk/ 中的独立手机版前端编译成 Android APK
REM   说明: 手机版与电脑版完全隔离，删除 mobile-apk/ 后电脑版仍可运行
REM
REM   前置要求:
REM     1. JDK 17 已安装 (脚本自动检测 D:\jdk-17 或 JAVA_HOME)
REM     2. Android SDK 已安装 (脚本自动检测 D:\android-sdk 或 ANDROID_HOME)
REM     3. Gradle 7.6+ 已安装 (脚本自动检测 D:\gradle-7.6.3 或 PATH)
REM     4. Node.js 18+ 已安装
REM ============================================================

echo.
echo ============================================================
echo   灵山胜境 AI 导游 - APK 构建工具
echo ============================================================
echo.

REM ---- 自动检测工具路径 ----
echo [1/6] 检测构建环境...

REM 检测 JDK 17
if exist "D:\jdk-17\bin\java.exe" (
    set "JAVA_HOME=D:\jdk-17"
    set "PATH=D:\jdk-17\bin;!PATH!"
    echo       JDK 17: D:\jdk-17
) else if not "%JAVA_HOME%"=="" (
    echo       JAVA_HOME = %JAVA_HOME%
) else (
    where java >nul 2>&1
    if !errorlevel! neq 0 (
        echo [错误] 未找到 JDK 17
        echo        请安装 JDK 17 并设置 JAVA_HOME
        echo        下载: https://adoptium.net/temurin/releases/?version=17
        pause
        exit /b 1
    )
)

REM 检测 Android SDK
if exist "D:\android-sdk" (
    set "ANDROID_HOME=D:\android-sdk"
    set "ANDROID_SDK_ROOT=D:\android-sdk"
    set "PATH=D:\android-sdk\platform-tools;D:\android-sdk\build-tools\33.0.2;D:\android-sdk\cmdline-tools\latest\bin;!PATH!"
    echo       Android SDK: D:\android-sdk
) else if not "%ANDROID_HOME%"=="" (
    echo       ANDROID_HOME = %ANDROID_HOME%
) else if not "%ANDROID_SDK_ROOT%"=="" (
    set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
    echo       ANDROID_HOME = %ANDROID_HOME%
) else (
    echo [错误] 未找到 Android SDK
    echo        请安装 Android SDK 并设置 ANDROID_HOME
    echo        参考 docs\APK编译指南.md
    pause
    exit /b 1
)

REM 检测 Gradle
if exist "D:\gradle-7.6.3\bin\gradle.bat" (
    set "PATH=D:\gradle-7.6.3\bin;!PATH!"
    echo       Gradle: D:\gradle-7.6.3
) else (
    where gradle >nul 2>&1
    if !errorlevel! neq 0 (
        echo [警告] 未找到 Gradle，Cordova 将尝试自动下载
    ) else (
        echo       Gradle: 已在 PATH 中
    )
)

REM 检测 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js
    echo        请安装 Node.js 18+
    echo        下载: https://nodejs.org/
    pause
    exit /b 1
)
echo       Node.js: 已安装

REM ---- 检查 Cordova ----
echo.
echo [2/6] 检查 Cordova CLI...
if exist "node_modules\.bin\cordova.cmd" (
    echo       Cordova: 已安装 (本地)
) else (
    echo [信息] 安装项目依赖...
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
)

REM ---- 添加 Android 平台 ----
echo.
echo [3/6] 配置 Android 平台...
if not exist "platforms\android" (
    call node_modules\.bin\cordova.cmd platform add android
    if !errorlevel! neq 0 (
        echo [错误] 添加 Android 平台失败
        pause
        exit /b 1
    )
) else (
    echo       platforms\android 已存在，跳过
)

REM ---- 同步 www 资源 ----
echo.
echo [4/6] 同步手机版前端资源...
call node_modules\.bin\cordova.cmd prepare android
if %errorlevel% neq 0 (
    echo [错误] cordova prepare 失败
    pause
    exit /b 1
)

REM ---- 编译 APK ----
echo.
echo [5/6] 编译 Debug APK (可能需要 5-15 分钟)...
echo.

REM 使用腾讯镜像加速 Gradle 下载 (国内网络)
set "CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=https://mirrors.cloud.tencent.com/gradle/gradle-7.6-bin.zip"

call node_modules\.bin\cordova.cmd build android --debug
if %errorlevel% neq 0 (
    echo.
    echo [错误] APK 编译失败
    echo        常见原因: Gradle 下载失败、Android SDK 版本不匹配
    echo        参考 docs\APK编译指南.md 故障排查
    pause
    exit /b 1
)

REM ---- 复制 APK ----
echo.
echo [6/6] 复制 APK...
set "APK_SRC=platforms\android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_NAME=灵山AI导游.apk"
set "APK_DST=%APK_NAME%"

if exist "!APK_SRC!" (
    copy /Y "!APK_SRC!" "!APK_DST!" >nul
    echo.
    echo ============================================================
    echo   构建成功!
    echo ============================================================
    echo.
    echo   APK 已生成: !APK_DST!
    for %%I in ("!APK_DST!") do echo   文件大小: %%~zI 字节
    echo.
    echo   下一步:
    echo     1. 把 APK 传到手机
    echo     2. 手机设置中允许「安装未知应用」
    echo     3. 点击 APK 安装
    echo     4. 首次启动输入电脑 IP (例如 http://192.168.0.8:3000)
    echo.
    echo   注意: APK 是 debug 签名，可直接安装测试。
    echo         正式发布需要生成 keystore 并签名。
    echo ============================================================
) else (
    echo [警告] 未找到 APK 输出文件: !APK_SRC!
)

echo.
pause
endlocal

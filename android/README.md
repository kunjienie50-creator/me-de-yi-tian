# Android 打包

成品：`../releases/me-day-0.1.3.apk`，应用名 **me的一天**，包名 `com.kunjienie50.meday`。支持 Android 8.0（API 26）及以上。

## 构建

本工程用系统 WebView 加载 APK 内置的前端资源。首次启动不依赖网络，也没有 INTERNET、相机或存储权限。数据保存在此应用的 localStorage / IndexedDB，与浏览器在线版的数据独立。卸载应用会清除应用数据。

安装 Node.js、JDK 17、Android SDK Platform 35 和 Build Tools 35.0.0；首次 `npm install` 后执行：

```powershell
$env:JAVA_HOME = '你的 JDK 17 目录'
$env:ANDROID_HOME = '你的 Android SDK 目录'
$env:ANDROID_BUILD_TOOLS = "$env:ANDROID_HOME\build-tools\35.0.0"
node scripts/build-android.cjs
```

工具也支持本项目 `.dsh-check/android-tools/` 下的已校验本地工具链。脚本先运行 Vite 构建，再编译资源 / Java / DEX、对齐、签名，并验证签名、包名及 SDK 版本。输出 APK 与 SHA256 校验文件到 `releases/`。不依赖 Gradle 下载。

同时保留了可用 Android Studio 打开的 Gradle 工程；其网页 assets 使用上述脚本生成的 `app/build/manual/assets`。Gradle 构建不自动使用本地发布密钥。

## 签名与升级

首次构建自动生成本项目专用的发布密钥，存放在根目录 `.android-signing/`；该目录已被 Git 忽略。请将整个目录私下备份，后续覆盖安装必须使用相同密钥。密钥和密码都不在 APK 内，不应提交到 Git 或公开分享。

发布新版本前同时递增 manifest 与 `app/build.gradle` 中的 versionCode，并调整脚本输出文件名。不要删除现有密钥来解决签名问题。

## 原生适配

- 用保留的 `https://appassets.androidplatform.net/assets/` 本地域名提供资源，保持标准 Web API 与稳定存储来源；未匹配资源返回 404，无网络回退。
- 顶层外链交给系统浏览器；内置桥只提供 JSON 文件导出，系统保存器选择位置。
- 照片选择使用系统文件选择器，不申请额外相机或存储权限。
- 返回键先关闭弹层，再回到首页；首页返回将应用置于后台。
- Android 11+ 显式处理系统栏、刘海和输入法区域；Android 8–10 使用系统窗口适配。
- AI 代理仅支持原项目本地开发服务器。离线 APK 与静态在线版一样，使用原有规则降级，不在客户端嵌入密钥。

## 图标

`design/app-icon/me-day-icon.ai` 是 Illustrator 29.6.1 的高保真彩色描摹扩展结果，已实际删除原图白边、底板与图外路径，保留 726 个原字样和花朵矢量路径。没有背景图层、隐藏底板、位图、链接图、裁切遮罩或额外描边。SVG 为同一矢量内容。

五档 Android 桌面图标直接从用户指定的 `美术素材（art）/tb.png` 原图等比缩放，保留原图白边、底板和全部装饰，不裁剪、不描摹、不增加图层。网页图标及单独交付的 AI/SVG 仍使用无背景矢量设计。重生成尺寸需要安装 Sharp，然后运行 `node scripts/generate-app-icons.cjs`。

`../scripts/trace-app-icon.jsx` 保留本次 Illustrator 描摹脚本；其输入是先由原图等比例缩小到 1536×1536 的 `.dsh-check/tb-trace.png`，重新运行前需准备该输入。

## 验证范围

本次已在 Android 15 / System WebView 124 模拟器中复现旧包 ERR_HTTP_RESPONSE_CODE_FAILURE，并验证新版断网冷启动、原生 AssetManager 读取、页面与美术加载、事件写入、离线桥，以及覆盖安装后记录保留。另已通过原始 ZIP 名称、资源逐字节内容、APK v2/v3 签名与对齐检查；单独交付的矢量图标无背景、无裁切遮罩或新增描边。尚未在用户的实体手机测试。

## 0.1.1 调整

图标已去除白边、渐变底板和外围大花，仅保留透明字标与装饰。Android 使用无附加底板的透明 PNG 启动图标；桌面启动器的系统遮罩由具体手机决定。APK 明确返回离线运行标记，AI 调用直接走本地规则，不发起网络探测。包名、资源来源和签名保持一致，versionCode 为 2，可覆盖安装并保留本地记录。

## 0.1.2 启动修复

Windows aapt2 的 `-A` 把资源目录分隔符写成了 ZIP 文件名中的反斜杠。Android AssetManager 不能将它当作正斜杠，因此旧包的首页会返回本地 404，出现 ERR_HTTP_RESPONSE_CODE_FAILURE。现在使用 JDK jar 添加网页资源，并在签名前直接检查 ZIP 原始中央目录名和每个资源内容；不会通过 Windows 解压器规范路径来掩盖错误。

可运行 `node scripts/verify-apk.cjs` 复核最终 APK。包名、发布证书和本地域名保持不变，versionCode 为 3。

## 0.1.3 桌面图标

按最新要求，Android 桌面图标直接使用 tb.png 原图生成五档尺寸，保留完整画面和配色。版本号为 0.1.3 / versionCode 4；包名、签名、本地域名和离线加载方式保持一致。

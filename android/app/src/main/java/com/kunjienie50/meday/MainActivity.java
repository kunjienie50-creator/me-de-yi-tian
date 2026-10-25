package com.kunjienie50.meday;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Offline HTTPS asset origin: localStorage / IndexedDB keep the same origin across APK updates. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final int PICK_PHOTO = 40, SAVE_JSON = 41;
    private WebView web;
    private ValueCallback<Uri[]> photoCallback;
    private byte[] pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(255,247,252));
        setContentView(root);
        // Android 15 enforces edge-to-edge: reserve system bars and the software keyboard.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                // Android 8–10 decor already reserves system bars; adjustResize handles the IME.
                view.setPadding(0, 0, 0, 0);
            }
            return insets;
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only URIs explicitly granted by the system photo chooser.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        web.setBackgroundColor(Color.rgb(255,247,252));
        web.addJavascriptInterface(new ExportBridge(), "MeDayAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri) || !"GET".equals(request.getMethod())) return missing();
                String relative = uri.getPath().substring("/assets/".length());
                if (relative.contains("..") || relative.contains("\\") || relative.isEmpty()) return missing();
                try {
                    String mime = mime(relative);
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime, isText(mime) ? "UTF-8" : null, 200, "OK", headers, getAssets().open("www/"+relative));
                } catch (IOException error) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocal(uri)) return false;
                String scheme = uri.getScheme();
                if (request.isForMainFrame() && ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException error) { toast("没有可用的浏览器"); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PICK_PHOTO); }
                catch (ActivityNotFoundException error) { photoCallback.onReceiveValue(null); photoCallback = null; toast("无法打开照片选择器"); }
                return true;
            }
        });
        web.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private static boolean isText(String type) { return type.startsWith("text/") || type.contains("javascript") || type.contains("json") || type.contains("svg"); }
    private static String mime(String file) {
        if (file.endsWith(".js")) return "application/javascript";
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".html")) return "text/html";
        if (file.endsWith(".svg")) return "image/svg+xml";
        if (file.endsWith(".json")) return "application/json";
        if (file.endsWith(".webp")) return "image/webp";
        if (file.endsWith(".png")) return "image/png";
        if (file.endsWith(".ttf")) return "font/ttf";
        if (file.endsWith(".woff2")) return "font/woff2";
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(file));
        return type == null ? "application/octet-stream" : type;
    }

    private final class ExportBridge {
        @JavascriptInterface public String getMode() { return "offline"; }
        @JavascriptInterface public void saveExport(String filename, String json) {
            if (json == null || json.length() > 10_000_000) return;
            runOnUiThread(() -> {
                if (pendingExport != null) { toast("请先完成当前保存"); return; }
                String currentUrl = web.getUrl();
                if (currentUrl == null || !isLocal(Uri.parse(currentUrl))) return;
                pendingExport = json.getBytes(StandardCharsets.UTF_8);
                String safeName = filename == null ? "me-day.json" : filename.replaceAll("[\\\\/:*?\"<>|]", "_");
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, safeName);
                try { startActivityForResult(intent, SAVE_JSON); }
                catch (ActivityNotFoundException error) { pendingExport = null; toast("无法打开文件保存器"); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = data == null ? null : data.getData();
        if (request == PICK_PHOTO && photoCallback != null) {
            photoCallback.onReceiveValue(result == RESULT_OK && uri != null ? new Uri[]{uri} : null);
            photoCallback = null;
        } else if (request == SAVE_JSON) {
            byte[] bytes = pendingExport; pendingExport = null;
            if (result != RESULT_OK || uri == null || bytes == null) return;
            new Thread(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(bytes);
                    toast("备份已保存（不含照片）");
                } catch (IOException error) { toast("保存失败，请重新导出"); }
            }, "save-backup").start();
        }
    }
    private void toast(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show()); }
    private void goBack() {
        web.evaluateJavascript("(function(){var dialog=document.querySelector('[role=dialog]');if(dialog){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return false;}if(location.hash && location.hash!=='#home'){location.hash='home';return false;}return true;})()", home -> { if ("true".equals(home)) moveTaskToBack(true); });
    }
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (photoCallback != null) photoCallback.onReceiveValue(null);
        pendingExport = null;
        web.removeJavascriptInterface("MeDayAndroid"); web.destroy();
        super.onDestroy();
    }
}

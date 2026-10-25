/** APK declares its bundled offline runtime through its private native bridge. */
export function isOfflineApp() {
  try {
    return globalThis.MeDayAndroid?.getMode?.() === 'offline'
  } catch {
    return false
  }
}

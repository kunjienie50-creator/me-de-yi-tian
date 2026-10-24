// 图片只写入本机 IndexedDB，绝不上传；失败时明确报错且不影响其它数据
const DB_NAME = 'me-de-yi-tian-images'
const STORE = 'images'
const VERSION = 1

let dbPromise = null
const urlCache = new Map()

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
  })
  return dbPromise
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const store = transaction.objectStore(STORE)
        let result
        try {
          result = fn(store)
        } catch (error) {
          reject(error)
          return
        }
        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error || new Error('事务中止'))
      }),
  )
}

export async function putImage(id, blob) {
  await tx('readwrite', (store) => store.put(blob, id))
  return id
}

export async function getImageUrl(id) {
  if (!id) return null
  if (urlCache.has(id)) return urlCache.get(id)
  try {
    const db = await openDb()
    const blob = await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readonly')
      const req = t.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    urlCache.set(id, url)
    return url
  } catch (error) {
    console.warn('[images] 读取失败', error)
    return null
  }
}

export async function deleteImage(id) {
  if (!id) return
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
  await tx('readwrite', (store) => store.delete(id))
}

export async function countImages() {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readonly')
      const req = t.objectStore(STORE).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return 0
  }
}

export async function clearImages() {
  urlCache.forEach((url) => URL.revokeObjectURL(url))
  urlCache.clear()
  try {
    await tx('readwrite', (store) => store.clear())
    return true
  } catch (error) {
    console.warn('[images] 清空失败', error)
    return false
  }
}

/** 压缩到最长边 1280px，控制本地体积 */
export async function compressImage(file, maxEdge = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob
}

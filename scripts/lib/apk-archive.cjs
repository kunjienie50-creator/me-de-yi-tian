const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Read raw ZIP names. Windows unzip libraries may normalize backslashes and hide invalid APK assets.
function readApkEntries(file) {
  const bytes = fs.readFileSync(file);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { end = at; break; }
  }
  assert.ok(end >= 0, 'ZIP end record not found');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  assert.notEqual(count, 0xffff, 'ZIP64 is not supported by this verifier');
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP central directory');
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const size = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const commentSize = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    assert.ok(!name.includes('\\'), `Invalid APK ZIP path: ${JSON.stringify(name)} (use forward slashes)`);
    assert.ok(!name.includes('\0') && !name.startsWith('/') && !name.split('/').includes('..'), `Unsafe APK path: ${name}`);
    assert.ok(!entries.has(name), `Duplicate APK path: ${name}`);
    entries.set(name, { name, size, read() {
      assert.equal(flags & 1, 0, 'Encrypted APK entry');
      assert.equal(bytes.readUInt32LE(local), 0x04034b50, 'Invalid ZIP local header');
      const localNameSize = bytes.readUInt16LE(local + 26);
      assert.equal(bytes.subarray(local + 30, local + 30 + localNameSize).toString('utf8'), name, 'ZIP local/central names differ');
      const dataAt = local + 30 + localNameSize + bytes.readUInt16LE(local + 28);
      const compressed = bytes.subarray(dataAt, dataAt + compressedSize);
      assert.ok(method === 0 || method === 8, `Unsupported APK compression: ${method}`);
      const result = method === 0 ? compressed : zlib.inflateRawSync(compressed);
      assert.equal(result.length, size, `Wrong extracted length: ${name}`);
      return result;
    }});
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return entries;
}
function verifyApkAssets(apk, dist) {
  const entries = readApkEntries(apk);
  // AssetManager.open('www/index.html') requires this exact name in the ZIP central directory.
  for (const name of ['AndroidManifest.xml', 'classes.dex', 'assets/www/index.html']) {
    assert.ok(entries.has(name), `Missing exact APK entry: ${name}`);
  }
  let assets = 0;
  function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else {
        const name = 'assets/www/' + path.relative(dist, file).split(path.sep).join('/');
        assert.ok(entries.has(name), `AssetManager cannot find: ${name}`);
        assert.deepEqual(entries.get(name).read(), fs.readFileSync(file), `APK asset differs: ${name}`);
        assets++;
      }
    }
  }
  visit(dist);
  assert.equal([...entries.keys()].filter(name => name.startsWith('assets/www/') && !name.endsWith('/')).length, assets, 'Unexpected stale bundled assets');
  assert.ok(![...entries.keys()].some(name => /(?:\.jks$|\.env$|password\.txt$)/.test(name)), 'Signing or environment secrets found');
  return { entries: entries.size, assets, exactAssetNames: true };
}
module.exports = { readApkEntries, verifyApkAssets };

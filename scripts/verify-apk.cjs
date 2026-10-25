const path = require('node:path');
const { verifyApkAssets } = require('./lib/apk-archive.cjs');
const root = path.resolve(__dirname, '..');
const apk = path.resolve(root, process.argv[2] || 'releases/me-day-0.1.3.apk');
const dist = path.resolve(root, process.argv[3] || 'dist');
console.log(JSON.stringify({ apk, ...verifyApkAssets(apk, dist) }));

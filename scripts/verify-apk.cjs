const path = require('node:path');
const { verifyApkAssets } = require('./lib/apk-archive.cjs');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const apk = path.resolve(root, process.argv[2] || `releases/me-day-${version}.apk`);
const dist = path.resolve(root, process.argv[3] || 'dist');
console.log(JSON.stringify({ apk, ...verifyApkAssets(apk, dist) }));

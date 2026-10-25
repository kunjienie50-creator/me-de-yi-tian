const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { verifyApkAssets } = require('./lib/apk-archive.cjs');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const resolve = (...parts) => path.resolve(root, ...parts);
// APK 文件名只跟 package.json 的 version 走，避免版本号散落在脚本和文档里。
const { version: appVersion } = require(resolve('package.json'));
const apkName = `me-day-${appVersion}.apk`;
const tools = resolve('.dsh-check/android-tools');
function firstDir(parent, marker) {
  if (!fs.existsSync(parent)) return null;
  if (fs.existsSync(path.join(parent, marker))) return parent;
  return fs.readdirSync(parent).map(name => path.join(parent,name)).find(p => fs.existsSync(path.join(p,marker)));
}
const javaHome = process.env.JAVA_HOME || firstDir(path.join(tools,'jdk'), 'bin/java.exe');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const buildTools = process.env.ANDROID_BUILD_TOOLS || (sdk ? firstDir(path.join(sdk,'build-tools'),'aapt2.exe') : firstDir(path.join(tools,'build-tools'),'aapt2.exe'));
const platform = sdk ? firstDir(path.join(sdk,'platforms'),'android.jar') : firstDir(path.join(tools,'platform'),'android.jar');
if (!javaHome || !buildTools || !platform) throw Error('Set JAVA_HOME, ANDROID_HOME and optionally ANDROID_BUILD_TOOLS; requires JDK 17, Android platform 35 and build-tools 35.0.0. See android/README.md.');
const androidJar = path.join(platform,'android.jar');
const java = path.join(javaHome,'bin/java.exe');
// aapt on Windows cannot read Unicode absolute arguments; project-relative ASCII paths work.
const run = (command,args) => cp.execFileSync(command,args.map(arg => arg.startsWith(root + path.sep) ? path.relative(root,arg) : arg),{cwd:root,stdio:'inherit',windowsHide:true});
const build = resolve('android/app/build/manual');
const assets = path.join(build,'assets');
const classes = path.join(build,'classes');
const dex = path.join(build,'dex');
[build,assets,classes,dex,path.join(build,'generated'),resolve('releases')].forEach(p=>fs.mkdirSync(p,{recursive:true}));
run(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build']);
const www = path.join(assets,'www');
// Only replace this script's generated staging directory, never source data.
if (fs.existsSync(www)) fs.rmSync(www,{recursive:true});
fs.cpSync(resolve('dist'),www,{recursive:true});
run(path.join(buildTools,'aapt2.exe'),['compile','--dir',resolve('android/app/src/main/res'),'-o',path.join(build,'resources.zip')]);
const unsigned = path.join(build,'unsigned.apk');
run(path.join(buildTools,'aapt2.exe'),['link','-o',unsigned,'-I',androidJar,'--manifest',resolve('android/app/src/main/AndroidManifest.xml'),'--java',path.join(build,'generated'),'--auto-add-overlay',path.join(build,'resources.zip')]);
function files(dir,extension){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),extension):e.name.endsWith(extension)?[path.join(dir,e.name)]:[])}
const sources=files(resolve('android/app/src/main/java'),'.java').concat(files(path.join(build,'generated'),'.java'));
run(path.join(javaHome,'bin/javac.exe'),['-encoding','UTF-8','-source','8','-target','8','-bootclasspath',[path.relative(root,androidJar),path.relative(root,path.join(buildTools,'core-lambda-stubs.jar'))].join(path.delimiter),'-d',classes,...sources]);
const jar=path.join(build,'classes.jar');
run(path.join(javaHome,'bin/jar.exe'),['cf',jar,'-C',classes,'.']);
run(java,['-cp',path.join(buildTools,'lib/d8.jar'),'com.android.tools.r8.D8','--release','--min-api','26','--lib',androidJar,'--output',dex,jar]);
// aapt2 -A writes Windows backslashes into asset entry names on this toolchain.
// JDK jar uses ZIP-standard forward slashes; Android AssetManager requires exact names.
run(path.join(javaHome,'bin/jar.exe'),['uf',unsigned,'-C',build,'assets','-C',dex,'classes.dex']);
console.log('APK raw asset paths:', verifyApkAssets(unsigned, resolve('dist')));
const aligned=path.join(build,'aligned.apk');
run(path.join(buildTools,'zipalign.exe'),['-f','-p','4',unsigned,aligned]);
const signing=resolve('.android-signing');fs.mkdirSync(signing,{recursive:true});
const key=path.join(signing,'me-day-release.jks');
const pass=path.join(signing,'password.txt');
if(!fs.existsSync(key)){
  if(!fs.existsSync(pass))fs.writeFileSync(pass,crypto.randomBytes(32).toString('base64url'));
  run(path.join(javaHome,'bin/keytool.exe'),['-genkeypair','-keystore',key,'-storetype','JKS','-storepass:file',pass,'-keypass:file',pass,'-alias','me-day','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=me-day, OU=Mobile, O=kunjienie50-creator, C=CN']);
}
if(!fs.existsSync(pass))throw Error('Signing password is missing. Restore .android-signing; never replace an existing signing key.');
const apk=resolve('releases',apkName);
run(java,['-jar',path.join(buildTools,'lib/apksigner.jar'),'sign','--ks',key,'--ks-key-alias','me-day','--ks-pass','file:'+pass,'--out',apk,aligned]);
run(java,['-jar',path.join(buildTools,'lib/apksigner.jar'),'verify','--verbose','--print-certs',apk]);
run(path.join(buildTools,'zipalign.exe'),['-c','-p','4',apk]);
run(path.join(buildTools,'aapt.exe'),['dump','badging',apk]);
const sha=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
fs.writeFileSync(resolve('releases/SHA256SUMS.txt'),sha+'  '+apkName+'\n');
console.log('\nAPK:',apk,'\nBytes:',fs.statSync(apk).size,'\nSHA256:',sha);

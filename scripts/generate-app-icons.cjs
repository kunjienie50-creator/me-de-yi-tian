const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
process.chdir(path.resolve(__dirname, '..'));
const transparent = { fit: 'contain', background: '#00000000' };
(async () => {
  if (process.argv.includes('--prepare-trace')) {
    fs.mkdirSync('.dsh-check', { recursive: true });
    await sharp('美术素材（art）/tb.png').resize(1536, 1536).png().toFile('.dsh-check/tb-trace.png');
    console.log('Illustrator trace source prepared from the supplied tb.png');
    return;
  }
  const svg = 'design/app-icon/me-day-icon.svg';
  const body = fs.readFileSync(svg, 'utf8');
  if (/<image\b|data:image/i.test(body)) throw Error('Vector contains bitmap');
  if (/<clipPath\b|<mask\b|<filter\b/i.test(body)) throw Error('Vector contains a clipping layer');
  const viewBox = body.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  for (const rect of body.match(/<rect\b[^>]+>/g) || []) {
    const width = Number(rect.match(/\bwidth="([^"]+)"/)?.[1] || 0);
    const height = Number(rect.match(/\bheight="([^"]+)"/)?.[1] || 0);
    if (width > viewBox[2] * .8 && height > viewBox[3] * .8) throw Error('Vector contains a full-size background');
  }
  fs.mkdirSync('public', { recursive: true });
  await sharp(svg).resize(512, 512, transparent).png().toFile('public/app-icon.png');
  await sharp(svg).resize(180, 180, transparent).png().toFile('public/apple-touch-icon.png');
  fs.copyFileSync(svg, 'public/app-icon.svg');
  await sharp(svg).resize(1024, 1024, transparent).png().toFile('design/app-icon/preview.png');
  // Android launcher icons use the supplied bitmap directly, preserving the full original composition.
  // The separate editable vector and browser icons retain their transparent design.
  const launcherSource = '美术素材（art）/tb.png';
  for (const [name, size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    const dir = `android/app/src/main/res/mipmap-${name}`;
    fs.mkdirSync(dir, { recursive: true });
    await sharp(launcherSource).resize(size, size, transparent).png().toFile(dir + '/ic_logo.png');
    for (const old of ['ic_launcher.png', 'ic_launcher_foreground.png']) {
      const file = path.join(dir, old);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  const oldAdaptive = 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml';
  if (fs.existsSync(oldAdaptive)) fs.unlinkSync(oldAdaptive);
  const { data, info } = await sharp('public/app-icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const pixel of [0, info.width - 1, info.width * (info.height - 1), info.width * info.height - 1]) {
    if (data[pixel * info.channels + info.channels - 1] !== 0) throw Error('Icon corner is not transparent');
  }
  console.log('Android launcher icons generated directly from tb.png; vector/browser icons remain transparent; SVG bytes:', fs.statSync(svg).size);
})().catch(error => { console.error(error); process.exitCode = 1; });

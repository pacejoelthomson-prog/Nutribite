const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

async function run() {
  console.log('Optimizing images in public directory...');

  // 1. logo.png (resizing from 390x390 230KB to 120x120 crisp retina ~3-4KB)
  const logoPath = path.join(publicDir, 'logo.png');
  const logoBuf = fs.readFileSync(logoPath);
  const logo120Png = await sharp(logoBuf)
    .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  fs.writeFileSync(logoPath, logo120Png);
  console.log(`Optimized logo.png: ${(logoBuf.length / 1024).toFixed(1)} KB -> ${(logo120Png.length / 1024).toFixed(1)} KB`);

  const logoWebp = await sharp(logoBuf)
    .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(path.join(publicDir, 'logo.webp'));
  console.log(`Created logo.webp: ${(logoWebp.size / 1024).toFixed(1)} KB`);

  // 2. Showcase Scan
  const scanPath = path.join(publicDir, 'showcase-scan.jpg');
  const scanBuf = fs.readFileSync(scanPath);
  await sharp(scanBuf).webp({ quality: 82, effort: 6 }).toFile(path.join(publicDir, 'showcase-scan.webp'));
  await sharp(scanBuf).avif({ quality: 75, effort: 6 }).toFile(path.join(publicDir, 'showcase-scan.avif'));
  const scanOptJpg = await sharp(scanBuf).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  fs.writeFileSync(scanPath, scanOptJpg);
  console.log(`showcase-scan.jpg: ${(scanBuf.length / 1024).toFixed(1)} KB -> ${(scanOptJpg.length / 1024).toFixed(1)} KB (WebP/AVIF created)`);

  // 3. Showcase Pros & Cons
  const prosPath = path.join(publicDir, 'showcase-proscons.jpg');
  const prosBuf = fs.readFileSync(prosPath);
  await sharp(prosBuf).webp({ quality: 82, effort: 6 }).toFile(path.join(publicDir, 'showcase-proscons.webp'));
  await sharp(prosBuf).avif({ quality: 75, effort: 6 }).toFile(path.join(publicDir, 'showcase-proscons.avif'));
  const prosOptJpg = await sharp(prosBuf).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  fs.writeFileSync(prosPath, prosOptJpg);
  console.log(`showcase-proscons.jpg: ${(prosBuf.length / 1024).toFixed(1)} KB -> ${(prosOptJpg.length / 1024).toFixed(1)} KB (WebP/AVIF created)`);

  // 4. Showcase Progress
  const progPath = path.join(publicDir, 'showcase-progress.png');
  const progBuf = fs.readFileSync(progPath);
  await sharp(progBuf).webp({ quality: 82, effort: 6 }).toFile(path.join(publicDir, 'showcase-progress.webp'));
  await sharp(progBuf).avif({ quality: 75, effort: 6 }).toFile(path.join(publicDir, 'showcase-progress.avif'));
  const progOptPng = await sharp(progBuf).png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer();
  fs.writeFileSync(progPath, progOptPng);
  console.log(`showcase-progress.png: ${(progBuf.length / 1024).toFixed(1)} KB -> ${(progOptPng.length / 1024).toFixed(1)} KB (WebP/AVIF created)`);

  // 5. Hero
  const heroPath = path.join(publicDir, 'hero.jpg');
  const heroBuf = fs.readFileSync(heroPath);
  await sharp(heroBuf).webp({ quality: 82, effort: 6 }).toFile(path.join(publicDir, 'hero.webp'));
  await sharp(heroBuf).avif({ quality: 75, effort: 6 }).toFile(path.join(publicDir, 'hero.avif'));
  const heroOptJpg = await sharp(heroBuf).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  fs.writeFileSync(heroPath, heroOptJpg);
  console.log(`hero.jpg: ${(heroBuf.length / 1024).toFixed(1)} KB -> ${(heroOptJpg.length / 1024).toFixed(1)} KB (WebP/AVIF created)`);

  console.log('Image optimization complete!');
}

run().catch(console.error);

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const terser = require('terser');

const publicDir = path.join(__dirname, '..', 'public');

async function build() {
  console.log('Building production minified CSS and JS...');

  // 1. Minify CSS
  const cssPath = path.join(publicDir, 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const minCssResult = new CleanCSS({
    level: {
      1: { all: true },
      2: { restructureRules: false } // preserve rule order
    }
  }).minify(css);

  if (minCssResult.errors.length) {
    console.error('CSS Minify Errors:', minCssResult.errors);
  } else {
    const minCssPath = path.join(publicDir, 'styles.min.css');
    fs.writeFileSync(minCssPath, minCssResult.styles);
    console.log(`Minified styles.min.css: ${(css.length / 1024).toFixed(1)} KB -> ${(minCssResult.styles.length / 1024).toFixed(1)} KB`);
  }

  // 2. Minify JS files
  const jsFiles = ['common.js', 'bg3d.js', 'scan.js', 'progress.js', 'results.js'];
  for (const file of jsFiles) {
    const filePath = path.join(publicDir, file);
    const code = fs.readFileSync(filePath, 'utf8');
    const minResult = await terser.minify(code, {
      compress: { drop_console: false },
      mangle: true
    });
    const minName = file.replace('.js', '.min.js');
    const minFilePath = path.join(publicDir, minName);
    fs.writeFileSync(minFilePath, minResult.code);
    console.log(`Minified ${minName}: ${(code.length / 1024).toFixed(1)} KB -> ${(minResult.code.length / 1024).toFixed(1)} KB`);
  }

  console.log('Build completed successfully!');
}

build().catch(console.error);

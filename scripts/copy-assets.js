const fs = require('fs');
const path = require('path');

// 確保 dist 目錄存在
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 需要複製的文件和目錄
const assetsToCopy = [
  { src: 'index.html', dest: 'index.html' },
  { src: 'style.css', dest: 'style.css' },
  { src: 'js/font.js', dest: 'js/font.js' }
];

assetsToCopy.forEach(({ src, dest }) => {
  const srcPath = path.join(__dirname, '..', src);
  const destPath = path.join(distDir, dest);
  const destDirPath = path.dirname(destPath);

  if (!fs.existsSync(destDirPath)) {
    fs.mkdirSync(destDirPath, { recursive: true });
  }

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${src} to ${dest}`);
  } else {
    console.warn(`Warning: ${src} not found`);
  }
});

console.log('Assets copied successfully!');

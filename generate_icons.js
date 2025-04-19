const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#007AFF';
  ctx.fillRect(0, 0, size, size);

  // Text
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RM', size/2, size/2);

  return canvas.toBuffer('image/png');
}

// Generate icons in different sizes
[16, 48, 128].forEach(size => {
  const buffer = generateIcon(size);
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  console.log(`Generated ${size}x${size} icon`);
}); 
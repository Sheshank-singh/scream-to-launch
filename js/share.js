import { PAGE_HOST, PAGE_URL } from './config.js';
import { mulberry32 } from './util.js';

const FONT = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function placeLabel({ country, flag }) {
  if (!country) return '';
  return flag ? `${country} ${flag}` : country;
}

export function shareLine({ altitudeLabel, country, flag, rank }) {
  const place = placeLabel({ country, flag });
  const ranked = Number.isInteger(rank) && rank > 0 ? ` Ranked #${rank} worldwide.` : '';
  return `I screamed my rocket to ${altitudeLabel} from ${place} 🚀${ranked} Can you beat me? 👇\n${PAGE_URL}`;
}

export function shareIntent(text) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export function sanitizePlace(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawRocket(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const flame = ctx.createLinearGradient(0, 20, 0, 150);
  flame.addColorStop(0, 'rgba(255, 246, 220, 0.95)');
  flame.addColorStop(0.3, 'rgba(255, 176, 46, 0.9)');
  flame.addColorStop(0.7, 'rgba(255, 70, 24, 0.35)');
  flame.addColorStop(1, 'rgba(255, 40, 0, 0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-10, 22);
  ctx.quadraticCurveTo(0, 150, 10, 22);
  ctx.fill();

  ctx.fillStyle = '#e7edf6';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-32, 28);
  ctx.lineTo(-10, 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.lineTo(32, 28);
  ctx.lineTo(10, 20);
  ctx.fill();

  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#8d97a8');
  body.addColorStop(0.38, '#f7f9fc');
  body.addColorStop(1, '#9aa4b5');
  ctx.fillStyle = body;
  roundRect(ctx, -15, -48, 30, 74, 10);
  ctx.fill();

  ctx.fillStyle = '#ff5b2e';
  ctx.beginPath();
  ctx.moveTo(0, -86);
  ctx.lineTo(16, -40);
  ctx.lineTo(-16, -40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffc857';
  ctx.fillRect(-15, 4, 30, 6);
  ctx.fillStyle = '#142033';
  ctx.beginPath();
  ctx.arc(0, -16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 220, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(-2, -18, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fitSize(ctx, text, weight, maxWidth, start, min) {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return min;
}

/** Draw the 1200×675 share card. Stars are seeded so redraws don't flicker. */
export function drawShareCard(canvas, { value, unit, title, tagline, country, flag, rank }) {
  const ctx = canvas.getContext('2d');
  const width = 1200;
  const height = 675;
  canvas.width = width;
  canvas.height = height;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1a1030');
  sky.addColorStop(0.45, '#0c101c');
  sky.addColorStop(1, '#070910');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(860, 180, 20, 880, 200, 420);
  glow.addColorStop(0, 'rgba(255, 196, 120, 0.22)');
  glow.addColorStop(1, 'rgba(255, 196, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const rand = mulberry32(42);
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * width;
    const y = rand() * height * 0.82;
    const r = rand() < 0.1 ? 1.8 : 1;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#efe6d4';
  ctx.beginPath();
  ctx.arc(980, 150, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 130, 110, 0.35)';
  ctx.beginPath();
  ctx.arc(960, 136, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1002, 168, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c4553a';
  ctx.beginPath();
  ctx.arc(1040, 250, 16, 0, Math.PI * 2);
  ctx.fill();

  drawRocket(ctx, 980, 430, 1.55);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc857';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('SCREAM TO LAUNCH', 72, 118);

  ctx.fillStyle = '#f4f1ea';
  ctx.font = `650 40px ${FONT}`;
  ctx.fillText('I screamed my rocket to', 72, 250);

  const altitude = `${value} ${unit}`;
  const size = fitSize(ctx, altitude, 800, 760, 108, 54);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(altitude, 72, 250 + size * 0.95);

  const titleY = 250 + size * 0.95 + 64;
  ctx.fillStyle = '#ff5b2e';
  const titleSize = fitSize(ctx, title, 750, 760, 40, 28);
  ctx.font = `750 ${titleSize}px ${FONT}`;
  ctx.fillText(title, 72, titleY);

  ctx.fillStyle = '#d5dbe8';
  ctx.font = `600 28px ${FONT}, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;
  const place = country ? `from ${placeLabel({ country, flag })}` : 'pick a country';
  ctx.fillText(place, 72, titleY + 48);
  let tagY = titleY + 92;
  if (Number.isInteger(rank) && rank > 0) {
    ctx.fillStyle = '#ffc857';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(`Ranked #${rank} worldwide`, 72, titleY + 86);
    tagY = titleY + 122;
  }

  ctx.fillStyle = '#9aa6bd';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(tagline, 72, tagY);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(72, 600);
  ctx.lineTo(700, 600);
  ctx.stroke();

  ctx.fillStyle = '#f4f1ea';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(PAGE_HOST, 72, 640);
}

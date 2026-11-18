import { clamp, mulberry32 } from './util.js';

const MOON_M = 384_400_000;
const MARS_M = 225_000_000_000;

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

function viewSpan(cam) {
  if (cam < 1500) return 520 + (cam / 1500) * 1800;
  if (cam < 15000) return 2320 + (cam - 1500) * 0.55;
  if (cam < 120000) return 9745 + (cam - 15000) * 0.38;
  return Math.max(48000, cam * 0.42);
}

function makeStars() {
  const rand = mulberry32(11);
  const stars = [];
  for (let i = 0; i < 170; i += 1) {
    stars.push({
      x: rand(),
      y: rand(),
      z: 0.35 + rand() * 0.65,
      r: rand() < 0.12 ? 1.7 : 0.8 + rand() * 0.6,
      band: rand() > 0.45 ? 1 : 0,
      tw: rand() * Math.PI * 2,
      speed: 1.5 + rand() * 3,
    });
  }
  return stars;
}

function makeCity() {
  const rand = mulberry32(5);
  const buildings = [];
  let x = 0;
  while (x < 1.02) {
    const w = 0.028 + rand() * 0.048;
    buildings.push({
      x,
      w,
      h: 24 + rand() ** 1.4 * 110,
      cols: 2 + Math.floor(rand() * 4),
      rows: 3 + Math.floor(rand() * 8),
      seed: rand() * 20,
    });
    x += w + 0.004 + rand() * 0.012;
  }
  return buildings;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const stars = makeStars();
  const city = makeCity();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const particles = [];
  const confetti = [];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let cam = 0;
  let starScroll = 0;
  let streakScroll = 0;
  let flash = 0;
  let shake = 0;
  let clock = 0;
  let rocketX = 0;
  let rocketY = 0;
  let groundY = 0;

  const jets = [
    { alt: 8_600, speed: 0.07, seed: 0.05, s: 1, dir: 1 },
    { alt: 10_400, speed: 0.1, seed: 0.4, s: 1.15, dir: -1 },
    { alt: 12_800, speed: 0.06, seed: 0.7, s: 0.92, dir: 1 },
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(1, rect.width);
    const nextH = Math.max(1, rect.height);
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nextW === width && nextH === height && nextDpr === dpr && canvas.width) return;
    width = nextW;
    height = nextH;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function worldToScreen(alt) {
    const span = viewSpan(cam);
    const bottom = cam - span * 0.44;
    return height - ((alt - bottom) / span) * height;
  }

  function spawnFlame(thrust) {
    if (thrust < 0.04 || reduced) return;
    const count = 1 + Math.floor(thrust * 3);
    for (let i = 0; i < count; i += 1) {
      if (particles.length > 160) particles.shift();
      const smoke = Math.random() > 0.72;
      particles.push({
        x: rocketX + (Math.random() - 0.5) * 10,
        y: rocketY + 4,
        vx: (Math.random() - 0.5) * (smoke ? 40 : 18),
        vy: 70 + thrust * 380 + Math.random() * 160,
        life: smoke ? 0.55 : 0.28 + Math.random() * 0.18,
        age: 0,
        size: (smoke ? 8 : 4) + thrust * 8,
        smoke,
      });
    }
    if (cam < 400 && thrust > 0.35) {
      particles.push({
        x: rocketX + (Math.random() - 0.5) * 50,
        y: groundY,
        vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 90),
        vy: -10 - Math.random() * 30,
        life: 0.45,
        age: 0,
        size: 5 + Math.random() * 6,
        smoke: true,
      });
    }
  }

  function burst(strength = 1) {
    const n = reduced ? 18 : Math.floor(56 * strength);
    const colors = ['#ff5b2e', '#ffc857', '#7dffb3', '#9fd8ff', '#ffffff', '#ff8bd2'];
    for (let i = 0; i < n; i += 1) {
      if (confetti.length > 220) confetti.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 460 * strength;
      confetti.push({
        x: rocketX,
        y: rocketY - 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 1.1 + Math.random() * 0.8,
        age: 0,
        w: 4 + Math.random() * 5,
        h: 7 + Math.random() * 7,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
        color: colors[i % colors.length],
      });
    }
    flash = Math.min(1, flash + 0.45 * strength);
  }

  function drawSky() {
    const km = cam / 1000;
    const top = km > 80 ? '#05070e' : km > 20 ? '#0b0d18' : '#140c22';
    const mid = km > 80 ? '#070910' : '#100a1c';
    const bottom = '#070910';
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.55, mid);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const horizonFade = clamp(1 - km / 40, 0, 1);
    if (horizonFade > 0.02 && groundY < height + 200) {
      const glow = ctx.createLinearGradient(0, groundY - 220, 0, groundY + 20);
      glow.addColorStop(0, 'rgba(255, 92, 48, 0)');
      glow.addColorStop(1, `rgba(255, 88, 42, ${0.32 * horizonFade})`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, Math.max(0, groundY - 220), width, 260);
    }
  }

  function drawStars() {
    for (const star of stars) {
      let alpha;
      if (star.band === 0) alpha = 0.28 + 0.55 * clamp(cam / 6000, 0, 1);
      else alpha = clamp((cam - 5000) / 28000, 0, 1) * 0.9;
      if (alpha <= 0.02) continue;
      const twinkle = reduced ? 1 : 0.65 + Math.sin(clock * star.speed + star.tw) * 0.35;
      let y = (star.y + starScroll * star.z) % 1;
      if (y < 0) y += 1;
      ctx.fillStyle = `rgba(244, 246, 255, ${alpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x * width, y * height, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMoon() {
    const progress = clamp(cam / MOON_M, 0, 1.2);
    let radius = 16 + progress ** 1.55 * Math.min(width, height) * 0.46;
    let x = width * (0.82 - 0.28 * Math.min(progress, 1));
    let y = height * (0.16 + 0.08 * Math.min(progress, 1));
    if (cam < 2000) {
      const blend = clamp(cam / 2000, 0, 1);
      x = width * 0.86 + (x - width * 0.86) * blend;
      y = height * 0.42 + (y - height * 0.42) * blend;
    }
    if (cam > MOON_M * 1.04) {
      const past = clamp((cam - MOON_M) / MOON_M, 0, 1);
      radius = Math.max(12, radius * (1 - past * 0.86));
      x = width * (0.52 - past * 0.28);
      y = height * (0.28 + past * 0.35);
    }
    if (y > height + radius || radius < 2) return;
    const body = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.36, radius * 0.15, x, y, radius);
    body.addColorStop(0, '#f8f3e8');
    body.addColorStop(1, '#b5a892');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(110, 98, 84, 0.38)';
    const craters = [[-0.22, -0.08, 0.16], [0.28, 0.16, 0.11], [0.02, 0.3, 0.08], [-0.32, 0.28, 0.09]];
    for (const [cx, cy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(x + cx * radius, y + cy * radius, Math.max(1, cr * radius), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlanet(x, y, radius, light, dark, ring) {
    const body = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.32, radius * 0.15, x, y, radius);
    body.addColorStop(0, light);
    body.addColorStop(1, dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (ring) {
      ctx.strokeStyle = 'rgba(236, 220, 180, 0.8)';
      ctx.lineWidth = Math.max(2, radius * 0.12);
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.7, radius * 0.42, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawOuterBodies() {
    const bodies = [
      { alt: MARS_M, light: '#ffb199', dark: '#c44832', x: 0.2, min: 2_000_000 },
      { alt: 630_000_000_000, light: '#f6e2b8', dark: '#c9894a', x: 0.78, min: 40_000_000_000 },
      { alt: 1_270_000_000_000, light: '#f4e6c4', dark: '#d2b47a', x: 0.22, min: 200_000_000_000, ring: true },
      { alt: 5_900_000_000_000, light: '#f0d2c0', dark: '#b89280', x: 0.74, min: 1_500_000_000_000 },
    ];
    for (const body of bodies) {
      if (cam < body.min) continue;
      const progress = clamp(cam / body.alt, 0, 1.2);
      let radius = 5 + Math.min(progress, 1) ** 1.45 * Math.min(width, height) * 0.3;
      if (cam > body.alt * 1.08) radius = Math.max(6, radius * 0.28);
      const x = width * body.x;
      const y = height * (0.2 + 0.04 * (1 - Math.min(progress, 1)));
      drawPlanet(x, y, radius, body.light, body.dark, body.ring);
    }
  }

  function drawCloud(x, y, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `rgba(236, 240, 248, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46 * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(-28 * scale, 6 * scale, 24 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(30 * scale, 4 * scale, 28 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawClouds() {
    const specs = [
      { alt: 650, x: 0.18, s: 1.15, a: 0.16 },
      { alt: 980, x: 0.72, s: 1.45, a: 0.18 },
      { alt: 1500, x: 0.4, s: 1.8, a: 0.2 },
      { alt: 2300, x: 0.84, s: 1.3, a: 0.14 },
      { alt: 3100, x: 0.22, s: 1.6, a: 0.12 },
      { alt: 4200, x: 0.6, s: 1.2, a: 0.1 },
    ];
    for (const cloud of specs) {
      const y = worldToScreen(cloud.alt);
      if (y < -80 || y > height + 80) continue;
      drawCloud(cloud.x * width, y, cloud.s, cloud.a);
    }
  }

  function drawJet(x, y, scale, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * scale, scale);
    ctx.fillStyle = '#d5dcea';
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(-30, -5);
    ctx.lineTo(-36, 0);
    ctx.lineTo(-30, 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(16, 18);
    ctx.lineTo(22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(-34, -14);
    ctx.lineTo(-20, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7ec8ff';
    ctx.fillRect(6, -2, 16, 3);
    ctx.restore();
  }

  function drawJets() {
    for (const jet of jets) {
      const y = worldToScreen(jet.alt);
      if (y < -40 || y > height + 40) continue;
      const travel = ((clock * jet.speed + jet.seed) % 1.35) - 0.15;
      drawJet(travel * width, y, jet.s * 1.15, jet.dir);
    }
  }

  function drawMarker(altitude, label, color) {
    const y = worldToScreen(altitude);
    if (y < 188 || y > height - 28) return;
    const gradient = ctx.createLinearGradient(0, y - 8, 0, y + 8);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 8, width, 16);
    ctx.fillStyle = color;
    ctx.font = '700 12px Inter, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 16, y - 10);
  }

  function drawISS() {
    const y = worldToScreen(400_000);
    if (y < -50 || y > height + 50) return;
    const x = width * (0.5 + Math.sin(clock * 0.15) * 0.18);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#1d4e89';
    ctx.fillRect(-78, -16, 50, 32);
    ctx.fillRect(28, -16, 50, 32);
    ctx.fillStyle = 'rgba(143, 208, 255, 0.85)';
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(-74 + i * 12, -13, 8, 26);
      ctx.fillRect(32 + i * 12, -13, 8, 26);
    }
    ctx.fillStyle = '#d5dbe6';
    ctx.fillRect(-30, -3, 60, 6);
    ctx.fillStyle = '#f4f7fb';
    roundRect(ctx, -18, -12, 20, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#c5ccd8';
    roundRect(ctx, 4, -9, 16, 13, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    if (groundY > height + 40 || groundY < -200) return;
    ctx.fillStyle = '#10141e';
    ctx.fillRect(0, groundY, width, height - groundY + 80);

    for (const building of city) {
      const bx = building.x * width;
      const bw = building.w * width;
      ctx.fillStyle = '#1a2030';
      ctx.fillRect(bx, groundY - building.h, bw, building.h);
      const winW = Math.max(2, bw / (building.cols * 2.2));
      const winH = 3;
      for (let row = 0; row < building.rows; row += 1) {
        for (let col = 0; col < building.cols; col += 1) {
          const on = Math.sin(building.seed + row * 2.1 + col + clock * 0.6) > -0.2;
          ctx.fillStyle = on ? 'rgba(255, 206, 130, 0.85)' : 'rgba(255,255,255,0.05)';
          ctx.fillRect(
            bx + 4 + col * (winW + 3),
            groundY - building.h + 6 + row * 8,
            winW,
            winH,
          );
        }
      }
    }

    const padW = Math.min(230, width * 0.46);
    const padX = width / 2 - padW / 2;
    ctx.fillStyle = '#2c3344';
    roundRect(ctx, padX, groundY - 10, padW, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(width / 2 - 18, groundY - 12, 36, 4);

    const gantryX = width / 2 - padW / 2 - 8;
    ctx.strokeStyle = '#8d97aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gantryX, groundY);
    ctx.lineTo(gantryX, groundY - 118);
    ctx.moveTo(gantryX - 16, groundY);
    ctx.lineTo(gantryX - 16, groundY - 90);
    for (let y = 0; y < 100; y += 16) {
      ctx.moveTo(gantryX - 16, groundY - y);
      ctx.lineTo(gantryX, groundY - y - 10);
    }
    ctx.stroke();
    const blink = Math.sin(clock * 5) > 0;
    ctx.fillStyle = blink ? '#ff5b2e' : '#5a2430';
    ctx.beginPath();
    ctx.arc(gantryX, groundY - 122, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRocket(thrust) {
    const scale = Math.min(width, height) / 390;
    ctx.save();
    ctx.translate(rocketX, rocketY);
    const wobble = reduced ? 0 : Math.sin(clock * 42) * thrust * 0.04;
    ctx.rotate(wobble);
    ctx.scale(scale, scale);
    ctx.translate(0, -18);

    if (thrust > 0.03) {
      const length = 26 + thrust * 86 + (reduced ? 0 : Math.sin(clock * 54) * 8 * thrust);
      const flame = ctx.createLinearGradient(0, 16, 0, 16 + length);
      flame.addColorStop(0, 'rgba(255, 248, 224, 0.95)');
      flame.addColorStop(0.28, 'rgba(255, 176, 40, 0.92)');
      flame.addColorStop(0.72, 'rgba(255, 64, 20, 0.4)');
      flame.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(-8, 16);
      ctx.quadraticCurveTo(0, 18 + length, 8, 16);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 244, 210, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-3.5, 16);
      ctx.quadraticCurveTo(0, 18 + length * 0.55, 3.5, 16);
      ctx.fill();
    }

    ctx.fillStyle = '#d7dde8';
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.lineTo(-24, 20);
    ctx.lineTo(-8, 15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, 2);
    ctx.lineTo(24, 20);
    ctx.lineTo(8, 15);
    ctx.fill();

    const body = ctx.createLinearGradient(-12, 0, 12, 0);
    body.addColorStop(0, '#8e97a8');
    body.addColorStop(0.35, '#f5f7fb');
    body.addColorStop(0.72, '#c5ccd8');
    body.addColorStop(1, '#8a93a4');
    ctx.fillStyle = body;
    roundRect(ctx, -11, -38, 22, 56, 8);
    ctx.fill();

    ctx.fillStyle = '#ff5b2e';
    ctx.beginPath();
    ctx.moveTo(0, -64);
    ctx.lineTo(12, -32);
    ctx.lineTo(-12, -32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffc857';
    ctx.fillRect(-11, 0, 22, 4);

    ctx.fillStyle = '#172033';
    ctx.beginPath();
    ctx.arc(0, -14, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 216, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-1.3, -15.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (cam < 500 && groundY < height) {
      const lift = clamp(1 - cam / 400, 0, 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * lift})`;
      ctx.beginPath();
      ctx.ellipse(rocketX, groundY - 2, 16 * scale * (0.5 + lift), 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 40 * dt;
      const t = 1 - particle.age / particle.life;
      if (particle.smoke) {
        ctx.fillStyle = `rgba(180, 186, 198, ${0.22 * t})`;
      } else {
        ctx.fillStyle = `rgba(255, ${140 + Math.floor(80 * t)}, 40, ${0.8 * t})`;
      }
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (particle.smoke ? 1 + particle.age : t), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawConfetti(dt) {
    for (let i = confetti.length - 1; i >= 0; i -= 1) {
      const bit = confetti[i];
      bit.age += dt;
      if (bit.age >= bit.life) {
        confetti.splice(i, 1);
        continue;
      }
      bit.vy += 520 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.rot += bit.vr * dt;
      const alpha = 1 - bit.age / bit.life;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(bit.rot);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = bit.color;
      ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawStreaks(velocity) {
    const speed = Math.abs(velocity);
    if (reduced || speed < 400) return;
    const intensity = clamp(Math.log10(speed) / 8, 0, 0.55);
    ctx.strokeStyle = `rgba(220, 230, 255, ${intensity})`;
    ctx.lineWidth = 1.5;
    const dir = Math.sign(velocity) || 1;
    for (let i = 0; i < 14; i += 1) {
      const x = ((i * 97) % width);
      const length = 30 + (i % 5) * 18;
      const y = (streakScroll * dir + i * 80) % (height + 80);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (i % 2 ? 6 : -4), y + length);
      ctx.stroke();
    }
  }

  function frame(flight, dt, options = {}) {
    resize();
    clock += dt;
    const altitude = flight.altitude || 0;
    const follow = altitude < 2000 ? 2.4 : 5;
    cam += (altitude - cam) * (1 - Math.exp(-follow * Math.max(dt, 0.001)));
    if (Math.abs(altitude - cam) < 0.4) cam = altitude;

    const velocity = flight.velocity || 0;
    const vLog = Math.log10(Math.abs(velocity) + 10);
    starScroll = (starScroll + Math.sign(velocity || 1) * vLog * dt * 0.015) % 1;
    streakScroll = (streakScroll + dt * (30 + Math.min(500, vLog * 50))) % 10000;

    const thrust = flight.thrust || 0;
    const targetShake = reduced ? 0 : thrust * Math.min(width, height) * 0.012;
    shake += (targetShake - shake) * 0.35;
    flash = Math.max(0, flash - dt * 0.8);

    groundY = worldToScreen(0);
    rocketX = width / 2;
    rocketY = worldToScreen(altitude);

    const ox = reduced ? 0 : Math.sin(clock * 73) * shake;
    const oy = reduced ? 0 : Math.cos(clock * 91) * shake * 0.75;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(ox, oy);
    drawSky();
    drawStars();
    drawOuterBodies();
    drawMoon();
    if (options.markers !== false) {
      drawMarker(100_000, 'KÁRMÁN LINE  ·  100 km', 'rgba(125, 255, 179, 0.9)');
      drawMarker(400_000, 'ISS  ·  400 km', 'rgba(159, 216, 255, 0.9)');
    }
    drawClouds();
    drawJets();
    drawISS();
    drawGround();
    spawnFlame(thrust);
    if (thrust > 0.05) {
      const glow = ctx.createRadialGradient(rocketX, rocketY + 10, 4, rocketX, rocketY + 20, 70 + thrust * 90);
      glow.addColorStop(0, `rgba(255, 150, 60, ${0.35 * thrust})`);
      glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(rocketX, rocketY + 16, 80 + thrust * 90, 0, Math.PI * 2);
      ctx.fill();
    }
    drawParticles(dt);
    drawStreaks(velocity);
    drawRocket(thrust);
    drawConfetti(dt);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 236, 210, ${flash * 0.22})`;
      ctx.fillRect(-20, -20, width + 40, height + 40);
    }
    ctx.restore();
  }

  return {
    frame,
    burst,
    snapTo(altitude) {
      cam = altitude;
    },
    resize,
  };
}

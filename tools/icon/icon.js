// Palmyra Quest app icon: the Sacred Grove with a pillar of light (no people).
// Painted procedurally on a canvas; tools/icon/render.mjs renders every size.
// drawIcon(ctx, S, { maskable, simple, seed })
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function drawIcon(ctx, S, o = {}) {
  const R = rng(o.seed || 7);
  const simple = !!o.simple;
  const z = o.maskable ? 0.84 : 1; // maskable: pull the frame in so the trunks survive a circle crop
  const X = (u) => S * (0.5 + (u - 0.5) * z);
  ctx.save();
  // 1) deep grove at dawn
  let g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#163a46'); g.addColorStop(0.45, '#1a4634'); g.addColorStop(0.78, '#123222'); g.addColorStop(1, '#081a10');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // warm air around the light
  ctx.globalCompositeOperation = 'screen';
  g = ctx.createRadialGradient(S * 0.5, S * 0.45, 0, S * 0.5, S * 0.5, S * 0.72);
  g.addColorStop(0, 'rgba(255,214,140,0.85)'); g.addColorStop(0.35, 'rgba(214,150,70,0.38)'); g.addColorStop(0.7, 'rgba(90,70,40,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  // 2) far trunks in haze
  const trunk = (x0, w0, w1, lean, col, blur, rim) => {
    ctx.save();
    if (blur) ctx.filter = `blur(${blur * S / 1024}px)`;
    ctx.beginPath();
    ctx.moveTo(x0 - w0 * 0.85, S * 1.02);
    ctx.quadraticCurveTo(x0 - w0 / 2, S * 0.97, x0 - w0 / 2, S * 0.88);
    ctx.bezierCurveTo(x0 - w0 / 2 + lean * 0.3, S * 0.6, x0 - w1 / 2 + lean * 0.8, S * 0.3, x0 - w1 / 2 + lean, -S * 0.02);
    ctx.lineTo(x0 + w1 / 2 + lean, -S * 0.02);
    ctx.bezierCurveTo(x0 + w1 / 2 + lean * 0.8, S * 0.3, x0 + w0 / 2 + lean * 0.3, S * 0.6, x0 + w0 / 2, S * 0.88);
    ctx.quadraticCurveTo(x0 + w0 / 2, S * 0.97, x0 + w0 * 0.85, S * 1.02);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (rim) {
      // light wraps only the edge that faces the pillar
      ctx.clip();
      const side = x0 < S / 2 ? 1 : -1;
      const edge = () => { ctx.beginPath(); ctx.moveTo(x0 + side * w0 * 0.85, S * 1.02); ctx.quadraticCurveTo(x0 + side * w0 / 2, S * 0.97, x0 + side * w0 / 2, S * 0.88); ctx.bezierCurveTo(x0 + side * w0 / 2 + lean * 0.3, S * 0.6, x0 + side * w1 / 2 + lean * 0.8, S * 0.3, x0 + side * w1 / 2 + lean, -S * 0.02); };
      if (!simple) {
        // bark furrows (subtle)
        for (let i = 0; i < 22; i++) {
          const u = (R() - 0.5) * w1 * 0.9, y = R() * S, h = S * (0.03 + R() * 0.07);
          ctx.strokeStyle = R() < 0.7 ? 'rgba(0,0,0,0.28)' : 'rgba(120,140,120,0.05)';
          ctx.lineWidth = S * (0.002 + R() * 0.003);
          ctx.beginPath(); ctx.moveTo(x0 + u + lean * (1 - y / S), y); ctx.quadraticCurveTo(x0 + u + S * 0.004 + lean * (1 - y / S), y + h / 2, x0 + u + lean * (1 - y / S), y + h); ctx.stroke();
        }
      }
      const cg = ctx.createLinearGradient(x0 - w0 / 2, 0, x0 + w0 / 2, 0);
      cg.addColorStop(0, 'rgba(70,110,110,0.22)'); cg.addColorStop(0.25, 'rgba(0,0,0,0)'); cg.addColorStop(0.75, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(70,110,110,0.22)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, S, S);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${S * 0.012}px)`;
      edge(); ctx.strokeStyle = `rgba(214,140,60,${rim * 0.3})`; ctx.lineWidth = w0 * 0.4; ctx.stroke();
      ctx.filter = `blur(${S * 0.0025}px)`;
      edge(); ctx.strokeStyle = `rgba(255,214,140,${rim})`; ctx.lineWidth = w0 * 0.09; ctx.stroke();
    }
    ctx.restore();
  };
  if (!simple) {
    for (const [u, w, a] of [[0.3, 0.035, 0.5], [0.38, 0.025, 0.42], [0.63, 0.03, 0.46], [0.71, 0.04, 0.5], [0.24, 0.03, 0.4], [0.77, 0.026, 0.4]]) {
      trunk(X(u), S * w * 1.2, S * w * 0.8, (R() - 0.5) * S * 0.02, `rgba(22,56,50,${a})`, 7, 0.12);
    }
    for (const [u, w] of [[0.31, 0.055], [0.69, 0.06]]) trunk(X(u), S * w, S * w * 0.7, (R() - 0.5) * S * 0.03, 'rgba(10,26,22,0.9)', 2.5, 0.3);
  }
  // 3) the pillar of light, brightest above, settling softly onto the ground
  const bc = document.createElement('canvas'); bc.width = bc.height = S;
  const bx = bc.getContext('2d');
  const beam = (topW, botW, col, blur, alpha) => {
    bx.save();
    bx.globalCompositeOperation = 'lighter';
    if (blur) bx.filter = `blur(${blur * S / 1024}px)`;
    bx.globalAlpha = alpha;
    const cx = S * 0.5;
    bx.beginPath();
    bx.moveTo(cx - topW / 2, -S * 0.08); bx.lineTo(cx + topW / 2, -S * 0.08);
    bx.lineTo(cx + botW / 2, S * 0.9); bx.lineTo(cx - botW / 2, S * 0.9); bx.closePath();
    const hg = bx.createLinearGradient(cx - botW / 2, 0, cx + botW / 2, 0);
    hg.addColorStop(0, 'rgba(255,170,80,0)'); hg.addColorStop(0.32, col); hg.addColorStop(0.5, '#fff6e2'); hg.addColorStop(0.68, col); hg.addColorStop(1, 'rgba(255,170,80,0)');
    bx.fillStyle = hg; bx.fill();
    bx.restore();
  };
  beam(S * 0.3, S * 0.42, 'rgba(255,170,80,0.5)', 70, simple ? 0.7 : 0.42);
  beam(S * 0.13, S * 0.2, 'rgba(255,200,120,0.8)', 22, simple ? 0.8 : 0.6);
  beam(S * (simple ? 0.11 : 0.06), S * (simple ? 0.14 : 0.085), 'rgba(255,232,180,1)', simple ? 2 : 4, 1);
  bx.globalCompositeOperation = 'destination-in';
  const vg = bx.createLinearGradient(0, 0, 0, S);
  vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.62, 'rgba(0,0,0,0.85)'); vg.addColorStop(0.86, 'rgba(0,0,0,0.5)'); vg.addColorStop(0.96, 'rgba(0,0,0,0)');
  bx.fillStyle = vg; bx.fillRect(0, 0, S, S);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(bc, 0, 0); ctx.restore();
  // radiance where the light breaks through the canopy, with a soft fan of rays
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (simple ? 0 : 14); i++) {
    const a = Math.PI / 2 + (i / 13 - 0.5) * 1.9, len = S * (0.75 + R() * 0.3), wdt = 0.025 + R() * 0.03;
    const rg = ctx.createLinearGradient(S / 2, 0, S / 2 + Math.cos(a) * len, Math.sin(a) * len);
    rg.addColorStop(0, `rgba(255,230,170,${0.10 + R() * 0.06})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(S / 2, -S * 0.02);
    ctx.lineTo(S / 2 + Math.cos(a - wdt) * len, Math.sin(a - wdt) * len); ctx.lineTo(S / 2 + Math.cos(a + wdt) * len, Math.sin(a + wdt) * len); ctx.closePath(); ctx.fill();
  }
  g = ctx.createRadialGradient(S * 0.5, 0, 0, S * 0.5, 0, S * (simple ? 0.42 : 0.36));
  g.addColorStop(0, 'rgba(255,246,220,0.95)'); g.addColorStop(0.35, 'rgba(255,214,140,0.45)'); g.addColorStop(1, 'rgba(255,190,100,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S * 0.5);
  ctx.restore();
  // light pooled on the ground
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  g = ctx.createRadialGradient(S * 0.5, S * 0.84, 0, S * 0.5, S * 0.84, S * 0.36);
  g.addColorStop(0, 'rgba(255,236,190,0.8)'); g.addColorStop(0.3, 'rgba(255,190,100,0.35)'); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.setTransform(1, 0, 0, 0.36, 0, S * 0.84 * 0.64); ctx.fillRect(0, 0, S, S * 2);
  ctx.restore();
  // 4) canopy: dark leaf masses, edges kindled by the light
  if (!simple) {
    const mass = (cx, cy, rx, ry, col, blur) => { ctx.save(); ctx.filter = `blur(${blur * S / 1024}px)`; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
    const leaves = (cx, cy, rx, ry, n, rimDir) => {
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, d = 0.75 + R() * 0.3;
        const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, rr = S * (0.006 + R() * 0.011);
        const lit = rimDir && Math.abs(x - S / 2) < S * 0.24 && R() < 0.22;
        ctx.fillStyle = lit ? `rgba(${170 + R() * 60},${170 + R() * 40},${100 + R() * 40},0.5)` : `rgb(${5 + R() * 8},${18 + R() * 16},${14 + R() * 10})`;
        ctx.beginPath(); ctx.ellipse(x, y, rr * 1.6, rr * 0.8, R() * 3, 0, Math.PI * 2); ctx.fill();
      }
    };
    for (const [u, v, rx, ry, dir] of [[0.06, 0.04, 0.3, 0.2, 1], [0.94, 0.03, 0.3, 0.19, -1], [0.27, -0.03, 0.17, 0.1, 1], [0.73, -0.04, 0.17, 0.1, -1]]) {
      mass(X(u), S * v, S * rx, S * ry, 'rgba(6,18,13,0.98)', 4);
      leaves(X(u), S * v, S * rx, S * ry, 520, dir);
      mass(X(u), S * v, S * rx * 0.8, S * ry * 0.8, 'rgb(6,17,12)', 2);
    }
  }
  // 5) foreground trunks frame the light
  trunk(X(0.12), S * 0.16, S * 0.1, S * 0.03, '#0b1511', simple ? 0 : 1, simple ? 0.55 : 0.75);
  trunk(X(0.885), S * 0.18, S * 0.11, -S * 0.025, '#0a130f', simple ? 0 : 1, simple ? 0.55 : 0.75);
  // 6) ground and grass
  ctx.save();
  g = ctx.createLinearGradient(0, S * 0.8, 0, S);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(0.25, 'rgba(10,22,14,0.75)'); g.addColorStop(1, '#040a06');
  ctx.fillStyle = g; ctx.fillRect(0, S * 0.8, S, S * 0.2);
  if (!simple) {
    for (let i = 0; i < 260; i++) {
      const x = R() * S, base = S * (0.93 + R() * 0.09), h = S * (0.02 + R() * 0.05);
      const near = Math.max(0, 1 - Math.abs(x - S / 2) / (S * 0.28));
      ctx.strokeStyle = near > 0.25 && R() < 0.4 ? `rgba(${110 + near * 120},${100 + near * 90},${50 + near * 40},${0.35 + near * 0.35})` : `rgba(6,${16 + R() * 14},10,0.95)`;
      ctx.lineWidth = S * (0.002 + R() * 0.0025);
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + (R() - 0.5) * S * 0.02, base - h * 0.6, x + (R() - 0.5) * S * 0.035, base - h); ctx.stroke();
    }
  }
  ctx.restore();
  // 7) motes drifting in the light
  if (!simple) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const y = S * (0.1 + R() * 0.72), spread = S * (0.06 + (y / S) * 0.1);
      const x = S * 0.5 + (R() - 0.5) * 2 * spread * (0.4 + R());
      const r = S * (0.0015 + R() * 0.0035);
      g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, `rgba(255,248,220,${0.5 + R() * 0.5})`); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }
  // 8) vignette
  g = ctx.createRadialGradient(S * 0.5, S * 0.52, S * 0.3, S * 0.5, S * 0.5, S * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(2,6,6,${simple ? 0.3 : 0.45})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // 9) a whisper of paint grain
  if (!simple) {
    const id = ctx.getImageData(0, 0, S, S), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(id, 0, 0);
  }
  ctx.restore();
}

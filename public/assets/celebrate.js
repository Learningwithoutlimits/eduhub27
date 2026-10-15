// Confetti and sparklers drawn on a canvas, in awards gold with a touch of
// Trust teal and purple.
// No outside libraries. Does nothing for people who ask for reduced motion.

const COLOURS = ['#f6cf6b', '#ffe3a1', '#c98a1a', '#fff4d6', '#e8b04a', '#009189', '#6F2789'];
const SPARK = ['#fff7d6', '#FDB913', '#ffe48a', '#ffffff'];

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function celebrate(canvas, { duration = 4200, sparklers = [] } = {}){
  if(!canvas || reducedMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const rand = (a, b) => a + Math.random() * (b - a);
  const confetti = [];
  // Two bursts from the lower corners, then a gentle shower from the top.
  for(const side of [0, 1]){
    for(let i = 0; i < 90; i++){
      const angle = side ? rand(-2.6, -1.9) : rand(-1.25, -0.55);
      const speed = rand(9, 17);
      confetti.push({ x: side ? w + 10 : -10, y: h * 0.85, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: rand(6, 11), rot: rand(0, Math.PI), spin: rand(-0.25, 0.25), colour: COLOURS[i % COLOURS.length], wobble: rand(0, 6), delay: 0 });
    }
  }
  for(let i = 0; i < 70; i++){
    confetti.push({ x: rand(0, w), y: rand(-h * 0.6, -20), vx: rand(-1, 1), vy: rand(1, 3), size: rand(5, 9),
      rot: rand(0, Math.PI), spin: rand(-0.2, 0.2), colour: COLOURS[i % COLOURS.length], wobble: rand(0, 6), delay: rand(300, 1400) });
  }
  const sparks = [];
  const start = performance.now();
  let frame, stopped = false;

  function step(now){
    const t = now - start;
    ctx.clearRect(0, 0, w, h);

    // Sparklers: a glowing tip that throws off short-lived sparks.
    if(t < duration - 600){
      for(const s of sparklers){
        const sx = s.x * w, sy = s.y * h;
        for(let i = 0; i < 6; i++){
          const a = rand(0, Math.PI * 2), v = rand(1.5, 5.5);
          sparks.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: rand(18, 38), age: 0, colour: SPARK[i % SPARK.length] });
        }
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#FDB913'; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
        // The sparkler stick.
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(80,80,80,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + (s.x < 0.5 ? -18 : 18), sy + 70); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.age++; p.vy += 0.12; p.x += p.vx; p.y += p.vy;
      if(p.age > p.life){ sparks.splice(i, 1); continue; }
      const alpha = 1 - p.age / p.life;
      ctx.strokeStyle = p.colour; ctx.globalAlpha = alpha; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
    }
    ctx.restore();

    // Confetti.
    for(const c of confetti){
      if(t < c.delay) continue;
      c.vy += 0.22; c.vx *= 0.985; c.vy *= 0.985;
      c.x += c.vx + Math.sin((t / 260) + c.wobble) * 0.6; c.y += c.vy; c.rot += c.spin;
      if(c.y > h + 30) continue;
      ctx.save();
      ctx.globalAlpha = t > duration - 800 ? Math.max(0, (duration - t) / 800) : 1;
      ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.colour;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }

    if(t < duration && !stopped) frame = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, w, h);
  }
  frame = requestAnimationFrame(step);
  return () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener('resize', resize); ctx.clearRect(0, 0, w, h); };
}

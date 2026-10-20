// Logo files are often exported with a wide transparent or white margin,
// which makes the artwork look small on the page. This crops that margin
// away in the browser, so any logo uploaded later is trimmed too.
// Applies to <img data-trim>. If anything goes wrong the original stays.

const SAMPLE = 400; // width used to find the edges, for speed

function isBlank(d, i){
  return d[i + 3] < 12 || (d[i] > 246 && d[i + 1] > 246 && d[i + 2] > 246);
}

function trim(img){
  try{
    const w = img.naturalWidth, h = img.naturalHeight;
    if(!w || !h) return;
    const scale = Math.min(1, SAMPLE / w);
    const sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
    const probe = document.createElement('canvas');
    probe.width = sw; probe.height = sh;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(img, 0, 0, sw, sh);
    const d = pctx.getImageData(0, 0, sw, sh).data;
    let top = sh, left = sw, right = -1, bottom = -1;
    for(let y = 0; y < sh; y++){
      for(let x = 0; x < sw; x++){
        if(isBlank(d, (y * sw + x) * 4)) continue;
        if(x < left) left = x; if(x > right) right = x;
        if(y < top) top = y; if(y > bottom) bottom = y;
      }
    }
    if(right < 0) return;
    // Keep a small breathing space around the artwork.
    const pad = Math.round(Math.max(right - left, bottom - top) * 0.03);
    const x0 = Math.max(0, (left - pad) / scale), y0 = Math.max(0, (top - pad) / scale);
    const x1 = Math.min(w, (right + 1 + pad) / scale), y1 = Math.min(h, (bottom + 1 + pad) / scale);
    // Not worth doing if the margin is already small.
    if((x1 - x0) * (y1 - y0) > w * h * 0.85) return;
    const out = document.createElement('canvas');
    out.width = Math.round(x1 - x0); out.height = Math.round(y1 - y0);
    out.getContext('2d').drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
    img.src = out.toDataURL('image/png');
    img.classList.add('is-trimmed');
  }catch{ /* leave the original logo in place */ }
}

for(const img of document.querySelectorAll('img[data-trim]')){
  if(img.complete && img.naturalWidth) trim(img);
  else img.addEventListener('load', () => trim(img), { once: true });
}

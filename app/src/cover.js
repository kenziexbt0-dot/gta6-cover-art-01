// Draws a multi-panel poster-style cover: the photos in their panels, a colour grade over each one, and the
// caption in a bold condensed face. `state` holds the export size, the layout, the grade, the caption and, per
// panel, which photo it shows and how that photo is panned and zoomed. Everything is drawn on the canvas's own
// 2D context at the canvas's own size, so the preview and the exported PNG are the same drawing. The optional
// `selection` index draws a dashed outline around one panel; export passes -1 so it never appears in a PNG.

/** The panel layouts: each panel is a fraction of the canvas (x, y, w, h). */
export const LAYOUTS = {
  hero: {
    name: 'Hero',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  triptych: {
    name: 'Triptych',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  quad: {
    name: 'Quad',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
};

/** The colour grades: a canvas filter for the photo, then gradient overlays per panel. */
export const GRADES = {
  sunset: {
    name: 'Sunset',
    accent: '#ff7a3d',
    filter: 'saturate(1.35) contrast(1.06)',
    overlays: [
      { composite: 'overlay', stops: [[0, 'rgba(255,150,60,0.28)'], [0.55, 'rgba(255,80,90,0.10)'], [1, 'rgba(200,30,120,0.34)']] },
    ],
  },
  neon: {
    name: 'Neon',
    accent: '#22e6ff',
    filter: 'saturate(1.7) contrast(1.12) hue-rotate(-8deg)',
    overlays: [
      { composite: 'overlay', stops: [[0, 'rgba(255,0,180,0.30)'], [0.5, 'rgba(80,0,255,0.08)'], [1, 'rgba(0,220,255,0.34)']] },
    ],
  },
  noir: {
    name: 'Noir',
    accent: '#e8e8e8',
    filter: 'grayscale(1) contrast(1.3) brightness(1.06)',
    overlays: [
      { composite: 'soft-light', stops: [[0, 'rgba(120,160,200,0.35)'], [1, 'rgba(0,0,0,0.45)']] },
    ],
  },
  palm: {
    name: 'Palm',
    accent: '#ffc44d',
    filter: 'saturate(1.25) sepia(0.12) contrast(1.05)',
    overlays: [
      { composite: 'soft-light', stops: [[0, 'rgba(0,130,115,0.30)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(255,190,80,0.30)']] },
    ],
  },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The panel rectangles in canvas pixels, with a uniform white gutter between panels and around the edge. */
export function panelRects(layout, w, h) {
  const g = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  return LAYOUTS[layout].panels.map((p) => {
    const x = p.x * w + (p.x === 0 ? g : g / 2);
    const y = p.y * h + (p.y === 0 ? g : g / 2);
    const pw = p.w * w - (p.x === 0 ? g : g / 2) - (p.x + p.w === 1 ? g : g / 2);
    const ph = p.h * h - (p.y === 0 ? g : g / 2) - (p.y + p.h === 1 ? g : g / 2);
    return { x, y, w: pw, h: ph };
  });
}

/** The index of the panel holding canvas point (x, y), or -1. */
export function panelAt(layout, w, h, x, y) {
  return panelRects(layout, w, h).findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/** Draws one panel's photo, panned and zoomed, clipped to the panel, then the grade's overlays. */
function drawPanel(ctx, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (panel.photo) {
    const img = panel.photo;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const base = Math.max(w / iw, h / ih);
    const scale = base * panel.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    // Pan is kept inside the range that still covers the panel.
    const dx = clamp(x + (w - dw) / 2 + panel.panX, x + w - dw, x);
    const dy = clamp(y + (h - dh) / 2 + panel.panY, y + h - dh, y);
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, '#2a1d3a');
    fill.addColorStop(1, '#171021');
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  for (const ov of grade.overlays) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    for (const [off, color] of ov.stops) grad.addColorStop(off, color);
    ctx.globalCompositeOperation = ov.composite;
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (!panel.photo) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.max(14, h * 0.05)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

/** The caption in huge condensed capitals, with a dark outline, a shadow and an accent bar above it. */
function drawCaption(ctx, w, h, caption, sizeMul, pos, accent) {
  const text = caption.trim().toUpperCase();
  if (!text) return;
  let size = h * 0.15 * sizeMul;
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  try {
    ctx.letterSpacing = `${size * 0.03}px`;
  } catch {
    // letterSpacing is Chrome-only; the caption still draws without it.
  }
  while (ctx.measureText(text).width > w * 0.92 && size > 12) {
    size -= 2;
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
  }
  const y = h * (0.12 + pos * 0.76);
  // A soft dark scrim so the words read over any photo.
  const scrim = ctx.createLinearGradient(0, y - size * 0.9, 0, y + size * 0.7);
  scrim.addColorStop(0, 'rgba(10,4,18,0)');
  scrim.addColorStop(0.5, 'rgba(10,4,18,0.42)');
  scrim.addColorStop(1, 'rgba(10,4,18,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, y - size * 0.9, w, size * 1.6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeStyle = 'rgba(16,6,24,0.9)';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.04;
  ctx.strokeText(text, w / 2, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, y);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Accent bar above the words.
  const barW = Math.min(w * 0.3, ctx.measureText(text).width * 0.5);
  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - barW / 2, y - size * 0.78, barW, Math.max(3, size * 0.06));
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // See above.
  }
}

/**
 * Draws the whole cover onto the canvas's 2D context, at the canvas's own size.
 * state: { layout, grade, caption, captionSize (0.5..1.5), captionPos (0..1, top to bottom),
 *          panels: [{ photo, zoom, panX, panY }] }.
 */
export function drawCover(canvas, state, selection = -1) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => drawPanel(ctx, rect, state.panels[i] ?? { photo: null, zoom: 1, panX: 0, panY: 0 }, grade));
  // A vignette over the whole poster.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawCaption(ctx, w, h, state.caption, state.captionSize, state.captionPos, grade.accent);
  if (selection >= 0 && rects[selection]) {
    const r = rects[selection];
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
    ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }
}

/** Renders the cover at the given pixel size on a fresh canvas and returns it. */
export function renderCover(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state, -1);
  return canvas;
}

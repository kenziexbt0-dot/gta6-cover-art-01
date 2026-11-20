// Wires the page: upload photos, pick a layout and a grade, edit the caption, pan and zoom each panel, and
// export the cover as a PNG at 1080 x 1080, 1080 x 1350 or 1920 x 1080. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js). The preview canvas draws at the export size, so what you see is what
// the PNG holds; the selection outline is preview-only and never appears in an export.

import { drawCover, renderCover, panelAt, panelRects, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const status = document.getElementById('status');
const photoList = document.getElementById('photo-list');
const panelPhoto = document.getElementById('panel-photo');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const captionSize = document.getElementById('caption-size');
const captionPos = document.getElementById('caption-pos');

/** The export sizes the app offers, as [width, height]. */
const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'Sunset Heist',
  captionSize: 1,
  captionPos: 0.85,
  size: '1080x1080',
  panels: [],
  selected: -1,
};

/** Every photo the app can draw: { name, img }. The two samples load first so the app is never empty. */
const photos = [];

function newPanel(photoIdx) {
  return { photo: photos[photoIdx]?.img ?? null, photoIdx, zoom: 1, panX: 0, panY: 0 };
}

function applyLayout() {
  const n = LAYOUTS[state.layout].panels.length;
  const old = state.panels;
  state.panels = Array.from({ length: n }, (_, i) => old[i] ?? newPanel(i % photos.length));
  state.selected = state.panels.length > 0 ? 0 : -1;
}

function redraw() {
  drawCover(canvas, state, state.selected);
  syncPanelTools();
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function refreshPhotoList() {
  photoList.innerHTML = '';
  photos.forEach((p, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.title = `${p.name} — click to put it in every panel`;
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    thumb.appendChild(img);
    const label = document.createElement('span');
    label.textContent = p.name;
    thumb.appendChild(label);
    thumb.addEventListener('click', () => {
      state.panels.forEach((panel) => {
        panel.photoIdx = i;
        panel.photo = p.img;
        panel.zoom = 1;
        panel.panX = 0;
        panel.panY = 0;
      });
      redraw();
      status.textContent = `Every panel now shows ${p.name}.`;
    });
    photoList.appendChild(thumb);
  });
  panelPhoto.innerHTML = '';
  photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    panelPhoto.appendChild(opt);
  });
}

function syncPanelTools() {
  const panel = state.panels[state.selected];
  const enabled = panel !== undefined;
  panelPhoto.disabled = !enabled;
  zoomSlider.disabled = !enabled;
  if (panel) {
    panelPhoto.value = String(panel.photoIdx);
    zoomSlider.value = String(panel.zoom);
    zoomValue.textContent = `${panel.zoom.toFixed(2)}x`;
  }
}

function syncButtons() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
}

function setSize(key) {
  state.size = key;
  const [w, h] = SIZES[key];
  canvas.width = w;
  canvas.height = h;
  syncButtons();
  redraw();
}

function setLayout(key) {
  state.layout = key;
  syncButtons();
  applyLayout();
  redraw();
}

function setGrade(key) {
  state.grade = key;
  syncButtons();
  redraw();
}

// ---- photo upload -------------------------------------------------------

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      photos.push({ name: file.name.replace(/\.[^.]+$/, ''), img });
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  if (files.length > 0) {
    // New photos join the pool; the selected panel takes the first of them.
    const panel = state.panels[state.selected];
    if (panel) {
      panel.photoIdx = photos.length - files.length;
      panel.photo = photos[panel.photoIdx].img;
      panel.zoom = 1;
      panel.panX = 0;
      panel.panY = 0;
    }
    refreshPhotoList();
    redraw();
    status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} added. Click a thumbnail to fill every panel with it.`;
  }
  e.target.value = '';
});

// ---- caption ------------------------------------------------------------

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
captionSize.addEventListener('input', () => {
  state.captionSize = Number(captionSize.value);
  redraw();
});
captionPos.addEventListener('input', () => {
  state.captionPos = Number(captionPos.value);
  redraw();
});

// ---- layout, grade and size buttons --------------------------------------

document.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => setLayout(b.dataset.layout)));
document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => setGrade(b.dataset.grade)));
document.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));

// ---- selected panel ------------------------------------------------------

panelPhoto.addEventListener('change', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.photoIdx = Number(panelPhoto.value);
  panel.photo = photos[panel.photoIdx].img;
  panel.zoom = 1;
  panel.panX = 0;
  panel.panY = 0;
  redraw();
});
zoomSlider.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Number(zoomSlider.value);
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  state.panels.forEach((p) => {
    p.photoIdx = panel.photoIdx;
    p.photo = panel.photo;
    p.zoom = 1;
    p.panX = 0;
    p.panY = 0;
  });
  redraw();
  status.textContent = 'Every panel now shows the selected panel\u2019s photo.';
});

// ---- pan and zoom on the canvas ------------------------------------------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  drag = { x: p.x, y: p.y, panX: state.panels[i].panX, panY: state.panels[i].panY };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  const rect = panelRects(state.layout, canvas.width, canvas.height)[state.selected];
  const img = panel.photo;
  if (img) {
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const dw = img.naturalWidth * base * panel.zoom;
    const dh = img.naturalHeight * base * panel.zoom;
    const maxX = Math.max(0, (dw - rect.w) / 2);
    const maxY = Math.max(0, (dh - rect.h) / 2);
    panel.panX = Math.min(maxX, Math.max(-maxX, drag.panX + (p.x - drag.x)));
    panel.panY = Math.min(maxY, Math.max(-maxY, drag.panY + (p.y - drag.y)));
  }
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Math.min(4, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

// ---- export ---------------------------------------------------------------

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = SIZES[state.size];
  const out = renderCover(w, h, state);
  out.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved cover-${w}x${h}.png`;
  }, 'image/png');
});

/** The fixed scene a `?shot=` screenshot runs: layout, grade, size, caption and sample photos. */
async function setupShot({ layout, grade, size, caption, photos: names }) {
  state.layout = layout in LAYOUTS ? layout : 'hero';
  state.grade = grade in GRADES ? grade : 'sunset';
  state.caption = caption;
  captionInput.value = caption;
  applyLayout(); // Panels must exist before setSize redraws.
  setSize(size && SIZES[size] ? size : '1080x1080');
  const loaded = [];
  for (const name of names) {
    // Samples join the photo pool, so the thumbnails and the panel-photo picker show them too.
    let found = photos.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase()));
    if (!found) {
      try {
        const img = await loadImage(`samples/${name}.jpg`);
        found = { name: `${name[0].toUpperCase()}${name.slice(1)} — sample`, img };
        photos.push(found);
      } catch {
        // An unknown sample name leaves that panel empty rather than failing the shot.
      }
    }
    if (found) loaded.push(found.img);
  }
  applyLayout();
  state.panels.forEach((panel, i) => {
    const img = loaded[i % Math.max(1, loaded.length)] ?? null;
    panel.photo = img;
    panel.photoIdx = img ? photos.findIndex((p) => p.img === img) : -1;
    panel.zoom = 1;
    panel.panX = 0;
    panel.panY = 0;
  });
  state.selected = -1;
  syncButtons();
  refreshPhotoList();
  redraw();
}

// A handle the screenshot script and the shot scenes use to inspect the app.
window.__app = { state, photos, setSize, setLayout, setGrade, setupShot };

const shot = new URLSearchParams(location.search).get('shot');
(async () => {
  // The condensed display face has to be loaded before the canvas draws with it.
  try {
    await document.fonts.load('100px "Bebas Neue"');
  } catch {
    // The caption still draws in the fallback face.
  }
  if (!shot) {
    photos.push({ name: 'Pier — sample', img: await loadImage('samples/pier.jpg') });
    photos.push({ name: 'Boulevard — sample', img: await loadImage('samples/boulevard.jpg') });
    applyLayout();
    state.panels[0].photoIdx = 0;
    state.panels[0].photo = photos[0].img;
    if (state.panels[1]) {
      state.panels[1].photoIdx = 1;
      state.panels[1].photo = photos[1].img;
    }
    if (state.panels[2]) {
      state.panels[2].photoIdx = 1;
      state.panels[2].photo = photos[1].img;
    }
    state.selected = 0;
    refreshPhotoList();
    redraw();
    return;
  }
  await runShot(shot, new URLSearchParams(location.search), { setup: setupShot });
})();

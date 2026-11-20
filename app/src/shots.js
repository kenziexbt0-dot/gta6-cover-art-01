// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos; ?shot=cover shows the cover
// alone. `layout` picks a panel layout, `grade` a colour grade, `size` the export size (1080x1080, 1080x1350
// or 1920x1080), `photos` a comma-separated list of samples (pier, boulevard) dealt across the panels in order,
// and `caption` the words. window.__shotReady is set once painted.
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const size = query.get('size') ?? '1080x1080';
  const photos = (query.get('photos') ?? query.get('photo') ?? 'pier').split(',').map((s) => s.trim()).filter(Boolean);
  await api.setup({
    layout: query.get('layout') ?? 'hero',
    grade: query.get('grade') ?? 'sunset',
    size,
    caption: query.get('caption') ?? 'Sunset Heist',
    photos,
  });
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

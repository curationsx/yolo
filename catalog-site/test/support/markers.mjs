// @ts-check

/**
 * Named "marker" elements from the Board oracle whose on-screen geometry
 * (position expressed as a ratio of the viewport) must stay stable across
 * deploys. Every selector below is an existing, stable structural hook
 * already present in the production markup — no new test-only attributes
 * were required.
 *
 * `board-app.jsx` mapping (ACCEPTANCE.md):
 *   - header-brand / header-nav-first -> BoardHeader
 *   - search-shell / filter-bar       -> board-views.jsx search + filters
 *   - featured-heading / stack-score  -> BoardHome / CompanyRow (score rail)
 *   - feed-heading                    -> FeedRail
 */
export const MARKER_SELECTORS = /** @type {const} */ ({
  'header-brand': '.site-header .brand',
  'header-nav-first': '.site-nav a >> nth=0',
  'search-shell': '.board-search-shell',
  'filter-bar': '.board-filter-bar',
  'featured-heading': '#featured-stacks .board-list-heading h1',
  'first-stack-score': '.stack-list .stack-row .stack-score >> nth=0',
  'feed-heading': '#universal-feed h2',
});

/**
 * Measures each marker's bounding box as a ratio of the current viewport, so
 * comparisons are resolution-independent and expressible as "within 0.5% of
 * the viewport".
 *
 * @param {import('@playwright/test').Page} page
 */
export async function measureMarkers(page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Page has no viewport set.');

  /** @type {Record<string, { x: number; y: number; width: number; height: number }>} */
  const result = {};
  for (const [name, selector] of Object.entries(MARKER_SELECTORS)) {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`Marker "${name}" (${selector}) has no bounding box.`);
    result[name] = {
      x: box.x / viewport.width,
      y: box.y / viewport.height,
      width: box.width / viewport.width,
      height: box.height / viewport.height,
    };
  }
  return result;
}

/**
 * Client-side search + filters for the directory grid.
 *
 * Runs entirely in the browser over data-* attributes already rendered into
 * the static HTML — no fetch, no search server, no external library. With a
 * dataset this small (dozens of entries), substring matching is instant.
 */

interface Controls {
  search: HTMLInputElement;
  category: HTMLSelectElement;
  deployment: HTMLSelectElement;
  license: HTMLSelectElement;
}

export function initFilters(): void {
  const grid = document.querySelector<HTMLElement>('[data-directory-grid]');
  const count = document.querySelector<HTMLElement>('[data-result-count]');
  if (!grid || !count) return;

  const controls: Controls = {
    search: grid.ownerDocument.querySelector('#filter-search')!,
    category: grid.ownerDocument.querySelector('#filter-category')!,
    deployment: grid.ownerDocument.querySelector('#filter-deployment')!,
    license: grid.ownerDocument.querySelector('#filter-license')!,
  };

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.card'));

  const apply = (): void => {
    const q = controls.search.value.trim().toLowerCase();
    const category = controls.category.value;
    const deployment = controls.deployment.value;
    const license = controls.license.value;

    let visible = 0;
    for (const card of cards) {
      const matches =
        (!q || (card.dataset.search ?? '').includes(q)) &&
        (!category || card.dataset.category === category) &&
        (!deployment || card.dataset.deployment === deployment) &&
        (!license || card.dataset.license === license);
      card.hidden = !matches;
      if (matches) visible += 1;
    }

    count.textContent =
      visible === cards.length
        ? `${cards.length} tools`
        : `${visible} of ${cards.length} tools`;
  };

  controls.search.addEventListener('input', apply);
  for (const select of [controls.category, controls.deployment, controls.license]) {
    select.addEventListener('change', apply);
  }
  apply();
}

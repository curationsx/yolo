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
  const grids = Array.from(
    document.querySelectorAll<HTMLElement>('[data-directory-grid]'),
  );
  const count = document.querySelector<HTMLElement>('[data-result-count]');
  if (!grids.length || !count) return;

  const controls: Controls = {
    search: document.querySelector('#filter-search')!,
    category: document.querySelector('#filter-category')!,
    deployment: document.querySelector('#filter-deployment')!,
    license: document.querySelector('#filter-license')!,
  };

  const cards = grids.flatMap((grid) =>
    Array.from(grid.querySelectorAll<HTMLElement>('.stack-row')),
  );

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

    for (const section of document.querySelectorAll<HTMLElement>('[data-card-section]')) {
      section.hidden = !section.querySelector('.stack-row:not([hidden])');
    }

    count.textContent =
      visible === cards.length
        ? `${cards.length} stacks`
        : `${visible} of ${cards.length} stacks`;
  };

  controls.search.addEventListener('input', apply);
  controls.search.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    apply();
  });
  for (const select of [controls.category, controls.deployment, controls.license]) {
    select.addEventListener('change', apply);
  }
  apply();
}

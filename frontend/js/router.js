// Steps of the flow, driven by the URL hash so the browser's back button works.
// The Bluetooth connection lives in this one document, which is why the steps are views and not separate HTML files:
// a connection is dropped when the browser navigates to another page.
const ORDER = ['select', 'calibrate', 'live'];

/**
 * @param {Record<string, {title: string, subtitle: string, enter(root: HTMLElement): void, leave(): void}>} pages
 * @param {(step: string) => boolean} canEnter
 * @param {{ root: HTMLElement, title: HTMLElement, subtitle: HTMLElement, stepper: HTMLElement }} els
 */
export function createRouter(pages, canEnter, els) {
  let current = null;

  function resolve() {
    let i = Math.max(0, ORDER.indexOf(location.hash.slice(1)));
    while (i > 0 && !canEnter(ORDER[i])) i--;   // fall back to the latest step that is allowed
    return ORDER[i];
  }

  function show(step) {
    if (step === current) return;
    if (current) pages[current].leave();
    current = step;
    const page = pages[step];
    els.title.textContent = page.title; els.subtitle.textContent = page.subtitle;
    els.stepper.querySelectorAll('li').forEach(li => {
      const i = ORDER.indexOf(li.dataset.step);
      li.dataset.state = i < ORDER.indexOf(step) ? 'done' : i === ORDER.indexOf(step) ? 'current' : 'todo';
    });
    els.root.innerHTML = '';
    page.enter(els.root);
  }

  function sync() {
    const step = resolve();
    if (location.hash.slice(1) !== step) history.replaceState(null, '', '#' + step);
    show(step);
  }

  window.addEventListener('hashchange', sync);
  return {
    start: sync,
    go(step) { if (location.hash.slice(1) === step) sync(); else location.hash = step; },
  };
}

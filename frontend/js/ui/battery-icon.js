// Battery icon with the charge percent written inside it. Turns red at LOW_BATTERY_PERCENT.
import { describeBattery } from '../sensor/ble-link.js';

export const LOW_BATTERY_PERCENT = 20;

const BOLT = '<svg class="batt-bolt" viewBox="0 0 8 12" aria-hidden="true"><path d="M5 0 0 7h3l-1 5 6-7H5z"/></svg>';

/**
 * @param {import('../sensor/ble-link.js').Battery | null} battery
 * @param {string} [label] short name shown before the icon, e.g. "Upper arm"
 * @returns {string} HTML, empty when there is no battery reading
 */
export function batteryIconHtml(battery, label = '') {
  if (!battery) return '';
  const pct = Math.max(0, Math.min(100, battery.percent));
  const low = pct <= LOW_BATTERY_PERCENT;
  const spoken = `${label ? `${label} ` : ''}battery ${describeBattery(battery)}`;
  return `<span class="batt-item" role="img" aria-label="${spoken}">`
    + (label ? `<span class="batt-label" aria-hidden="true">${label}</span>` : '')
    + `<span class="batt" data-low="${low}" style="--pct:${pct}%" aria-hidden="true"><span class="batt-num">${pct}</span></span>`
    + (battery.charging ? BOLT : '')
    + '</span>';
}

/** Puts `html` into `el`, skipping the DOM write when it hasn't changed (the live page repaints every frame). */
export function renderBatteries(el, html) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}

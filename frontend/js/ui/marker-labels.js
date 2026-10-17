// Name tags that follow the sensor spots on the 3D arm.
import { MARKER_IDS, markerAnchor } from '../model/sensor-markers.js';
import { POSITIONS } from '../sensor-setups.js';

/** @param {{ stage: object, container: HTMLElement }} opts */
export function createMarkerLabels({ stage, container }) {
  const els = {};
  for (const id of MARKER_IDS) {
    const el = document.createElement('div');
    el.className = 'marker-label'; el.hidden = true; el.textContent = POSITIONS[id].label;
    container.appendChild(el); els[id] = el;
  }
  let shown = [];

  stage.onFrame(() => {
    for (const id of shown) {
      const p = stage.project(markerAnchor(id));
      els[id].style.left = `${p.x + 18}px`; els[id].style.top = `${p.y}px`; els[id].style.opacity = p.visible ? 1 : 0;
    }
  });

  return {
    /** @param {string[]} ids labels to show; `selected` ones are drawn solid */
    show(ids, selected = []) {
      shown = ids;
      for (const id of MARKER_IDS) {
        els[id].hidden = !ids.includes(id);
        els[id].dataset.selected = String(selected.includes(id));
      }
    },
    hide() { this.show([]); },
  };
}

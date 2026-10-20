// Page 1: choose the sensor setup, by clicking sensor spots on the 3D arm or by picking a setup from the list.
import { SETUPS, setupFromPositions, setupById, togglePosition } from '../sensor-setups.js';
import { MARKER_IDS, setMarkersVisible, setMarkerState, pickTargets, markerIdOf } from '../model/sensor-markers.js';
import { $ } from '../ui/dom.js';

/** @param {{stage, model, labels, state, router}} ctx */
export function createSelectPage({ stage, model, labels, state, router }) {
  let root = null;
  let positions = new Set();
  let hovered = null;
  const cleanups = [];

  function render() {
    root.innerHTML = `
      <h2>Where will you wear the sensors?</h2>
      <p class="hint">Click a spot on the arm, or pick a setup below.</p>
      <div class="setups" role="radiogroup" aria-label="Sensor setup">
        ${SETUPS.map(s => `
          <button type="button" class="setup" role="radio" data-id="${s.id}" aria-checked="false">
            <span class="dot" aria-hidden="true"></span><span class="name">${s.label}</span>${s.implemented ? '' : '<span class="badge">Not built yet</span>'}
          </button>`).join('')}
      </div>
      <p class="note" id="sel-note" aria-live="polite"></p>
      <div class="row actions"><button type="button" class="fg-btn fg-btn-primary" id="sel-continue" disabled>Continue</button></div>`;

    root.querySelectorAll('.setup').forEach(btn => btn.addEventListener('click', () => {
      positions = new Set(setupById(btn.dataset.id).positions); refresh();
    }));
    $('#sel-continue', root).addEventListener('click', () => {
      const setup = setupFromPositions(positions);
      if (!setup || !setup.implemented) return;
      if (state.setupId !== setup.id) state.calibrated = false;
      state.setupId = setup.id;
      router.go('calibrate');
    });
  }

  function refresh() {
    const setup = setupFromPositions(positions);
    for (const id of MARKER_IDS) setMarkerState(id, positions.has(id) ? 'selected' : id === hovered ? 'hover' : 'idle');
    labels.show(MARKER_IDS, [...positions]);
    root.querySelectorAll('.setup').forEach(btn => btn.setAttribute('aria-checked', String(setup?.id === btn.dataset.id)));

    let note;
    if (!positions.size) note = 'Nothing selected yet.';
    else if (!setup) note = positions.has('upper') && positions.size === 1
      ? 'An upper arm sensor needs a forearm or wrist sensor with it.'
      : 'That combination is not one of the setups.';
    else if (!setup.implemented) note = `${setup.label} is not implemented yet. Choose another setup to continue.`;
    else note = setup.summary;
    $('#sel-note', root).textContent = note;
    $('#sel-continue', root).disabled = !(setup && setup.implemented);
    stage.requestRender();
  }

  return {
    title: 'Choose your sensors',
    subtitle: 'Click a sensor spot on the arm to select it.',
    enter(el) {
      root = el;
      model.setCalibrationView(false); model.setElbow(0); model.setTwist(0);
      setMarkersVisible(MARKER_IDS);
      positions = new Set(state.setupId ? setupById(state.setupId).positions : []);
      render(); refresh();

      cleanups.push(stage.onTap(p => {
        const hit = stage.raycast(p.x, p.y, pickTargets());
        if (hit) { positions = togglePosition(positions, markerIdOf(hit)); refresh(); }
      }));
      cleanups.push(stage.onHover(p => {
        const hit = p && stage.raycast(p.x, p.y, pickTargets());
        const id = hit ? markerIdOf(hit) : null;
        stage.canvas.style.cursor = id ? 'pointer' : '';
        if (id !== hovered) { hovered = id; refresh(); }
      }));
    },
    leave() {
      cleanups.splice(0).forEach(off => off());
      stage.canvas.style.cursor = ''; hovered = null;
      for (const id of MARKER_IDS) setMarkerState(id, 'idle');
      labels.hide();
    },
  };
}

// Page 3: the live arm and the numeric angles.
import { setupById } from '../sensor-setups.js';
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { $ } from '../ui/dom.js';

/** @param {{stage, model, labels, state, router, link, estimator, cfg}} ctx */
export function createLivePage({ stage, model, labels, state, router, link, estimator, cfg }) {
  let root = null;
  let angles = { elbow: 0, twist: 0 }, peak = 0;
  let latestQ = null;
  const cleanups = [];

  const fmt = deg => { const n = Math.round(deg); return n < 0 ? `−${-n}` : String(n); };   // true minus sign, never -0

  function render() {
    const setup = setupById(state.setupId);
    root.innerHTML = `
      <div class="readouts">
        <div class="fg-reading"><span class="fg-label">Elbow flexion</span><span><span class="fg-reading-value" id="live-elbow">0</span><span class="fg-reading-unit">&deg;</span></span><span class="fg-reading-note">Peak <span id="live-peak">0</span>&deg;</span></div>
        <div class="fg-reading"><span class="fg-label">Forearm rotation</span><span><span class="fg-reading-value" id="live-twist">0</span><span class="fg-reading-unit">&deg;</span></span><span class="fg-reading-note">0&deg; = palm toward thigh</span></div>
      </div>
      <p class="note">The sensor can't tell which way your palm faces. Hold it toward your thigh, then press Zero twist.</p>
      <p class="note warn" id="live-warn" hidden>No data from the sensor.</p>
      <p class="meta" id="live-meta"></p>
      <div class="row view">
        <div class="seg" role="group" aria-label="Skin">
          <span class="lbl">Skin</span>
          <button type="button" data-skin="glass" aria-pressed="true">Glass</button>
          <button type="button" data-skin="solid" aria-pressed="false">Solid</button>
          <button type="button" data-skin="off" aria-pressed="false">Off</button>
        </div>
        <div class="seg" role="group" aria-label="Layers">
          <span class="lbl">Show</span>
          <button type="button" data-layer="muscles" aria-pressed="true">Muscles</button>
          <button type="button" data-layer="bones" aria-pressed="true">Bones</button>
        </div>
      </div>
      <div class="grid-actions">
        <button type="button" class="fg-btn fg-btn-quiet" id="live-peak-reset">Reset peak</button>
        <button type="button" class="fg-btn fg-btn-quiet" id="live-twist-zero" title="Hold your palm toward your thigh first" disabled>Zero twist</button>
        <button type="button" class="fg-btn fg-btn-quiet" id="live-sensors">Change sensors</button>
        <button type="button" class="fg-btn fg-btn-secondary" id="live-recal">Recalibrate</button>
      </div>`;

    $('#live-meta', root).textContent = `${setup.label} · forearm axis ${estimator.axisLabel}`;
    root.querySelectorAll('[data-skin]').forEach(btn => btn.addEventListener('click', () => {
      model.setSkinMode(btn.dataset.skin);
      root.querySelectorAll('[data-skin]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      stage.requestRender();
    }));
    root.querySelectorAll('[data-layer]').forEach(btn => btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on)); model.setLayerOn(btn.dataset.layer, on); stage.requestRender();
    }));
    $('#live-peak-reset', root).addEventListener('click', () => { peak = angles.elbow; });
    $('#live-twist-zero', root).addEventListener('click', () => {
      if (!latestQ || !estimator.setTwistZero(latestQ)) return;
      angles.twist = 0;
      model.setTwist(0);
      stage.requestRender();
      paint();
    });
    $('#live-sensors', root).addEventListener('click', () => router.go('select'));
    $('#live-recal', root).addEventListener('click', () => router.go('calibrate'));
  }

  function paint() {
    $('#live-elbow', root).textContent = fmt(angles.elbow);
    $('#live-peak', root).textContent = fmt(peak);
    $('#live-twist', root).textContent = fmt(angles.twist);
    $('#live-warn', root).hidden = link.msSincePacket() < cfg.staleMs;
    const setup = setupById(state.setupId);
    $('#live-meta', root).textContent = `${setup.label} · forearm axis ${estimator.axisLabel} · ${link.rateHz} Hz · ${link.lost} lost`;
  }

  return {
    title: 'Live arm',
    subtitle: 'Elbow and forearm angles from your sensor.',
    enter(el) {
      root = el; angles = { elbow: 0, twist: 0 }; peak = 0; latestQ = null;
      const setup = setupById(state.setupId);
      model.setCalibrationView(false);
      model.setSkinMode('glass'); model.setLayerOn('muscles', true); model.setLayerOn('bones', true);
      setMarkersVisible(setup.positions);
      for (const id of MARKER_IDS) setMarkerState(id, 'selected');
      labels.show(setup.positions, setup.positions);
      render();

      cleanups.push(link.on('packet', q => {
        latestQ = q;
        $('#live-twist-zero', root).disabled = false;
        const a = estimator.update(q);
        if (!a) return;
        angles = a; peak = Math.max(peak, a.elbow);
        model.setElbow(a.elbow); model.setTwist(a.twist); stage.requestRender();
      }));
      cleanups.push(link.on('disconnected', () => { state.calibrated = false; estimator.reset(); router.go('calibrate'); }));
      cleanups.push(stage.onFrame(paint));
    },
    leave() {
      cleanups.splice(0).forEach(off => off());
      labels.hide();
    },
  };
}

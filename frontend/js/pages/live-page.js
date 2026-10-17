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

  const fmt = deg => Math.round(deg);

  function render() {
    const setup = setupById(state.setupId);
    root.innerHTML = `
      <div class="readouts">
        <div class="readout"><small>Elbow flexion</small><b><span id="live-elbow">0</span>&deg;</b><em>peak <span id="live-peak">0</span>&deg;</em></div>
        <div class="readout"><small>Forearm rotation</small><b><span id="live-twist">0</span>&deg;</b><em>0&deg; = palm toward thigh</em></div>
      </div>
      <p class="note">Hold your palm toward your thigh, then press Zero twist. The sensor cannot detect palm direction on its own.</p>
      <p class="note warn" id="live-warn" hidden>No data from the sensor.</p>
      <p class="meta" id="live-meta"></p>
      <div class="row">
        <div class="seg" role="group" aria-label="Skin">
          <span class="lbl">Skin</span>
          <button type="button" data-skin="glass" aria-pressed="true">Glass</button>
          <button type="button" data-skin="solid" aria-pressed="false">Solid</button>
          <button type="button" data-skin="off" aria-pressed="false">Off</button>
        </div>
        <button type="button" class="chip" data-layer="muscles" aria-pressed="true"><i></i>Muscles</button>
        <button type="button" class="chip" data-layer="bones" aria-pressed="true"><i></i>Bones</button>
      </div>
      <div class="row actions">
        <button type="button" class="btn ghost" id="live-peak-reset">Reset peak</button>
        <button type="button" class="btn ghost" id="live-twist-zero" title="Hold your palm toward your thigh first" disabled>Zero twist</button>
        <button type="button" class="btn ghost" id="live-sensors">Change sensors</button>
        <button type="button" class="btn" id="live-recal">Recalibrate</button>
      </div>`;

    $('#live-meta', root).textContent = `${setup.label} - forearm axis ${estimator.axisLabel}`;
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
    $('#live-meta', root).textContent = `${setup.label} - forearm axis ${estimator.axisLabel} - ${link.rateHz} Hz, ${link.lost} lost`;
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

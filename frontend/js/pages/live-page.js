// Page 3: the live arm and the numeric angles.
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { $ } from '../ui/dom.js';

/** @param {{stage, model, labels, state, router, rig}} ctx */
export function createLivePage({ stage, model, labels, state, router, rig: currentRig }) {
  let root = null, rig = null;
  let angles = { elbow: 0, twist: 0 }, peak = 0;
  let latestSample = null;
  const cleanups = [];

  const fmt = deg => { const n = Math.round(deg); return n < 0 ? `−${-n}` : String(n); };   // true minus sign, never -0

  const twistNote = () => rig.slots.length > 1
    ? 'Rotation is measured against the upper arm. Hold your palm toward your thigh, then press Zero twist.'
    : "The sensor can't tell which way your palm faces. Hold it toward your thigh, then press Zero twist.";

  function meta() {
    const axes = rig.slots.length > 1 ? rig.estimator.axisLabel : `forearm axis ${rig.estimator.axisLabel}`;
    return `${rig.setup.label} · ${axes} · ${rig.rateHz} Hz · ${rig.lost} lost`;
  }

  function render() {
    root.innerHTML = `
      <div class="readouts">
        <div class="fg-reading"><span class="fg-label">Elbow flexion</span><span><span class="fg-reading-value" id="live-elbow">0</span><span class="fg-reading-unit">&deg;</span></span><span class="fg-reading-note">Peak <span id="live-peak">0</span>&deg;</span></div>
        <div class="fg-reading"><span class="fg-label">Forearm rotation</span><span><span class="fg-reading-value" id="live-twist">0</span><span class="fg-reading-unit">&deg;</span></span><span class="fg-reading-note">0&deg; = palm toward thigh</span></div>
        ${rig.slots.length > 1 ? `<div class="fg-reading"><span class="fg-label">Upper arm</span><span><span class="fg-reading-value" id="live-upper">0</span><span class="fg-reading-unit">&deg;</span></span><span class="fg-reading-note" id="live-upper-note">from vertical</span></div>` : ''}
      </div>
      <p class="note" id="live-twist-note"></p>
      <p class="note warn" id="live-warn" hidden>No data from ${rig.slots.length > 1 ? 'one of the sensors' : 'the sensor'}.</p>
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

    $('#live-twist-note', root).textContent = twistNote();
    $('#live-meta', root).textContent = meta();
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
      if (!latestSample || !rig.estimator.setTwistZero(latestSample)) return;
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
    if (angles.upperArm) {
      const { tilt, forward, out } = angles.upperArm;
      $('#live-upper', root).textContent = fmt(tilt);
      $('#live-upper-note', root).textContent = `${fmt(Math.abs(forward))}° ${forward < 0 ? 'back' : 'forward'} · ${fmt(Math.abs(out))}° ${out < 0 ? 'in' : 'out'}`;
    }
    $('#live-warn', root).hidden = rig.streaming;
    $('#live-meta', root).textContent = meta();
  }

  return {
    title: 'Live arm',
    subtitle: 'Elbow and forearm angles from your sensor.',
    enter(el) {
      root = el; rig = currentRig(); angles = { elbow: 0, twist: 0 }; peak = 0; latestSample = null;
      const { setup, estimator } = rig;
      model.setCalibrationView(false);
      model.setSkinMode('glass'); model.setLayerOn('muscles', true); model.setLayerOn('bones', true);
      setMarkersVisible(setup.positions);
      for (const id of MARKER_IDS) setMarkerState(id, 'selected');
      labels.show(setup.positions, setup.positions);
      render();

      cleanups.push(rig.on('sample', s => {
        latestSample = s;
        $('#live-twist-zero', root).disabled = false;
        const a = estimator.update(s);
        if (!a) return;
        angles = a; peak = Math.max(peak, a.elbow);
        model.setElbow(a.elbow); model.setTwist(a.twist); model.setShoulder(a.shoulder || null); stage.requestRender();
      }));
      cleanups.push(rig.on('disconnected', () => { state.calibrated = false; estimator.reset(); router.go('calibrate'); }));
      cleanups.push(stage.onFrame(paint));
    },
    leave() {
      cleanups.splice(0).forEach(off => off());
      labels.hide();
    },
  };
}

// Page 3: the live arm, the numeric angles and the form check.
// The form check (rep count and elbow swing) needs the upper arm board, so single-board setups show an error instead.
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { RepDetector } from '../form/rep-detector.js';
import { $ } from '../ui/dom.js';

const MAX_STRIP_REPS = 20;   // RepStrip fits 3-20 reps; older reps scroll off the left

/** @param {{stage, model, labels, state, router, rig, cfg}} ctx */
export function createLivePage({ stage, model, labels, state, router, rig: currentRig, cfg }) {
  let root = null, rig = null;
  let angles = { elbow: 0, twist: 0 }, peak = 0;
  let latestSample = null;
  let detector = null;   // null for single-board setups
  let reps = [];         // finished reps of this set
  let cueRep = null;     // the rep the cue card is about, until a clean rep follows
  let stripDirty = false;
  const cleanups = [];

  const fmt = deg => { const n = Math.round(deg); return n < 0 ? `−${-n}` : String(n); };   // true minus sign, never -0

  const twistNote = () => rig.slots.length > 1
    ? 'Rotation is measured against the upper arm. Hold your palm toward your thigh, then press Zero twist.'
    : "The sensor can't tell which way your palm faces. Hold it toward your thigh, then press Zero twist.";

  function meta() {
    const axes = rig.slots.length > 1 ? rig.estimator.axisLabel : `forearm axis ${rig.estimator.axisLabel}`;
    return `${rig.setup.label} · ${axes} · ${rig.rateHz} Hz · ${rig.lost} lost`;
  }

  function formHtml() {
    if (!detector) {
      return `<section class="form" aria-label="Form check">
        <p class="stat"><i data-s="err"></i><span>Form check needs both sensors: upper arm and forearm. Press Change sensors to switch setup.</span></p>
      </section>`;
    }
    return `<section class="form" aria-label="Form check">
      <div class="form-head">
        <span class="fg-flag fg-flag-clear" id="form-flag" role="status"><span class="fg-flag-sq" aria-hidden="true"></span><span id="form-flag-text">In range</span></span>
        <span class="meta" id="form-count"></span>
      </div>
      <p class="stat" id="form-paused" hidden><i data-s="err"></i><span>Form check paused: waiting for both sensors.</span></p>
      <p class="hint" id="form-hint">Curl when ready. Keep your upper arm still at your side.</p>
      <section class="fg-cue" id="form-cue" hidden>
        <div class="fg-cue-top">
          <span class="fg-flag fg-flag-fault" role="status"><span class="fg-flag-sq" aria-hidden="true"></span><span id="form-cue-joint"></span></span>
          <span class="fg-cue-meta" id="form-cue-meta"></span>
        </div>
        <p class="fg-cue-cue">Pin your elbow.</p>
        <p class="fg-cue-fix" id="form-cue-fix"></p>
      </section>
      <div class="fg-reps" id="form-reps" hidden></div>
    </section>`;
  }

  function stripHtml() {
    const shown = reps.slice(-MAX_STRIP_REPS);
    const top = Math.max(...shown.map(r => r.peakDeg - r.bottomDeg));   // depth is relative to this lifter's fullest rep
    const clean = reps.filter(r => !r.faults.length).length;
    const summary = (clean === reps.length ? 'Clean set · ' : '') + `${clean}/${reps.length} in range`;
    const fault = r => r.faults.length ? 'Elbow swing' : '';
    return `
      <div class="fg-reps-head"><span class="fg-label">Bicep curl</span><span class="fg-reps-sum">${summary}</span></div>
      <div class="fg-reps-bars" role="img" aria-label="${summary}">${shown.map(r => `
        <div class="fg-rep${r.faults.length ? ' fg-rep-fault' : ''}" title="Rep ${r.index}${r.faults.length ? `: ${fault(r)}` : ''}">
          <div class="fg-rep-bar" style="height:${Math.round(Math.max(0.08, Math.min(1, (r.peakDeg - r.bottomDeg) / top)) * 100)}%"></div>
        </div>`).join('')}
      </div>
      <div class="fg-reps-nums" aria-hidden="true">${shown.map(r => `<span${r.faults.length ? ' class="fg-rep-fault"' : ''}>${r.index}</span>`).join('')}</div>`;
  }

  /** @param {import('../form/rep-detector.js').RepEvent | null} e */
  function onRepEvent(e) {
    if (!e) return;
    if (e.type === 'fault') cueRep = e.rep;
    else if (e.type === 'abort') { if (cueRep === e.rep) cueRep = null; }
    else {
      reps.push(e.rep); stripDirty = true;
      cueRep = e.rep.faults.length ? e.rep : null;   // a clean rep clears the cue of an earlier one
    }
  }

  function newSet() {
    peak = angles.elbow;
    if (!detector) return;
    detector.reset(); reps = []; cueRep = null; stripDirty = true;
  }

  function paintForm() {
    if (!detector) return;
    const streaming = rig.streaming;
    if (!streaming && detector.current) { if (cueRep === detector.current) cueRep = null; detector.abandon(); }
    const faulting = !!cueRep;
    $('#form-paused', root).hidden = streaming;
    $('#form-flag', root).hidden = !streaming;
    $('#form-flag', root).className = `fg-flag fg-flag-${faulting ? 'fault' : 'clear'}`;
    $('#form-flag-text', root).textContent = faulting ? 'Elbow swing' : 'In range';
    $('#form-count', root).textContent = `${detector.count} ${detector.count === 1 ? 'rep' : 'reps'}`;
    $('#form-hint', root).hidden = !streaming || reps.length > 0 || faulting;

    $('#form-cue', root).hidden = !cueRep;
    if (cueRep) {
      const swing = cueRep.swingDeg;
      $('#form-cue-joint', root).textContent = swing >= 0 ? 'Elbow drifting forward' : 'Elbow swinging back';
      $('#form-cue-meta', root).textContent = `Rep ${cueRep.index || detector.count + 1}`;
      $('#form-cue-fix', root).textContent =
        `Your upper arm moved ${fmt(Math.abs(swing))}° ${swing >= 0 ? 'forward' : 'back'}. Keep it still at your side and let the forearm do the lifting.`;
    }
    $('#live-upper', root)?.closest('.fg-reading').classList.toggle('fg-reading-fault', !!detector.current?.faults.length);

    if (stripDirty) {
      stripDirty = false;
      const strip = $('#form-reps', root);
      strip.hidden = !reps.length;
      strip.innerHTML = reps.length ? stripHtml() : '';
    }
  }

  function render() {
    root.innerHTML = `
      ${formHtml()}
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
        <button type="button" class="fg-btn fg-btn-quiet" id="live-peak-reset">${detector ? 'New set' : 'Reset peak'}</button>
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
    $('#live-peak-reset', root).addEventListener('click', newSet);
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
    paintForm();
  }

  return {
    title: 'Live arm',
    subtitle: 'Elbow and forearm angles from your sensor.',
    enter(el) {
      root = el; rig = currentRig(); angles = { elbow: 0, twist: 0 }; peak = 0; latestSample = null;
      detector = rig.slots.length > 1 ? new RepDetector(cfg) : null;
      reps = []; cueRep = null; stripDirty = true;
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
        if (detector) onRepEvent(detector.update(a, performance.now()));
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

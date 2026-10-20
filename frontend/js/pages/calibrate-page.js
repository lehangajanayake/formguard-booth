// Page 2: show the calibration pose on the 3D arm, connect the sensors, then calibrate.
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { SensorLink } from '../sensor/ble-link.js';
import { $ } from '../ui/dom.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** @param {{stage, model, labels, state, router, rig, cfg}} ctx */
export function createCalibratePage({ stage, model, labels, state, router, rig: currentRig, cfg }) {
  let root = null, rig = null;
  let running = false, cancelled = false, advanceTimer = 0;
  let message = null;   // { text, tone } shown under the sensors, e.g. after a failed calibration
  let hadData = [];     // per slot: data has arrived since connecting
  const cleanups = [];

  function slotStatus(slot, i) {
    const name = rig.slots.length > 1 && slot.name ? ` (${slot.name})` : '';
    if (slot.link.connecting) return { text: `${slot.label}: connecting…`, tone: 'wait' };
    if (!slot.link.connected) return { text: `${slot.label}: not connected${name}`, tone: 'off' };
    if (!hadData[i]) return { text: `${slot.label}: connected, waiting for data`, tone: 'wait' };
    return { text: `${slot.label}: ${slot.link.rateHz} Hz`, tone: 'live' };
  }

  function status() {
    if (message) return message;
    if (running) return { text: 'Calibrating: hold the pose', tone: 'wait' };
    if (rig.connected && hadData.every(Boolean)) return { text: 'Ready. Hold the pose, then press Calibrate', tone: 'live' };
    return null;   // the sensor rows say what is missing
  }

  function refresh() {
    rig.slots.forEach((slot, i) => {
      const s = slotStatus(slot, i);
      $(`#cal-dot-${i}`, root).dataset.s = s.tone;
      $(`#cal-text-${i}`, root).textContent = s.text;
      const connect = $(`#cal-connect-${i}`, root);
      connect.textContent = slot.link.connected ? 'Disconnect' : 'Connect';
      connect.disabled = slot.link.connecting || running;
    });
    const s = status();
    $('#cal-status', root).hidden = !s;
    if (s) { $('#cal-dot', root).dataset.s = s.tone; $('#cal-text', root).textContent = s.text; }
    $('#cal-start', root).disabled = !(rig.connected && hadData.every(Boolean)) || running;
    $('#cal-back', root).disabled = running;
  }

  async function connectClicked(slot) {
    message = null;
    if (slot.link.connected) { slot.link.disconnect(); return; }
    try { await rig.connect(slot); }
    catch (e) { message = { text: e.message || 'Could not connect.', tone: 'err' }; }
    refresh();
  }

  async function runCalibration() {
    message = null; running = true; cancelled = false; state.calibrated = false; refresh();
    try {
      await rig.calibrateBoards(4000);   // the boards recalibrate themselves first; carry on if a signal is missed
    } catch (e) {
      running = false; message = { text: 'Could not send the calibrate command.', tone: 'err' }; refresh(); return;
    }
    if (cancelled) return;
    const { estimator } = rig;
    estimator.beginCalibration();
    const off = rig.on('sample', s => estimator.addSample(s));
    await sleep(cfg.calibrationMs);
    off();
    if (cancelled) return;

    const result = estimator.finishCalibration();
    running = false;
    if (!result.ok) { message = { text: result.reason, tone: 'err' }; refresh(); return; }
    state.calibrated = true;
    message = { text: `Calibrated (${rig.slots.length > 1 ? '' : 'forearm axis '}${estimator.axisLabel})`, tone: 'live' };
    refresh();
    advanceTimer = setTimeout(() => router.go('live'), 800);
  }

  return {
    title: 'Calibrate',
    subtitle: 'Match the pose shown on the arm, then press Calibrate.',
    enter(el) {
      root = el; rig = currentRig(); message = null; running = false;
      rig.releaseMismatched();
      hadData = rig.slots.map(s => s.link.msSincePacket() < cfg.staleMs);
      state.calibrated = false; rig.estimator.reset();
      const { setup } = rig;

      model.setCalibrationView(true);
      setMarkersVisible(setup.positions);
      for (const id of MARKER_IDS) setMarkerState(id, setup.positions.includes(id) ? 'selected' : 'idle');
      labels.show(setup.positions, setup.positions);
      stage.requestRender();

      root.innerHTML = `
        <h2>Calibration pose</h2>
        <p class="hint">${setup.label}: ${rig.slots.map(s => s.label.toLowerCase()).join(' + ')}.</p>
        <ul class="steps">${setup.calibrationSteps.map(s => `<li>${s}</li>`).join('')}</ul>
        ${rig.slots.map((_, i) => `
          <div class="row">
            <span class="stat"><i id="cal-dot-${i}" data-s="off"></i><span id="cal-text-${i}"></span></span>
            <button type="button" class="fg-btn fg-btn-quiet" id="cal-connect-${i}">Connect</button>
          </div>`).join('')}
        <p class="stat" id="cal-status" hidden><i id="cal-dot" data-s="off"></i><span id="cal-text"></span></p>
        ${SensorLink.supported ? '' : '<p class="note warn">Web Bluetooth is not available. Use Chrome or Edge, served from localhost or https.</p>'}
        <div class="row actions">
          <button type="button" class="fg-btn fg-btn-quiet" id="cal-back">Back</button>
          <button type="button" class="fg-btn fg-btn-primary" id="cal-start" disabled>Calibrate</button>
        </div>`;
      rig.slots.forEach((slot, i) => $(`#cal-connect-${i}`, root).addEventListener('click', () => connectClicked(slot)));
      $('#cal-start', root).addEventListener('click', runCalibration);
      $('#cal-back', root).addEventListener('click', () => router.go('select'));

      rig.slots.forEach((slot, i) => {
        cleanups.push(slot.link.on('disconnected', () => { hadData[i] = false; refresh(); }));
        cleanups.push(slot.link.on('packet', () => { if (!hadData[i]) { hadData[i] = true; refresh(); } }));
      });
      for (const event of ['connecting', 'connected', 'stats']) cleanups.push(rig.on(event, refresh));
      refresh();
    },
    leave() {
      cancelled = true; clearTimeout(advanceTimer);
      cleanups.splice(0).forEach(off => off());
      labels.hide();
    },
  };
}

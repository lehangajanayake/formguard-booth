// Page 2: show the calibration pose on the 3D arm, connect the sensor, then calibrate.
import { setupById, POSITIONS } from '../sensor-setups.js';
import { setMarkersVisible, setMarkerState, MARKER_IDS } from '../model/sensor-markers.js';
import { SensorLink } from '../sensor/ble-link.js';
import { $ } from '../ui/dom.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** @param {{stage, model, labels, state, router, link, estimator, cfg}} ctx */
export function createCalibratePage({ stage, model, labels, state, router, link, estimator, cfg }) {
  let root = null;
  let hadData = false, running = false, cancelled = false, advanceTimer = 0;
  let message = null;   // { text, tone } shown in place of the connection status, e.g. after a failed calibration
  const cleanups = [];

  function status() {
    if (message) return message;
    if (running) return { text: 'Calibrating: hold the pose', tone: 'wait' };
    if (link.connecting) return { text: 'Connecting...', tone: 'wait' };
    if (!link.connected) return { text: 'Sensor not connected', tone: 'off' };
    if (!hadData) return { text: 'Connected, waiting for data', tone: 'wait' };
    return { text: `Ready. Hold the pose, then press Calibrate (${link.rateHz} Hz)`, tone: 'live' };
  }

  function refresh() {
    const s = status();
    $('#cal-dot', root).dataset.s = s.tone;
    $('#cal-text', root).textContent = s.text;
    const connect = $('#cal-connect', root);
    connect.textContent = link.connected ? 'Disconnect' : 'Connect';
    connect.disabled = link.connecting || running;
    $('#cal-start', root).disabled = !(link.connected && hadData) || running;
    $('#cal-back', root).disabled = running;
  }

  async function connectClicked() {
    message = null;
    if (link.connected) { link.disconnect(); return; }
    try { await link.connect(); }
    catch (e) { message = { text: e.message || 'Could not connect.', tone: 'err' }; }
    refresh();
  }

  async function runCalibration() {
    message = null; running = true; cancelled = false; state.calibrated = false; refresh();
    try {
      await link.sendCalibrate();
    } catch (e) {
      running = false; message = { text: 'Could not send the calibrate command.', tone: 'err' }; refresh(); return;
    }
    await link.once('ready', 4000);   // the board recalibrates itself first; carry on if the signal is missed
    if (cancelled) return;
    estimator.beginCalibration();
    const off = link.on('packet', q => estimator.addSample(q));
    await sleep(cfg.calibrationMs);
    off();
    if (cancelled) return;

    const result = estimator.finishCalibration();
    running = false;
    if (!result.ok) { message = { text: result.reason, tone: 'err' }; refresh(); return; }
    state.calibrated = true;
    message = { text: `Calibrated (forearm axis ${estimator.axisLabel})`, tone: 'live' };
    refresh();
    advanceTimer = setTimeout(() => router.go('live'), 800);
  }

  return {
    title: 'Calibrate',
    subtitle: 'Match the pose shown on the arm, then press Calibrate.',
    enter(el) {
      root = el; hadData = link.msSincePacket() < cfg.staleMs; message = null; running = false;
      state.calibrated = false; estimator.reset();
      const setup = setupById(state.setupId);

      model.setCalibrationView(true);
      setMarkersVisible(setup.positions);
      for (const id of MARKER_IDS) setMarkerState(id, setup.positions.includes(id) ? 'selected' : 'idle');
      labels.show(setup.positions, setup.positions);
      stage.requestRender();

      root.innerHTML = `
        <h2>Calibration pose</h2>
        <p class="hint">${setup.label}: ${setup.positions.map(p => POSITIONS[p].label.toLowerCase()).join(' + ')} sensor.</p>
        <ul class="steps">${setup.calibrationSteps.map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="row">
          <span class="stat"><i id="cal-dot" data-s="off"></i><span id="cal-text"></span></span>
          <button type="button" class="btn" id="cal-connect">Connect</button>
        </div>
        ${SensorLink.supported ? '' : '<p class="note warn">Web Bluetooth is not available. Use Chrome or Edge, served from localhost or https.</p>'}
        <div class="row actions">
          <button type="button" class="btn ghost" id="cal-back">Back</button>
          <button type="button" class="btn primary" id="cal-start" disabled>Calibrate</button>
        </div>`;
      $('#cal-connect', root).addEventListener('click', connectClicked);
      $('#cal-start', root).addEventListener('click', runCalibration);
      $('#cal-back', root).addEventListener('click', () => router.go('select'));

      for (const event of ['connecting', 'connected', 'disconnected', 'stats']) {
        cleanups.push(link.on(event, () => { if (event === 'disconnected') hadData = false; refresh(); }));
      }
      cleanups.push(link.on('packet', () => { if (!hadData) { hadData = true; refresh(); } }));
      refresh();
    },
    leave() {
      cancelled = true; clearTimeout(advanceTimer);
      cleanups.splice(0).forEach(off => off());
      labels.hide();
    },
  };
}

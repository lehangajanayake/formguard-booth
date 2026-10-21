// Boots the app: builds the stage, hands the shared objects to the pages and starts the router.
import { CFG } from './config.js';
import { state } from './app-state.js';
import { createRouter } from './router.js';
import { createStage } from './stage/stage.js';
import * as model from './model/arm-model.js';
import * as markers from './model/sensor-markers.js';
import { SensorLink } from './sensor/ble-link.js';
import { SensorRig } from './sensor/rig.js';
import { setupById } from './sensor-setups.js';
import { createMarkerLabels } from './ui/marker-labels.js';
import { createSelectPage } from './pages/select-page.js';
import { createCalibratePage } from './pages/calibrate-page.js';
import { createLivePage } from './pages/live-page.js';
import { $ } from './ui/dom.js';

import * as THREE from 'three';
THREE.ColorManagement.legacyMode = false;

const loadingMessage = $('#msg');
let stage;
try {
  stage = createStage({ canvas: $('#c'), dock: $('#dock'), header: $('#header') });
} catch (e) {
  loadingMessage.textContent = e.message;
  throw e;
}

stage.scene.add(model.root);
model.applyTheme();

/** Mirrors the 3D arm to the side being tracked and frames the camera on it. */
function setArmSide(side) {
  model.setSide(side);
  const framing = model.computeFramingBox();
  framing.expandByObject(model.placeFloor(framing));
  framing.min.y -= 0.6;   // the camera looks down a little, so the floor's near edge sits lower on screen
  stage.setFramingBox(framing);
  stage.requestRender();
}
state.arm = CFG.arm === 'right' ? 'right' : 'left';
setArmSide(state.arm);

const links = { upper: new SensorLink(), lower: new SensorLink() };
const rigs = {};
/** The sensors and estimator for the chosen setup. Each setup keeps its own calibration. */
const rig = () => (rigs[state.setupId] ||= new SensorRig(setupById(state.setupId), links, CFG));
const labels = createMarkerLabels({ stage, container: $('#labels') });
const ctx = { stage, model, markers, labels, state, rig, cfg: CFG, setArmSide };

const pages = {};
const router = createRouter(pages, step => {
  if (step === 'calibrate') return !!state.setupId;
  if (step === 'live') return state.calibrated && rig().connected;
  return true;
}, { root: $('#page'), title: $('#page-title'), subtitle: $('#page-sub'), stepper: $('#stepper') });

ctx.router = router;
pages.select = createSelectPage(ctx);
pages.calibrate = createCalibratePage(ctx);
pages.live = createLivePage(ctx);

loadingMessage.remove();
router.start();

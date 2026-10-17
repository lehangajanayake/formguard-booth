// Boots the app: builds the stage, hands the shared objects to the pages and starts the router.
import { CFG } from './config.js';
import { state } from './app-state.js';
import { createRouter } from './router.js';
import { createStage } from './stage/stage.js';
import * as model from './model/arm-model.js';
import * as markers from './model/sensor-markers.js';
import { SensorLink } from './sensor/ble-link.js';
import { ForearmEstimator } from './sensor/forearm-estimator.js';
import { createMarkerLabels } from './ui/marker-labels.js';
import { createSelectPage } from './pages/select-page.js';
import { createCalibratePage } from './pages/calibrate-page.js';
import { createLivePage } from './pages/live-page.js';
import { $ } from './ui/dom.js';

const THREE = window.THREE;
THREE.ColorManagement.legacyMode = false;

const loadingMessage = $('#msg');
let stage;
try {
  stage = createStage({ canvas: $('#c'), dock: $('#dock'), header: $('#header') });
} catch (e) {
  loadingMessage.textContent = e.message;
  throw e;
}

stage.scene.add(model.arm, model.plumb);
model.applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { model.applyTheme(); stage.requestRender(); });
stage.setFramingBox(model.computeFramingBox());

const link = new SensorLink();
const estimator = new ForearmEstimator(CFG);
const labels = createMarkerLabels({ stage, container: $('#labels') });
const ctx = { stage, model, markers, labels, state, link, estimator, cfg: CFG };

const pages = {};
const router = createRouter(pages, step => {
  if (step === 'calibrate') return !!state.setupId;
  if (step === 'live') return state.calibrated && link.connected;
  return true;
}, { root: $('#page'), title: $('#page-title'), subtitle: $('#page-sub'), stepper: $('#stepper') });

ctx.router = router;
pages.select = createSelectPage(ctx);
pages.calibrate = createCalibratePage(ctx);
pages.live = createLivePage(ctx);

loadingMessage.remove();
router.start();

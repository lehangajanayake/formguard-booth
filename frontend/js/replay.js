// Reuses the live app's 3D arm, scene, framing and design system for recorded playback.
import * as THREE from 'three';
import { createStage } from './stage/stage.js';
import * as model from './model/arm-model.js';
import { $ } from './ui/dom.js';

THREE.ColorManagement.legacyMode = false;
const stage = createStage({ canvas: $('#c'), dock: $('#dock'), header: $('#header') });
stage.scene.add(model.root);
model.applyTheme();
model.setSide('right');
model.setSkinMode('glass');
model.setLayerOn('muscles', true);
model.setLayerOn('bones', true);
const framing = model.computeFramingBox();
framing.expandByObject(model.placeFloor(framing));
framing.min.y -= 0.6;
stage.setFramingBox(framing);
stage.requestRender();
$('#msg').remove();

let peak = 0;
function renderReps() {
  const host = $('#form-reps');
  const reps = window.latestReps || [];
  if (!reps.length) { host.hidden = true; return; }
  host.hidden = false;
  const top = Math.max(1, ...reps.map(rep => rep.peak - rep.bottom));
  host.innerHTML = `<div class="fg-reps-head"><span class="fg-label">Bicep curl</span><span class="fg-reps-sum">${reps.length}/${reps.length} in range</span></div><div class="fg-reps-bars" role="img" aria-label="${reps.length} recorded reps">${reps.map(rep => `<div class="fg-rep"><div class="fg-rep-bar" style="height:${Math.max(8, Math.round((rep.peak - rep.bottom) / top * 100))}%"></div></div>`).join('')}</div><div class="fg-reps-nums" aria-hidden="true">${reps.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>`;
}
window.addEventListener('message', event => {
  const sample = event.data;
  if (!sample || sample.type !== 'formguard-replay-sample') return;
  const angle = Number(sample.elbow) || 0;
  const upper = Number(sample.upper) || 0;
  const forward = THREE.MathUtils.degToRad(Number(sample.forward) || 0);
  const out = THREE.MathUtils.degToRad(Number(sample.out) || 0);
  const gravity = new THREE.Vector3(-Math.tan(forward), -1, -Math.tan(out)).normalize();
  const shoulder = new THREE.Quaternion().setFromUnitVectors(gravity, new THREE.Vector3(0, -1, 0));
  model.setElbow(angle);
  model.setShoulder(shoulder);
  stage.requestRender();
  peak = Math.max(peak, angle);
  $('#live-elbow').textContent = String(Math.round(angle));
  $('#live-peak').textContent = String(Math.round(peak));
  $('#live-upper').textContent = String(Math.round(upper));
  $('#live-upper-note').textContent = `${Math.round(Math.abs(Number(sample.forward) || 0))}° ${Number(sample.forward) < 0 ? 'back' : 'forward'} · ${Math.round(Math.abs(Number(sample.out) || 0))}° ${Number(sample.out) < 0 ? 'in' : 'out'}`;
  $('#form-count').textContent = `${sample.repCount ?? 0} ${(sample.repCount ?? 0) === 1 ? 'rep' : 'reps'}`;
  const faulty = Boolean(sample.fault);
  $('#form-flag').className = `fg-flag fg-flag-${faulty ? 'fault' : 'clear'}`;
  $('#form-flag-text').textContent = faulty ? sample.fault : 'In range';
  $('#form-hint').hidden = faulty;
  $('#form-cue').hidden = !faulty;
  if (faulty) {
    $('#form-cue-meta').textContent = `Rep ${sample.currentRep || ''}`;
    $('#form-cue-joint').textContent = sample.fault === 'Elbow swing' ? (Number(sample.swing) >= 0 ? 'Elbow drifting forward' : 'Elbow swinging back') : 'Partial rep';
    $('#form-cue-cue').textContent = sample.fault === 'Elbow swing' ? 'Pin your elbow.' : 'Curl all the way up.';
    $('#form-cue-fix').textContent = sample.fault === 'Elbow swing'
      ? `Your upper arm moved ${Math.round(Math.abs(Number(sample.swing) || 0))}° ${Number(sample.swing) >= 0 ? 'forward' : 'back'}. Keep it still at your side and let the forearm do the lifting.`
      : `Your elbow only bent to ${Math.round(Number(sample.repPeak) || angle)}°. Bring the weight up toward your shoulder before lowering it.`;
  }
  $('#form-hint').textContent = String(sample.phase || 'waiting').replaceAll('_', ' ');
  window.latestReps = sample.completedReps || [];
  renderReps();
  $('#replay-phase').textContent = sample.status || 'Recorded sensor data';
});

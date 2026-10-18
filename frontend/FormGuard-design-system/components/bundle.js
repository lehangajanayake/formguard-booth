/* @ds-bundle: {"format":4,"namespace":"FormGuard","components":[{"name":"Button"},{"name":"Flag"},{"name":"Reading"},{"name":"RepStrip"},{"name":"CueCard"},{"name":"JointMarker"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && keys.indexOf(k) < 0) r[k] = o[k]; } return r; }

  function Button(props) {
    var variant = props.variant || 'quiet';
    var rest = omit(props, ['variant', 'size', 'fullWidth', 'className', 'children']);
    if (!rest.type) rest.type = 'button';
    rest.className = cx('fg-btn', 'fg-btn-' + variant, props.size === 'sm' && 'fg-btn-sm', props.fullWidth && 'fg-btn-full', props.className);
    return h('button', rest, props.children);
  }

  function Flag(props) {
    var tone = props.tone || 'clear';
    return h('span', { className: cx('fg-flag', 'fg-flag-' + tone, props.className), role: 'status' },
      h('span', { className: 'fg-flag-sq', 'aria-hidden': 'true' }),
      props.children || (tone === 'clear' ? 'In range' : 'Fault'));
  }

  function Reading(props) {
    var tone = props.tone || 'clear';
    return h('div', { className: cx('fg-reading', 'fg-reading-' + tone, props.className) },
      props.label ? h('span', { className: 'fg-label' }, props.label) : null,
      h('span', null,
        h('span', { className: 'fg-reading-value' }, props.value),
        props.unit ? h('span', { className: 'fg-reading-unit' }, props.unit) : null),
      props.note ? h('span', { className: 'fg-reading-note' }, props.note) : null);
  }

  function RepStrip(props) {
    var reps = props.reps || [];
    var clean = reps.filter(function (r) { return !r.fault; }).length;
    var summary = props.summary || (clean === reps.length ? 'Clean set · ' : '') + clean + '/' + reps.length + ' in range';
    return h('div', { className: cx('fg-reps', props.className) },
      h('div', { className: 'fg-reps-head' },
        props.label ? h('span', { className: 'fg-label' }, props.label) : h('span'),
        h('span', { className: 'fg-reps-sum' }, summary)),
      h('div', { className: 'fg-reps-bars', role: 'img', 'aria-label': summary },
        reps.map(function (r, i) {
          var d = Math.max(0.08, Math.min(1, r.depth == null ? 1 : r.depth));
          return h('div', { key: i, className: cx('fg-rep', r.fault && 'fg-rep-fault'), title: 'Rep ' + (i + 1) + (r.fault ? ': ' + r.fault : '') },
            h('div', { className: 'fg-rep-bar', style: { height: Math.round(d * 100) + '%' } }));
        })),
      h('div', { className: 'fg-reps-nums', 'aria-hidden': 'true' },
        reps.map(function (r, i) { return h('span', { key: i, className: r.fault ? 'fg-rep-fault' : null }, i + 1); })));
  }

  function CueCard(props) {
    return h('section', { className: cx('fg-cue', props.className) },
      h('div', { className: 'fg-cue-top' },
        h(Flag, { tone: 'fault' }, props.joint),
        props.meta ? h('span', { className: 'fg-cue-meta' }, props.meta) : null),
      h('p', { className: 'fg-cue-cue' }, props.cue),
      props.fix ? h('p', { className: 'fg-cue-fix' }, props.fix) : null);
  }

  function JointMarker(props) {
    var state = props.state || 'idle';
    var size = props.size || 32;
    var halo = state === 'idle' ? null : h('circle', { className: 'b', cx: 16, cy: 16, r: 12.5 });
    return h('span', { className: cx('fg-joint', 'fg-joint-' + state, props.className), role: 'img', 'aria-label': (props.label || 'Joint') + ': ' + state },
      h('svg', { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': 'true' },
        halo,
        h('circle', { className: 'd', cx: 16, cy: 16, r: state === 'idle' ? 5 : 7 })),
      props.label ? h('span', { className: 'fg-label' }, props.label) : null);
  }

  window.FormGuard = Object.assign(window.FormGuard || {}, { Button: Button, Flag: Flag, Reading: Reading, RepStrip: RepStrip, CueCard: CueCard, JointMarker: JointMarker });
})();

import {analyse, demoRows, parseCSV, toCSV, makeReport} from './model.mjs';
const $ = selector => document.querySelector(selector);
let state = {rows: demoRows(), synthetic: true, mode: 'shifted', label: 'Delay moves — synthetic example'};
const fmt = n => n === null ? '—' : n.toFixed(1).replace(/\.0$/, '');
const days = n => `${fmt(n)} ${Math.abs(Number(fmt(n))) === 1 ? 'day' : 'days'}`;
const percent = n => n === null ? '—' : `${Math.round(n * 100)}%`;
const span = (text, className) => { const e = document.createElement('span'); e.textContent = text; if (className) e.className = className; return e; };
function text(selector, value) { $(selector).textContent = value; }

function drawChart(a) {
  const chart = $('#chart'); chart.replaceChildren();
  const scale = Math.max(a.before.total || 0, a.after.total || 0, 1);
  for (const c of [a.before, a.after]) {
    const row = document.createElement('div'); row.className = 'bar-row';
    row.append(span(c.period === 'before' ? 'Before' : 'After', 'period-label'));
    const track = document.createElement('div'); track.className = 'bar-track';
    if (c.total === null) track.append(span('No eligible paired intervals', 'no-data'));
    else {
      for (const [value, name, className] of [[c.report, 'MRI to report', 'reporting'], [c.postReport, 'Report to biopsy', 'downstream']]) {
        const piece = span(value / scale >= .075 ? fmt(value) : '', `bar-segment ${className}`);
        piece.style.width = `${value / scale * 100}%`;
        piece.setAttribute('aria-label', `${name}: ${days(value)}`);
        piece.title = `${name}: ${days(value)}`;
        track.append(piece);
      }
      if (c.total === 0) track.append(span('Both intervals are zero', 'no-data'));
    }
    const total = document.createElement('span'); total.className = 'bar-total'; total.append(document.createTextNode(fmt(c.total)));
    if (c.total !== null) { const unit = document.createElement('small'); unit.textContent = ' days'; total.append(unit); }
    row.append(track, total); chart.append(row);
  }
}

function render() {
  const a = analyse(state.rows), b = a.before, f = a.after;
  const headlines = {
    shifted: ['Faster reporting.', a.delta?.total > .05 ? 'A longer wait for biopsy.' : 'No earlier biopsy.'],
    shorter: ['Less waiting.', 'All the way to biopsy.'],
    longer: ['More waiting', 'between MRI and biopsy.'],
    unchanged: ['The wait for biopsy', 'is unchanged.'],
    insufficient: ['Too early—or too little', 'data—to compare.']
  };
  const title = $('#finding-title'); title.replaceChildren(document.createTextNode(headlines[a.kind][0]), document.createElement('br'));
  const emphasis = document.createElement('em'); emphasis.textContent = headlines[a.kind][1]; title.append(emphasis);
  let body;
  if (!a.available) body = 'Missing follow-up is not zero waiting time. Both periods need eligible, complete intervals before a comparison is possible.';
  else if (a.kind === 'shifted') body = `Reporting is ${days(-a.delta.report)} quicker, but the later wait grows by ${days(a.delta.postReport)}. The total is ${days(b.total)} before and ${days(f.total)} after.`;
  else if (a.kind === 'shorter') body = `The mean MRI-to-biopsy interval falls from ${days(b.total)} to ${days(f.total)}. That is ${days(-a.delta.total)} less waiting in the completed subset.`;
  else if (a.kind === 'longer') body = `The mean MRI-to-biopsy interval rises from ${days(b.total)} to ${days(f.total)}. Review both stages and who is still waiting.`;
  else body = `The mean MRI-to-biopsy interval is ${days(b.total)} before and ${days(f.total)} after, at the displayed precision.`;
  text('#finding-body', body);
  text('#scope', `Completed biopsies within 28 days only · ${b.analysed} before / ${f.analysed} after with paired intervals. Descriptive, not causal.`);
  drawChart(a);
  const strip = $('#check-strip'); strip.replaceChildren();
  for (const [label, value, note] of [
    ['Biopsy within 28 days', `${b.finished}/${b.eligible} before · ${f.finished}/${f.eligible} after`, `${percent(b.completionRate)} → ${percent(f.completionRate)} of episodes with 28-day follow-up`],
    ['Still pending at extraction', `${b.pending} before · ${f.pending} after`, 'Excluded from the interval chart, not from the audit'],
    ['Follow-up too short', `${b.immature} before · ${f.immature} after`, 'Less than 28 days after MRI; excluded']
  ]) {
    const item = document.createElement('div'); item.className = 'check-item';
    const strong = document.createElement('strong'); strong.textContent = value;
    const small = document.createElement('small'); small.textContent = note;
    item.append(span(label), strong, small); strip.append(item);
  }
  const warnings = $('#warnings'); warnings.replaceChildren(); warnings.hidden = !a.warnings.length;
  if (a.warnings.length) {
    const heading = document.createElement('strong'); heading.textContent = 'Read before interpreting'; const list = document.createElement('ul');
    a.warnings.forEach(w => { const li = document.createElement('li'); li.textContent = w; list.append(li); }); warnings.append(heading, list);
  }
  const next = {
    shifted: 'Review the steps after the report: clinical review, booking, preparation and biopsy capacity. The intervals locate a delay; they do not identify its cause.',
    shorter: 'Check that case mix, staffing and follow-up are comparable—and that patients still waiting are not being hidden. This difference alone does not prove an AI benefit.',
    longer: 'Check downstream waits, case mix and changes in capacity. Look at incomplete pathways before attributing the difference to any technology.',
    unchanged: 'Review the two stages separately, together with completion rates. An unchanged total may conceal a faster step and a slower one.',
    insufficient: 'Wait until both cohorts have the same minimum follow-up, or fill in the missing intervals. Then rerun the audit; do not compare an incomplete cohort with a mature one.'
  };
  text('#next-step', next[a.kind]);
  const tbody = $('#cohort-table tbody'); tbody.replaceChildren();
  const rows = [
    ['All supplied episodes', b.all, f.all],
    ['At least 28 days of follow-up', b.eligible, f.eligible],
    ['Biopsy completed within 28 days', b.finished, f.finished],
    ['Paired intervals in the chart', b.analysed, f.analysed, true],
    ['Mean MRI → report (days)', fmt(b.report), fmt(f.report)],
    ['Mean report → biopsy (days)', fmt(b.postReport), fmt(f.postReport)],
    ['Mean MRI → biopsy (days)', fmt(b.total), fmt(f.total), true],
    ['Median MRI → biopsy (days)', fmt(b.median), fmt(f.median)],
    ['90th percentile MRI → biopsy (days)', fmt(b.p90), fmt(f.p90)],
    ['Zero-day MRI → biopsy intervals', b.sameDay, f.sameDay],
    ['Completed after day 28', b.later, f.later],
    ['Still pending at extraction', b.pending, f.pending],
    ['Biopsy not planned at extraction', b.notPlanned, f.notPlanned],
    ['Unknown status / missing biopsy interval', b.unknown, f.unknown],
    ['Day-28 completions missing a report interval', b.missingReport, f.missingReport],
    ['Less than 28 days follow-up (excluded)', b.immature, f.immature]
  ];
  rows.forEach(([label, bv, fv, main]) => {
    const tr = document.createElement('tr'); if (main) tr.className = 'main-row';
    const th = document.createElement('th'); th.scope = 'row'; th.style.textTransform = 'none'; th.style.letterSpacing = '0'; th.textContent = label;
    tr.append(th); [bv, fv].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); tbody.append(tr);
  });
  const provenance = $('#provenance'); provenance.classList.toggle('imported', !state.synthetic); provenance.replaceChildren(span('', 'dot'));
  const source = document.createElement('strong'); source.textContent = state.synthetic ? 'Synthetic example' : 'Your CSV · unverified';
  provenance.append(source, span(state.synthetic ? 'Invented episodes. Not Lucida or NHS results.' : 'Read locally. No data is sent or saved by this app.'));
  document.querySelectorAll('[data-demo]').forEach(btn => btn.setAttribute('aria-pressed', String(state.synthetic && btn.dataset.demo === state.mode)));
}

function toast(message) { const e = $('#toast'); e.textContent = message; e.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { e.hidden = true; }, 4500); }
function download(content, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], {type})), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function resetChecks() { document.querySelectorAll('.checklist input').forEach(input => { input.checked = false; }); }
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.demo;
  state = {rows: demoRows(mode), synthetic: true, mode, label: `${button.textContent} — synthetic example`};
  resetChecks(); $('#csv-text').value = ''; $('#csv-file').value = ''; render();
}));
const dialog = $('#import-dialog');
$('#open-import').addEventListener('click', () => { $('#import-error').hidden = true; dialog.showModal(); });
$('#close-import').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
function acceptCSV(csv) {
  try {
    const rows = parseCSV(csv);
    state = {rows, synthetic: false, mode: null, label: 'User-supplied anonymous CSV (not independently verified)'};
    resetChecks(); render(); dialog.close(); $('#csv-text').value = ''; $('#csv-file').value = '';
    $('#finding-title').setAttribute('tabindex', '-1'); $('#finding-title').focus({preventScroll: true}); $('.audit').scrollIntoView({block: 'start'});
    toast(`${rows.length} episodes checked locally. Nothing was uploaded.`);
  } catch (error) { $('#import-error').textContent = error.message; $('#import-error').hidden = false; $('#import-error').scrollIntoView({block: 'nearest'}); }
}
$('#csv-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 1500000) { text('#import-error', 'Use a CSV smaller than 1.5 MB.'); $('#import-error').hidden = false; return; }
  try { acceptCSV(await file.text()); } catch { text('#import-error', 'This file could not be read. Try a plain-text CSV.'); $('#import-error').hidden = false; }
});
$('#analyse-paste').addEventListener('click', () => acceptCSV($('#csv-text').value));
$('#download-example').addEventListener('click', () => download(toCSV(demoRows()), 'after-mri-synthetic-example.csv', 'text/csv;charset=utf-8'));
$('#export-report').addEventListener('click', () => {
  const checks = [...document.querySelectorAll('.checklist input:checked')].map(i => i.value);
  download(makeReport(analyse(state.rows), {...state, checks}), `after-mri-${state.synthetic ? 'synthetic-demo' : 'audit'}.txt`);
  toast('Audit note downloaded, including exclusions and limitations.');
});
let printState = [];
window.addEventListener('beforeprint', () => { printState = [...document.querySelectorAll('.details-section details')].map(e => [e, e.open]); printState.forEach(([e]) => { e.open = true; }); });
window.addEventListener('afterprint', () => { printState.forEach(([e, open]) => { e.open = open; }); });
$('#print-report').addEventListener('click', () => window.print());
window.addEventListener('hashchange', openHash);
function openHash() { const target = ['#method', '#cohort-details', '#comparison-details'].includes(location.hash) ? $(location.hash) : null; if (target) { target.open = true; target.scrollIntoView({block: 'start'}); } }
render(); openHash();

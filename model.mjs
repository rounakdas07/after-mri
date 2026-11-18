// Pure calculation layer. No patient identifiers, network calls, or storage.
export const HEADERS = ['period', 'biopsy_status', 'mri_to_report_days', 'mri_to_biopsy_days', 'followup_days'];
export const WINDOW = 28;
export const MAX_ROWS = 10000;
const STATUSES = ['completed', 'pending', 'not_planned', 'unknown'];
const numberRE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
export const mean = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
export function quantile(xs, p) {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b), at = (sorted.length - 1) * p;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

export function parseCSV(text) {
  if (typeof text !== 'string' || text.length > 1500000) throw new Error('Use a CSV smaller than 1.5 MB.');
  text = text.replace(/^\uFEFF/, '');
  // RFC-style quoted cells, including escaped quotes. All values are validated below.
  const records = []; let row = [], value = '', quoted = false, closed = false;
  const pushCell = () => { row.push(value.trim()); value = ''; closed = false; };
  const pushRow = () => { pushCell(); if (row.some(Boolean)) records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else value += c;
    } else if (c === '"') {
      if (value.trim() || closed) throw new Error('Invalid CSV quotation. Save as a standard comma-separated CSV.');
      value = ''; quoted = true;
    } else if (c === ',') pushCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else { if (closed && c.trim()) throw new Error('Unexpected content after a quoted CSV cell.'); value += c; }
  }
  if (quoted) throw new Error('A quoted CSV cell was not closed.');
  if (value || row.length || closed) pushRow();
  if (!records.length) throw new Error('The CSV is empty. Download the template to get started.');
  const headers = records.shift();
  if (headers.length !== HEADERS.length || new Set(headers).size !== HEADERS.length || HEADERS.some(h => !headers.includes(h))) {
    throw new Error('Use exactly the five template columns. Remove identifiers, dates, notes and any extra columns.');
  }
  if (!records.length) throw new Error('The CSV has column headings but no episodes.');
  if (records.length > MAX_ROWS) throw new Error(`Use at most ${MAX_ROWS.toLocaleString()} episodes.`);
  const index = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows = records.map((values, i) => {
    const line = i + 2;
    const fail = message => { throw new Error(`Row ${line}: ${message}`); };
    if (values.length !== HEADERS.length) fail('expected five cells.');
    const period = values[index.period], status = values[index.biopsy_status];
    if (!['before', 'after'].includes(period)) fail('period must be before or after.');
    if (!STATUSES.includes(status)) fail('biopsy_status must be completed, pending, not_planned or unknown.');
    const read = (field, required = false) => {
      const s = values[index[field]];
      if (s === '') { if (required) fail(`${field} is required.`); return null; }
      if (!numberRE.test(s)) fail(`${field} must be a non-negative number of days, or blank if missing.`);
      const n = Number(s);
      if (!Number.isFinite(n) || n > 3650) fail(`${field} must be between 0 and 3650 days.`);
      return n;
    };
    const report = read('mri_to_report_days'), biopsy = read('mri_to_biopsy_days'), followup = read('followup_days', true);
    if (status !== 'completed' && biopsy !== null) fail('a biopsy interval is only allowed for completed biopsies.');
    if (report !== null && report > followup) fail('report interval exceeds the available follow-up.');
    if (biopsy !== null && biopsy > followup) fail('biopsy interval exceeds the available follow-up.');
    if (report !== null && biopsy !== null && biopsy < report) fail('biopsy precedes the report. Check the agreed report milestone.');
    return {period, status, report, biopsy, followup};
  });
  if (!rows.some(r => r.period === 'before') || !rows.some(r => r.period === 'after')) throw new Error('Include both before and after episodes.');
  return rows;
}

export function toCSV(rows) {
  return HEADERS.join(',') + '\r\n' + rows.map(r => [r.period, r.status, r.report ?? '', r.biopsy ?? '', r.followup].join(',')).join('\r\n') + '\r\n';
}

export function summarise(rows, period) {
  const all = rows.filter(r => r.period === period);
  // Equal minimum follow-up. Only biopsy intervals within that fixed window enter the time comparison.
  const mature = all.filter(r => r.followup >= WINDOW);
  const immature = all.length - mature.length;
  const finished = mature.filter(r => r.status === 'completed' && r.biopsy !== null && r.biopsy <= WINDOW);
  const paired = finished.filter(r => r.report !== null);
  const later = mature.filter(r => r.status === 'completed' && r.biopsy !== null && r.biopsy > WINDOW).length;
  const pending = mature.filter(r => r.status === 'pending').length;
  const unknown = mature.filter(r => r.status === 'unknown' || (r.status === 'completed' && r.biopsy === null)).length;
  const notPlanned = mature.filter(r => r.status === 'not_planned').length;
  const reports = paired.map(r => r.report), postReport = paired.map(r => r.biopsy - r.report), total = paired.map(r => r.biopsy);
  return {period, all: all.length, eligible: mature.length, immature, finished: finished.length, analysed: paired.length,
    missingReport: finished.length - paired.length, later, pending, unknown, notPlanned,
    completionRate: mature.length ? finished.length / mature.length : null,
    report: mean(reports), postReport: mean(postReport), total: mean(total),
    median: quantile(total, .5), p90: quantile(total, .9),
    sameDay: paired.filter(r => r.biopsy === 0).length};
}

export function analyse(rows) {
  const before = summarise(rows, 'before'), after = summarise(rows, 'after');
  const available = before.analysed > 0 && after.analysed > 0;
  const delta = available ? {report: after.report - before.report, postReport: after.postReport - before.postReport, total: after.total - before.total} : null;
  // 0.05 days is display precision, not a statistical or clinical significance threshold.
  const tol = .05;
  let kind = 'insufficient';
  if (available) {
    if (delta.report < -tol && delta.total >= -tol) kind = 'shifted';
    else if (delta.total < -tol) kind = 'shorter';
    else if (delta.total > tol) kind = 'longer';
    else kind = 'unchanged';
  }
  const warnings = [];
  if (!available) warnings.push('Both periods need at least one complete reporting-and-biopsy interval within 28 days, with at least 28 days of follow-up.');
  if (before.immature + after.immature) warnings.push(`${before.immature + after.immature} episodes have less than 28 days of follow-up and are excluded. Later recruits may not be comparable yet.`);
  if (before.missingReport + after.missingReport) warnings.push(`${before.missingReport + after.missingReport} completed biopsies have no report interval and are excluded from both stages of the time comparison.`);
  if (before.unknown + after.unknown) warnings.push(`${before.unknown + after.unknown} mature episodes have unknown biopsy status or an unrecorded biopsy interval.`);
  if (available && (before.analysed < 10 || after.analysed < 10)) warnings.push('Fewer than 10 paired intervals in at least one period. This prototype flags small samples; 10 is not a validated adequacy threshold.');
  const completionDifference = before.completionRate !== null && after.completionRate !== null ? after.completionRate - before.completionRate : null;
  if (completionDifference !== null && Math.abs(completionDifference) > .000001) warnings.push('The proportion completing biopsy within 28 days differs between periods. A faster completed subset can hide patients who are still waiting.');
  return {before, after, available, delta, kind, warnings, completionDifference};
}

export function demoRows(mode = 'shifted') {
  const rows = [];
  for (const period of ['before', 'after']) {
    for (let i = 0; i < 40; i++) {
      const after = period === 'after';
      const report = after ? 1 + (i % 3 - 1) * .25 : 4 + (i % 3 - 1) * .25;
      // Eight repeats of -2,-1,0,1,2: means of exactly 6 or 9 days after report.
      const post = (after && mode === 'shifted' ? 9 : 6) + i % 5 - 2;
      rows.push({period, status: 'completed', report, biopsy: report + post, followup: after && mode === 'immature' ? 14 : 42});
    }
    for (let i = 0; i < 12; i++) rows.push({period, status: 'not_planned', report: period === 'before' ? 4 : 1, biopsy: null, followup: period === 'after' && mode === 'immature' ? 14 : 42});
    for (let i = 0; i < 8; i++) rows.push({period, status: 'pending', report: period === 'before' ? 4 : 1, biopsy: null, followup: period === 'after' && mode === 'immature' ? 14 : 42});
  }
  return rows;
}

export function makeReport(a, {synthetic = true, label = 'Demo', checks = []} = {}) {
  const num = n => n === null ? 'Not available' : n.toFixed(2);
  const b = a.before, f = a.after;
  return `AFTER MRI — DESCRIPTIVE PATHWAY AUDIT\n${synthetic ? 'SYNTHETIC DEMONSTRATION — not Lucida or NHS results' : 'USER-SUPPLIED DATA — not verified by After MRI'}\n${label}\n\nQuestion: Did faster MRI reporting translate into earlier biopsy?\nScope: 28-day window after MRI. Only episodes with at least 28 days of follow-up are eligible. Time intervals use the SAME complete paired subset in each period.\n\nMeasure | Before | After\nAll supplied episodes | ${b.all} | ${f.all}\nAt least 28 days follow-up | ${b.eligible} | ${f.eligible}\nBiopsy completed within 28 days | ${b.finished} | ${f.finished}\nPaired intervals analysed | ${b.analysed} | ${f.analysed}\nMean MRI to report (days) | ${num(b.report)} | ${num(f.report)}\nMean report to biopsy (days) | ${num(b.postReport)} | ${num(f.postReport)}\nMean MRI to biopsy (days) | ${num(b.total)} | ${num(f.total)}\nMedian MRI to biopsy (days) | ${num(b.median)} | ${num(f.median)}\n90th percentile MRI to biopsy (days) | ${num(b.p90)} | ${num(f.p90)}\nZero-day MRI-to-biopsy intervals | ${b.sameDay} | ${f.sameDay}\nCompleted after day 28 | ${b.later} | ${f.later}\nStill pending at extraction | ${b.pending} | ${f.pending}\nNot planned at extraction | ${b.notPlanned} | ${f.notPlanned}\nUnknown status / missing biopsy interval | ${b.unknown} | ${f.unknown}\nMissing report interval among day-28 completions | ${b.missingReport} | ${f.missingReport}\nLess than 28 days follow-up (excluded) | ${b.immature} | ${f.immature}\n\n${a.available ? `Observed mean total change (after minus before): ${num(a.delta.total)} days. This is a descriptive difference, not an estimate of AI's causal effect.` : 'No time comparison is available. Do not interpret missing data as zero waiting time.'}\n\nDATA WARNINGS\n${a.warnings.length ? a.warnings.map(w => '- ' + w).join('\n') : 'No automatic data warnings. This does not establish comparability or absence of bias.'}\n\nCOMPARABILITY CHECKS (user-attested, not verified)\n${checks.length ? checks.map(c => '- ' + c).join('\n') : 'None confirmed.'}\n\nLIMITATIONS\nOnly biopsies completed within 28 days contribute to the time comparison. This conditions on an outcome and excludes longer waits; compare completion rates and waiting patients alongside times. No adjustment for case mix, staffing, rollout dates or other pathway changes. Pending/not-planned/unknown labels describe extraction status, not a reconstructed day-28 decision. No diagnostic accuracy, safety, cost-effectiveness or cancer-outcome claim is made. Faster biopsy is not the same as faster diagnosis.\n\nMethod and sources: https://rounakdas07.github.io/after-mri/#method\nIndependent prototype by Rounak Das. AI-assisted development. Not affiliated with or endorsed by Lucida Medical, the NHS or NICE.\n`;
}

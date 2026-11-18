import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, toCSV, demoRows, analyse, mean, quantile, makeReport, HEADERS} from '../model.mjs';
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);
const csv = body => HEADERS.join(',') + '\n' + body;
test('synthetic displacement: three days gained in reporting, three lost downstream', () => {
  const a = analyse(demoRows()); assert.equal(a.kind,'shifted');
  near(a.delta.report,-3); near(a.delta.postReport,3); near(a.delta.total,0);
  assert.equal(a.before.analysed,40); assert.equal(a.after.pending,8); assert.equal(a.before.eligible,60);
  near(a.before.report+a.before.postReport,a.before.total);
});
test('improvement scenario changes total without claiming causality', () => { const a = analyse(demoRows('shorter')); assert.equal(a.kind,'shorter'); near(a.delta.total,-3); });
test('immature after cohort cannot produce a zero-day success', () => { const a = analyse(demoRows('immature')); assert.equal(a.available,false); assert.equal(a.after.immature,60); assert.equal(a.after.total,null); assert.equal(a.kind,'insufficient'); });
test('CSV roundtrip preserves decimal intervals and missing values', () => assert.deepEqual(parseCSV(toCSV(demoRows())),demoRows()));
test('BOM, CRLF, quoted columns and reordered headers supported', () => {
  const s = '\uFEFF"biopsy_status","period","followup_days","mri_to_biopsy_days","mri_to_report_days"\r\ncompleted,before,28,2.5,1.5\r\ncompleted,after,28,2,1\r\n';
  const r = parseCSV(s); near(r[0].biopsy,2.5); near(r[1].report,1);
});
test('missing report excluded from BOTH stage means, retained in completion count', () => {
  const a = analyse(parseCSV(csv('before,completed,,10,28\nbefore,completed,2,5,28\nafter,completed,1,3,28')));
  assert.equal(a.before.finished,2); assert.equal(a.before.analysed,1); assert.equal(a.before.missingReport,1); near(a.before.total,5); near(a.before.report+a.before.postReport,5);
});
test('day 28 inclusive, day 29 excluded from timings but counted as later completion', () => {
  const a = analyse(parseCSV(csv('before,completed,1,28,28\nbefore,completed,2,29,30\nafter,completed,1,5,28')));
  assert.equal(a.before.finished,1); assert.equal(a.before.later,1); assert.equal(a.before.completionRate,.5); near(a.before.total,28);
});
test('blank completed biopsy outcome remains unknown, never counted as zero or no biopsy', () => {
  const a = analyse(parseCSV(csv('before,completed,1,,28\nafter,completed,1,5,28'))); assert.equal(a.before.unknown,1); assert.equal(a.before.finished,0); assert.equal(a.before.total,null);
});
test('all mature statuses partition the cohort and complete-case exclusions are explicit', () => {
  const r = demoRows(); r.push({period:'before',status:'unknown',report:null,biopsy:null,followup:40}); r.push({period:'before',status:'completed',report:1,biopsy:35,followup:40});
  const b = analyse(r).before; assert.equal(b.finished+b.later+b.pending+b.notPlanned+b.unknown,b.eligible);
});
test('same-day zeroes are real values, not missingness', () => {
  const a = analyse(parseCSV(csv('before,completed,0,0,28\nafter,completed,0,0,28'))); assert.equal(a.kind,'unchanged'); assert.equal(a.before.sameDay,1); assert.equal(a.before.total,0);
});
test('percentiles use interpolation without mutating input', () => { const xs=[4,1,3,2]; assert.equal(quantile(xs,.5),2.5); near(quantile(xs,.9),3.7); assert.deepEqual(xs,[4,1,3,2]); assert.equal(mean([]),null); });
test('rejects extra identifier columns and duplicate headings', () => {
  assert.throws(()=>parseCSV('period,biopsy_status,mri_to_report_days,mri_to_biopsy_days,followup_days,name\nbefore,completed,1,2,28,Name'),/five template/);
  assert.throws(()=>parseCSV('period,period,mri_to_report_days,mri_to_biopsy_days,followup_days\nbefore,completed,1,2,28'),/five template/);
});
test('rejects impossible timing, future events and status contradictions', () => {
  for (const row of ['before,completed,5,2,28','before,completed,1,29,28','before,pending,1,5,28','before,completed,29,,28']) assert.throws(()=>parseCSV(csv(row+'\nafter,completed,1,3,28')),/Row 2/);
});
test('rejects formula injection, negative times, dates, infinity and unrecognised enums', () => {
  for (const value of ['=1+2','-1','2026-11-01','Infinity','NaN','<script>','1e2']) assert.throws(()=>parseCSV(csv(`before,completed,${value},10,28\nafter,completed,1,2,28`)),/non-negative/);
  assert.throws(()=>parseCSV(csv('before,yes,1,2,28\nafter,completed,1,2,28')),/biopsy_status/);
});
test('requires follow-up, both periods, data and valid quotes', () => {
  assert.throws(()=>parseCSV(csv('before,completed,1,2,\nafter,completed,1,2,28')),/followup_days is required/);
  assert.throws(()=>parseCSV(csv('before,completed,1,2,28')),/both before and after/);
  assert.throws(()=>parseCSV(HEADERS.join(',')),/no episodes/);
  assert.throws(()=>parseCSV(csv('"before,completed,1,2,28')),/not closed/);
});
test('unequal biopsy completion triggers selection warning', () => { const r = demoRows(); r.push({period:'after',status:'pending',report:1,biopsy:null,followup:40}); const a=analyse(r); assert.ok(a.warnings.some(w=>w.includes('proportion completing'))); });
test('export preserves synthetic status, denominators, cautions and user checks', () => {
  const s = makeReport(analyse(demoRows()),{checks:['Case mix reviewed']});
  for (const phrase of ['SYNTHETIC','Paired intervals analysed | 40 | 40','Case mix reviewed','not an estimate','Still pending at extraction | 8 | 8']) assert.ok(s.includes(phrase),phrase);
});
test('export for incomplete cohort states no comparison', () => { const s=makeReport(analyse(demoRows('immature')),{synthetic:false}); assert.ok(s.includes('No time comparison')); assert.ok(s.includes('USER-SUPPLIED')); assert.ok(!s.includes('SYNTHETIC DEMONSTRATION')); });

# After MRI: research and build brief

Prepared 18 November 2026. Public-source research; no access to Lucida's internal systems or patient data.

## What is established

| Evidence | Implication for this project |
| --- | --- |
| [Greater Manchester Cancer Alliance](https://gmcancer.org.uk/ai-prostate-cancer-detection/) describes a four-trust Pi rollout and service evaluation. | Pathway impact is an actual evaluation topic, not an invented company problem. |
| [Leeds Teaching Hospitals](https://www.leedsth.nhs.uk/news/new-ai-pilot-to-speed-up-prostate-cancer-diagnosis-in-leeds/), 28 October 2025, describes priority reporting linked to same-day biopsy. | Measuring only report speed cannot establish the whole pathway result. |
| [Lucida's April 2026 release](https://lucidamedical.com/new-software-launch/) combines AI scores, PSA density and PI-RADS. | Building another biopsy-risk calculator would overlap with their product and require clinical validation. |
| [Sushentsev et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC13282241/) report retrospective evidence, verification-bias limitations and the need for prospective assessment. | Do not turn retrospective results into promised patient outcomes. Keep missing and unobserved outcomes visible. |
| [Lucida's October 2026 statement](https://lucidamedical.com/lucida-medical-welcomes-nice-draft-recommendations-on-ai-support-for-prostate-cancer-diagnosis/) discusses draft NICE proposals and ongoing real-world evidence generation. | A practical evidence-support contribution is timely. Do not call this a NICE-approved tool or assert final guidance status. |

## The opportunity is a hypothesis

A small, inspectable workflow could reduce repetitive preparation of an early pathway audit. We do **not** know whether Lucida already has a better internal version. We have not established demand, time saved, purchasing intent or a hiring need. The code is a concrete discussion starter and reusable work sample.

## Intended user and task

A supervised research assistant or clinical implementation analyst takes a pre-approved anonymous extract from one site, checks its consistency, and produces a transparent descriptive note for discussion with the study lead. It is not used to triage, diagnose, decide on biopsy or assess an individual patient's risk.

## Why this contribution fits Rounak

The work emphasises literature review, clear endpoint definitions, careful data handling and communication. It gives a medical student a tractable contribution under supervision. It does not pretend the author can independently validate a diagnostic AI system or replace a clinical study team.

## Design decisions

- One visible question and one chart. No sidebar, decorative metrics, login or generic dashboard.
- Two stages on one shared day scale. The completed-case denominator sits beside the finding.
- No configurable effect slider. Results come from episodes, not a guessed percentage benefit.
- Data gaps can prevent a comparison. A missing follow-up interval never becomes a zero.
- Clinical and governance detail stays in expandable sections, but provenance and completion counts remain visible.
- Evidence links explain the motivation. Demo data is explicitly invented.

## What to validate with a clinical lead

1. Would this save work relative to their current evaluation workflow?
2. Which report milestone matters: first clinical read, verified report or MDT review? Is it available consistently?
3. Is a 28-day window appropriate? What censoring and longer-follow-up analyses are required?
4. Which cohorts should be compared, and which risk/site/scanner groups need separate analysis?
5. How will cancers missed, biopsy decisions and later diagnoses be evaluated separately?

If the existing team already has this workflow, a better contribution may be maintaining an agreed evidence extraction table or checking a data dictionary. The demo should open that conversation, not impose a tool.

## Next development only after feedback

Potential extensions include approved risk stratification, interval censoring, additional diagnosis milestones and spreadsheet export. These would need better-defined data and supervised validation. They are deliberately absent from version 1.

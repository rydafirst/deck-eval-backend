# What each grading axis actually evaluates

This is the substantive judgment layer: what counts as a real defect on each axis, learned across two real grading tasks (a travel-deck brief and an image-compression course deck). It sits underneath the other two skills in this set: deck-eval-rationale-voice controls how a finding gets written up, slop-detection-taxonomy is the specific tool to reach for inside Writing Style, and this skill is about sorting a defect onto the correct axis in the first place and knowing what each axis is actually checking for.

## Content Quality

Tests accuracy and completeness against the source material, not against how polished the result feels.
- Trace every number and claim back to its actual source document individually. A deck can read smoothly and still contain a wrong figure or a dropped requirement — that only surfaces when you check line by line, never when you judge the overall impression.
- Check the brief's explicit requirement list item by item. A requirement can be technically present but de-emphasized or effectively unmet (e.g. a brief asks for "at least 3 days downtime" and the deck's own numbers show only 1) — that is a Content Quality failure even if nothing else about the deck looks wrong.
- When something looks unsourced or added (a stock image, an unexplained claim), verify before concluding it's a defect — check speaker notes, captions, or any attached documentation first. An apparently uncredited addition that turns out to be fully cited is not a flaw.
- A factually wrong sentence that is beautifully written is a Content Quality problem, not a Writing Style problem. Don't let good prose talk you out of flagging a wrong fact, and don't flag accurate prose just because the underlying claim it's reporting happens to be ugly.

## Storytelling

Tests the build and arc of the argument or narrative: does the ordering and emphasis actually build toward what the brief asked for, not just whether the facts are individually present.
- Check whether the narrative acknowledges and works with the brief's real constraints, not just whatever's convenient to feature. A deck can present true facts in a smooth sequence and still fail Storytelling if the arc never actually engages a constraint the brief cared about.
- A Content Quality defect (a wrong number, an unmet requirement) very often creates a separate Storytelling defect from its own angle: the narrative's build-up doesn't account for the thing being wrong. Score and explain that as its own Storytelling finding — don't treat flagging it once under Content Quality as having covered it.
- Timing and pacing count here when the task has a stated time budget (e.g. a "30-minute" deck): check whether the internal pacing (slide count, speaker-note timing) actually supports the claimed arc, not just whether the total runtime matches.

## Writing Style

Tests the quality of the prose inside the artifact being graded — not the grader's own rationale-writing voice (that's deck-eval-rationale-voice), the artifact's writing.
- Apply slop-detection-taxonomy's four categories here: check for formulaic/slogan language, vague/unsupported substance, wordy/jargon-filled phrasing, and unnecessary framing or repetition inside the artifact's own text.
- Jargon that's used but never defined for the stated audience is a Writing Style problem, independent of whether the underlying technical claim is correct (that's Content Quality).
- Plain, concrete, sometimes slightly awkward phrasing that still clearly conveys a checkable idea is not a defect — don't flag clunkiness on its own; flag it only when it actually trips one of the four slop categories.

## Aesthetics

Tests visual effect and compliance with whatever visual rules the task actually hands you (a named template, a style guide) — never implementation detail you can't verify.
- Only describe effect (readable or not, consistent or not, too small to read) unless a template or source document literally names the implementation detail (a font name, a color-swatch name). If it's named in a source you were given, quoting that name is fine — that's citing the source, not inventing a guess.
- When a template or style guide defines explicit rules (required colors, required layout types, chart axis rules), check each rule literally against every slide rather than assessing the overall visual impression. "Looks polished" is not the same as "follows the template's rules."
- If your own review method has a real limitation (e.g. working from rendered screenshots rather than the native file), disclose that honestly as a side note, but never use it to justify lowering or raising a score — the disclosure is about method transparency, not about the artifact's actual quality.

## Layout

Tests structural and spatial consistency — placement, required structural elements, and (when charts are involved) honest chart construction.
- Check placement consistency literally: does the title sit in the same place on every slide, the way the template requires, rather than just looking consistent overall. A single outlier slide (e.g. slide 1's title not top-left) is a real Layout defect even if every other slide is fine.
- Check required-structure coverage explicitly: if the brief or template defines a fixed set of layout types (e.g. four required types), count how many actually appear across the deck rather than assuming variety exists because the deck looks varied.
- For any chart: check for a zero-based axis, visible gridlines, and labeled bars/values literally — a chart that looks fine at a glance can still start its axis above zero or omit labels, which is a real Layout/Aesthetics-adjacent defect depending on how the task scopes it.

## Overall

- Overall is not an average of the axis scores. One sufficiently weak axis can and should dominate the Overall score the way it would dominate a human reader's impression — but you must explicitly name which axis is doing the swaying.
- Still weigh the strong axes too when writing the explanation; don't build a one-sided case that ignores everything that worked.
- Keep the Overall explanation short and measured (two or three plain sentences) — it reads like a summary of the axis findings, not a persuasive closing argument.

## Cross-cutting rules for any multi-axis, multi-response grading task

- **One defect can hit multiple axes independently.** A single wrong number can be a Content Quality/Accuracy problem *and* a Storytelling build-up problem *and* an Aesthetics visual-quality problem, each from its own distinct angle. Check every axis against the defect separately rather than flagging it once and treating the rest as covered.
- **Keep every response standalone until the final ranking.** When grading two or more responses against the same brief, each response's own axis-level and Overall rationales must never reference or compare to a sibling response. Comparison belongs only in the final Overall Ranking step. A rationale that justifies a score by saying "unlike Response A..." has leaked a different response into a rationale that's supposed to stand on its own.
- **Sort every defect onto its most specific axis, not the most convenient one.** Before finalizing, re-scan each finding and ask: is this really a Content Quality issue, or did I file it there because it was the first axis I was writing? A defect usually has one clearest home even when it has secondary effects elsewhere (see the cross-axis rule above) — name the primary axis deliberately.

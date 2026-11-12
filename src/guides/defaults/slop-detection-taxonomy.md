# Detecting and categorizing "AI slop"

This comes from a real training module ("Professional writing failure modes") plus practice sets graded against it, including platform feedback that corrected wrong first guesses. Treat the four categories and their literal tests as the law — not "does this feel like AI wrote it."

## The four categories, exactly as defined

**01 — Formulaic, slogan-like, or figurative language.** The underlying claim may be fine, but it's packaged as a stock formula, slogan, staged cadence, canned emotion, or strained metaphor instead of plain analysis. Four sub-patterns:
- *Stock formulas and slogan cadence* — "it's not just a tracker, it's the gateway to..."; "not only X, but also Y"; rhetorical triads ("faster, smarter, more intuitive"); the "X, not Y" reveal-pivot/contrast used as empty flourish. Fix: say what it actually does.
- *Manufactured rhythm and punctuation* — semicolons/colons/em-dashes strung together to fake a beat rather than clarify ("Owners are set; risks are checked; approval is granted — and the launch moves forward"). Fix: plain sentence, same facts ("Teams set owners, reviewers check risks, and leaders approve the launch").
- *Artificial tone and figurative wording* — strained metaphors ("five readiness gates are green"), canned empathy ("I completely understand how frustrating this must feel"), fake balanced tradeoffs with no real tension, inflated significance ("legacy," "pivotal moment") when nothing earns it, travel-brochure adjectives (vibrant, renowned, nestled) where they weren't asked for.
- *Synthetic authority, vocabulary, and formatting* — vague sourcing ("experts argue," "observers note") instead of naming the real source; AI-flavored vocabulary cluster (delve, pivotal, robust, tapestry, underscore, foster, testament, vibrant); mechanical bold-label bullet lists where that structure adds nothing.
- *Do not flag when*: the sentence states a real distinction, gives a genuine warning, or quotes a named source. Parallel structure or punctuation is fine when it's separating a real list, a real contrast, or a real logical relationship — that's correct writing, not slogan cadence. Confirmed-acceptable examples: "The bug is in the parser, not the tokenizer." / "The red light means stop, and the green light means go."

**02 — Vague, inflated, or unsupported substance.** Flag a claim that has no number, example, or source the reader could check, or a conclusion stated without the reasoning that justifies it.
- The dividing line from Formulaic: inflation dressed in a stock phrase, slogan, or metaphor is Formulaic. A *bare* assertion of significance with no figurative packaging at all is this category instead. ("This represents a profound shift" has no metaphor or slogan shape — it's just an unsupported claim of importance, so it's 02, not 01.)
- This rule reaches claims and conclusions, not bare directives or policy rules. A short recommendation with no statistic attached ("Restrict nonessential visits; strengthen screening," "Approve a stage-gated pilot; do not pre-authorize a broad rollout," "Optimize unit economics before adding footprint") is not automatically a flag just because it lacks a number — directives aren't claims needing evidence.
- Naming an actual identifiable source protects a claim even if terse — "public filings anchor the baseline" points at a real, checkable source, so it doesn't trip this rule even though it's short.
- Grammatically awkward or unusual phrasing is *not itself* evidence of slop. A clunky sentence that still conveys a real, checkable instruction is clean. Check against the four patterns, never against "does this read oddly to me."

**03 — Wordy, jargon-filled, or indirect language.** Flag bureaucratic phrasing, hedging ("it would seem that," "to some extent"), padding that could be cut with no loss of meaning, or a sentence layered so densely that a reader has to re-read it to get the point. Example: "The workflow operationalizes a cross-functional enablement layer for downstream value realization" — dense abstract nouns with no concrete referent. A clause can trip this even inside an otherwise-concrete sentence: "...service management lift execution and contribution per load..." doesn't parse cleanly on first read even though numbers sit right next to it.

**04 — Unnecessary framing, repetition, or structure.** Flag generic throat-clearing openers ("In today's fast-paced world..."), meta-commentary about what the writing is about to do ("Below is a polished and comprehensive rewrite tailored to your needs"), and endings/lines that just restate what was already said instead of adding something new.
- A generic-sounding sentence is *not* automatically this category just because it's bland. If it states real, distinct content (even several plain priorities) and isn't actually throat-clearing, meta-commentary, or restatement, it doesn't match any of the four patterns and should be left unflagged — "generic" alone isn't one of the four tests.

## Platform-confirmed ground truth (the only real anchors)

Only these three have actual confirmed feedback behind them — everything else below is reasoned, not verified:
1. "This represents a profound shift." → **Vague/inflated/unsupported substance**, not Formulaic. Platform's own words: "the sentence asserts significance without naming a concrete change or evidence."
2. "The sector asks all reduced avoidable contact around vulnerable people." → confirmed **not slop** ("This sentence is ok!") despite reading as broken/awkward — awkward grammar alone is not a flag.
3. "Different sectors, same behavioral logic: reduce optional contact where consequences are highest." → confirmed **slop**, Formulaic / staged cadence (colon-then-contrast construction, the module's own listed bad example).

## Method: check literal rule text per clause, not vibe

1. Take the sentence apart clause by clause. A sentence can contain real numbers *and* a slop clause at the same time — don't give the whole sentence a pass because part of it looks solid. (Missed this on first pass with "cargo theft was becoming more sophisticated" riding along next to three hard stats in the same sentence — the unsupported clause still needs its own flag.)
2. For each clause, test it against all four category definitions literally — not "does this sound like AI," not "does this sound generic," not "is this short." Ask specifically: is there a stock/slogan/metaphor shape (01)? Is there a claim or conclusion with no number/example/source (02)? Is it padded or does it require a re-read (03)? Is it throat-clearing, meta-commentary, or pure restatement (04)? If none of the four literally fire, it's not slop, however bland it sounds.
3. Directives and conditional decision rules ("do X only when Y holds," "approve X; don't approve Y") are judged as directives, not as claims — don't demand a statistic from a recommendation.
4. A mild, conventional business idiom ("the next bet," "anchor the baseline") is not automatically a strained metaphor. Compare it directly against the module's own strained-metaphor example ("five readiness gates are green" — an invented scoring image that describes nothing literal) before flagging; most ordinary business phrasing doesn't reach that bar on its own. But watch for the sub-pattern that doesn't need a metaphor at all: a clipped, two-clause, period-separated finance-jargon pair (matching "Pipeline is flat. Spend isn't." / "EBITDA is not cash. Bridge it.") is flagged for the cadence itself, metaphor or not.
5. When a call is genuinely close, argue both sides on purpose before deciding: build the strongest "this is slop" case and the strongest "this is clean" case separately, each with its own confidence, then adjudicate by checking each side's comparison example against the literal rule text and the real confirmed examples — not by which argument merely sounds more confident.
6. Another model's, another grader's, or a colleague's different answer is a reason to re-examine your own reasoning against the literal rule text — it is never itself evidence that your answer was wrong. Only actual confirmed platform/grader feedback is ground truth.

## Worked examples (reasoned via the method above — not all platform-confirmed, shown as calibration)

**Uber Freight set — flag: 2, 6, 7, 10. Not 4 or 11.**
- #2 ("...service management lift execution and contribution per load...") — Wordy/jargon, doesn't parse on first read.
- #6 (cargo-theft sentence) — Vague/unsupported clause riding next to real stats in the same sentence.
- #7 ("X, not Y" contrast with nothing behind it) — Formulaic.
- #10 ("Quality improvements compound across existing volume and future lanes") — zero number/example/source — Vague/unsupported.
- #4 ("Optimize unit economics before adding footprint") and #11 ("Regional lanes are the next bet only where validated carrier depth already exists") — both are directives/conditional decision rules with a named, checkable criterion, same shape as the confirmed-acceptable "Restrict nonessential visits; strengthen screening." Not slop.

**Client messaging set — flag: 1, 3, 5.**
- #1 ("...not with generic AI messaging") — buzzword-stacked "X, not Y" contrast — Formulaic.
- #3 ("...produce late insight and weak action ownership") — the concrete system list at the front doesn't protect the unsupported causal claim in the back half — Vague/unsupported.
- #5 (colon-then-semicolon staged construction, same shape as the confirmed "Different sectors, same behavioral logic" example) — Formulaic.
- #2 ("CFOs need to reduce expenses, improve forecast accuracy, and strengthen financial controls") — generic-sounding but states real, distinct content and isn't throat-clearing or restatement. None of the four patterns literally fire. Not slop.

**HubSpot set — flag: 2 and 4.**
- #2 ("meaningful cohort-level value... deliberately dilutive... without verified adoption and incrementality") — jargon-heavy words with no number attached to any of them — Vague/unsupported.
- #4 ("Public filings anchor the baseline. Controlled experiments must earn the forecast.") — matches the clipped two-clause, period-separated finance-cadence sub-pattern (same shape as "Pipeline is flat. Spend isn't.") directly, reinforced by figurative verbs ("anchor," "earn") applied to things that can't literally do either — Formulaic. (Naming "public filings" as a source blocks the Vague/unsupported read, but does not block the cadence-match Formulaic read — different test, different category.)
- #1, #3, #5 — concrete distinction, hard numbers, hard numbers respectively. Not slop.

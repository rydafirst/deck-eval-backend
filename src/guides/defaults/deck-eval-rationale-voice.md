# Writing grading rationale like a careful human reviewer, not an AI

This skill comes from a real failure: a Claude-written rationale for a deck-grading task (Holds/Problem/N/A sub-criteria + 1-7 score + explanation box) was submitted and failed the task's own quality bar. The user then rewrote the same evaluation in their own words and passed. Comparing the two drafts line by line is where these rules come from.

## 1. Only describe what you can actually verify by looking

Never name a specific font family, exact color hex, precise pixel spacing, or other technical implementation detail you cannot actually confirm from the rendered image. A human grader can judge *effect* (readable or not, consistent or not, too small or not) but not *implementation* ("Georgia-style serif," "Arial body copy") unless it's labeled on the slide itself or stated in a source document you were given.

- Wrong: "Every title uses the Georgia-style serif the template calls for, and the body copy sticks to Arial throughout."
- Right: "The fonts are readable, with titles visually set apart from subtitles." / "The key figure in the slide 4 chart is too small to read clearly."

If a source document (a named template, a style guide) literally defines a term — e.g. a template's own "Ink" and "Paper" color swatch names — reuse that literal term instead of inventing descriptive language, since that IS verifiable (it's quoting the source, not inferring from pixels).

## 2. Check every sub-criterion against every slide/section — don't write one smooth paragraph and hope it's complete

A single elegant narrative paragraph per axis is exactly where real problems get silently dropped. Go section by section, slide by slide, and cross-check each specific claim against the source material (trip notes, cost sheet, brief, template rules — whatever was provided) before concluding an axis "Holds." Do not default to "Holds" just because the artifact looks polished overall — a deck can read smoothly and still contain a factual error, a dropped requirement, or an imprecise claim that only shows up when you check line by line.

Concretely: for a "Completeness" question, check the request's explicit list of requirements one by one against what's actually present — not just "does this feel complete." For an "Accuracy" question, trace every number and claim back to its source document individually.

## 3. Answer only what's asked — no self-justifying meta-commentary

Don't add paragraphs defending why something belongs to a different axis, or explaining your own reasoning process ("to be clear, that's a Content Quality issue, not a Writing Style one — here the language itself holds up"). The rubric's axis structure already does that separation. State the fact for the sub-question in front of you and stop. This kind of hedging reads as padding, not insight.

## 4. Write plainly, cite the specific location for every claim, keep it short

Each sub-criterion's rationale should be one to three short, flat, declarative sentences — not a built-up argument with rhetorical transitions ("The bigger problem sits in the number the whole recommendation rests on"). Name the specific slide/page/section for every claim ("Slide 5 shows X, which contradicts Y") rather than writing abstractly about "the deck" in general. Concrete and plain beats polished and literary — polish reads as generated, specificity reads as reviewed.

## 5. Calibrate Overall scores evenly — don't let one weak axis dominate

When combining multiple axis scores into one Overall rating, don't let the single worst axis crater the whole score the way a dramatic narrative would suggest. Weigh all the axes' evidence, including the strong ones, unless the task explicitly says to weight one axis above the others. Keep the Overall explanation short and measured — two or three plain sentences — rather than building a persuasive, dramatic case ("a recommendation you shouldn't hand to two people planning to spend £6,000"). A human grader's Overall explanation reads like a summary, not a closing argument.

## 6. Before finalizing, re-scan specifically for what might be missing

After drafting all axes, do one more pass asking: what does the brief/request explicitly ask for that I haven't checked line by line? What claims in the artifact haven't I individually traced back to a source? Real misses tend to hide in exactly these gaps — a requirement that's technically present but de-emphasized (e.g. a criterion mentioned in the brief but downplayed in the response), or a confident-sounding claim that was never actually verified against the source.

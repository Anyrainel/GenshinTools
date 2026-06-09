---
name: feedback-report
description: >
  Pull and triage GenshinTools user feedback from the production Cloudflare D1 feedback table.
  TRIGGER when the user asks to fetch, pull, review, summarize, or triage newest feedback,
  feedback since last time, feedback deltas, feedback-reports, or "what users said / what to build next".
  Uses the repo's incremental `npm run feedback:fetch` flow and summarizes only newly fetched submissions.
---

# Feedback Report

Fetches production feedback into the gitignored local `feedback-reports/` bundle and summarizes the newest delta for planning or bug triage.

## Workflow

1. Check the current worktree before changing files:

```bash
git status --short
```

Treat pending source changes as someone else's work unless the user explicitly says otherwise.

2. Locate the tool if needed. The normal entrypoint is:

```bash
npm run feedback:fetch
```

If it is not obvious, search these anchors:

```bash
rg -n "feedback:fetch|fetch-feedback-report|feedback-reports|feedback_submissions|ggartifact-backup" package.json scripts worker migrations wrangler.jsonc .gitignore
```

3. Run the incremental fetch:

```bash
npm run feedback:fetch
```

The script reads `feedback-reports/index.json`, uses the latest `fetchedThroughCreatedAt` as the D1 cutoff, queries remote `ggartifact-backup.feedback_submissions`, writes timestamped `.json` and `.md` files under `feedback-reports/runs/`, then updates `feedback-reports/index.{json,md}`. Do not manually invent a cutoff date when the index exists.

4. Read the newest generated report. The command prints a path like:

```text
[feedback] wrote 3 new rows to runs\2026-06-03T06-58-00-130Z.md
```

Open that markdown report first, and use the JSON only when exact timestamps, ids, or metadata are needed.

5. Summarize what changed:

- Start with row count, query cutoff, fetch time, and rating distribution.
- Group items into actionable themes: feature request, bug report, support / external dependency, and needs investigation.
- Quote or translate the user's meaning when useful, but do not paste contact metadata unless the user asks for it.
- Mention exact feedback ids for traceability.
- Call out likely next engineering target only when the feedback clearly points to one.

## Important Details

- `feedback-reports/` is intentionally gitignored. Do not add it to commits.
- The production source is Cloudflare D1 database `ggartifact-backup`; the script uses repo-local Wrangler from `node_modules`.
- If there is no index, the script bootstraps from legacy `feedback-reports/current-feedback.json` when present.
- `feedback-reports/closed-feedback.json` can hide already-handled ids in generated markdown. Do not edit it unless the user asks to mark feedback closed or handled.
- If Wrangler auth, network, or D1 access fails, report the exact failure and stop; do not fall back to local D1 for production feedback.

## Output Shape

Use a concise structure:

- `Fetched:` rows, cutoff, report path.
- `What's new:` grouped feedback summaries with ids.
- `Suggested next work:` prioritized items, if any.
- `Notes:` failures, privacy caveats, or whether the report artifacts are ignored.

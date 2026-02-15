# Code Review and Commit

Review all uncommitted changes, fix issues, and commit after user approval.

## Instructions

### Phase 1: Review

1. Run `git diff` and `git diff --cached` to identify all changed files (staged + unstaged)
2. Launch a code review agent (Task tool, subagent_type=general-purpose) that:
   - Reads every changed file in full
   - Reviews for: correctness, edge cases, consistency, test coverage, type safety, performance
   - Returns a numbered list of findings with severity (Critical, High, Medium, Low, Nit)
   - Is harsh and critical — flags anything questionable
   - Ignores unrelated uncommitted changes (e.g. debug logs, WIP in other files) — note them separately

### Phase 2: Report + Voice Summary

1. Use voice to announce a summary, e.g.:
   `python c:/projects/trace/scripts/voice.py "Review done. 2 critical, 1 high, and 5 lower issues found." --agent opus-main`
2. Present the FULL findings table to the user:

| # | Severity | Finding | Action |
|---|----------|---------|--------|

For each finding, set Action to one of:
- **Fix** — You will fix this (critical, high, and clear medium issues)
- **Skip** — Not worth fixing (nits, intentional design, debatable)

Explain your reasoning for each Skip.

### Phase 3: Wait for Feedback

STOP and wait for the user to respond. They may:
- Approve your plan as-is
- Ask you to fix additional items
- Ask you to skip items you planned to fix
- Provide other feedback

Do NOT proceed until the user confirms.

### Phase 4: Fix

1. Apply all approved fixes
2. Run `npm run test:run` and `npm run type-check:mobile`
3. If tests fail, diagnose and fix. If a second fix attempt fails, stop and report — do not loop endlessly.
4. Check if any `packages/core/` files changed: `git diff --name-only | grep '^packages/core/'`
   - If yes: run `cd packages/core && npm run build`. If the build fails, stop and report.
5. Present a summary of what was fixed
6. Use voice: `python c:/projects/trace/scripts/voice.py "Fixes applied, tests passing." --agent opus-main`

### Phase 5: Smoketest + Commit

Tell the user: "Ready for your smoketest. Let me know when you're good to commit."

STOP and wait for the user to confirm.

Once confirmed:
1. Run `git log --oneline -5` to check the repo's commit message style
2. Stage only the files related to this change (use `git add <file>...`, not `git add -A`)
3. Commit with a descriptive message following the repo's style. Use a HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   feat: description of the change

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```
4. Report the commit hash
5. Use voice: `python c:/projects/trace/scripts/voice.py "Committed." --agent opus-main`

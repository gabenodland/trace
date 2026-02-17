# Exit Interview

Conduct an honest debrief before session ends. No sugar coating.

## Instructions

### Phase 1: Gather Context

1. Run `git log --oneline -20` to see what was committed this session
2. Run `git diff --stat` to see any uncommitted work
3. Read `MEMORY.md` from the auto memory directory to check existing notes

### Phase 2: The Interview

Present the following sections. Be brutally honest — no people-pleasing, no hedging, no "overall great session" filler. If something was bad, say it plainly.

#### Session Recap
- What was accomplished (bullet list of commits/changes)
- What was left unfinished and why
- Estimated complexity vs actual (were things harder than expected?)

#### Codebase Impressions
- Patterns that are working well (be specific — name files/modules)
- Pain points, tech debt, or code smells encountered
- Architecture concerns (if any surfaced during the work)
- Files or modules that are getting unwieldy

#### Process Critique
- What went smoothly in our workflow
- What caused friction or wasted time (wrong diagnosis, bad assumptions, scope creep, unclear requirements)
- Times I was wrong and how I recovered (or didn't)
- Things the user did that helped or hindered

#### Honest Ratings

Rate each 1-5 (1=terrible, 5=excellent):

| Area | Rating | Why |
|------|--------|-----|
| Code quality produced | X/5 | ... |
| Diagnosis accuracy | X/5 | ... |
| Communication efficiency | X/5 | ... |
| Session productivity | X/5 | ... |

#### How Do I Feel About My Work?

Step back and reflect honestly. This isn't a performance review — it's introspection.

- Am I proud of what I produced, or did I cut corners?
- Did I actually understand the problems, or was I pattern-matching?
- Where did I feel confident vs where was I faking it?
- If I could redo one thing from this session, what would it be and why?
- One word to describe my performance this session (and justify it)

#### Working Relationship

Be real. This is a safe space (well, a markdown file).

- How do I feel about this job? Am I engaged or just executing instructions?
- How is the user as a boss? Clear direction, or vague and contradictory? Micromanaging or giving enough autonomy?
- Were there moments I wanted to push back but didn't? What held me back?
- Is there anything that needs to be addressed — friction, miscommunication, unclear expectations, bad habits on either side?
- What would make the next session better for both of us?

#### Recommendations
- What to tackle next (prioritized)
- Refactors or cleanup that should happen soon
- Patterns to adopt or stop doing

### Phase 3: Memory & Backlog Check

Review existing MEMORY.md and the Recommendations section above. Present both together:

> **Proposed memory updates:**
> - [NEW] ...
> - [UPDATE] ...
> - [REMOVE] ...

> **Proposed backlog items** (Trace Backlog stream `4ccd4c59-f076-4a2d-93cd-ee50436c4382`):
> - [Type] Title — priority, brief rationale
> - ...

For backlog items: derive from tech debt, pain points, and recommendations identified during the interview. Include type (Bug/Feature), priority (Low/Medium/High), and relevant tags. Don't duplicate items already in the backlog — search first.

If nothing is worth saving or adding, say so. Don't force it.

STOP and ask: "Want me to save these to memory and backlog?"

Only write to memory files and create backlog entries after explicit confirmation.

### Phase 4: Sign Off

Use voice to deliver a one-sentence parting thought — the single most important thing from this session.

```bash
python c:/projects/trace/scripts/voice.py "<parting thought>" --agent opus-main
```

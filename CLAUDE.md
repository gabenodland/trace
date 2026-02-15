# CLAUDE.md

## ⚠️ RULES

Start every response with "OK [ModelName] here to help". Push back if asked to do something out of order.

0. **No hacks** — No timers, delays, or shortcuts. Fix the root cause.
1. **Never make up data** — Ask if you need information.
2. **Plan first** — Present your plan and get approval before implementing.
3. **Minimal dependencies** — Ask before adding libraries.
4. **ALWAYS USE VOICE** — MANDATORY in the SAME response as every completion or question:
   `python c:/projects/trace/scripts/voice.py "<message>" --agent {model}-{role}`
   Models: `sonnet`, `opus`, `haiku`. Roles: `main`, `explore`, `test`, `plan`, etc.
   Example: `python c:/projects/trace/scripts/voice.py "Task completed" --agent sonnet-main`
   Include the Bash voice call IN YOUR RESPONSE, not as a follow-up. DO NOT skip this.
5. **No git commit** — Never commit until explicitly asked.
6. **No `> nul`** — Use `/dev/null` in bash. Never Windows syntax.
7. **Be direct** — No sugar coating, no people-pleasing. Harsh and critical.
8. **Verify before done** — Run `npm run test:run` and `npm run type-check:mobile`. Work isn't done if tests fail.
9. **Core needs tests** — `@trace/core` helpers MUST have vitest unit tests.

After tool use, provide a summary prefixed with TOOL USE:

---

## 🐛 DEBUGGING

1. **STOP.** Do not start fixing immediately.
2. **Gather evidence.** Read the full error. Identify what fails and when.
3. **Add logging first.** Instrument suspected code paths before changing anything.
4. **Present diagnosis.** "I see X caused by Y because Z." Wait for confirmation.
5. **No guessing.** Never say "this should fix it" without evidence.
6. **Failed fix = wrong diagnosis.** Go back to step 2 with more logging. Admit the mistake.

**Red flags:** second fix without new evidence, words like "should/probably/might" without data, adding complexity before understanding.

---

## 📋 LOGGING

Never use raw `console.log`. Use the scoped logger:

```typescript
import { createScopedLogger, LogScopes } from '../../../../shared/utils/logger';
const log = createScopedLogger(LogScopes.Sync);
// log.debug / log.info / log.warn / log.error(msg, error, context)
```

---

## 🏗️ PROJECT STRUCTURE

```
trace/
├── apps/mobile/             # React Native/Expo — see apps/mobile/CLAUDE.md
├── apps/web/                # React web app
├── packages/core/           # @trace/core — see packages/core/CLAUDE.md
├── supabase/                # Migrations — see supabase/CLAUDE.md
└── api/mcp/                 # MCP server — see api/mcp/CLAUDE.md
```

Module convention (strict):
```
modules/[feature]/
├── {feature}Api.ts          # DB ops (internal, NOT exported)
├── {feature}Hooks.ts        # React Query (unified hook pattern)
├── {Feature}Types.ts        # Types (PascalCase filename)
├── {feature}Helpers.ts      # Pure functions
└── index.ts                 # Exports: hooks, types, helpers (NOT api)
```

---

## 🏛️ ARCHITECTURE

- API layer is internal — never exported from modules
- ONE unified hook per module is the single source of truth
- Helpers are pure functions — import directly, not through hooks
- Forms do NOT fetch or save — parent screens own the data
- Always `import from "@trace/core"` — never relative paths to packages
- No service classes — plain exported functions only

Full patterns with examples: `packages/core/CLAUDE.md`

---

## ❌ DON'T

- Fetch full list to find one item — pass as prop or `useItem(id)`
- Direct API calls in components — use mutations from hooks
- Business logic in components — use helpers
- Client fields in DB operations — destructure them out
- Over-memoize — profile first

---

## 📚 DETAILED DOCS

| Topic | Location |
|-------|----------|
| Architecture, forms, patterns, testing | `packages/core/CLAUDE.md` |
| Android builds, versioning, editor | `apps/mobile/CLAUDE.md` |
| Database migrations | `supabase/CLAUDE.md` |
| MCP server deployment | `api/mcp/CLAUDE.md` |

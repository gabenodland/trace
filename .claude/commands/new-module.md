# New Module

Create a new feature module in the Trace monorepo following established conventions.

## Instructions

Ask the user for the module name if not provided as an argument: $ARGUMENTS

Then execute these steps:

### 1. Create core module files

```bash
mkdir -p packages/core/src/modules/{moduleName}
```

Create these files following the naming convention:
- `{module}Api.ts` — Database operations (internal, not exported)
- `{module}Hooks.ts` — React Query hooks with unified hook pattern
- `{Module}Types.ts` — TypeScript interfaces (PascalCase filename)
- `{module}Helpers.ts` — Pure utility functions
- `{module}Helpers.test.ts` — Unit tests for helpers
- `index.ts` — Public exports (hooks, types, helpers — NOT api)

### 2. Export from core package

Add to `packages/core/src/index.ts`:
```typescript
export * from "./modules/{moduleName}";
```

### 3. Create mobile UI structure

```bash
mkdir -p apps/mobile/src/modules/{moduleName}/{screens,components}
```

### 4. Create web UI structure (if needed)

```bash
mkdir -p apps/web/src/modules/{moduleName}/{pages,components}
```

### 5. Build core package

```bash
cd packages/core && npm run build
```

### 6. Verify

```bash
npm run test:run
npm run type-check:mobile
```

## Reminders

- API layer is internal only — never export from index.ts
- Unified hook is the single source of truth for data
- Helpers are imported directly, not re-exported through hooks
- Helper functions MUST have unit tests

# Trace Backlog

## Pro Features (Planned)

### Map Timeline View
**Priority:** High
**Status:** Design

Map with dual-handle range slider for filtering entries by date.

- Map displays entry markers (existing)
- Bottom panel with timeline slider
- Two handles: adjust start and end date independently
- Drag middle bar to slide entire range
- Auto-scales to user's entry date range
- Shows entry count for selected range
- Double-tap to reset to full range

```
┌────────────────────────────────────┐
│             MAP                    │
│   [markers for filtered entries]  │
├────────────────────────────────────┤
│  Mar 1, 2024 → Jun 15, 2024       │
│  ●━━━━━━━━━━━━━━━━●               │
│  23 entries                        │
└────────────────────────────────────┘
```

---

## Subscription & Payments

### Stripe Web Payments
**Priority:** High
**Status:** Not Started

- Create Stripe Payment Link ($39.99/year)
- Create Edge Function webhook to handle payment success
- Update user profile to `subscription_tier: 'pro'`
- Landing page at mindjig.com/trace with purchase button

### In-App Purchase (iOS/Android)
**Priority:** Medium
**Status:** Blocked (requires store accounts)

- Implement react-native-iap
- Create Edge Function for receipt validation
- Handle subscription restoration

---

## Integrations

### MCP Server (Claude Integration)
**Priority:** Medium
**Status:** Idea

Edge Function that exposes Trace as an MCP server, allowing Claude to read/write notes.

**Tools to expose:**
- `list_entries` - Get recent entries
- `get_entry` - Get specific entry by ID
- `create_entry` - Add a new note
- `search_entries` - Search notes by text

**Architecture:**
```
Claude Desktop / Claude Code
     ↓ (HTTP + Bearer token)
Supabase Edge Function (MCP Server)
     ↓ (authenticated Supabase client)
Database (RLS enforced)
```

**Auth approach:**
- Generate personal API token in app settings
- Store in `api_tokens` table with user_id
- Edge Function validates token, creates authenticated client
- RLS ensures user only accesses their own data

**Use case:** "Add a note to my Trace: Meeting with John, discussed project timeline"

---

## Future Ideas

- On This Day memories with location context
- Travel journal / trip grouping
- Entry density heatmap on slider
- Play button to animate through time
- Location-based reminders

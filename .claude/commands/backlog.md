# Trace Backlog

Manage the Trace Backlog stream via MCP. Use this for searching, updating, and creating backlog items.

## Stream Reference

- **Stream ID:** `4ccd4c59-f076-4a2d-93cd-ee50436c4382`
- **Stream Name:** Trace Backlog
- **Types:** Bug, Feature
- **Statuses:** new, todo, in_progress, done, on_hold
- **Priorities:** 0=None, 1=Low, 2=Medium, 3=High, 4=Urgent
- **Rating:** disabled
- **Due dates:** disabled

## Instructions

Use the Trace MCP tools with the stream ID above. Never call `list_streams` just to find this ID.

### If the user provides arguments: `$ARGUMENTS`

Parse the arguments for intent:

- **`done <search>`** — Search for the item, mark status=done
- **`search <query>`** — Search entries in the backlog
- **`new <title>`** — Create a new entry (ask for type/priority if not specified)
- **`list`** — List open items (status != done), include_content=false
- **`bugs`** — List open bugs (search for type=Bug, status != done)

### If no arguments

List the 20 most recent open backlog items (status != done) with `include_content=false`.

### Common operations

- When marking items done, always use `expected_version` to prevent overwrites
- When creating items, always set `stream_id` to the backlog stream ID
- Use `include_content=false` for listing/browsing, fetch full content only when needed

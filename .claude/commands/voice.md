# Voice

Speak a message using Microsoft Edge neural text-to-speech. Each session/agent combo gets a unique random voice from a curated pool. Voices persist across restarts.

## Usage

```
/voice "Your message here" --agent opus-main --session editor
/voice "Message" --agent sonnet-explore --session editor
/voice --assignments
/voice --reset
```

## Instructions

When this command is invoked, use the `voice_speak` MCP tool. If MCP is unavailable, fall back to:

```bash
python c:/projects/claude-voice-mcp/voice.py $ARGUMENTS
```

## Session System

Sessions group agents working on the same task. The registry key is `session/agent`, so:
- `editor/opus-main` and `settings/opus-main` get **different voices**
- `editor/opus-main` and `editor/sonnet-explore` get **different voices**
- Same `session/agent` combo always gets the **same voice** (persisted to disk)

If `--session` is omitted, defaults to the cwd folder name (e.g. `trace`).

**Subagents:** When spawning subagents, tell them to use the same `--session` value so they're grouped with you in the UI.

## Commands

| Command | Description |
|---------|-------------|
| `"text" --agent ID --session NAME` | Speak with auto-assigned voice |
| `"text" --agent ID --name NAME` | Speak with custom display name |
| `"text" --voice VOICE` | Speak with explicit voice override |
| `--assignments` | Show all session/agent voice mappings |
| `--assign AGENT VOICE` | Manually assign a voice |
| `--pool` | Show the 14 curated voices and assignments |
| `--stop` | Stop current playback |
| `--status` | Show playback state |
| `--reset` | Clear all assignments |
| `--list-voices` | List ALL Edge TTS voices (300+) |

## Voice Pool (42 voices across 14 locales)

Run `python c:/projects/claude-voice-mcp/voice.py --pool` to see current assignments.

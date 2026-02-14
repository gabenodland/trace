# Voice

Speak a message using Microsoft Edge neural text-to-speech. Each agent randomly picks a unique voice and keeps it for the session.

## Usage

```
/voice "Your message here" --agent main
/voice "Message" --agent explore
/voice --show-session
/voice --reset-session
```

## Instructions

When this command is invoked, run the voice.py script:

```bash
python c:/projects/trace/scripts/voice.py $ARGUMENTS
```

## Agent Voice System

Each agent type gets a randomly assigned voice on first use. The voice persists for the entire session so you can distinguish agents by their voices.

**Common agent types:**
- `main` - Primary Claude instance
- `explore` - Explorer/research agent
- `plan` - Planning agent
- `code` - Code writing agent
- `bash` - Command execution agent
- `test` - Test runner agent
- `build` - Build agent

**Voice pool (14 voices):**
- US English: Aria, Guy, Jenny, Christopher, Eric, Michelle
- British: Sonia, Ryan
- Australian: Natasha, William
- Irish: Emily, Connor
- Indian: Neerja
- Canadian: Clara

## Commands

| Command | Description |
|---------|-------------|
| `--show-session` | Show which voice each agent has |
| `--reset-session` | Clear all assignments, agents pick new voices |
| `--list-pool` | List available voices in the pool |
| `--list-voices` | List ALL Edge TTS voices (300+) |

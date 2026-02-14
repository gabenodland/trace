#!/usr/bin/env python3
"""
Edge TTS voice tool for Claude Code notifications.
Uses Microsoft's free neural text-to-speech voices.

Each agent randomly picks a voice on first use and keeps it for the session.

Usage:
    python voice.py "Your message here"
    python voice.py "Message" --agent explore
    python voice.py "Message" --voice en-GB-SoniaNeural
    python voice.py --list-voices
    python voice.py --reset-session
"""

import argparse
import asyncio
import json
import os
import random
import subprocess
import sys
import tempfile
from pathlib import Path

from filelock import FileLock

# Session file to persist agent→voice mappings
SESSION_FILE = Path(tempfile.gettempdir()) / "claude_voice_session.json"
# Lock file to prevent overlapping speech
SPEECH_LOCK_FILE = Path(tempfile.gettempdir()) / "claude_voice_speech.lock"

def get_auto_agent_id() -> str:
    """Get agent ID from env var CLAUDE_VOICE_ID, or return 'default'."""
    return os.environ.get("CLAUDE_VOICE_ID", "default")

# Pool of good English neural voices for random selection
VOICE_POOL = [
    ("en-US-AriaNeural", "Female, US, conversational"),
    ("en-US-GuyNeural", "Male, US, friendly"),
    ("en-US-JennyNeural", "Female, US, warm"),
    ("en-US-ChristopherNeural", "Male, US, professional"),
    ("en-US-EricNeural", "Male, US, casual"),
    ("en-US-MichelleNeural", "Female, US, cheerful"),
    ("en-GB-SoniaNeural", "Female, British, sophisticated"),
    ("en-GB-RyanNeural", "Male, British, friendly"),
    ("en-AU-NatashaNeural", "Female, Australian"),
    ("en-AU-WilliamNeural", "Male, Australian"),
    ("en-IE-EmilyNeural", "Female, Irish"),
    ("en-IE-ConnorNeural", "Male, Irish"),
    ("en-IN-NeerjaNeural", "Female, Indian"),
    ("en-CA-ClaraNeural", "Female, Canadian"),
]

# Default voice when no agent specified
DEFAULT_VOICE = "en-US-AriaNeural"


def load_session() -> dict:
    """Load the current session's agent→voice mappings."""
    if SESSION_FILE.exists():
        try:
            return json.loads(SESSION_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {"agents": {}, "used_voices": []}


def save_session(session: dict):
    """Save the session state."""
    SESSION_FILE.write_text(json.dumps(session, indent=2))


def get_voice_for_agent(agent_id: str) -> str:
    """Get or assign a voice for an agent. Persists for the session."""
    session = load_session()

    # If agent already has a voice, return it
    if agent_id in session["agents"]:
        return session["agents"][agent_id]

    # Pick a random voice not yet used by another agent
    available = [v[0] for v in VOICE_POOL if v[0] not in session["used_voices"]]

    # If all voices used, allow reuse
    if not available:
        available = [v[0] for v in VOICE_POOL]

    voice = random.choice(available)

    # Save the assignment
    session["agents"][agent_id] = voice
    session["used_voices"].append(voice)
    save_session(session)

    return voice


def reset_session():
    """Reset the session, clearing all agent→voice mappings."""
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()
    print("Session reset. Agents will pick new voices on next use.")


def show_session():
    """Show current session's agent→voice mappings."""
    session = load_session()
    if not session["agents"]:
        print("No agents have spoken yet this session.")
        return

    print(f"{'Agent':<20} {'Voice':<30}")
    print("-" * 52)
    for agent, voice in session["agents"].items():
        # Find description
        desc = next((v[1] for v in VOICE_POOL if v[0] == voice), "")
        print(f"{agent:<20} {voice:<30}")
        if desc:
            print(f"{'':20} ({desc})")


async def list_voices(language_filter: str | None = None):
    """List available voices, optionally filtered by language."""
    import edge_tts

    voices = await edge_tts.list_voices()

    if language_filter:
        voices = [v for v in voices if v["Locale"].lower().startswith(language_filter.lower())]

    # Sort by locale then name
    voices.sort(key=lambda v: (v["Locale"], v["ShortName"]))

    print(f"{'Voice Name':<30} {'Gender':<8} {'Locale':<10}")
    print("-" * 50)
    for voice in voices:
        print(f"{voice['ShortName']:<30} {voice['Gender']:<8} {voice['Locale']:<10}")


async def speak(text: str, voice: str = DEFAULT_VOICE):
    """Generate speech and play it. Uses file lock to prevent overlapping speech."""
    import edge_tts

    # Create temp file for audio
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        temp_path = f.name

    try:
        # Generate audio (can happen in parallel with other agents)
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(temp_path)

        # Acquire lock before playing (blocks until other agents finish speaking)
        lock = FileLock(SPEECH_LOCK_FILE, timeout=-1)  # -1 = wait forever
        with lock:
            subprocess.run(
                ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", temp_path],
                check=True
            )
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main():
    parser = argparse.ArgumentParser(
        description="Text-to-speech using Microsoft Edge neural voices"
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="Text to speak"
    )
    parser.add_argument(
        "--voice", "-v",
        help=f"Voice to use (overrides agent voice)"
    )
    parser.add_argument(
        "--agent", "-a",
        help="Agent ID (optional - auto-generates from process ID if not provided)"
    )
    parser.add_argument(
        "--list-voices", "-l",
        action="store_true",
        help="List all available Edge TTS voices"
    )
    parser.add_argument(
        "--list-pool",
        action="store_true",
        help="List the voice pool used for random selection"
    )
    parser.add_argument(
        "--show-session",
        action="store_true",
        help="Show current session's agent→voice mappings"
    )
    parser.add_argument(
        "--reset-session",
        action="store_true",
        help="Reset session (agents will pick new voices)"
    )
    parser.add_argument(
        "--language",
        help="Filter voices by language code (e.g., 'en', 'es', 'fr')"
    )

    args = parser.parse_args()

    if args.reset_session:
        reset_session()
    elif args.show_session:
        show_session()
    elif args.list_pool:
        print(f"{'Voice':<30} {'Description':<30}")
        print("-" * 62)
        for voice, desc in VOICE_POOL:
            print(f"{voice:<30} {desc:<30}")
    elif args.list_voices:
        asyncio.run(list_voices(args.language))
    elif args.text:
        # Determine voice: explicit --voice > --agent > auto (PPID-based)
        if args.voice:
            voice = args.voice
        else:
            # Use provided agent ID or auto-generate from PPID
            agent_id = args.agent if args.agent else get_auto_agent_id()
            voice = get_voice_for_agent(agent_id)
        asyncio.run(speak(args.text, voice))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

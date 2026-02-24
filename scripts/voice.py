#!/usr/bin/env python3
"""
Edge TTS voice tool for Claude Code notifications.
Uses Microsoft's free neural text-to-speech voices.

Fixed voice per model:
  sonnet → en-US-MichelleNeural (US female)
  haiku  → en-US-BrianMultilingualNeural (US male multilingual)
  opus   → en-GB-RyanNeural (British male)

Usage:
    python voice.py "Your message here" --agent opus-main
    python voice.py "Message" --voice en-GB-SoniaNeural
    python voice.py --list-voices
"""

import argparse
import asyncio
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

from filelock import FileLock

# Lock file to prevent overlapping speech
SPEECH_LOCK_FILE = Path(tempfile.gettempdir()) / "claude_voice_speech.lock"

# Fixed voice per model prefix
MODEL_VOICES = {
    "sonnet": "en-US-MichelleNeural",
    "haiku": "en-US-BrianMultilingualNeural",
    "opus": "en-GB-RyanNeural",
}

DEFAULT_VOICE = "en-US-AriaNeural"


def get_voice_for_agent(agent_id: str) -> str:
    """Get the fixed voice for an agent based on model prefix."""
    agent_lower = agent_id.lower()
    for model, voice in MODEL_VOICES.items():
        if agent_lower == model or agent_lower.startswith(model + "-"):
            return voice
    return DEFAULT_VOICE


async def list_voices(language_filter: Optional[str] = None):
    """List available voices, optionally filtered by language."""
    import edge_tts

    voices = await edge_tts.list_voices()

    if language_filter:
        voices = [v for v in voices if v["Locale"].lower().startswith(language_filter.lower())]

    voices.sort(key=lambda v: (v["Locale"], v["ShortName"]))

    print(f"{'Voice Name':<30} {'Gender':<8} {'Locale':<10}")
    print("-" * 50)
    for voice in voices:
        print(f"{voice['ShortName']:<30} {voice['Gender']:<8} {voice['Locale']:<10}")


async def speak(text: str, voice: str = DEFAULT_VOICE):
    """Generate speech and play it. Uses file lock to prevent overlapping speech."""
    import edge_tts
    import platform

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        temp_path = f.name

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(temp_path)

        lock = FileLock(SPEECH_LOCK_FILE, timeout=-1)
        with lock:
            # Use platform-appropriate audio player
            if platform.system() == "Darwin":  # macOS
                subprocess.run(["afplay", temp_path], check=True)
            else:  # Windows/Linux
                subprocess.run(
                    ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", temp_path],
                    check=True
                )
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main():
    parser = argparse.ArgumentParser(
        description="Text-to-speech using Microsoft Edge neural voices"
    )
    parser.add_argument("text", nargs="?", help="Text to speak")
    parser.add_argument("--voice", "-v", help="Voice to use (overrides agent voice)")
    parser.add_argument("--agent", "-a", help="Agent ID (e.g. opus-main, sonnet-explore)")
    parser.add_argument("--list-voices", "-l", action="store_true", help="List all available Edge TTS voices")
    parser.add_argument("--language", help="Filter voices by language code (e.g., 'en', 'es')")

    args = parser.parse_args()

    if args.list_voices:
        asyncio.run(list_voices(args.language))
    elif args.text:
        if args.voice:
            voice = args.voice
        elif args.agent:
            voice = get_voice_for_agent(args.agent)
        else:
            voice = DEFAULT_VOICE
        asyncio.run(speak(args.text, voice))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

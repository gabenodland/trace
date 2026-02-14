#!/usr/bin/env python3
"""
Download an attachment from Trace MCP API for local viewing.

Usage:
    python scripts/get_attachment.py <attachment_id> [--api-key KEY]

The script:
1. Calls the MCP API to get a signed URL for the attachment
2. Downloads the file to a temp directory
3. Prints the local file path for viewing

API key can be provided via --api-key flag or TRACE_API_KEY environment variable.
"""

import argparse
import json
import os
import sys
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

# MCP API endpoint
MCP_URL = "https://trace-mcp.mindjig.com/mcp"


def call_mcp(api_key: str, method: str, params: dict = None) -> dict:
    """Call the MCP API with the given method and params."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or {}
    }

    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {error_body}", file=sys.stderr)
        sys.exit(1)


def get_attachment_url(api_key: str, attachment_id: str) -> str:
    """Get a signed URL for the attachment."""
    result = call_mcp(api_key, "tools/call", {
        "name": "get_attachment_url",
        "arguments": {"attachment_id": attachment_id}
    })

    if "error" in result:
        print(f"MCP Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    # Parse the response - it's in result.result.content[0].text
    try:
        content = result["result"]["content"][0]["text"]
        data = json.loads(content)
        return data.get("url") or data.get("signed_url")
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"Failed to parse response: {result}", file=sys.stderr)
        sys.exit(1)


def download_file(url: str, attachment_id: str) -> Path:
    """Download the file from the signed URL to a temp directory."""
    # Create a temp directory that persists
    temp_dir = Path(tempfile.gettempdir()) / "trace_attachments"
    temp_dir.mkdir(exist_ok=True)

    # Try to determine file extension from URL or default to .jpg
    ext = ".jpg"
    if "." in url.split("?")[0].split("/")[-1]:
        ext = "." + url.split("?")[0].split("/")[-1].split(".")[-1]

    local_path = temp_dir / f"{attachment_id}{ext}"

    # Download the file
    try:
        urllib.request.urlretrieve(url, local_path)
        return local_path
    except urllib.error.URLError as e:
        print(f"Download failed: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Download a Trace attachment for local viewing"
    )
    parser.add_argument("attachment_id", help="The attachment ID to download")
    parser.add_argument(
        "--api-key",
        help="Trace API key (or set TRACE_API_KEY env var)",
        default=os.environ.get("TRACE_API_KEY")
    )

    args = parser.parse_args()

    if not args.api_key:
        print("Error: API key required. Use --api-key or set TRACE_API_KEY", file=sys.stderr)
        sys.exit(1)

    # Get signed URL
    print(f"Getting signed URL for {args.attachment_id}...", file=sys.stderr)
    signed_url = get_attachment_url(args.api_key, args.attachment_id)

    # Download file
    print(f"Downloading...", file=sys.stderr)
    local_path = download_file(signed_url, args.attachment_id)

    # Print the path (stdout) so it can be captured
    print(local_path)


if __name__ == "__main__":
    main()

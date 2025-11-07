#!/usr/bin/env python3
"""
Fix Orthanc configuration to enable remote access with authentication
"""

import json
import re
import sys
from datetime import datetime
import shutil

CONFIG_FILE = "/etc/orthanc/orthanc.json"
BACKUP_SUFFIX = f".backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def remove_json_comments(text):
    """Remove C-style comments from JSON text"""
    # Remove single line comments
    text = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)
    # Remove multi-line comments
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    return text

def add_json_comments(text, line_number, comment):
    """Add comment before a specific line"""
    lines = text.split('\n')
    if line_number < len(lines):
        lines.insert(line_number, comment)
    return '\n'.join(lines)

def main():
    print("===== Orthanc Remote Access Configuration Fix =====")
    print()
    print("This script will:")
    print("1. Enable RemoteAccessAllowed")
    print("2. Enable AuthenticationEnabled")
    print("3. Add RegisteredUsers credentials")
    print()
    print("Credentials will be: orthanc / orthanc")
    print()

    try:
        # Read the original file
        print(f"Reading {CONFIG_FILE}...")
        with open(CONFIG_FILE, 'r') as f:
            original_content = f.read()

        # Create backup
        backup_file = CONFIG_FILE + BACKUP_SUFFIX
        print(f"Creating backup: {backup_file}")
        shutil.copy2(CONFIG_FILE, backup_file)

        # Parse JSON (removing comments first)
        print("Parsing configuration...")
        json_content = remove_json_comments(original_content)
        config = json.loads(json_content)

        # Modify settings
        print("Updating settings...")
        config["RemoteAccessAllowed"] = True
        config["AuthenticationEnabled"] = True
        config["RegisteredUsers"] = {
            "orthanc": "orthanc",
            "admin": "admin"
        }

        # Convert back to JSON with nice formatting
        new_json = json.dumps(config, indent=2)

        # Write the modified config
        print(f"Writing updated configuration...")
        with open(CONFIG_FILE, 'w') as f:
            f.write(new_json)

        print()
        print("✅ Configuration updated successfully!")
        print()
        print("Credentials:")
        print("  Username: orthanc  Password: orthanc")
        print("  Username: admin    Password: admin")
        print()
        print("Now restart Orthanc with:")
        print("  sudo systemctl restart orthanc")
        print()

        return 0

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        print(f"\nIf backup exists, restore with:")
        print(f"  sudo cp {CONFIG_FILE + BACKUP_SUFFIX} {CONFIG_FILE}")
        return 1

if __name__ == "__main__":
    sys.exit(main())



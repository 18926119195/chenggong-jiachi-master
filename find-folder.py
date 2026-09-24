#!/usr/bin/env python3
"""List the actual folder structure to find the real name."""
import os
base = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
for entry in os.listdir(base):
    if "cot" in entry.lower():
        full = os.path.join(base, entry)
        if os.path.isdir(full):
            print(f"FOLDER: {entry!r}")
            for sub in os.listdir(full):
                print(f"  └─ {sub!r}")
#!/usr/bin/env python3
import os
BASE = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
cot = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(os.path.join(BASE, e))][0]
log_path = os.path.join(BASE, cot, "logs", "cot-run-Z1-Q2.log")
with open(log_path, encoding="utf-8") as f:
    print(f.read())
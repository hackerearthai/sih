"""Test that the same file produces identical results every time."""
import requests
import json

results = []
for i in range(5):
    with open("fir_date_tampered.png", "rb") as f:
        r = requests.post("http://localhost:6001/analyze", files={"file": f}).json()
        results.append(r)

for i, r in enumerate(results):
    same = r == results[0]
    flag = r["aiRiskFlag"]
    score = r["details"]["elaScore"]
    nflags = len(r["details"]["metadataFlags"])
    print(f"Run {i+1}: flag={flag}, ela={score}, nflags={nflags}, identical={same}")

print()
print("ALL IDENTICAL:", all(r == results[0] for r in results))

import requests

PDF_PATH = r"C:\Users\My Pc\.gemini\antigravity-ide\brain\82ecffbe-3b38-49b1-855d-bd1930a9a995\.user_uploaded\media_1788691014189.pdf"

with open(PDF_PATH, "rb") as f:
    r = requests.post(
        "http://localhost:6001/analyze",
        files={"file": ("test.pdf", f, "application/pdf")}
    ).json()

print("=== PDF ANALYSIS RESULT ===")
print("Flag:", r["aiRiskFlag"])
print("ELA Score:", r["details"]["elaScore"])

ca = r.get("contentAnalysis", {})
print("Doc Type:", ca.get("documentType"))
print("Fields found:", list(ca.get("identifiedFields", {}).keys()))

text = ca.get("extractedText", "")
print("Extracted chars:", len(text))
print("Text preview:", text[:400])
print()

print("Content Checks:")
for c in ca.get("contentChecks", []):
    status = c["status"].upper()
    print(f"  [{status}] {c['check']}: {c['detail']}")

print()
print("Forensic Flags:")
flags = r["details"]["metadataFlags"]
if flags:
    for fl in flags:
        print(" -", fl)
else:
    print("  (none)")

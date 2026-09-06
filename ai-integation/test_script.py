"""
Demo test script for SIH26190 AI Forensic & Tamper Detection Module.

Usage:
    python test_script.py <path_to_unedited_image> <path_to_edited_image>
    python test_script.py --all
    python test_script.py   (runs default test on Pair 03: 03_FIR_original vs 03_FIR_TAMPERED)

Sends documents to the running microservice (default http://localhost:6000 or 6001)
and prints the forensic verification results side by side.
"""

import sys
import json
import os
import glob
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SERVICE_URL_PORT6001 = "http://localhost:6001/analyze"
SERVICE_URL_PORT6000 = "http://localhost:6000/analyze"


def get_service_url():
    target_url = os.environ.get("SERVICE_URL")
    if not target_url:
        for port in [6000, 6001]:
            try:
                r = requests.get(f"http://localhost:{port}/health", timeout=2)
                if r.status_code == 200:
                    return f"http://localhost:{port}/analyze"
            except Exception:
                pass
        target_url = SERVICE_URL_PORT6000
    return target_url


def analyze(path):
    target_url = get_service_url()
    with open(path, "rb") as f:
        files = {"file": (os.path.basename(path), f)}
        resp = requests.post(target_url, files=files, timeout=35)
    resp.raise_for_status()
    return resp.json()


def print_side_by_side(label_a, result_a, label_b, result_b):
    def fmt(result):
        details = result.get("details", {})
        bv = result.get("blockchainVerification", {})
        diffs = details.get("fieldDiffs") or bv.get("fieldDiffs") or []
        diff_str = "; ".join([d.get("finding", f"{d.get('field')}: {d.get('original')} -> {d.get('tampered')}") for d in diffs]) if diffs else "None (Exact Match)"

        lines = [
            f"aiRiskFlag       : {result.get('aiRiskFlag')}",
            f"blockchainStatus : {details.get('blockchainStatus', bv.get('status', 'N/A'))}",
            f"elaScore         : {details.get('elaScore')}",
            f"detectedDiffs    : {diff_str}",
            f"metadataFlags    : {details.get('metadataFlags') or '[]'}",
            f"heatmapPath      : {details.get('elaHeatmapPath')}",
        ]
        return lines

    lines_a = fmt(result_a)
    lines_b = fmt(result_b)

    col_width = max(len(label_a), len(label_b), 48) + 2

    print("=" * (col_width * 2 + 3))
    print(f"{label_a:<{col_width}} | {label_b}")
    print("-" * (col_width * 2 + 3))
    for la, lb in zip(lines_a, lines_b):
        # Truncate if exceptionally long for column alignment
        la_display = (la[:col_width - 3] + "...") if len(la) > col_width else la
        lb_display = (lb[:col_width - 3] + "...") if len(lb) > col_width else lb
        print(f"{la_display:<{col_width}} | {lb_display}")
    print("=" * (col_width * 2 + 3))


def run_all_manifest_tests():
    print("=" * 85)
    print("RUNNING BATCH TESTS ON TEST MANIFEST DOCUMENTS")
    print("=" * 85)

    test_dir = "test_docs"
    if not os.path.isdir(test_dir):
        test_dir = os.path.join("files", "test_docs")

    pairs = [
        ("01", "01_FIR_original.pdf", "01_FIR_TAMPERED.pdf", "Date & Time of FIR"),
        ("02", "02_FIR_original.pdf", "02_FIR_TAMPERED.pdf", "Legal Sections"),
        ("03", "03_FIR_original.pdf", "03_FIR_TAMPERED.pdf", "Complainant Name"),
        ("04", "04_FIR_original.pdf", "04_FIR_TAMPERED.pdf", "Place of Occurrence"),
        ("05", "05_FIR_original.pdf", "05_FIR_TAMPERED.pdf", "Brief Description"),
    ]

    print(f"{'Pair':<6} | {'Original Doc':<22} | {'Original Flag':<14} | {'Tampered Flag':<18} | {'Detected Alteration'}")
    print("-" * 105)

    all_passed = True
    for p_id, orig_name, tamp_name, change_desc in pairs:
        orig_path = os.path.join(test_dir, orig_name)
        tamp_path = os.path.join(test_dir, tamp_name)

        if not os.path.exists(orig_path) or not os.path.exists(tamp_path):
            continue

        try:
            r_orig = analyze(orig_path)
            r_tamp = analyze(tamp_path)

            orig_flag = r_orig.get("aiRiskFlag", "error")
            tamp_flag = r_tamp.get("aiRiskFlag", "error")

            diffs = r_tamp.get("details", {}).get("fieldDiffs") or []
            diff_text = diffs[0].get("finding", change_desc) if diffs else change_desc

            is_pair_correct = (orig_flag == "clean" and tamp_flag == "review_recommended")
            if not is_pair_correct:
                all_passed = False

            status_icon = "✓ PASS" if is_pair_correct else "✗ FAIL"
            print(f"P{p_id:<4} | {orig_name:<22} | {orig_flag:<14} | {tamp_flag:<18} | {diff_text[:40]} [{status_icon}]")
        except Exception as e:
            print(f"P{p_id:<4} | ERROR: {e}")
            all_passed = False

    print("=" * 105)
    if all_passed:
        print("ALL TESTS PASSED: 100% of authentic originals flagged CLEAN, 100% of altered files flagged REVIEW_RECOMMENDED.")
    else:
        print("SOME TESTS FAILED: Review output above.")


def main():
    if len(sys.argv) == 2 and sys.argv[1] in ["--all", "-a", "all"]:
        run_all_manifest_tests()
        return

    if len(sys.argv) == 3:
        unedited_path, edited_path = sys.argv[1], sys.argv[2]
    else:
        # Default to Pair 03
        default_dir = "test_docs" if os.path.isdir("test_docs") else os.path.join("files", "test_docs")
        unedited_path = os.path.join(default_dir, "03_FIR_original.pdf")
        edited_path = os.path.join(default_dir, "03_FIR_TAMPERED.pdf")
        print(f"Note: No paths specified. Running default demonstration on Pair 03:")
        print(f"  Unedited : {unedited_path}")
        print(f"  Edited   : {edited_path}")
        print()

    if not os.path.exists(unedited_path):
        print(f"Error: Original file not found at '{unedited_path}'")
        sys.exit(1)
    if not os.path.exists(edited_path):
        print(f"Error: Tampered file not found at '{edited_path}'")
        sys.exit(1)

    print(f"Analyzing unedited file: {unedited_path}")
    unedited_result = analyze(unedited_path)

    print(f"Analyzing edited file:   {edited_path}")
    edited_result = analyze(edited_path)

    print()
    print_side_by_side(
        "UNEDITED (expected: clean)", unedited_result,
        "EDITED (expected: review_recommended)", edited_result,
    )

    print()
    print("Detected Differences in Edited File:")
    diffs = edited_result.get("details", {}).get("fieldDiffs", [])
    if diffs:
        for d in diffs:
            print(f"  • {d.get('field')}: '{d.get('original')}' --> '{d.get('tampered')}'")
    else:
        print("  None detected via field diff.")

    print()
    print("Blockchain Verification Details:")
    bv_orig = unedited_result.get("blockchainVerification", {})
    bv_edit = edited_result.get("blockchainVerification", {})
    print(f"  Unedited : {bv_orig.get('status')} - {bv_orig.get('message')}")
    print(f"  Edited   : {bv_edit.get('status')} - {bv_edit.get('message')}")


if __name__ == "__main__":
    main()

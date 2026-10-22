"""
One-off fix: the "Difference of Received Vs Expected" column insertion
(add_difference_received_column.py) shifted every column from "Closing Date"
onward by one position, but blindly copied the TAT formula cell as-is -
it still read "=IFERROR(AA3-X3,"-")" (the OLD "Current Date"/"Closing Date"
letters), which after the shift point at the wrong columns ("Payout Status"
and "Percentage of Average Revenue..." instead of "Current Date" and
"Closing Date"). This corrects it to reference the new letters directly.

Run once: python dev_scripts/fix_tat_formula_shift.py
"""
import io
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook

from app.services.template_store import get_template_bytes, save_template


def main():
    old_bytes = get_template_bytes("deals")

    backup_dir = Path(__file__).resolve().parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    (backup_dir / f"deals_before_tat_fix_{stamp}.xlsx").write_bytes(old_bytes)

    wb = load_workbook(io.BytesIO(old_bytes), data_only=False)
    ws = wb.active

    assert ws.cell(2, 25).value.strip() == "Closing Date", ws.cell(2, 25).value
    assert ws.cell(2, 28).value.strip() == "Current Date", ws.cell(2, 28).value
    assert ws.cell(2, 29).value.startswith("TAT"), ws.cell(2, 29).value

    before = ws.cell(3, 29).value
    ws.cell(3, 29).value = '=IFERROR(AB3-Y3,"-")'  # Current Date (AB) - Closing Date (Y)
    print(f"TAT formula: {before!r} -> {ws.cell(3, 29).value!r}")

    out = io.BytesIO()
    wb.save(out)
    save_template("deals", out.getvalue(), "deals.xlsx", "fix-tat-formula-shift-script")
    print("deals: TAT formula fixed and saved.")


if __name__ == "__main__":
    main()

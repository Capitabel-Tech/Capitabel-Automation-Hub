"""
One-off fix: restores the "Difference of Received Vs Expected" column to the
live 'deals' template, lost from the template at some point before the
payout-column migration ever ran (confirmed missing from the pre-payout
backup too). Inserted right after "Net Revenue Per file" (=V3-Q3, i.e. Net
Revenue minus Expected Revenue), matching the column order of a known-good
historical output file exactly.

Run once: python dev_scripts/add_difference_received_column.py
"""
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from update_templates_payout import rebuild_template

from app.services.template_store import get_template_bytes, save_template

NOTE_TEXT = (
    "How to add a new column: in row 2 add a header for the new column, and in row 3 "
    "(this example row) either enter a formula referencing other cells in row 3 (e.g. =E3-F3) "
    "for a calculated column, or leave it as an example value for a column that should be copied "
    "directly from the uploaded raw file (the header text must match the raw file's column exactly). "
    "Save and re-upload this template through the app."
)


def main():
    old_bytes = get_template_bytes("deals")

    backup_dir = Path(__file__).resolve().parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    from datetime import datetime
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    (backup_dir / f"deals_before_diff_col_{stamp}.xlsx").write_bytes(old_bytes)

    # Current layout (1-indexed): 1 Deal Name .. 22 Net Revenue Per file,
    # 23 % Avg Revenue Per File on Disbursed Amount .. 34 Service State.
    slots = [{"old": i} for i in range(1, 23)]  # 1..22, through "Net Revenue Per file"
    slots.append({
        "header": "Difference of Received Vs Expected",
        "value": '=IFERROR(V3-Q3,"-")',  # Net Revenue Per file (V) - Expected Revenue (Q)
        "format": '"₹"\\ #,##0',
        "width": 18,
        "style_from": 22,  # Net Revenue Per file - same currency style
    })
    slots += [{"old": i} for i in range(23, 35)]  # % Avg Revenue .. Service State

    new_bytes = rebuild_template(old_bytes, slots, NOTE_TEXT)
    save_template("deals", new_bytes, "deals.xlsx", "add-difference-received-column-script")
    print("deals: updated,", len(slots), "columns")


if __name__ == "__main__":
    main()

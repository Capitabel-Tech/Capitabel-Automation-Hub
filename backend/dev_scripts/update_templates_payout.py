"""
One-off migration: adds the new Payout-related columns to the live, already-
customized 'deals', 'pipeline_high', and 'leads' templates stored in the
database - rebuilding each sheet column-by-column in the new order rather
than using openpyxl's insert_cols (which doesn't rewrite formula references
in other cells), so the two existing formulas that land after the insertion
point get their cell references correctly shifted.

Run once: python dev_scripts/update_templates_payout.py
"""
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from app.services.template_store import get_template_bytes, save_template


def copy_cell_style(src_cell, dst_cell):
    import copy as copy_mod
    dst_cell.font = copy_mod.copy(src_cell.font)
    dst_cell.fill = copy_mod.copy(src_cell.fill)
    dst_cell.border = copy_mod.copy(src_cell.border)
    dst_cell.alignment = copy_mod.copy(src_cell.alignment)


def rebuild_template(old_bytes: bytes, slots: list[dict], note_text: str) -> bytes:
    """`slots` is the new column order. Each slot is one of:
      {"old": old_col_index}                                   - copy as-is
      {"old": old_col_index, "formula": new_formula_string}     - copy style,
          but use this formula instead of the old one (for the two existing
          formulas whose cell references need to shift)
      {"header": str, "value": value_or_formula, "format": str,
       "width": float, "style_from": old_col_index}             - brand new
          column; style (font/fill/border/alignment) borrowed from an
          existing column so it looks consistent with the rest of the sheet
    """
    old_wb = load_workbook(io.BytesIO(old_bytes), data_only=False)
    old_ws = old_wb.active

    new_wb = load_workbook(io.BytesIO(old_bytes), data_only=False)
    new_ws = new_wb.active
    # Unmerge BEFORE deleting columns - unmerge_cells needs the underlying
    # cell objects to still exist, and delete_cols() removes them without
    # cleaning up the merge definitions itself, which would otherwise overlap
    # the new merges added below and Excel flags the file as corrupted.
    for merged_range in list(new_ws.merged_cells.ranges):
        new_ws.unmerge_cells(str(merged_range))
    new_ws.delete_cols(1, new_ws.max_column)

    n_cols = len(slots)

    for new_idx, slot in enumerate(slots, start=1):
        if "old" in slot:
            old_idx = slot["old"]
            for row in (1, 2, 3, 4, 5):
                src = old_ws.cell(row, old_idx)
                dst = new_ws.cell(row, new_idx)
                if row == 3 and "formula" in slot:
                    dst.value = slot["formula"]
                else:
                    dst.value = src.value
                copy_cell_style(src, dst)
                dst.number_format = src.number_format
            old_letter = get_column_letter(old_idx)
            new_letter = get_column_letter(new_idx)
            old_dim = old_ws.column_dimensions.get(old_letter)
            if old_dim and old_dim.width:
                new_ws.column_dimensions[new_letter].width = old_dim.width
        else:
            style_src_idx = slot["style_from"]
            for row in (1, 4, 5):
                src = old_ws.cell(row, style_src_idx)
                dst = new_ws.cell(row, new_idx)
                dst.value = None
                copy_cell_style(src, dst)
            header_src = old_ws.cell(2, style_src_idx)
            header_dst = new_ws.cell(2, new_idx)
            header_dst.value = slot["header"]
            copy_cell_style(header_src, header_dst)
            example_src = old_ws.cell(3, style_src_idx)
            example_dst = new_ws.cell(3, new_idx)
            example_dst.value = slot["value"]
            copy_cell_style(example_src, example_dst)
            example_dst.number_format = slot["format"]
            new_ws.column_dimensions[get_column_letter(new_idx)].width = slot["width"]

    # row 1 title and row 5 usage note are merged across every column
    new_ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n_cols)
    new_ws.cell(5, 1).value = note_text
    new_ws.merge_cells(start_row=5, start_column=1, end_row=5, end_column=n_cols)

    out = io.BytesIO()
    new_wb.save(out)
    return out.getvalue()


NOTE_TEXT = (
    "How to add a new column: in row 2 add a header for the new column, and in row 3 "
    "(this example row) either enter a formula referencing other cells in row 3 (e.g. =E3-F3) "
    "for a calculated column, or leave it as an example value for a column that should be copied "
    "directly from the uploaded raw file (the header text must match the raw file's column exactly). "
    "Save and re-upload this template through the app."
)


def update_deals():
    old_bytes = get_template_bytes("deals")
    # Old layout (1-indexed): 1 Deal Name .. 16 New ROI., 17 Supply Side,
    # 18 Demand Side, 19 Direct Cost, 20 Average/Gross Revenue Per file
    # (=Q3+R3), 21 Net Revenue Per file (=T3-S3), 22 %Avg Revenue on
    # Disbursed (=T3/G3), 23 Closing Date, 24 Lead Source .. 28 Service State.
    slots = [{"old": i} for i in range(1, 17)]  # 1..16, through "New ROI."
    slots.append({
        "header": "Expected Revenue ", "value": 4415.6, "format": "0",
        "width": 18, "style_from": 16,  # New ROI. - plain numeric style
    })
    slots += [
        {"old": 17},  # Supply Side
        {"old": 18},  # Demand Side
        {"old": 19},  # Direct Cost
        {"old": 20, "formula": "=R3+S3"},  # Average/Gross Revenue Per file
        {"old": 21, "formula": "=U3-T3"},  # Net Revenue Per file
        {"old": 22, "formula": "=U3/G3"},  # % Avg Revenue Per File on Disbursed Amount
        {"old": 23},  # Closing Date
    ]
    slots += [
        {
            "header": "Payout received Date ", "value": None, "format": "mm-dd-yy",
            "width": 18, "style_from": 23,  # Closing Date - date style
        },
        {
            "header": "Payout Status", "value": "Received", "format": "General",
            "width": 16, "style_from": 24,  # Lead Source - plain text style
        },
        {
            "header": "Current Date", "value": None, "format": "mm-dd-yy",
            "width": 18, "style_from": 23,  # Closing Date - date style
        },
        {
            "header": "TAT (AS ON {TAT_DATE})", "value": '=IFERROR(AA3-X3,"-")', "format": "General",
            "width": 16, "style_from": 16,  # New ROI. - plain numeric style
        },
        {
            "header": "Receivable Status", "value": "Cleared", "format": "General",
            "width": 16, "style_from": 24,  # Lead Source - plain text style
        },
    ]
    slots += [{"old": i} for i in range(24, 29)]  # Lead Source .. Service State

    new_bytes = rebuild_template(old_bytes, slots, NOTE_TEXT)
    save_template("deals", new_bytes, "deals.xlsx", "payout-migration-script")
    print("deals: updated,", len(slots), "columns")


def update_pipeline_high():
    old_bytes = get_template_bytes("pipeline_high")
    # Old layout: 1 Deal Name .. 8 %Requested Vs Login, 9 Lead Source,
    # 10 Assigned To, 11 Service State.
    slots = [{"old": i} for i in range(1, 9)]  # through "%Requested Vs Login"
    slots.append({
        "header": "Expected Revenue ", "value": '=IFERROR(F3*0.09%,"-")', "format": '"₹"\\ #,##0.00',
        "width": 18, "style_from": 5,  # Requested Loan Amount - currency style
    })
    slots += [{"old": i} for i in (9, 10, 11)]  # Lead Source, Assigned To, Service State

    new_bytes = rebuild_template(old_bytes, slots, NOTE_TEXT)
    save_template("pipeline_high", new_bytes, "pipeline_high.xlsx", "payout-migration-script")
    print("pipeline_high: updated,", len(slots), "columns")


def update_leads():
    old_bytes = get_template_bytes("leads")
    # Old layout: 1 Lead Name, 2 Loan Type, 3 Lead Status, 4 Lead Source,
    # 5 Assigned To. New "Date" column appended at the end.
    slots = [{"old": i} for i in range(1, 6)]
    slots.append({
        "header": "Date", "value": None, "format": "mm-dd-yy",
        "width": 16, "style_from": 1,  # Lead Name - plain style
    })

    new_bytes = rebuild_template(old_bytes, slots, NOTE_TEXT)
    save_template("leads", new_bytes, "leads.xlsx", "payout-migration-script")
    print("leads: updated,", len(slots), "columns")


if __name__ == "__main__":
    update_deals()
    update_pipeline_high()
    update_leads()

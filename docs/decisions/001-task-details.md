# Optional task details in existing Markdown metadata

Accepted: 2026-09-20 (2.6.0).

Tasks need optional deadlines and multiline notes while remaining note-local and
preserving readable checkbox lines, IDs, ordering and completion history.

Store `dueDate` (validated `YYYY-MM-DD`) and `notes` (plain text) in the existing
`quadrant-task` JSON comment. Omit empty fields when serializing, normalize old
tasks to `null` / `""`, and keep the existing board and data version numbers:
this is additive and needs no migration. New mutations reject invalid input;
malformed persisted details make the board read-only until corrected rather than
silently dropping data. Escape JSON angle brackets so notes cannot end comments
or masquerade as managed-block boundaries. JSON escapes preserve line breaks.

Calendar deadlines are not timestamps. Compute day differences using local
year/month/day values mapped to UTC day numbers, avoiding DST-length-day errors.
Only unfinished tasks with a difference below three days are urgent; overdue
tasks remain urgent. Refresh calendar-dependent views after local day changes.

The UI uses a native date input inside a small popup with local-date shortcuts.
Explicit confirmation avoids saving intermediate values during segmented date
entry. Notes are never rendered as HTML/Markdown; cards show an ellipsis preview
and the editor exposes the complete multiline text.

Trade-off: older plugin versions ignore these optional fields and may strip them
when saving a board. Update all devices before using detailed tasks. Downgrading
requires preserving the Markdown backup first; do not promise lossless edits
from older versions. No remote service or plugin-local task database is added.

# Tags and optional local deadline time

Accepted: 2026-09-20 (2.7.0).

Updated: 2026-09-24 (2.7.4). Unfinished deadlines use red for overdue tasks
and days 0–3, yellow for days 4–7, and green beyond day 7. Completed tasks
remain muted. Theme-specific yellow/green text is checked for at least 4.5:1
contrast against task-card backgrounds in the light/dark browser fixtures.

Extend existing task metadata with `tags: string[]` and optional `dueTime: HH:mm`.
Empty values stay omitted in Markdown and old tasks normalize to `[]` and `null`.
Reject malformed persisted values before editing a board, preserving all existing
note ownership and atomic write protections. Date/time are one logical draft value:
clearing the date clears the time; resetting a saved draft clears both only if
neither has changed during persistence. Times without dates are invalid.

Time is local wall-clock time, not a UTC timestamp. Cards display 24-hour values,
and date-derived weekday abbreviations always use English Mon–Sun. Urgency remains
a calendar-day rule, with inclusive 3/7-day boundaries, not an hourly countdown.

Tags trim whitespace, remove leading # characters, normalize Unicode NFC and
deduplicate case-sensitively. There is no count limit or global tag database.
FNV-1a over normalized UTF-16 text maps each tag to one of eight color pairs;
the mapping is device-independent and light/dark pairs have at least 4.5:1
text contrast. Tags use textContent, not Markdown/HTML rendering. Editors accept
Enter/comma/newline separators and save the final unconfirmed token as well.

Use the browser's native date input and synchronous showPicker in a click handler.
Keep the field visible and operable if a webview lacks or rejects showPicker. This
avoids depending on an Obsidian private API or maintaining a second calendar UI.
Dates/weekday, time and relative days are separate nonbreaking layout units.

As with 2.6.0 details, old plugins may strip unknown fields. Upgrade every device
before editing new metadata; preserve a Markdown backup before downgrading.

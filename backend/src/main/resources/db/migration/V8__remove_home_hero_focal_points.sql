UPDATE content_revision revision
SET payload = revision.payload - 'focusX' - 'focusY'
FROM content_entry entry
WHERE revision.entry_id = entry.id
  AND entry.kind = 'HOME_HERO'
  AND (revision.payload ? 'focusX' OR revision.payload ? 'focusY');

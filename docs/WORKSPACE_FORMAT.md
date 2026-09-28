# MarkmapEditor Workspace Format

The Workspace format accepted in release `0.6.2`.

## Layout

```
workspace-root/
└── notes/
    └── *.md
```

Choose the workspace **root** in Open Workspace. The root is the folder that
contains `notes/`. Do not select `notes/` itself.

Every Markdown file inside `notes/` is a **Note**. There are no separate
`journals/`, `concepts/` or `archive/` folders in this format.

## Canonical unit

```
Markdown file -> canonical unit
```

Notes, Knowledge, Pinned and Archive are **projections** over those same
physical files. They are visual reuse of one record, not file duplication.

## Classifications

Classifications live in the file's YAML frontmatter.

| Frontmatter | Effect |
| --- | --- |
| `knowledge: true` | Note also appears in Knowledge. |
| `pinned: true` | Note appears in Pinned. |
| `archived: true` | Note leaves Notes, Pinned and Knowledge, and appears in Archive. |

### Projection contract

- **Notes** contains every active Note.
- **Knowledge** is a filtered projection over active Notes. A Knowledge Note
  remains visible in Notes.
- **Pinned** is an independent classification. A Pinned Note is not repeated in
  the dated or Undated subsection.
- **Archive** holds archived Notes only. Archived Notes appear in Archive and
  not in active Notes, Pinned or Knowledge.

### Archive is not deletion

An archived Note remains a physical file in `notes/`. Archive never moves,
renames, copies or deletes anything. Restore removes the `archived` key and the
Note returns to the active views.

## Title and physical identity

- The **H1 heading** is the primary saved visual title.
- The **filename and folder path** remain the physical identity.
- Duplicate H1 values are supported. Two Notes with the same H1 remain separate
  Notes, distinguished by their paths.
- Navigation always uses the exact path, never the title.

## Data scopes

```
Current Document -> live single-document scope
Workspace        -> optional saved aggregation
```

Current Document reflects the live editor buffer. Workspace projections reflect
saved files. An unsaved change to a title or classification may not appear in
the Workspace views until you Save. Save rebuilds the Workspace Index.

## Migration from a legacy Workspace

**There is no automatic migration.** A Workspace that still uses `journals/` or
`concepts/` is rejected rather than converted, and the application never
creates `notes/` inside such a Workspace without an explicit selection and
confirmation.

### Procedure

1. **Keep an untouched backup** of the original Workspace. Do not modify it.
2. **Migrate a copy first.** Run the conversion against the copy, confirm the
   result, and only then repeat it on the original.
3. For each `concepts/*.md` file, add `knowledge: true` to its frontmatter.
4. For each `journals/*.md` file, no frontmatter is required: a journal becomes
   an ordinary Note.
5. For items that should be archived, add `archived: true`.
6. Place **all active files physically inside `notes/`** in the new Workspace.
7. Open the **Workspace root**, not `notes/`.

The conversion is frontmatter-only. It does not rewrite Markdown body content,
rename files, or rewrite Wiki Links.

## Intentional boundaries

These are accepted design boundaries, not missing work:

- No automatic legacy migration.
- No filename rename workflow.
- No automatic Wiki Link rewriting.
- No non-Markdown asset browser.
- No monthly calendar.
- No Reminders.
- No shared `@` attribute layer and no autocomplete.
- No Mermaid/Graph completion.
- No Reveal.js completion.
- No Journal-mode removal (the application context mode is still internally
  named `journal`).

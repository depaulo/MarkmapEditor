# MarkMapJournal Release 40 Dev Status

## Goal

Prepare MarkMapJournal for a future multi-context app:

- MarkMapEditor
- MarkMapJournal
- MarkMapSlides

## Current state

- App has been partially split from single-file HTML.
- CSS is currently mainly in css/app.css.
- Main JavaScript is currently mainly in js/main.js.
- HTML preview rendering has been moved to js/render/html-preview.js.
- Template data has been moved to js/data/templates-data.js.

## Current priority

Refactor file organization safely before implementing the context selector.

## Browser target

Chrome / Chromium.

## Run command

python3 -m http.server 8000

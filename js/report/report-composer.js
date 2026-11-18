// @ts-nocheck
// ACT R1A — Report Composer, session-local selection surface.
// Reuses existing Workspace Index and Report Dictionary.
// Does NOT create a second parser, second Index, second editor, or second Save owner.

// ---------- Module-local Composer state (session-only) ----------
const initialState = {
  period: {
    startDate: '',
    endDate: '',
    inclusive: true,
  },

  includedDomains: {
    projects: true,
    tasks: true,
    notes: false,
  },

  selection: {
    projectIds: [],
    taskIds: [],
    notePaths: [],
  },

  workflow: {
    step: 'configure',
  },

  projection: {
    eligibleProjectIds: [],
    eligibleTaskIds: [],
    eligibleNotePaths: [],
    diagnostics: [],
  },
};

// Exported state (module-local, never persisted)
export const state = Object.freeze({ ...initialState });

// Helper: reset to defaults (called on reload / new workspace)
export const resetState = () => {
  Object.assign(state, initialState);
};

// ---- Period semantics -------------------------------------------------

// Inclusive boundaries: startDate <= recordDate <= endDate
// Both dates required before Build Selection; invalid period blocks it.

// ---- Domain eligibility -------------------------------------------------

// Project eligibility: at least one current recognized period field intersects
// the selected period:
//   - Expected Order; Expected Delivery; Expected Billing

// Task classifications relative to report endDate:
//   - open at period end;  due in period;  completed in period;
//   - overdue at period end (dueDate < endDate && !completed by endDate)

// Note eligibility:
//   Primary: recognized document date within period
//   Secondary: recognized filename/date convention (if already authoritative)
//   Undated: available for explicit selection in Undated/Manual group;
//            not automatically period-eligible

// ---- Selection identities (canonical, reused across rerenders) -----------

// Projects: current Project identity from Workspace Index
// Tasks: current stable Task identity
// Notes: normalized source path

// If a selected record disappears after Index refresh:
//   - diagnose as stale
//   - exclude from Build Selection
//   - do NOT silently retarget

// ---- Build Selection ----------------------------------------------------

// Read-only. Must:
//   - validate the period
//   - read current Workspace Index state
//   - reconcile selected identities with current records
//   - produce a selected Report Dictionary projection or bounded selection descriptor
//   - show selected counts and diagnostics
//   - NOT generate Markdown
//   - NOT open the editor
//   - NOT Save
//   - NOT mutate source records

// Reuse report-dictionary.js:
//   - Preferred: extend its input with an optional selection filter
//   - Smallest backward-compatible optional selection boundary
//   - Quick Report behavior unchanged when no selection filter supplied

// Result must expose (no generatedAt, no Markdown, no Save metadata):
//   period, included domains, selected identities,
//   eligible counts, selected counts, diagnostics,
//   source traceability

// ---- Empty / Error States -----------------------------------------------

// No Workspace:          Open a Workspace to compose a Report.
// Index building:         Preparing Workspace records…
// Invalid period:         Start date must be on or before End date.
// No matches:             No records match the selected period and domains.
// No selection:           Select at least one record before building.
// Stale records:          Diagnose and exclude; do NOT silently substitute.

// ---- UI Integration (Phase 6) -----------------------------------------

// Entry point: Report Sidebar surface exposes "Open Report Composer"
// Preserve Quick Report and Draw.io controls unchanged.

// One Expanded View with bounded sections:
//   HEADER: Back to Workspace | Report Composer | concise read-only status
//   PERIOD: Start/End date + inclusive explanation + validation message
//   DOMAINS: Projects | Tasks | Notes toggles
//   ELIGIBLE RECORDS: grouped by domain; eligible count; selected count;
//               Select eligible / Clear selection / native checkboxes
//   SELECTION REVIEW: selected counts / source traceability / Build Selection result

// Use native accessible controls:
//   - explicit labels on every date, domain toggle, record selection
//   - keyboard operable, visible focus, aria-live for validation/build status

// Keep surface compact — one Expanded View with bounded sections, no multi-route wizard.

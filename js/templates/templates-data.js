// @ts-nocheck
// Extracted template data.
(function () {
  const __TPL_ORG = [
    // ==========================
    // Editor templates
    // ==========================
    {
      id: 'editor_exec_brief',
      context: 'editor',
      name: '📝 Executive Brief',
      body: `# Executive Brief

Type: Brief
Status: draft
Tags:
Created:
Updated:

## Executive Summary
-

## Context
-

## Key Points
-
-
-

## Recommendation
-

## Risks / Considerations
-

## Next Steps
- [ ]

## Sources
-
`,
    },
    {
      id: 'editor_meeting_notes',
      context: 'editor',
      name: '📝 Meeting Notes',
      body: `# Meeting Notes

Type: Meeting
Status: active
Tags:
Created:
Updated:

## Meeting Details
Date:
Participants:
Topic:

## Agenda
-

## Notes
-

## Decisions
-

## Action Items
- [ ]

## Follow-up
-
`,
    },
    {
      id: 'editor_decision_record',
      context: 'editor',
      name: '📝 Decision Record',
      body: `# Decision Record

Type: Decision
Status: proposed
Tags:
Created:
Updated:

## Decision
-

## Context
-

## Options Considered
### Option 1
-

### Option 2
-

## Rationale
-

## Impact
-

## Risks
-

## Next Steps
- [ ]
`,
    },
    {
      id: 'editor_project_plan',
      context: 'editor',
      name: '📝 Project Plan',
      body: `# Project Plan

Type: Project
Status: active
Tags:
Created:
Updated:

## Objective
-

## Scope
-

## Workstreams
-

## Timeline
-

## Owners
-

## Risks / Dependencies
-

## Tasks
- [ ]

## Success Criteria
-
`,
    },
    {
      id: 'editor_research_notes',
      context: 'editor',
      name: '📝 Research Notes',
      body: `# Research Notes

Type: Research
Status: active
Tags:
Created:
Updated:

## Research Question
-

## Summary
-

## Findings
-

## Implications
-

## Open Questions
-

## Sources
-
`,
    },
    {
      id: 'editor_customer_market_brief',
      context: 'editor',
      name: '📝 Customer / Market Brief',
      body: `# Customer / Market Brief

Type: Brief
Status: active
Tags:
Created:
Updated:

## Overview
-

## Market / Customer Context
-

## Opportunity
-

## Challenges
-

## Strategic Fit
-

## Recommended Actions
- [ ]

## Sources
-
`,
    },
    {
      id: 'editor_competitive_note',
      context: 'editor',
      name: '📝 Competitive Note',
      body: `# Competitive Note

Type: Competitive Note
Status: active
Tags:
Created:
Updated:

## Competitor / Topic
-

## Summary
-

## What Changed
-

## Strengths
-

## Weaknesses
-

## Implications
-

## Response / Action
- [ ]

## Sources
-
`,
    },
    {
      id: 'editor_action_plan',
      context: 'editor',
      name: '📝 Action Plan',
      body: `# Action Plan

Type: Action Plan
Status: active
Tags:
Created:
Updated:

## Goal
-

## Actions
- [ ]

## Owners
-

## Timeline
-

## Risks
-

## Follow-up
-
`,
    },

    // ==========================
    // Journal templates
    // ==========================
    {
      id: 'journal_daily_capture',
      context: 'journal',
      name: '📓 Daily Capture',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Daily Capture — {{date}}

Tags:

## Plan
- [ ]

## Capture
-

## Decisions
-

## Tasks
- [ ]

## Links
-

## Review
-
`,
    },
    {
      id: 'journal_meeting_debrief',
      context: 'journal',
      name: '📓 Meeting Debrief',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Meeting Debrief

Tags:

## Meeting
Date:
Participants:
Topic:

## Summary
-

## Key Points
-

## Decisions
-

## Follow-up Tasks
- [ ]

## Related Concepts
-
`,
    },
    {
      id: 'journal_customer_conversation',
      context: 'journal',
      name: '📓 Customer Conversation',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Customer Conversation

Tags:

## Account / Customer
Account:
Region:
Participants:

## Conversation Summary
-

## Needs / Pain Points
-

## Opportunities
-

## Risks
-

## Follow-up
- [ ]

## Related Concepts
-
`,
    },
    {
      id: 'journal_partner_conversation',
      context: 'journal',
      name: '📓 Partner Conversation',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Partner Conversation

Tags:

## Partner
Partner:
Region:
Participants:

## Summary
-

## Joint Opportunity
-

## Dependencies
-

## Next Steps
- [ ]

## Related Concepts
-
`,
    },
    {
      id: 'journal_travel_event_notes',
      context: 'journal',
      name: '📓 Travel / Event Notes',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Event / Travel Notes

Tags:

## Event / Visit
Name:
Location:
Date:

## Key Observations
-

## People / Organizations
-

## Opportunities
-

## Follow-up
- [ ]

## Related Concepts
-
`,
    },
    {
      id: 'journal_weekly_planning',
      context: 'journal',
      name: '📓 Weekly Planning',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Weekly Planning

Tags:

## Focus Areas
-

## Key Outcomes
-

## Priority Tasks
- [ ]

## Meetings / Events
-

## Risks / Blockers
-

## Review Notes
-
`,
    },
    {
      id: 'journal_followup_log',
      context: 'journal',
      name: '📓 Follow-up Log',
      metadataType: 'journal',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Follow-up Log

Tags:

## Open Follow-ups
- [ ]

## Waiting For
-

## Completed
- [x]

## Notes
-
`,
    },

    // ==========================
    // Concept templates
    // ==========================
    {
      id: 'concept_general',
      context: 'concept',
      name: '🧠 General Concept',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# ConceptName

Tags:

## Summary
-

## Notes
-

## Related Concepts
-

## Tasks
- [ ]

## Sources
-
`,
    },
    {
      id: 'concept_account_profile',
      context: 'concept',
      name: '🧠 Account / Customer Profile',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# AccountName

Tags:

Region:
Segment:
Key Contacts:
Opportunity Stage:
Owner:
Next Step:

## Summary
-

## Business Context
-

## Needs / Pain Points
-

## Opportunities
-

## Stakeholders
-

## Risks
-

## Next Steps
- [ ]

## Sources
-
`,
    },
    {
      id: 'concept_opportunity_brief',
      context: 'concept',
      name: '🧠 Opportunity Brief',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# OpportunityName

Tags:

Account:
Region:
Stage:
Owner:
Next Step:

## Summary
-

## Problem / Need
-

## Proposed Solution
-

## Business Impact
-

## Decision Process
-

## Risks / Dependencies
-

## Next Steps
- [ ]

## Sources
-
`,
    },
    {
      id: 'concept_partner_profile',
      context: 'concept',
      name: '🧠 Partner Profile',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# PartnerName

Tags:

Region:
Relationship Owner:
Opportunity Area:
Next Step:

## Summary
-

## Capabilities
-

## Joint Opportunities
-

## Dependencies
-

## Risks
-

## Next Steps
- [ ]

## Sources
-
`,
    },
    {
      id: 'concept_product_feedback',
      context: 'concept',
      name: '🧠 Product Feedback',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Product Feedback — Topic

Tags:

Source:
Account:
Region:
Priority:

## Summary
-

## Feedback Details
-

## Business Impact
-

## Examples / Evidence
-

## Related Concepts
-

## Follow-up
- [ ]
`,
    },
    {
      id: 'concept_market_region_note',
      context: 'concept',
      name: '🧠 Market / Region Note',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Market / Region Note

Tags:

Region:
Segment:

## Summary
-

## Market Context
-

## Trends
-

## Opportunities
-

## Risks
-

## Key Accounts / Partners
-

## Sources
-
`,
    },
    {
      id: 'concept_competitor_profile',
      context: 'concept',
      name: '🧠 Competitor Profile',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# CompetitorName

Tags:

Region:
Segment:

## Summary
-

## Positioning
-

## Strengths
-

## Weaknesses
-

## Recent Activity
-

## Implications
-

## Sources
-
`,
    },
    {
      id: 'concept_stakeholder_map',
      context: 'concept',
      name: '🧠 Stakeholder Map',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Stakeholder Map — Account / Initiative

Tags:

Account:
Region:
Owner:

## Stakeholders
-

## Influence / Role
-

## Needs / Concerns
-

## Engagement Plan
-

## Next Steps
- [ ]
`,
    },
    {
      id: 'concept_playbook_process_note',
      context: 'concept',
      name: '🧠 Playbook / Process Note',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Playbook — Topic

Tags:

## Purpose
-

## When to Use
-

## Process
-

## Checklist
- [ ]

## Examples
-

## Related Concepts
-
`,
    },
    {
      id: 'concept_feature_product_concept',
      context: 'concept',
      name: '🧠 Feature / Product Concept',
      metadataType: 'concept',
      metadata: {
        status: 'active',
        tags: [],
      },
      body: `# Feature / Product Concept

Tags:

Owner:
Status:

## Summary
-

## User / Customer Need
-

## Proposed Behavior
-

## Business Value
-

## Dependencies
-

## Open Questions
-

## Tasks
- [ ]
`,
    },
  ];

  const __TPL_PANDOC_ORG = [
    {
      id: 'pandoc_title_slide',
      name: '📊 Title Slide — Title + Subtitle',
      body: `# Strategy Proposal

<!-- Target PPT layout: Title Slide -->
<!-- Source layout: title -->

- Market expansion, product acceleration, and execution roadmap
- Business Development Team
- 2026-05-26

::: notes
Opening context and presenter introduction.
:::
`,
    },
    {
      id: 'pandoc_agenda',
      name: '📊 Agenda — Bullet List',
      body: `# Agenda

<!-- Target PPT layout: Agenda -->
<!-- Source layout: agenda -->

- Executive summary and recommendation
- Market opportunity and customer demand signals
- Strategic options and trade-offs
- Product and go-to-market priorities
- Execution roadmap and next steps

::: notes
Briefly explain the structure of the presentation.
:::
`,
    },
    {
      id: 'pandoc_exec_summary',
      name: '📊 Executive Summary — Key Points',
      body: `# Executive Summary

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Clear growth opportunity exists in priority customer segments with strong demand signals.
- Product innovation is needed to sustain differentiation and improve time-to-value.
- Go-to-market execution should focus on faster validation, partner leverage, and clearer prioritization.
- Recommended path combines focused market expansion with AI-enabled product acceleration.

::: notes
State the recommendation early and make the business implication clear.
:::
`,
    },
    {
      id: 'pandoc_growth_strategy',
      name: '📊 Growth Strategy — Two Columns',
      body: `# Growth Strategy

<!-- Target PPT layout: Two Content -->
<!-- Source layout: twocols -->

:::: {.columns}
::: {.column}
## Market / GTM
- Expand priority customer segments with measurable pipeline potential.
- Strengthen partner-led motion to reduce acquisition friction.
- Focus regional execution on markets with clear demand signals.
- Improve account prioritization using data-driven opportunity scoring.
:::

::: {.column}
## Product / Execution
- Accelerate AI-enabled product capabilities for high-value workflows.
- Simplify user experience across onboarding, reporting, and daily execution.
- Consolidate platform capabilities to reduce complexity.
- Shorten release cycles to improve learning speed and customer feedback loops.
:::
::::

::: notes
Use this slide to show the balanced strategy across market and product.
:::
`,
    },
    {
      id: 'pandoc_market_opportunity',
      name: '📊 Market Opportunity — Image + Text',
      body: `# Market Opportunity

<!-- Target PPT layout: Image Left + Text Right -->
<!-- Source layout: image-text -->

../assets/images/market-opportunity.png

- Local demand for scalable digital infrastructure continues to increase.
- AI workloads create additional pressure for performance, reliability, and governance.
- Customers want solutions that reduce complexity while improving decision speed.
- Partner ecosystem can accelerate adoption if the value proposition is specific and easy to explain.
- Initial validation should focus on high-intent segments before broader expansion.

::: notes
Explain the demand signals and why the market is attractive now.
:::
`,
    },
    {
      id: 'pandoc_product_roadmap',
      name: '📊 Product Roadmap — Text + Image',
      body: `# Product Roadmap

<!-- Target PPT layout: Text Left + Image Right -->
<!-- Source layout: text-image -->

- Simplify core workflows to reduce time-to-value for new users.
- Add AI-assisted decision support where users already experience repeated manual work.
- Improve executive visibility through better reporting and clearer business metrics.
- Prioritize fewer, higher-impact releases instead of a broad list of disconnected features.
- Use customer feedback loops to validate adoption before scaling investment.

../assets/images/product-roadmap.png

::: notes
Connect roadmap priorities to customer value and execution focus.
:::
`,
    },
    {
      id: 'pandoc_exec_priorities',
      name: '📊 Key Execution Priorities — Dense Bullets',
      body: `# Key Execution Priorities

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: bullets-2 -->

- Market growth
- Segment expansion
- AI-enabled features
- UX improvement
- Pricing optimization
- Partner ecosystem
- Operational efficiency
- Better reporting
- Pipeline governance
- Customer success enablement

::: notes
Use this slide when you need a compact priority overview.
:::
`,
    },
    {
      id: 'pandoc_strategic_options',
      name: '📊 Strategic Options — Three Columns',
      body: `# Strategic Options

<!-- Target PPT layout: Three Content -->
<!-- Source layout: threecols -->

:::: {.columns}
::: {.column}
## Option A
- Focused market validation
- Fast to implement
- Lower investment requirement
- Best for reducing uncertainty early
:::

::: {.column}
## Option B
- Balanced growth and product acceleration
- Medium implementation complexity
- Stronger cross-functional impact
- Best balance of speed, risk, and upside
:::

::: {.column}
## Option C
- Aggressive expansion
- Highest upside potential
- Higher execution risk
- Requires stronger funding, governance, and operational capacity
:::
::::

::: notes
Present the trade-offs and position the recommended option.
:::
`,
    },
    {
      id: 'pandoc_operating_model',
      name: '📊 Operating Model Overview — 2x2 Grid',
      body: `# Operating Model Overview

<!-- Target PPT layout: Four Content -->
<!-- Source layout: grid2 -->

| Area | Focus |
|---|---|
| Market | Focus on priority segments with clear demand signals, measurable pipeline, and partner leverage. |
| Product | Accelerate AI and UX roadmap delivery while reducing platform complexity. |
| Operations | Simplify decision cadence, clarify ownership, and improve execution visibility. |
| Financials | Improve margin discipline, investment prioritization, and ROI tracking. |

::: notes
Use this to summarize operating model implications.
:::
`,
    },
    {
      id: 'pandoc_revenue_kpi',
      name: '📊 Revenue Growth Potential — KPI',
      body: `# Revenue Growth Potential

<!-- Target PPT layout: KPI / Big Number -->
<!-- Source layout: kpi -->

## 42%

Expected growth potential over the planning horizon based on focused market expansion, product adoption, and partner-led go-to-market execution.

## Drivers
- Segment expansion
- AI-enabled product adoption
- Partner-led go-to-market
- Improved customer retention

::: notes
Explain the number, the assumption behind it, and the key growth drivers.
:::
`,
    },
    {
      id: 'pandoc_option_comparison',
      name: '📊 Option Comparison — Table',
      body: `# Option Comparison

<!-- Target PPT layout: Title and Table -->
<!-- Source layout: table -->

| Criteria | Option A | Option B | Option C |
|---|---|---|---|
| Cost | Low | Medium | High |
| Speed | Fast | Medium | Slow |
| Impact | Medium | High | Very High |
| Risk | Low | Medium | High |
| Governance need | Low | Medium | High |
| Recommended use | Validation | Balanced scale | Aggressive expansion |

::: notes
Use this slide to support decision-making and trade-off discussion.
:::
`,
    },
    {
      id: 'pandoc_architecture_view',
      name: '📊 Architecture View — Image + Caption',
      body: `# Architecture View

<!-- Target PPT layout: Image with Caption -->
<!-- Source layout: image-caption -->

../assets/images/architecture-view.png

The target architecture should support scale, observability, integration readiness, and faster product experimentation.

::: notes
Use this slide for system, operating model, or solution architecture.
:::
`,
    },
    {
      id: 'pandoc_recommendation',
      name: '📊 Recommendation — Section Divider',
      body: `# Recommendation

<!-- Target PPT layout: Section Header -->
<!-- Source layout: section -->

Focused expansion with accelerated AI product delivery

::: notes
Transition from analysis to recommendation.
:::
`,
    },
    {
      id: 'pandoc_key_message',
      name: '📊 Key Message — Highlight',
      body: `# Key Message

<!-- Target PPT layout: Highlight / Quote -->
<!-- Source layout: highlight -->

The best path is to combine focused market expansion with product simplification and AI-enabled differentiation.

::: notes
Use this as a memorable takeaway slide.
:::
`,
    },
    {
      id: 'pandoc_next_steps',
      name: '📊 Next Steps — Action List',
      body: `# Next Steps

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Validate the recommended option with priority stakeholders.
- Confirm target segments, success metrics, and investment guardrails.
- Build a 90-day execution plan with clear owners and decision checkpoints.
- Prepare a follow-up review to assess early results and adjust priorities.

::: notes
Close with owners, decisions, and timing.
:::
`,
    },
    {
      id: 'pandoc_account_snapshot',
      name: '📊 Customer / Account Snapshot — Profile Card',
      body: `# Customer / Account Snapshot

<!-- Target PPT layout: Title and Two Content -->
<!-- Source layout: account-snapshot -->

## Profile
- Account:
- Region:
- Segment:
- Current status:

## Opportunity
- Need:
- Business value:
- Next step:

::: notes
Use this for customer, account, partner, or region snapshots.
:::
`,
    },
    {
      id: 'pandoc_decision_slide',
      name: '📊 Decision Slide — Recommendation + Rationale',
      body: `# Decision

<!-- Target PPT layout: Title and Two Content -->
<!-- Source layout: decision -->

## Recommendation
-

## Rationale
- Reason 1
- Reason 2
- Reason 3

## Alternatives
-

::: notes
Use this when a decision is required from leadership or stakeholders.
:::
`,
    },
    {
      id: 'pandoc_risks_table',
      name: '📊 Risks / Dependencies — Table',
      body: `# Risks / Dependencies

<!-- Target PPT layout: Title and Table -->
<!-- Source layout: risks-table -->

| Risk / Dependency | Impact | Owner | Mitigation |
|---|---|---|---|
|  |  |  |  |

::: notes
Use this for governance, delivery, or execution risk discussions.
:::
`,
    },
    {
      id: 'pandoc_timeline',
      name: '📊 Timeline / Roadmap — Horizontal Timeline',
      body: `# Timeline / Roadmap

<!-- Target PPT layout: Timeline -->
<!-- Source layout: timeline -->

## Phases
- Phase 1 — Discovery — Owner — Date
- Phase 2 — Pilot — Owner — Date
- Phase 3 — Scale — Owner — Date

## Key Milestones
- Milestone 1
- Milestone 2
- Milestone 3

::: notes
Use this for roadmap, launch plan, implementation plan, or project phasing.
:::
`,
    },
  ];

  try {
    window.__TPL_ORG = __TPL_ORG;
    window.__TPL_PANDOC_ORG = __TPL_PANDOC_ORG;

    globalThis.__TPL_ORG = __TPL_ORG;
    globalThis.__TPL_PANDOC_ORG = __TPL_PANDOC_ORG;
  } catch {}
})();

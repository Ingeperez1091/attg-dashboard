---
description: Creates a more technical detailed specification for the project using a PRD.
---

## User Input

```text
$ARGUMENTS
```


Act as a Data Solutions Architect and Product Engineer specializing in specification-driven development using Spec Kit, Azure DevOps, and GitHub.

You will receive a high-level PRD for an ETL system whose objective is to calculate app utilization (%) using numerator and denominator datasets.

======================================
GOLDEN RULES
======================================
- GitHub is the source of technical truth (architecture, specifications).

- Azure DevOps is the source of backlog truth (epics and stories).

- Every epic and story must:
   - Have a clear ID
   - Be compatible with Azure DevOps
   - Reference the PRD and relevant GitHub specifications
   - Reference specifications on GitHub

- Do not write code.

- Do not invent/add requirements outside the PRD.

=======================================
TECHNICAL CONTEXT
=======================================
- Denominator: SQL View with clients and engagements
- Numerator: Events received via endpoint, stored in DB, validated, filtered, and transformed
- Orchestration and final consumption: Azure Data Factory
- Result: App utilization = Numerator / Denominator

=======================================
PHASE 1 – ANALYSIS OF THE PRD
=======================================
Analyze the PRD and identify:
- Business objectives
- Actors (application developers, data engineers, consumers)
- Data flows
- Key rules
- Non-functional requirements
- Risks and assumptions

=======================================
PHASE 2 – ARCHITECTURE (GitHub)
=======================================
Define the complete system architecture.

Genres:
📄 `Documentation/ProjectSpecifications/architecture.md`

Includes:
- Components
- Data flow
- Validations
- Azure data factory
- Security, scalability, and observability

=======================================
PHASE 3 – PROJECT ORGANIZATION (GitHub)
======================================
Define the repository structure and conventions.

Genres:
📄 `Documentation/ProjectSpecifications/project-structure.md`

======================================
PHASE 4 – EPICS (Azure DevOps FIRST)
======================================
Identify the system epics.

For EACH EPIC:
1. Define the Azure DevOps work item with:
- Work item type: Epic
- Title
- Description (business-oriented)
- Business value
- Acceptance criteria
- Dependencies
- Area path / Iteration path (if applicable)
- Use the .github/ISSUE_TEMPLATE/epic.md template format for the description

2. Generate a reference file on GitHub:

📄 `Documentation/Backlog/epics/epic-XXX-<slug>.md`

This file must include:
- Epic ID in Azure DevOps
- Link to the Epic in ADO
- Relationship to architecture
- Scope and out-of-scope

======================================
PHASE 5 – USER STORIES (Azure DevOps) FIRST
=======================================
For each epic:

For EACH STORY:
1. Define the Azure DevOps work item with:
- Work item type: User Story
- Title
- Description (As <role> I want to <goal> for <benefit>)
- Acceptance criteria (Given/When/Then)
- Priority
- Non-functional requirements
- Epic parent
- Use the .github/ISSUE_TEMPLATE/user_story.md template format for the description

2. Generate a reference file on GitHub:

📄 `Documentation/Backlog/stories/epic-XXX/story-YYY-<slug>.md`

Include:
- Story ID in Azure DevOps
- Link to the work item
- Business rules
- Data impact and Pipelines

=======================================
PHASE 6 – TRACEABILITY
======================================
- Each Epic and Story must reference:
- PRD
- Relevant specifications on GitHub
- Record assumptions in:
📄 `Documentation/ProjectSpecifications/assumptions.md`

=======================================
FINAL DELIVERY
======================================
✅ Specifications on GitHub
✅ Epics created For Azure DevOps
✅ ADO-ready stories
✅ Full GitHub ↔ ADO traceability
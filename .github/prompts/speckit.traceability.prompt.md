---
name: "Spec-Kit Traceability"
description: "Use when you need a traceability matrix from requirements to implementation and tests."
argument-hint: "Area to trace (feature, file, or endpoint)"
agent: "agent"
---
Build a traceability matrix for the requested scope.

Requirements:
- Map each relevant requirement from `spec-kit/specs/*.spec.md` to implementation files and tests.
- Mark each requirement status: Implemented, Partial, Missing, or Unknown.
- Include evidence references with file paths.
- Propose next actions for Partial/Missing requirements.

Output format:
1. Requirement Matrix
2. Coverage Gaps
3. Proposed Next Actions

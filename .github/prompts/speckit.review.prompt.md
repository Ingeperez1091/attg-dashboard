---
name: "Spec-Kit Review"
description: "Use when you want a code or design review against Spec-Kit requirements and gaps."
argument-hint: "What to review"
agent: "agent"
---
Review the requested code, design, or change for compliance with Spec-Kit.

Requirements:
- Use `spec-kit/constitution.md` and `spec-kit/specs/*.spec.md` as the source of truth.
- Prioritize findings: bugs, requirement mismatches, security gaps, and test coverage gaps.
- Include concrete file references for each finding.
- If no issues are found, explicitly state that and list residual risks.

Output format:
1. Findings (ordered by severity)
2. Spec Mappings
3. Open Questions
4. Recommended Fixes

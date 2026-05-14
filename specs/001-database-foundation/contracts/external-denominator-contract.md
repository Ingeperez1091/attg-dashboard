# Contract: External Mercury Denominator Access

## Purpose

Defines what this feature must verify about the external Mercury denominator dependency.

## External Object

- `vw_USTaxBTS_FY26_MaxACD`

## Ownership Boundary

- Managed by Mercury in an external database
- Not created, altered, or versioned by this feature

## Inputs

- Mercury-provided connection details
- Mercury-provided credentials or approved authentication path
- network access from the deployment or integration environment

## Required Validation

- connection to the external database succeeds
- a read query against `vw_USTaxBTS_FY26_MaxACD` succeeds
- required columns needed by downstream processing are available
- connection failure produces an actionable deployment error

## Expected Consumer Columns

    - [AccountingCycleDate]
    - [EngagementID]
    - [Engagement]
    - [ClientID]
    - [Client]
    - [AccountChannel]
    - [EngagementSubServiceLine]
    - [EngagementServiceCode]
    - [EngagementService]
    - [EngagementStatus]
    - [CreationDate]
    - [ReleaseDate]
    - [ETD_ANSRAmt]
    - [FYTD_ANSRAmt]
    - [ETD_TERAmt]
    - [FYTD_TERAmt]
    - [ETD_ChargedHours]
    - [FYTD_ChargedHours]

## Out of Scope

- reproducing Mercury business logic locally
- copying denominator rows into local storage in this feature
- performance tuning of Mercury-owned objects
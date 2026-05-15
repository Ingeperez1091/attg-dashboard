# Contract: Local Schema Foundation

## Purpose

Defines the local database objects this feature must create inside the application-owned Azure SQL database.

## Inputs

- Clean or upgradable Azure SQL application database
- Deployment identity with schema change permission
- Agreed fixed GUIDs or deterministic seed keys for reference data

## Outputs

The implementation must create:

- `app.Applications`
- `app.Roles`
- `app.Users`
- `app.UserRoles`
- `app.UserApplications`
- `stage.EngagementUsageRaw`

## Required Behaviors

- All mutable `app` tables include `CreateDate`, `CreatedBy`, `UpdateDate`, `UpdatedBy`
- `stage.EngagementUsageRaw` preserves raw JSON payloads before processing
- user-to-role enforcement supports exactly one role per user
- user-to-application assignments prevent duplicates
- scripts are idempotent or safely repeatable through the chosen migration mechanism

## Validation

- schema objects exist
- primary and foreign keys exist
- unique constraints enforce business identity
- audit fields are present on required tables

## Out of Scope

- Creating the Mercury denominator view locally
- Implementing downstream validation, filtering, or metric calculation logic
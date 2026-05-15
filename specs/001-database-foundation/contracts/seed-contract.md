# Contract: Seed Data

## Purpose

Defines the minimum deterministic seed data required for the MVP database foundation.

## Inputs

- Local schema foundation already deployed

## Outputs

### Applications

Exactly five seeded applications:

- Maestro
- EYST
- Prodigy
- Vector
- Navigate

Each application must include:

- `ApplicationId`
- `ApplicationName`
- `AdoptionLevel`
- `MatchKey`
- `ServiceLine`
- `SubServiceLine`
- `IsActive`
- audit fields

### Roles

Exactly three seeded roles:

- `administrator`
- `application_owner`
- `viewer`

### Users and assignments

One seeded super-admin user with:

- one assigned role: `administrator`
- assignments to all five applications

## Idempotency Rules

- rerunning seed scripts must not duplicate applications
- rerunning seed scripts must not duplicate roles
- rerunning seed scripts must not duplicate the super-admin
- rerunning seed scripts must not duplicate user-to-application assignments

## Validation

- counts remain stable after two runs
- seeded entities remain queryable by stable business keys
- seeded user has exactly one role and full application scope
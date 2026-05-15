# Contract Validation Checklist

## Database Foundation Contracts

- Local objects exist in `app` and `stage` schemas
- PK/FK/UNIQUE constraints are present
- Audit columns are present on mutable tables
- Staging table keeps raw payload unchanged
- External denominator required columns are validated
- Seed baseline entities are present

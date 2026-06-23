SET NOCOUNT ON;

-- ============================================================
-- Migration 032: Create app.ConfigVersions
-- Purpose: Tracks per-application, per-scope rule configuration
--          version for optimistic concurrency control.
-- ============================================================

:r ..\schema\app\ConfigVersions.sql

-- Seed one row per (ApplicationId × 2 scopes) for all 5 MVP applications
-- Uses MERGE to be idempotent on re-run
MERGE app.ConfigVersions AS target
USING (
    VALUES
        ('10000000-0000-0000-0000-000000000001', 'Denominator'),
        ('10000000-0000-0000-0000-000000000001', 'Numerator'),
        ('10000000-0000-0000-0000-000000000002', 'Denominator'),
        ('10000000-0000-0000-0000-000000000002', 'Numerator'),
        ('10000000-0000-0000-0000-000000000003', 'Denominator'),
        ('10000000-0000-0000-0000-000000000003', 'Numerator'),
        ('10000000-0000-0000-0000-000000000004', 'Denominator'),
        ('10000000-0000-0000-0000-000000000004', 'Numerator'),
        ('10000000-0000-0000-0000-000000000005', 'Denominator'),
        ('10000000-0000-0000-0000-000000000005', 'Numerator')
) AS source (ApplicationId, RuleScope)
ON target.ApplicationId = source.ApplicationId AND target.RuleScope = source.RuleScope
WHEN NOT MATCHED THEN
    INSERT (ApplicationId, RuleScope, Version, LastModifiedBy, LastModifiedAt)
    VALUES (source.ApplicationId, source.RuleScope, 1, 'SYSTEM', SYSUTCDATETIME());

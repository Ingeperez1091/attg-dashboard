# External Mercury Access Validation

## Purpose

Validate read access to `vw_USTaxBTS_FY26_MaxACD` without creating local replicas.

## Required Inputs

- Mercury-provided host/database name
- Mercury-provided credentials or approved auth method
- Network access from execution environment

## Validation Steps

1. Open a SQL session against Mercury database context.
2. Run:

```sql
SELECT TOP (10) *
FROM vw_USTaxBTS_FY26_MaxACD;
```

3. Run contract projection test from `tests/contract/database-foundation/us3-external-denominator.contract.sql`.

## Scripted Execution

Use the provided runner to execute the validation against a Mercury-connected environment.

### Trusted connection

```powershell
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -UseTrustedConnection
```

### Trusted connection with a different Windows user

```powershell
$credential = Get-Credential "DOMAIN\\username"
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -UseTrustedConnection -Credential $credential
```

Use this when you need integrated authentication but must connect as a different AD account than the current machine session.

### SQL authentication

```powershell
$credential = Get-Credential
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>" -Credential $credential
```

### Environment variable authentication

```powershell
$env:MERCURY_SQL_USER = "<user>"
$env:MERCURY_SQL_PASSWORD = "<password>"
.\scripts\database\run-mercury-validation.ps1 -Server "<server-name>" -Database "<database-name>"
```

## Failure Handling

- Authentication failure: verify credentials and auth mode.
- Network failure: verify firewall/VNet routes and allowlists.
- Object/column mismatch: coordinate with Mercury owner team.

# BTS Quarterly Metrics - Automated Solution Architecture

## Executive Summary

This document describes a conceptual architecture for measuring EY application adoption rates across tax engagements. The solution calculates:

```
Adoption % = Numerator / Denominator
```

Where:
- **Denominator** = Mercury engagement data, filtered by business rules to create the "addressable population"
- **Numerator** = Application data (engagements or clients in each EY application)

### Applications in Scope

| Application | Purpose | Adoption Level | Numerator Source |
|-------------|---------|----------------|------------------|
| Maestro | Private Client Services workflow | Engagement | Auto-generated from app |
| EYST | Family Tax & Trust Services | Client | Manual classification |
| Prodigy | R&D Tax Credit management | Client | Auto-generated from app |
| Vector | Tax technology engagement tracking | Engagement | Manual tracking spreadsheet |
| Navigate | US Financial Planner Line workflow | Engagement | Manual classification |

> **Key Distinction**: Prodigy and EYST measure **client adoption** (unique clients), while Maestro, Vector, and Navigate measure **engagement adoption**.

---

## The Business Rules Problem

Currently, business rules fall into two distinct categories:

### Denominator Rules (Filter the Mercury Data)

These rules reduce the Mercury engagement list to the "addressable population" - the denominator for adoption calculations. They are consistent, repeatable criteria applied to Mercury data.

| Rule Type | Example | How Applied |
|-----------|---------|-------------|
| Service Code | Include only `11420` | Simple lookup |
| Release Date | After `01/01/2025` | Date comparison |
| Engagement Status | `Closing`, `Completed`, `Pre-Closing`, `Released` | List membership |
| Minimum Revenue | ETD > $0 or ETD > $10,000 | Numeric threshold |
| Name Exclusion | Exclude `pof`, `perseus`, `pt`, `ITR`, `BTA`, `Bison` | Pattern matching |
| Name Inclusion | Include only names containing `FTTS` | Pattern matching |
| Account Channel | Channel `2` only | Simple lookup |

**These rules can be managed through a simple configuration interface.**

### Numerator Data (Application Population)

The numerator represents which engagements or clients are "in" each application. This data comes from two sources:

**Auto-Generated (from application systems)**
| Application | What the system provides |
|-------------|-------------------------|
| Maestro | List of Engagement IDs actively using Maestro |
| Prodigy | List of Client IDs with Prodigy engagements |

**Manually Classified (spreadsheet-driven)**
| Application | Classification Need | Current Source |
|-------------|---------------------|----------------|
| Navigate | Is this engagement using Navigate? (Navigate / Non-Navigate / Inactive) | Multi-tab Excel workbook maintained by business |
| EYST | Is this client actively using EYST? (Yes / No) | ShareTrust export with manual flags |
| Vector | Is this a Vector engagement? (Yes / No) | Manually maintained tracking spreadsheet |

**The manual classifications require a spreadsheet upload mechanism.**

---

## Proposed Architecture

### High-Level Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│   │  DENOMINATOR     │    │  NUMERATOR       │    │  NUMERATOR       │   │
│   │  Mercury Data    │    │  (Auto)          │    │  (Auto)          │   │
│   │                  │    │                  │    │                  │   │
│   │  Weekly refresh  │    │  Maestro API     │    │  Navigate API    │   │
│   │  from reporting  │    │  Prodigy API     │    │  EYST API        │   │
│   │  system          │    │                  │    │  Vector API      │   │
│   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘   │
│            │                       │                       │              │
└────────────┼───────────────────────┼───────────────────────┼──────────────┘
             │                       │                       │
             ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING LAYER                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                DENOMINATOR: Apply Business Rules                 │     │
│   │                                                                  │     │
│   │   Mercury Data  ──►  Apply Service Code Filter                   │     │
│   │                 ──►  Apply Date Filter                           │     │
│   │                 ──►  Apply Status Filter                         │     │
│   │                 ──►  Apply Revenue Filter                        │     │
│   │                 ──►  Apply Name Patterns                         │     │
│   │                                                                  │     │
│   │                      = Addressable Population (Denominator)      │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                                    │                                       │
│                                    ▼                                       │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                    MATCH: Numerator to Denominator               │     │
│   │                                                              ◄───┼───┘
│   │   Denominator (Addressable Population)                           │
│   │         ∩                                                        │
│   │   Numerator (App Data / Classifications)                         │
│   │         =                                                        │
│   │   Matched (by Engagement ID or Client ID)                        │
│   └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│                                    ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │                    CALCULATE METRICS                             │    │
│   │                                                                  │    │
│   │   Engagement-Level:  Matched Engagements / Denominator Engmts    │    │
│   │   Client-Level:      Matched Clients / Denominator Clients       │    │
│   │   Revenue:           Matched Revenue / Denominator Revenue       │    │
│   └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                              │
├────────────────────────────────────────────────────────────────────────────┤
│   Dashboard  │  Excel Reports  │  Historical Tracking                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Numerator Data: The Spreadsheet Challenge

Currently, for applications where numerator data is manually maintained, business owners use spreadsheets:

| Application | Current Spreadsheet | Structure |
|-------------|---------------------|-----------|
| Navigate | `EY Navigate engagements_v3_July2025.xlsx` | Multiple tabs: "New Navigate", "Old Navigate", "New Non-Nav", etc. |
| EYST | `FTTS FY25 EYST Adoption Analysis.xlsx` | Sheet with `EYST Active Client` flag column |
| Vector | `Vector Engagements-01.21.2026_source.xlsx` | Manual tracking with Yes/No indicators |

### The Problem

1. **No standard format** - Each application uses different column names, structures, and conventions
2. **Multi-tab complexity** - Navigate uses tab membership to indicate classification
3. **Stale data** - Classifications become outdated as engagements change
4. **No validation** - Users can enter invalid Engagement IDs or Client IDs
5. **Version confusion** - Multiple versions of spreadsheets may exist

### Proposed Solution: 

## API ingest Approach: 

For maximum flexibility, the system could expose an endpoint to receive the numerator data in Json format for applications. Each upload of data should be stored in a stage table and then it can be processed:

- Validate
- Filter
- Calculate Metrics

The endpoint should just receive the data and store it in database, then in an asynchronous flow it must be validated, filtered and the metrics should be recalculated

Each application will have a set of filtering rules associated
```
┌───────────────────────────────────────────────────────────────────┐
│  Set Numerator filer:                                             │
│                                                                   |
│ Application: [Maestro ▼]                                          |
│                                                                   |
| [ Region ]         [ = ]      [ US      ]                         |
| [ Health Status ]  [ IN ]     [ GREEN,YELLOW ]                    |
| [ Budget ]         [ >= ]     [ 20000   ]                         │
│                                                                   │
│                                                                   │
│             [Save]    [Cancel]                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

#### Existing Applications:

Currently we have 5 applications:

- Navigate
- Vector
- EYST
- Maestro
- Prodigy

Each application have the following required properties:

  - ServiceLine
  - SubServiceLine
  - ApplicationName
  - IsActive


#### Payload Template by Application

**Navigate Template**
| Column | Source | Editable |
|--------|--------|----------|
| Engagement ID | Denominator | No |
| Client ID | Denominator | No |
| Client Name | Denominator | No |
| Engagement Name | Denominator | No |
| Revenue (FYTD) | Denominator | No |
| **Navigate Status** | Numerator (User Input) | **Yes** |
| Notes | User Input | Yes |

Valid values for Navigate Status: `Navigate`, `Non-Navigate`, `Inactive`, `Not Classified`

**EYST Template**
| Column | Source | Editable |
|--------|--------|----------|
| Client ID | Denominator | No |
| Client Name | Denominator | No |
| Engagement Count | Denominator | No |
| Total Revenue (ETD) | Denominator | No |
| **EYST Active** | Numerator (User Input) | **Yes** |
| **EYST Data Cleanup Active** | Numerator (User Input) | **Yes** |
| Notes | User Input | Yes |

Valid values: `Yes`, `No`

**Prodigy Template** (if needed for manual overrides)
| Column | Source | Editable |
|--------|--------|----------|
| Client ID | Denominator | No |
| Client Name | Denominator | No |
| Engagement Count | Denominator | No |
| Total Revenue (FYTD) | Denominator | No |
| **In Prodigy** | Numerator (Auto from API) | No (display only) |
| **Override** | User Input | Yes |
| Notes | User Input | Yes |


## Denominator Rules Configuration

For configuring the filter rules that define the addressable population (Denominator):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Application: [Maestro ▼]                                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ DENOMINATOR RULES (Filter Mercury Data)                         │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                 │    │
│  │ Service Codes:     [11420        ]  [+ Add]                     │    │
│  │                                                                 │    │
│  │ Release Date After: [01/01/2025  📅]                           │    │
│  │                                                                 │    │
│  │ Engagement Status:                                              │    │
│  │   [✓] Closing  [✓] Completed  [✓] Pre-Closing  [✓] Released   │   │
│  │   [ ] Cancelled  [ ] Draft  [ ] Other                           │    │
│  │                                                                 │    │
│  │ Minimum Revenue (ETD): [$0      ] (exclusive)                   │    │
│  │                                                                 │    │
│  │ Exclude names containing:                                       │    │
│  │   [pof] [×]  [perseus] [×]  [pt] [×]  [ITR] [×]  [+ Add]        │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ ADOPTION SETTINGS                                               │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                 │    │
│  │ Adoption Level:  (●) Engagement  ( ) Client                     │    │
│  │                                                                 │    │
│  │ Revenue Metric:  [ANSR/Tech Revenue ETD ▼]                      │    │
│  │                                                                 │    │
│  │ Numerator Source:  (●) API/System  ( ) Spreadsheet Upload       │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  Denominator Preview: 2,909 engagements | $162.05M revenue              │
│                                                                         │
│  [Save Configuration]                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Current Application Rules Summary

### Maestro (Engagement-Level, API Numerator)

| Setting | Value |
|---------|-------|
| **Denominator Rules** | |
| Service Code | `11420` |
| Release Date | After `01/01/2025` |
| Exclude Names | `pof`, `perseus`, `pt`, `ITR`, `BTA`, `Bison` |
| Min Revenue (ETD) | > $0 |
| Status | Closing, Completed, Pre-Closing, Released |
| **Numerator** | |
| Match Key | Engagement ID |
| Source | Maestro system export (auto) |

### Prodigy (Client-Level, API Numerator)

| Setting | Value |
|---------|-------|
| **Denominator Rules** | |
| Service Code | `10676` |
| Release Date | After `01/01/2024` |
| Min Revenue (ETD) | > $0 |
| **Numerator** | |
| Match Key | Client ID |
| Source | Prodigy system export (auto) |

### Navigate (Engagement-Level, API Numerator)

| Setting | Value |
|---------|-------|
| **Denominator Rules** | |
| Service Code | `10469` |
| **Numerator** | |
| Match Key | Engagement ID |
| Source | **API** |
| Classification Values | Navigate, Non-Navigate, Inactive, Not Classified |

### EYST (Client-Level, API Numerator)

| Setting | Value |
|---------|-------|
| **Denominator Rules** | |
| Service Codes | `10459`, `11420`, `10170`, `10466` |
| Name Contains | `FTTS` |
| Exclude Status | Cancelled |
| **Numerator** | |
| Match Key | Client ID |
| Source | **API** |
| Classification Values | Yes, No |

### Vector (Engagement-Level, Manual Numerator)

| Setting | Value |
|---------|-------|
| **Denominator Rules** | |
| Service Codes | `10675`, `10677` |
| Account Channel | `2` |
| Release Date | After `01/01/2024` |
| Min Revenue (ETD) | > $10,000 |
| Status | Closing, Completed, Pre-Closing, Released |
| **Numerator** | |
| Match Key | Engagement ID |
| Source | **API** |

---

## Numerator Rules Configuration

Each application:

   - Has a different dataset structure
   - Has different filtering rules

Filters:

   - Are configured from the web app
   - Must impact processing in ADF

We don't want:

   - One pipeline per application
   - Duplicate data flows
   - Changing code every time

👉 The solution is to decouple the model and filters from the pipeline

   - ADF should not know the logical model of the dataset
   - The model resides in SQL metadata

ADF only:

   - Reads definitions
   - Applies dynamic rules
   - Orchestrates


### ADF Pipeline:

Lookup RAW JSON
   ↓
Parse JSON (model-driven)
   ↓
Save Processed Data
   ↓
Lookup Filters (by application)
   ↓
Apply Filters (SQL dynamic)
   ↓
Lookup Denominator Rule
   ↓
Join Denominator
   ↓
Calculate Metrics


### Metadata-based architecture (RECOMMENDED)

We need a way to dinamically define the fields for each appliaction model. The propposal is to use a SQL table to define what are the field name, type, path in the Json model, and other characteritics. For example:

```
application_model (
    application_id UNIQUEIDENTIFIER,
    field_name VARCHAR(100),
    field_type VARCHAR(50),
    source_path VARCHAR(200), -- path en el JSON
    is_filterable BIT,
    is_metric_dimension BIT
);
```

```
[Application]
         ↓
[Application Model (metadata)]
         ↓
[Filter Definitions (SQL)]
         ↓
[Generic ADF Pipeline]
```

### Key points

What this design looks for:
   ✔ Support different datasets per application
   ✔ 100% configurable filters
   ✔ Dynamic UI
   ✔ Single ADF pipeline
   ✔ No code changes
   ✔ Scales to N applications

## Data Storage Concept

### Denominator (Mercury Engagement List)

Loaded weekly from Mercury reporting system. It's stored in an independant SQL Server with standard engagement attributes. 
It's exposed through a SQL view: [InventoryAnalysis].[dbo].[vw_USTaxBTS_FY26_MaxACD]

Columns: 
   [EngagementID]
   [Engagement]
   [ClientID]
   [Client]
   [AccountChannel]
   [EngagementSubServiceLine]
   [EngagementServiceCode]
   [EngagementService]
   [EngagementStatus]
   [CreationDate]
   [ReleaseDate]
   [ETD_ANSRAmt]
   [FYTD_ANSRAmt]
   [ETD_TERAmt]
   [FYTD_TERAmt]
   [ETD_ChargedHours]
   [FYTD_ChargedHours]


### Numerator (Application Classifications)

Stored separately from the Denominator, linked by Engagement ID or Client ID:

Data should be saved in stage.EngagementUsageRaw Table with following columns:

| Column | Description |
|--------------|-------------|
|  StageId     | Identifier for app numerator data |
|  ApplicationId |  Application identifier |
|  PayloadJson | Json that contains numerator data |



| Storage Need | Description |
|--------------|-------------|
| Current Numerator | Latest classification for each engagement/client |
| Numerator History | Audit trail of changes over time |
| Upload Metadata | Who uploaded, when, which file |
| Validation Results | Any IDs that failed Denominator validation |

### Calculated Metrics

Stored for historical trending:

| Metric | Description |
|--------|-------------|
| Calculation Date | When metrics were computed |
| Application | Which application |
| Adoption Level | Engagement or Client |
| Denominator Count | Addressable population count |
| Numerator Count | Count in application |
| % Supported | Adoption percentage (Numerator / Denominator) |
| Denominator Revenue | Addressable revenue |
| Numerator Revenue | Revenue in application |
| % Revenue Supported | Revenue adoption percentage |

---

## Open Questions

1. **Frequency**: How often does Numerator data need to be updated?
   - Navigate: Quarterly?
   - EYST: Quarterly?
   - Vector: On-demand?

2. **Ownership**: Who is responsible for maintaining each application's Numerator data?

3. **Conflict Resolution**: If an engagement appears in both "Navigate" and "Non-Navigate" classifications, which wins?

4. **Historical Analysis**: Do users need to see how adoption rates changed over time? If so, how far back?

5. **Notifications**: Should users be notified when their Numerator data becomes stale (e.g., new engagements in Denominator not yet classified)?

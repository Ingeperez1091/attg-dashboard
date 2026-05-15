# BTS Quarterly Metrics - Business Rules and ETL Summary

## Overview

This document consolidates all business rules, data transformation methods, and ETL requirements extracted from the Jupyter notebooks in the BTS Quarterly Metrics Q3 FY26 project. The project analyzes technology adoption across multiple EY tax tools: **Maestro**, **EYST**, **Prodigy**, **Vector**, and **Navigate**.

---

## Data Sources

### Primary Data Source
| File | Description |
|------|-------------|
| `US_Tax_Engagement_List_Detailed_Report_Jan_Wk2_FY26.xlsx` | Main engagement list report (skips first 6 rows as header) |

### Secondary Data Sources by Analysis
| Analysis | Source Files |
|----------|--------------|
| Maestro | `./raw/maestro/maestro_data/*.xlsx` (25+ monthly files), `maestro_consolidated.xlsx` |
| EYST | `./raw/ftts/FTTS FY25 EYST Adoption Analysis 07182025.xlsx` |
| Prodigy | `./raw/prodigy/ClientEngagements_20260120_113520.xlsx` |
| Vector | `./raw/vector/Vector Engagements-01.21.2026_source.xlsx`, `./raw/vector_clients_engagements.xlsx` |
| Navigate | `./raw/navigate/EY Navigate engagements_v3_July2025.xlsx` |

---

## Common Data Pipeline (00_header_data_loading.ipynb)

### Required Columns
```
Client ID, Client, Account Channel, Engagement ID, Engagement Status, 
Engagement Service Code, Release Date, Engagement, ANSR / Tech Revenue ETD, 
ANSR / Tech Revenue FYTD, TER ETD, TER FYTD
```

### Data Type Coercion Rules
| Column | Data Type | Coercion Method |
|--------|-----------|-----------------|
| `Client ID` | numeric | `pd.to_numeric(errors='coerce')` |
| `Engagement Service Code` | string | `.astype(str)` |
| `Engagement ID` | string | `.astype(str)` |
| `Engagement Status` | string | `.astype(str)` |
| `ANSR / Tech Revenue ETD` | numeric | `pd.to_numeric(errors='coerce')` |
| `Release Date` | datetime | `pd.to_datetime(errors='coerce')` |
| `Engagement` | string | `.astype(str)` |

### Output
- Intermediate feather file: `./processed/reduced_coerced_engagement_list.feather`

---

## 1. Maestro Analysis (01_maestro_analysis.ipynb)

### Purpose
Analyze Private Client Services (PCS) Maestro adoption rates by engagement and revenue.

### Engagement Service Codes Evaluated
| Code | Description | Used in Final Analysis |
|------|-------------|----------------------|
| `11420` | Private Client Services (PCS) | **Yes** - 82.0% Maestro coverage |
| `11421` | Related PCS service | No - only 21.8% Maestro coverage |
| `10164` | No engagements found | No |
| `10170` | No engagements found | No |

### Business Rules (Applied Sequentially)

| Rule # | Filter | Description |
|--------|--------|-------------|
| 1 | Engagement Service Code = `11420` | Include only PCS engagements |
| 2 | Release Date > `01/01/2025` | Only recent engagements |
| 3 | Engagement name excludes: `pof`, `perseus`, `pt`, `ITR`, `BTA`, `Bison` | Case-insensitive exclusion pattern |
| 4 | ANSR / Tech Revenue ETD != 0 | Exclude zero-revenue engagements |
| 5 | Engagement Status IN (`Closing`, `Completed`, `Pre-Closing`, `Released`) | Active/completed engagements only |

### Maestro Data Consolidation Logic
1. Read all monthly Excel files from `./raw/maestro/maestro_data/`
2. Handle two file formats:
   - **Old format**: Contains `ClientCode`, `ClientName`, `EyEngagementId`, `EngagementName`
   - **New format**: Contains only `Client Id`, `Engagement Id`
3. Normalize column names to: `Client Id`, `Client Name`, `Engagement Id`, `Engagement Name`
4. Build lookup tables for client names and engagement names from files that have them
5. Deduplicate by `Client Id` + `Engagement Id` combination
6. Merge names back to ID-only records

### Metrics Calculated
- `% of Engagements in Maestro` = Maestro Engagements / Total Engagements
- `% of Revenue Supported by Maestro` = Maestro Supported Revenue / Total PCS Revenue

### Classification Logic
- `In Maestro = TRUE` if Engagement ID appears in consolidated Maestro data

---

## 2. EYST Analysis (02_eyst.ipynb)

### Purpose
Analyze FTTS (Family Tax & Trust Services) EYST adoption rates.

### Engagement Service Codes
| Code | Description |
|------|-------------|
| `10459` | FTTS primary |
| `11420` | Private Client Services |
| `10170` | Additional FTTS code |
| `10466` | Additional FTTS code |

### Business Rules

| Rule # | Filter | Description |
|--------|--------|-------------|
| 1 | Engagement Service Code IN (`10459`, `11420`, `10170`, `10466`) | Include FTTS-related codes |
| 2 | Engagement name contains `FTTS` | Case-insensitive filter |
| 3 | Exclude `N/A` cleanup values | Filter out unclassified records |
| 4 | Exclude Engagement Status = `Cancelled` | Remove cancelled engagements |

### Join Logic
- Left merge on `Client ID` to bring in ShareTrust data columns:
  - `Roll Up Client`
  - `EYST Active Client (client roll up version)`
  - `EYST Data Clean-Up Active Client (client roll up version)`
- Fill missing values with `N/A`
- Deduplicate after merge

### Metrics Calculated
- `Revenue $` = Total ETD / Yes ETD (where cleanup flag = 'yes')
- `% Engagements` = Yes clients / Total clients
- `Client Ratio` = Yes clients / Total clients

---

## 3. Prodigy Analysis (03_prodigy.ipynb)

### Purpose
Analyze Research & Development tax credit engagements supported by Prodigy.

### Engagement Service Code
| Code | Description |
|------|-------------|
| `10676` | Research & Development |

### Business Rules

| Rule # | Filter | Description |
|--------|--------|-------------|
| 1 | Engagement Service Code = `10676` | R&D engagements only |
| 2 | Release Date > `01/01/2024` | Recent engagements |
| 3 | ANSR / Tech Revenue ETD != 0 | Non-zero revenue |

### Classification Logic
- Match engagements to Prodigy by **Client ID** (not Engagement ID)
- `Client_in_Prodigy = TRUE` if Client ID appears in Prodigy client list

### Metrics Calculated
1. **Total ANSR FYTD Revenue** supported by Prodigy
2. **% of Engagements** = Prodigy client engagements / Total R&D engagements
3. **% of ANSR FYTD Revenue** = Prodigy Revenue / Total Revenue

### Key Insight
- 1,382 R&D engagements across 798 unique clients
- Some clients have multiple engagements (expected)

---

## 4. Vector Analysis (04_vector_analysis.ipynb)

### Purpose
Enrich Vector engagement data with revenue information from Mercury.

### Engagement Service Codes
| Code | Description |
|------|-------------|
| `10675` | Vector primary |
| `10677` | Vector secondary |

### Business Rules (from main notebook)

| Rule # | Filter | Description |
|--------|--------|-------------|
| 1 | Engagement Service Code IN (`10675`, `10677`) | Vector codes |
| 2 | Account Channel = `2` | Channel 2 clients only |
| 3 | ANSR / Tech Revenue ETD > 10,000 | Minimum revenue threshold |
| 4 | Release Date > `01/01/2024` | Recent engagements |
| 5 | Engagement Status IN (`Closing`, `Completed`, `Pre-Closing`, `Released`) | Active statuses |

### Data Enrichment Process
1. Read Vector engagement list (preserves all existing sheets)
2. Deduplicate `reduced_df` by Engagement ID (keep first occurrence)
3. Left merge on `Eng ID` = `Engagement ID`
4. Add columns: `Client ID`, `ANSR / Tech Revenue FYTD`, `ANSR / Tech Revenue ETD`
5. Preserve original workbook structure with additional Summary sheet

### Vector Classification
- `vector_engagement = "Yes"` if Engagement ID in Vector app data
- `vector_client = "Yes"` if Client ID in Vector app data

---

## 5. Navigate Analysis (05_navigate_analysis.ipynb)

### Purpose
Analyze EY Navigate adoption for US Financial Planner Line engagements.

### Engagement Service Code
| Code | Description |
|------|-------------|
| `10469` | US Financial Planner Line |

### Business Rules

| Rule # | Filter | Description |
|--------|--------|-------------|
| 1 | Engagement Service Code = `10469` | Financial Planner engagements only |

### Navigate Classification Source Sheets
| Sheet Name | Classification |
|------------|----------------|
| `New Navigate`, `Old Navigate` | Navigate = TRUE |
| `New Non-Nav`, `Old Non-Nav` | Non-Navigate |
| `New Inactives`, `Old Inactives` | Inactive |
| Not found in any sheet | Not Classified |

### Consolidation Logic
1. Read all sheets from Navigate tracking spreadsheet
2. Extract common columns: `Client`, `Engagement`, `Engagement ID`
3. Forward-fill Client names (some sheets have client only on first row of group)
4. Add `is_navigate` boolean and `source_tab` tracking columns
5. Merge with Mercury engagement data on `Engagement ID`
6. Derive `Navigate Status`: Navigate, Non-Navigate, Inactive, Not Classified

### Metrics Calculated
- `% Engagements in Navigate` = Navigate Engagements / Total Engagements
- `% Revenue in Navigate` = Navigate Revenue (FYTD) / Total Revenue (FYTD)

---

## Data Transformation Methods Summary

### File Format Conversions
| Input Format | Output Format | Method |
|--------------|---------------|--------|
| Excel (.xlsx) | Feather (.feather) | `pd.read_excel()` -> `df.to_feather()` |
| Feather (.feather) | Excel (.xlsx) | `pd.read_feather()` -> `df.to_excel()` |

### Common Transformations
| Operation | Pandas Method | Notes |
|-----------|---------------|-------|
| Read Excel (skip rows) | `pd.read_excel(skiprows=6)` | Main report has 6 header rows |
| String matching (case-insensitive) | `str.contains(pattern, case=False, na=False)` | Used for exclusion filters |
| Multiple string exclusion | `'|'.join(terms)` pattern | Combine with regex OR |
| Boolean flag creation | `df['col'].isin(lookup_series)` | Membership testing |
| Left merge | `df.merge(other, how='left', left_on=, right_on=)` | Preserve all left rows |
| Fill missing values | `fillna('N/A')` or `fillna(0)` | Handle nulls after merge |
| Deduplication | `drop_duplicates(subset=['col'])` | Keep first occurrence |
| Forward fill | `ffill()` | Fill client names in grouped data |

### Excel Output Features
- Table formatting with `TableStyleInfo`
- Key Metrics sheet with live Excel formulas (`COUNTIF`, `SUMIF`)
- Business Rules documentation sheet
- Multi-sheet workbook preservation with `openpyxl`

---

## ETL Automation Requirements

### 1. Data Extraction

#### Source Systems
| System | Data | Extraction Method |
|--------|------|-------------------|
| Mercury | US Tax Engagement List | Manual Excel export (weekly) |
| Maestro | Engagement utilization data | Monthly Excel exports |
| ShareTrust | EYST adoption analysis | Manual Excel export |
| Prodigy | Client engagements | System export |
| Vector | Engagement tracking | Manual Excel maintenance |
| Navigate | Engagement classification | Manual Excel maintenance |

#### Automation Opportunities
- Schedule Mercury report extraction via API (if available)
- Implement file watcher for new Maestro monthly files
- Standardize file naming conventions across all sources

### 2. Data Loading

#### Required Infrastructure
```
./raw/                          # Raw source files (input)
    maestro/
        maestro_data/           # Monthly Maestro files
    ftts/
    prodigy/
    vector/
    navigate/
./processed/                    # Intermediate files
./review/                       # Output files for business review
    maestro/
    vector/
    navigate/
```

#### File Processing Order
1. Load main engagement report -> Create base feather file
2. Load tool-specific reference data
3. Apply filters and classifications
4. Generate output files

### 3. Transformation Pipeline

#### Recommended ETL Steps
```
Step 1: Ingest & Validate
├── Read raw Excel files
├── Validate required columns exist
├── Log row counts and data quality metrics
└── Save to intermediate feather format

Step 2: Clean & Standardize
├── Apply data type coercion
├── Normalize string values (trim, case)
├── Handle null values consistently
└── Deduplicate where needed

Step 3: Enrich & Classify
├── Apply business rule filters (sequential)
├── Join with reference data sources
├── Create classification flags (In Maestro, Navigate Status, etc.)
└── Calculate derived metrics

Step 4: Aggregate & Export
├── Generate summary statistics
├── Create formatted Excel outputs
├── Apply Excel table styling
└── Add Key Metrics sheets with formulas
```

### 4. Configuration Management

#### Parameterize Business Rules
```yaml
maestro:
  service_codes: ['11420']
  release_date_cutoff: '2025-01-01'
  excluded_terms: ['pof', 'perseus', 'pt', 'ITR', 'BTA', 'Bison']
  allowed_statuses: ['Closing', 'Completed', 'Pre-Closing', 'Released']
  min_revenue: 0  # exclusive

prodigy:
  service_codes: ['10676']
  release_date_cutoff: '2024-01-01'
  
vector:
  service_codes: ['10675', '10677']
  account_channel: '2'
  min_revenue: 10000
  release_date_cutoff: '2024-01-01'
  allowed_statuses: ['Closing', 'Completed', 'Pre-Closing', 'Released']

navigate:
  service_codes: ['10469']
  
eyst:
  service_codes: ['10459', '11420', '10170', '10466']
  engagement_filter: 'FTTS'
  excluded_statuses: ['Cancelled']
```

### 5. Monitoring & Logging

#### Key Metrics to Track
- Row counts at each filter step (with % reduction)
- Match rates for joins (e.g., "Client ID match rate: 204/234")
- Revenue totals before/after filtering
- Duplicate detection counts
- Processing timestamps

### 6. Data Quality Checks

#### Recommended Validations
| Check | Implementation |
|-------|----------------|
| Missing required columns | Check before processing, log warnings |
| Duplicate engagement IDs | `df['Engagement ID'].duplicated().sum()` |
| Revenue outliers | Flag values outside expected ranges |
| Date range validation | Ensure dates within expected fiscal year |
| Join effectiveness | Log unmatched records count |

---

## Dependencies

### Python Libraries
```
pandas
openpyxl (Excel read/write with formatting)
numpy
pathlib
re (regex)
shutil (file operations)
datetime
```

### File Format Support
- Excel (.xlsx) - read/write
- Feather (.feather) - intermediate storage (faster than Excel)
- CSV - optional export

---

## Appendix: Service Code Reference

| Code | Tool/Analysis | Description |
|------|---------------|-------------|
| 10459 | EYST | FTTS primary |
| 10466 | EYST | FTTS additional |
| 10469 | Navigate | US Financial Planner Line |
| 10675 | Vector | Vector primary |
| 10676 | Prodigy | Research & Development |
| 10677 | Vector | Vector secondary |
| 11420 | Maestro, EYST | Private Client Services |
| 11421 | (evaluated) | Related PCS - not used |

# Pricing Backend Design

This document describes the proposed backend shape for the Pricing UI that was
introduced in panel build V064.

## Scope

The current V064 panel stores rate groups locally in the browser while the user
reviews the model. Backend persistence should start only after the model is
approved.

## Data model

Pricing should be stored as date-effective rate groups.

```json
{
  "version": 2,
  "updated_at": "2026-07-19T00:00:00+00:00",
  "holiday_source": "workday",
  "region": "NSW",
  "groups": [
    {
      "group_id": "uuid",
      "label": "Rates from Jan 1",
      "provider": "Retailer",
      "plan_name": "Plan name",
      "effective_start_date": "2026-01-01",
      "pricing_type": "dynamic",
      "daily_connection_charge": 1.234,
      "other_charges": "Metering charge: ...",
      "notes": "",
      "records": [
        {
          "record_id": "uuid",
          "label": "Peak",
          "day_types": ["mon", "tue", "wed", "thu", "fri"],
          "start_time": "14:00",
          "end_time": "20:00",
          "import_rate": 0.42,
          "export_rate": 0.05,
          "controlled_load_rate": null,
          "other_charges": "",
          "notes": ""
        }
      ]
    }
  ]
}
```

## Group semantics

- A group becomes active on `effective_start_date`.
- A group remains active until the next group starts.
- No explicit end date is required.
- If two groups have the same `effective_start_date`, the backend should reject
  the save and return a clear error.
- The active group at a given date is the latest group whose start date is less
  than or equal to that date.

## Record semantics

- Records apply only inside their parent group.
- Records are selected by day type and time window.
- Supported day types:
  - `mon`
  - `tue`
  - `wed`
  - `thu`
  - `fri`
  - `sat`
  - `sun`
  - `public_holiday`
- Public holiday records are overrides and should be evaluated before standard
  weekday/weekend records.
- Overnight windows are allowed and should be interpreted as two segments:
  `start_time` to midnight and midnight to `end_time`.
- A record where `start_time == end_time` is invalid.

## Overlap validation

The backend should reject overlapping records inside the same group when they
share any day type and their time windows intersect.

Examples:

- Mon-Fri 14:00-20:00 conflicts with Fri 19:00-21:00.
- Fri 14:00-20:00 does not conflict with Fri 20:00-23:00.
- `public_holiday` does not conflict with `mon` unless both records include
  `public_holiday`.

The UI already performs this validation, but the backend must repeat it so API
or service calls cannot save invalid data.

## Proposed Home Assistant services

### `pricing_upsert_group`

Create or update a rate group.

Fields:

- `group_id` optional
- `label`
- `provider`
- `plan_name`
- `effective_start_date` required
- `pricing_type` fixed/dynamic
- `daily_connection_charge`
- `other_charges`
- `notes`
- `entry_id` optional

### `pricing_remove_group`

Delete a rate group and all child records.

Fields:

- `group_id` required
- `entry_id` optional

### `pricing_upsert_record`

Create or update one record inside a group.

Fields:

- `group_id` required
- `record_id` optional
- `label`
- `day_types` required
- `start_time` required
- `end_time` required
- `import_rate`
- `export_rate`
- `controlled_load_rate`
- `other_charges`
- `notes`
- `entry_id` optional

### `pricing_remove_record`

Delete one record inside a group.

Fields:

- `group_id` required
- `record_id` required
- `entry_id` optional

## Sensor payload

The pricing schedule sensor should expose:

- `group_count`
- `record_count`
- `active_group`
- `active_record`
- `groups`
- `holiday_source`
- `region`
- `updated_at`

For compatibility during migration, it can also continue exposing the old
`rules`, `rule_count`, and `date_map` attributes until the panel no longer uses
them.

## Workday integration boundary

Workday should not be required to save pricing groups.

The later Workday pass should:

- detect whether the Home Assistant Workday integration/entities are configured;
- allow the user to choose the Workday entity or region;
- use that signal to decide whether today is a public holiday;
- apply `public_holiday` records ahead of standard day records.

## Migration

Existing version 1 schedules should remain readable.

Suggested migration:

- Convert each old `PricingRule.effective_date` bucket into one generated group.
- Preserve old rule IDs as record IDs where possible.
- Map old fields:
  - `supply_charge` -> `daily_connection_charge` on the group when shared
  - `controlled_load_1` -> `controlled_load_rate`
  - `holiday_only` -> `day_types: ["public_holiday"]`
  - `days_of_week` -> `day_types`
- Store migrated schedules as `version: 2`.

## Open questions for review

- Should fixed pricing use a single all-day record by default, or should fixed
  groups hide the record editor until advanced options are needed?
- Should rates be stored in dollars/kWh or cents/kWh? The UI currently accepts
  raw decimal values and formats them as rates.
- Should `public_holiday` records be allowed to overlap standard weekday records
  because they are overrides, or should they remain fully isolated by day type as
  they are in V064?

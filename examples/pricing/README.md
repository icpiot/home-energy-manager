# Pricing Model

This folder documents the vendor-neutral pricing shape used by
`custom_components/bytewatt/pricing.py`.

The model is designed to hold:

- import pricing
- export pricing
- fixed tariffs
- time-of-use windows
- dynamic market intervals
- spike or peak export rates

The current integration does not calculate bills from this data yet. It is a
storage and modeling foundation for a future pricing card.

## Fields

Each record follows this pattern:

- `flow`: `import`, `export`, or `net`
- `mode`: `fixed`, `tou`, `dynamic`, or `market`
- `value`: numeric price value
- `starts_at` / `ends_at`: optional ISO datetimes
- `label`: human-friendly description
- `currency`: defaults to `AUD`
- `unit`: defaults to `c/kWh`
- `source`: market or tariff source
- `region`: market region or locale
- `tariff_name`: tariff or plan name
- `priority`: higher values win when windows overlap
- `metadata`: extra details such as interval length or notes

## Rules of Thumb

- Use `priority` for spike export windows so they override the base rate.
- Leave `ends_at` empty for open-ended tariffs.
- Use `metadata` for vendor-specific or market-specific fields you do not want
  to bake into the core model.

# Home Energy Manager

Home Energy Manager is a Home Assistant integration for solar, battery, and
grid workflows with a focus on:

- real-time energy monitoring
- battery scheduling and control
- solar and load history
- cost-aware automations
- battery wear cost modeling
- forecasting and planning
- staged settings with submit/discard control
- automatic recovery for flaky API connections

The current implementation ships with the ByteWatt / Neovolt backend as the
first supported adapter, but the project is intended to grow beyond that
single vendor.

## Current Status

- Public GitHub repo: `icpiot/home-energy-manager`
- Default branch: `main`
- License: MIT

## What’s Included

- Home Assistant custom integration
- staged settings workflow
- recovery and diagnostics helpers
- example Lovelace cards and resource files
- unit tests and validation workflow

## Installation

### HACS

1. Install [HACS](https://hacs.xyz/) if you have not already.
2. Add this repository as a custom integration repository in HACS.
3. Install the integration and restart Home Assistant.

### Manual

Copy `custom_components/bytewatt` into your Home Assistant
`custom_components/` directory, restart, then add the integration.

## Backends

The repo currently includes support for the ByteWatt / Neovolt API. The source
code and abstractions are being shaped so other solar and battery systems can
be added later without rebuilding the project from scratch.

## Features

- real-time monitoring for solar, battery, and grid power
- daily and cumulative energy statistics
- battery charge/discharge scheduling
- grid feed-in controls
- host inverter selection for multi-inverter accounts
- staged settings with submit/discard buttons
- heartbeat monitoring, circuit breaker, and auto-reconnect
- optional Lovelace card assets in `examples/`

## Services

The integration exposes services for battery and maintenance workflows.

- `bytewatt.set_minimum_soc`
- `bytewatt.set_charge_cap`
- `bytewatt.set_discharge_start_time`
- `bytewatt.set_discharge_time`
- `bytewatt.set_charge_start_time`
- `bytewatt.set_charge_end_time`
- `bytewatt.update_battery_settings`
- `bytewatt.set_grid_feedin_enabled`
- `bytewatt.set_grid_feedin_cutoff_soc`
- `bytewatt.update_grid_feedin_slot`
- `bytewatt.force_reconnect`
- `bytewatt.health_check`
- `bytewatt.toggle_diagnostics`

## Support

Open an issue in the GitHub repository:
[icpiot/home-energy-manager](https://github.com/icpiot/home-energy-manager)

## Credits

This project builds on earlier ByteWatt / Neovolt integration work released
under the MIT license and extends it into a broader home energy management
project.

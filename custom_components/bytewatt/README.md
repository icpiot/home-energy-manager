# Home Energy Manager Integration

This integration is the current Home Assistant backend for the
Home Energy Manager project.

It currently supports ByteWatt / Neovolt devices, but the surrounding project
is being shaped to support broader solar and battery energy workflows over
time.

## Included Capabilities

- heartbeat monitoring
- stale data detection
- automatic recovery and reconnect
- staged settings with submit/discard control
- battery and grid-feed control services

## Control Notes

- discharge windows only allow battery discharge during the configured period
- charge windows force charging during the configured period and return to self-consumption mode outside it
- overlapping daily charge and discharge windows are allowed, and charging takes priority
- the minimum SOC setting is the battery discharge cutoff reserve
- UPS reserve keeps the battery above the cutoff after off-grid recovery when the system is grid-connected

## Troubleshooting

If the integration stops updating:

1. Check the Home Assistant logs.
2. Verify the upstream API or device is online.
3. Use the `bytewatt.force_reconnect` service.
4. Restart Home Assistant if needed.

## Configuration

Configure the integration through the Home Assistant UI.

## Services

- `bytewatt.force_reconnect`
- `bytewatt.update_battery_settings`
- `bytewatt.set_discharge_start_time`
- `bytewatt.set_discharge_time`
- `bytewatt.set_charge_start_time`
- `bytewatt.set_charge_end_time`
- `bytewatt.set_minimum_soc`

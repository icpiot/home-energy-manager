"""Contract checks for the bundled Home Energy Manager panel."""
from __future__ import annotations

import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PANEL_PATH = ROOT / "examples" / "www" / "home-energy-manager-panel.js"
INIT_PATH = ROOT / "custom_components" / "home_energy_manager" / "__init__.py"
MANIFEST_PATH = ROOT / "custom_components" / "home_energy_manager" / "manifest.json"
PANEL_EXAMPLE_PATH = ROOT / "examples" / "panel" / "home-energy-manager-panel_custom.yaml"
CONFIG_FLOW_PATH = ROOT / "custom_components" / "home_energy_manager" / "config_flow.py"


def test_panel_build_matches_registered_cache_version():
    panel_source = PANEL_PATH.read_text(encoding="utf-8")
    integration_source = INIT_PATH.read_text(encoding="utf-8")

    panel_build = re.search(r'PANEL_BUILD = "(\d+)"', panel_source)
    registered_build = re.search(r'panel\.js\?v=(\d+)', integration_source)

    assert panel_build is not None
    assert registered_build is not None
    assert panel_build.group(1) == registered_build.group(1)


def test_panel_uses_provider_neutral_entity_namespace():
    panel_source = PANEL_PATH.read_text(encoding="utf-8")
    assert "home_energy_manager(?:_|$)" in panel_source
    assert "home_energy_manager_${key}" in panel_source
    assert "|bytewatt" not in panel_source.lower()


def test_panel_reads_configuration_from_home_assistant_panel_property():
    panel_source = PANEL_PATH.read_text(encoding="utf-8")
    assert "this._config = panel?.config || this._config" in panel_source


def test_panel_exposes_forecast_page_and_configured_entity_lookup():
    panel_source = PANEL_PATH.read_text(encoding="utf-8")
    assert 'data-page="forecast"' in panel_source
    assert "_forecastPage()" in panel_source
    assert "_configuredEntityId(key)" in panel_source
    assert "_stateForConfiguredEntity" in panel_source


def test_panel_section_navigation_uses_page_fragment_links():
    panel_source = PANEL_PATH.read_text(encoding="utf-8")
    assert 'HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY = "hem_page"' in panel_source
    assert "_pageHref(page)" in panel_source
    assert 'url.hash = `${HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY}=' in panel_source
    assert 'type="button" class="panel-nav__item" data-page="forecast"' in panel_source
    assert 'class="panel-nav__item"' in panel_source


def test_config_flow_collects_forecast_setup():
    config_flow_source = CONFIG_FLOW_PATH.read_text(encoding="utf-8")
    assert "async_step_forecast_setup" in config_flow_source
    assert "forecast_provider" in config_flow_source
    assert "CONF_FORECAST_GENERATION_TODAY_ENTITY" in config_flow_source
    assert "CONF_SOLAR_FORECAST_ENTITY" in config_flow_source


def test_integration_forwards_select_platform():
    integration_source = INIT_PATH.read_text(encoding="utf-8")
    platforms = re.search(r"PLATFORMS = \[(.*?)\]", integration_source)
    assert platforms is not None
    assert '"select"' in platforms.group(1)


def test_manifest_version_matches_panel_milestone():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert manifest["version"] == "1.2.2"
    assert manifest["codeowners"] == ["@icpiot"]


def test_legacy_panel_example_keeps_module_url_at_panel_level():
    example = PANEL_EXAMPLE_PATH.read_text(encoding="utf-8")
    assert "\n  module_url:" in example
    assert "\n    module_url:" not in example

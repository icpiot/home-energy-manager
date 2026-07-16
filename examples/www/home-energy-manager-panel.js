import "./home-energy-manager-policy-card.js?v=005";
import "./home-energy-manager-report-card.js?v=299";
import "./home-energy-manager-debug-card.js?v=032";

const HOME_ENERGY_MANAGER_PANEL_BUILD = "028";
const HOME_ENERGY_MANAGER_PANEL_THEME_KEY = "home-energy-manager.panel.theme";
const HOME_ENERGY_MANAGER_PANEL_PAGE_KEY = "home-energy-manager.panel.page";
const HOME_ENERGY_MANAGER_PANEL_DEBUG_KEY = "home-energy-manager.panel.debug";
const HOME_ENERGY_MANAGER_PANEL_THEMES = [
  { value: "midnight", label: "Midnight" },
  { value: "sunrise", label: "Sunrise" },
  { value: "neon", label: "Neon" },
  { value: "cyberpunk", label: "Cyberpunk" },
];
const HOME_ENERGY_MANAGER_PANEL_PAGES = [
  { value: "overview", label: "Overview", icon: "◉" },
  { value: "policy", label: "Policy", icon: "▥" },
  { value: "report", label: "Report", icon: "▤" },
  { value: "battery", label: "Battery", icon: "▣" },
  { value: "solar", label: "Solar", icon: "☀" },
  { value: "history", label: "History", icon: "↺" },
  { value: "pricing", label: "Pricing", icon: "$" },
  { value: "settings", label: "Settings", icon: "⚙" },
  { value: "debug", label: "Debug", icon: "◫" },
];

class HomeEnergyManagerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._theme = this._loadTheme();
    this._debugEnabled = this._loadDebugEnabled();
    this._page = this._loadPage();
  }

  setConfig(config) {
    this._config = config || {};
    this._syncStoredState();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  set panel(panel) {
    this._panel = panel;
    this._config = panel?.config || this._config;
    this._syncStoredState();
    this._render();
  }

  set narrow(narrow) {
    this._narrow = Boolean(narrow);
    this._render();
  }

  set route(route) {
    this._route = route;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  _loadTheme() {
    try {
      return localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_THEME_KEY) || this._config.theme || "midnight";
    } catch (error) {
      return this._config.theme || "midnight";
    }
  }

  _loadPage() {
    try {
      return this._normalizePage(localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_PAGE_KEY) || "overview");
    } catch (error) {
      return "overview";
    }
  }

  _loadDebugEnabled() {
    try {
      return localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_DEBUG_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  _cleanCssValue(value, fallback) {
    const text = String(value ?? fallback ?? "").replace(/[;\r\n]/g, "").trim();
    return text || fallback;
  }

  _cssUrl(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return "none";
    }
    if (/^url\(/i.test(text)) {
      return text;
    }
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `url("${escaped}")`;
  }

  _themeStyleVars() {
    const artUrl = this._config.theme_art_url
      || this._config.theme_background_art_url
      || this._config.theme_panel_art_url
      || "";
    return [
      `--hem-panel-art-image: ${this._cssUrl(artUrl)};`,
      `--hem-panel-art-size: ${this._cleanCssValue(this._config.theme_art_size, "cover")};`,
      `--hem-panel-art-position: ${this._cleanCssValue(this._config.theme_art_position, "center center")};`,
      `--hem-panel-art-opacity: ${this._cleanCssValue(this._config.theme_art_opacity, "0.18")};`,
    ].join(" ");
  }

  _saveTheme(theme) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_THEME_KEY, theme);
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _savePage(page) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_PAGE_KEY, this._normalizePage(page));
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _saveDebugEnabled(enabled) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_DEBUG_KEY, enabled ? "true" : "false");
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _setTheme(theme) {
    this._theme = theme;
    this._saveTheme(theme);
    this._render();
  }

  _setPage(page) {
    this._page = this._normalizePage(page);
    this._savePage(this._page);
    this._render();
  }

  _setDebugEnabled(enabled) {
    const next = Boolean(enabled);
    this._debugEnabled = next;
    this._saveDebugEnabled(next);
    if (!next && this._page === "debug") {
      this._page = "overview";
      this._savePage("overview");
    }
    this._render();
  }

  _normalizePage(page) {
    const availablePages = this._availablePages();
    const requested = String(page || "overview").trim().toLowerCase();
    return availablePages.some((item) => item.value === requested) ? requested : "overview";
  }

  _availablePages() {
    return HOME_ENERGY_MANAGER_PANEL_PAGES.filter((page) => page.value !== "debug" || this._debugEnabled);
  }

  _syncStoredState() {
    this._theme = this._loadTheme();
    this._debugEnabled = this._loadDebugEnabled();
    this._page = this._loadPage();
  }

  _states() {
    return Object.values(this._hass?.states || {});
  }

  _managedEntities() {
    return this._states().filter((entity) => (
      /\.[a-z0-9_]*home_energy_manager(?:_|$)/i.test(entity.entity_id)
    ));
  }

  _entityCountByDomain(domain) {
    return this._managedEntities().filter((entity) => entity.entity_id.startsWith(`${domain}.`)).length;
  }

  _themeLabel() {
    return HOME_ENERGY_MANAGER_PANEL_THEMES.find((theme) => theme.value === this._theme)?.label || "Midnight";
  }

  _pageLabel() {
    return this._availablePages().find((page) => page.value === this._page)?.label || "Overview";
  }

  _entitySample(limit = 8) {
    return this._managedEntities()
      .slice(0, limit)
      .map((entity) => {
        return `<li><span>${entity.entity_id}</span><strong>${this._formatEntityState(entity)}</strong></li>`;
      })
      .join("");
  }

  _entityByKey(key, domain = "sensor") {
    const baseEntityId = `${domain}.home_energy_manager_${key}`;
    return this._hass?.states?.[baseEntityId]
      || this._managedEntities().find((entity) => {
        if (!entity.entity_id.startsWith(`${domain}.`)) {
          return false;
        }
        const objectId = entity.entity_id.slice(domain.length + 1).replace(/_\d+$/, "");
        const keySuffix = `home_energy_manager_${key}`;
        return objectId === keySuffix || objectId.endsWith(`_${keySuffix}`);
      });
  }

  _formatEntityState(entity, fallback = "Unavailable") {
    if (!entity || entity.state === "unknown" || entity.state === "unavailable") {
      return fallback;
    }

    const unit = entity.attributes?.unit_of_measurement;
    return unit ? `${entity.state} ${unit}` : entity.state;
  }

  _formattedState(key, domain = "sensor", fallback = "Unavailable") {
    return this._formatEntityState(this._entityByKey(key, domain), fallback);
  }

  _firstManagedState(pattern, fallback = "Unavailable") {
    return this._firstState(pattern, fallback);
  }

  _valueList(items, emptyLabel = "No matching entities yet") {
    const entries = items.length
      ? items
      : [{ label: emptyLabel, value: "idle" }];
    return entries
      .map((item) => `<li><span>${item.label}</span><strong>${item.value}</strong></li>`)
      .join("");
  }

  _matchedEntities(pattern) {
    return this._managedEntities().filter((entity) => pattern.test(entity.entity_id));
  }

  _firstState(pattern, fallback = "Unavailable") {
    const entity = this._matchedEntities(pattern)[0];
    return this._formatEntityState(entity, fallback);
  }

  _overviewPage() {
    const sampleList = this._entitySample(6) || "<li><span>No matching entities yet</span><strong>idle</strong></li>";
    const overviewTiles = [
      { label: "Battery", value: this._formattedState("battery_percentage"), note: "Current charge" },
      { label: "Solar", value: this._formattedState("pv_power"), note: "Live PV power" },
      { label: "Grid", value: this._formattedState("grid_consumption"), note: "Live grid flow" },
      { label: "Load", value: this._formattedState("house_consumption"), note: "Home demand" },
    ];
    return `
      <section class="overview">
        <article class="panel-card panel-card--wide overview__hero">
          <div class="panel-card__header">
            <h2>Energy Command Center</h2>
            <span>Overview</span>
          </div>
          <p>
            This is the daily control surface for battery, solar, grid, and future pricing
            workflows. The panel will stay focused on the most useful actions first.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="policy">Policy</button>
            <button type="button" class="panel-nav__item" data-page="report">Report</button>
            <button type="button" class="panel-nav__item" data-page="battery">Battery</button>
            <button type="button" class="panel-nav__item" data-page="solar">Solar</button>
            <button type="button" class="panel-nav__item" data-page="history">History</button>
            <button type="button" class="panel-nav__item" data-page="pricing">Pricing</button>
          </div>
        </article>

        <section class="overview__tiles">
          ${overviewTiles.map((tile) => `
            <article class="overview-tile">
              <span>${tile.label}</span>
              <strong>${tile.value}</strong>
              <small>${tile.note}</small>
            </article>
          `).join("")}
        </section>

        <section class="grid overview__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Live Entities</h2>
              <span>Preview</span>
            </div>
            <p>
              These are the entities the panel can already see. As we continue, this area can
              become the operational dashboard for the most important values.
            </p>
            <ul class="entity-list">
              ${sampleList}
            </ul>
          </article>

          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Quick Stats</h2>
              <span>Today</span>
            </div>
            <ul class="key-list">
              ${this._valueList([
                { label: "Managed entities", value: String(this._managedEntities().length) },
                { label: "Sensors", value: String(this._entityCountByDomain("sensor")) },
                { label: "Controls", value: String(
                  this._entityCountByDomain("switch") +
                  this._entityCountByDomain("number") +
                  this._entityCountByDomain("time") +
                  this._entityCountByDomain("button") +
                  this._entityCountByDomain("select")
                ) },
                { label: "Active page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _batteryPage() {
    const batteryItems = [
      { label: "Battery percentage", value: this._formattedState("battery_percentage") },
      { label: "Battery power", value: this._formattedState("battery_power") },
      { label: "Charged today", value: this._formattedState("battery_charged_today") },
      { label: "Discharged today", value: this._formattedState("battery_discharged_today") },
      { label: "Charge cap", value: this._formattedState("battery_charge_cap", "number") },
      { label: "Minimum SOC", value: this._formattedState("minimum_soc", "number") },
      { label: "Discharge cutoff", value: this._formattedState("grid_feed_in_discharging_cutoff_soc", "number") },
      { label: "UPS reserve", value: this._formattedState("ups_reserve_enable", "switch") },
      { label: "Charge start", value: this._formattedState("charge_start_time", "time") },
      { label: "Charge end", value: this._formattedState("charge_end_time", "time") },
      { label: "Discharge start", value: this._formattedState("discharge_start_time", "time") },
      { label: "Discharge end", value: this._formattedState("discharge_end_time", "time") },
    ];
    const batterySummary = [
      { label: "Battery", value: this._formattedState("battery_percentage") },
      { label: "Discharge window", value: this._formattedState("battery_discharge_time_control", "switch") },
      { label: "Grid charging", value: this._formattedState("grid_charging_battery", "switch") },
      { label: "Settings target", value: this._formattedState("settings_target", "select") },
    ];
    return `
      <section class="battery">
        <article class="panel-card panel-card--wide battery__hero">
          <div class="panel-card__header">
            <h2>Battery Control</h2>
            <span>Operations</span>
          </div>
          <p>
            The battery page will be the day-to-day control surface for charge and discharge
            policy, safety limits, and provider-specific battery modes.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="settings">Settings</button>
            <button type="button" class="panel-nav__item" data-page="history">History</button>
            <button type="button" class="panel-nav__item" data-page="pricing">Pricing</button>
          </div>
        </article>

        <section class="battery__tiles">
          ${batterySummary.map((item) => `
            <article class="battery-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid battery__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Battery Snapshot</h2>
              <span>Control layer</span>
            </div>
            <p>
              These are the battery controls and indicators the UI knows about right now.
              Missing values show as unavailable until the provider exposes them.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(batteryItems)}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Battery Notes</h2>
              <span>Schedule</span>
            </div>
            <p>
              Active provider schedules and reserve settings are shown here. Changes remain
              staged until they are submitted through the policy controls.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Charge window", value: `${this._firstState(/charge_start_time/i)} → ${this._firstState(/charge_end_time/i)}` },
                { label: "Discharge window", value: `${this._firstState(/discharge_start_time/i)} → ${this._firstState(/discharge_end_time/i)}` },
                { label: "Policy page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _policyPage() {
    const policyItems = [
      { label: "Charge window", value: `${this._formattedState("charge_start_time", "time")} → ${this._formattedState("charge_end_time", "time")}` },
      { label: "Discharge window", value: `${this._formattedState("discharge_start_time", "time")} → ${this._formattedState("discharge_end_time", "time")}` },
      { label: "Minimum SOC", value: this._formattedState("minimum_soc") },
      { label: "Charge cap", value: this._formattedState("charge_cap") },
      { label: "UPS reserve", value: this._formattedState("ups_reserve", "switch") },
      { label: "Grid charging", value: this._formattedState("grid_charging", "switch") },
    ];
    return `
      <section class="policy">
        <article class="panel-card panel-card--wide policy__hero">
          <div class="panel-card__header">
            <h2>Policy</h2>
            <span>Charge and feed-in control</span>
          </div>
          <p>
            This page shows the live policy summary inside the Home Energy Manager panel so
            battery charge and feed-in rules stay in one place.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="report">Report</button>
            <button type="button" class="panel-nav__item" data-page="battery">Battery</button>
          </div>
        </article>

        <section class="policy__stack">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Battery Policy Summary</h2>
              <span>Live settings</span>
            </div>
            <p>
              The current live settings are shown below while the embedded policy editors are
              stabilised. This keeps the page responsive even if the provider card is unavailable.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(policyItems)}
            </ul>
          </article>

          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Feed-in Policy Summary</h2>
              <span>Export control</span>
            </div>
            <p>
              Feed-in limits and export behavior can be reviewed here without depending on the
              embedded editor lifecycle.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Feed-in enabled", value: this._formattedState("feedin_enabled", "switch") },
                { label: "Feed-in cutoff SOC", value: this._formattedState("feedin_cutoff_soc") },
                { label: "Feed-in slot limit", value: this._formattedState("feedin_slot_limit") },
                { label: "Selected page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _reportPage() {
    const reportItems = [
      { label: "Battery SOC", value: this._formattedState("battery_percentage") },
      { label: "Battery power", value: this._formattedState("battery_power") },
      { label: "PV power", value: this._formattedState("pv_power") },
      { label: "House consumption", value: this._formattedState("house_consumption") },
      { label: "Grid consumption", value: this._formattedState("grid_consumption") },
      { label: "PV generated today", value: this._formattedState("pv_generated_today") },
      { label: "Consumed today", value: this._formattedState("consumed_today") },
      { label: "Feed in today", value: this._formattedState("feed_in_today") },
      { label: "Grid import today", value: this._formattedState("grid_import_today") },
    ];
    return `
      <section class="report">
        <article class="panel-card panel-card--wide report__hero">
          <div class="panel-card__header">
            <h2>Report</h2>
            <span>Power diagram and exports</span>
          </div>
          <p>
            The report view shows a live summary from the generic Home Energy Manager sensors
            so you can see current data while history continues to build.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="policy">Policy</button>
            <button type="button" class="panel-nav__item" data-page="history">History</button>
          </div>
        </article>

        <section class="report__stack">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Report Output</h2>
              <span>Live summary</span>
            </div>
            <p>
              This live report summary is built from the generic Home Energy Manager sensors
              so you still get a visible output even before the longer history archive is ready.
            </p>
            <div class="report-summary">
              <ul class="key-list key-list--compact">
                ${this._valueList(reportItems)}
              </ul>
            </div>
          </article>

          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Report Notes</h2>
              <span>History</span>
            </div>
            <p>
              History backfill and daily snapshots will appear here once the archive download
              finishes. For now, this page gives you the live report snapshot and navigation
              paths to policy, battery, history, and solar pages.
            </p>
          </article>
        </section>
      </section>
    `;
  }

  _solarPage() {
    const solarItems = [
      { label: "PV power", value: this._formattedState("pv_power") },
      { label: "PV generated today", value: this._formattedState("pv_generated_today") },
      { label: "Consumed today", value: this._formattedState("consumed_today") },
      { label: "Grid import today", value: this._formattedState("grid_import_today") },
      { label: "Feed in today", value: this._formattedState("feed_in_today") },
      { label: "Self consumption", value: this._formattedState("self_consumption") },
      { label: "Self sufficiency", value: this._formattedState("self_sufficiency") },
    ];
    const solarSummary = [
      { label: "Solar now", value: this._formattedState("pv_power") },
      { label: "Grid now", value: this._formattedState("grid_consumption") },
      { label: "Feed in today", value: this._formattedState("feed_in_today") },
      { label: "Forecast today", value: this._formattedState("forecast_generation_today") },
    ];
    return `
      <section class="solar">
        <article class="panel-card panel-card--wide solar__hero">
          <div class="panel-card__header">
            <h2>Solar Control</h2>
            <span>Generation layer</span>
          </div>
          <p>
            Solar is where we’ll surface live generation, feed-in, and future forecasting so
            the panel can guide battery and pricing decisions from the same place.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="battery">Battery</button>
            <button type="button" class="panel-nav__item" data-page="history">History</button>
          </div>
        </article>

        <section class="solar__tiles">
          ${solarSummary.map((item) => `
            <article class="solar-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid solar__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Solar Snapshot</h2>
              <span>Generation layer</span>
            </div>
            <p>
              This is the current solar view from Home Assistant. As we continue, it can turn
              into a daily operations page for power flows and solar forecasts.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(solarItems)}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Solar Notes</h2>
              <span>Provider coverage</span>
            </div>
            <p>
              Forecast and export values appear automatically when the configured provider
              or a future forecast source supplies them.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Forecast today", value: this._formattedState("forecast_generation_today") },
                { label: "Forecast tomorrow", value: this._formattedState("forecast_generation_tomorrow") },
                { label: "Export spike", value: this._formattedState("export_spike_price") },
                { label: "Solar page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _historyPage() {
    const historyItems = [
      { label: "Solar generated today", value: this._formattedState("pv_generated_today") },
      { label: "Consumed today", value: this._formattedState("consumed_today") },
      { label: "Grid import today", value: this._formattedState("grid_import_today") },
      { label: "Feed in today", value: this._formattedState("feed_in_today") },
      { label: "Battery charged today", value: this._formattedState("battery_charged_today") },
      { label: "Battery discharged today", value: this._formattedState("battery_discharged_today") },
    ];
    const historySummary = [
      { label: "Total solar", value: this._formattedState("total_solar_generation") },
      { label: "Total consumption", value: this._formattedState("total_house_consumption") },
      { label: "Total feed in", value: this._formattedState("total_feed_in") },
      { label: "Last update", value: this._formattedState("last_update") },
    ];
    return `
      <section class="history">
        <article class="panel-card panel-card--wide history__hero">
          <div class="panel-card__header">
            <h2>History</h2>
            <span>Timeline</span>
          </div>
          <p>
            This is where usage trends, state changes, and future reporting views will live.
            It gives us a dedicated place for history without making Lovelace the primary UI.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="battery">Battery</button>
            <button type="button" class="panel-nav__item" data-page="solar">Solar</button>
          </div>
        </article>

        <section class="history__tiles">
          ${historySummary.map((item) => `
            <article class="history-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid history__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>History Snapshot</h2>
              <span>Timeline</span>
            </div>
            <p>
              Daily energy totals come from the provider-neutral history model. Longer trend
              charts will build on the same normalized values.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(historyItems)}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>History Notes</h2>
              <span>Coverage</span>
            </div>
            <p>
              Recorder history remains available in Home Assistant while the dedicated report
              store supplies longer provider-neutral archives.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Trend depth", value: "Daily / weekly / monthly" },
                { label: "Source", value: "Home Assistant states" },
                { label: "History page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _pricingPage() {
    const pricingItems = [
      { label: "Daily cost estimate", value: this._formattedState("daily_cost_estimate") },
      { label: "Daily income estimate", value: this._formattedState("daily_income_estimate") },
      { label: "Current tariff", value: this._formattedState("tariff_current_price") },
      { label: "Next tariff", value: this._formattedState("tariff_next_price") },
      { label: "Dynamic pricing", value: this._formattedState("dynamic_pricing_enabled") },
      { label: "Battery wear cost", value: this._formattedState("battery_wear_cost") },
      { label: "Export spike", value: this._formattedState("export_spike_price") },
    ];
    const pricingSummary = [
      { label: "Current tariff", value: this._formattedState("tariff_current_price") },
      { label: "Dynamic", value: this._formattedState("dynamic_pricing_enabled") },
      { label: "Wear cost", value: this._formattedState("battery_wear_cost") },
      { label: "Spike export", value: this._formattedState("export_spike_price") },
    ];
    return `
      <section class="pricing">
        <article class="panel-card panel-card--wide pricing__hero">
          <div class="panel-card__header">
            <h2>Pricing</h2>
            <span>Future-ready</span>
          </div>
          <p>
            Pricing gets its own home so we can handle fixed tariffs, dynamic plans, wear cost,
            and future export spike pricing without tying the rest of the UI to one model.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="solar">Solar</button>
            <button type="button" class="panel-nav__item" data-page="history">History</button>
          </div>
        </article>

        <section class="pricing__tiles">
          ${pricingSummary.map((item) => `
            <article class="pricing-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid pricing__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Pricing Snapshot</h2>
              <span>Tariff layer</span>
            </div>
            <p>
              Pricing stays separate from energy history so fixed tariffs, time-of-use rates,
              and dynamic feeds can all retain date-effective records.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(pricingItems)}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Pricing Notes</h2>
              <span>Planned</span>
            </div>
            <p>
              The split is deliberate: fixed tariffs, dynamic pricing, and wear cost can evolve
              independently while keeping the dashboard focused.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Current tariff", value: this._formattedState("tariff_current_price") },
                { label: "Next tariff", value: this._formattedState("tariff_next_price") },
                { label: "Pricing page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _settingsPage() {
    const settingsItems = [
      { label: "Theme", value: this._themeLabel() },
      { label: "Route", value: this._route?.path || this._panel?.url_path || "home-energy-manager" },
      { label: "Screen", value: this._narrow ? "narrow" : "wide" },
      { label: "Provider", value: this._config.provider || "Configured provider" },
      { label: "Debug", value: this._debugEnabled ? "Enabled" : "Disabled" },
    ];
    return `
      <section class="grid grid--two">
        <article class="panel-card panel-card--wide">
          <div class="panel-card__header">
            <h2>Settings</h2>
            <span>Panel shell</span>
          </div>
          <ul class="key-list key-list--compact">
            ${this._valueList(settingsItems)}
          </ul>
        </article>
        <article class="panel-card">
          <div class="panel-card__header">
            <h2>Generic Settings</h2>
            <span>Local</span>
          </div>
          <div class="settings-toggle">
            <label class="toggle-row">
              <span class="toggle-row__label">Enable Debug</span>
              <span class="toggle-row__control">
                <input type="checkbox" data-debug-toggle ${this._debugEnabled ? "checked" : ""} />
                <span class="toggle-row__switch" aria-hidden="true"></span>
              </span>
            </label>
            <p>
              Generic settings keeps the panel device-agnostic while still exposing the debug page
              for deeper inspection, history checks, and provider-specific details.
            </p>
            <button
              type="button"
              class="panel-nav__item ${this._debugEnabled ? "" : "is-disabled"}"
              data-page="debug"
              ${this._debugEnabled ? "" : "disabled"}
            >
              Open Debug page
            </button>
          </div>
        </article>
        <article class="panel-card">
          <div class="panel-card__header">
            <h2>Theme Presets</h2>
            <span>Local</span>
          </div>
          <div class="theme-picker theme-picker--stacked" role="group" aria-label="Theme presets">
            ${HOME_ENERGY_MANAGER_PANEL_THEMES.map((theme) => `
              <button
                type="button"
                class="theme-pill ${theme.value === this._theme ? "is-active" : ""}"
                data-theme="${theme.value}"
              >
                ${theme.label}
              </button>
            `).join("")}
          </div>
        </article>
      </section>
    `;
  }

  _debugPage() {
    const debugItems = [
      { label: "Debug mode", value: this._debugEnabled ? "Enabled" : "Disabled" },
      { label: "Settings target", value: this._config?.settings_target || "Unavailable" },
      { label: "Entity prefix", value: this._config?.entity_prefix || "Unavailable" },
      { label: "Provider", value: this._config?.provider || "Configured provider" },
      { label: "Managed entities", value: String(this._managedEntities().length) },
      { label: "Sensors", value: String(this._entityCountByDomain("sensor")) },
      { label: "Controls", value: String(
        this._entityCountByDomain("switch") +
        this._entityCountByDomain("number") +
        this._entityCountByDomain("time") +
        this._entityCountByDomain("button") +
        this._entityCountByDomain("select")
      ) },
      { label: "Page", value: this._pageLabel() },
    ];
    return `
      <section class="debug">
        <article class="panel-card panel-card--wide debug__hero">
          <div class="panel-card__header">
              <h2>Diagnostics</h2>
            <span>Generic</span>
          </div>
          <p>
            This page is reserved for deeper inspection of the Home Energy Manager data model
            and the embedded debug card. The controls are generic and device-agnostic.
          </p>
          <div class="overview__actions">
            <button type="button" class="panel-nav__item" data-page="overview">Overview</button>
            <button type="button" class="panel-nav__item" data-page="settings">Settings</button>
            <button type="button" class="panel-nav__item" data-page="report">Report</button>
          </div>
        </article>

        <section class="grid debug__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Debug Snapshot</h2>
              <span>Internal</span>
            </div>
            <p>
              The values below should help confirm the panel is using the generic Home Energy
              Manager entities and that the provider data is flowing through correctly.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList(debugItems)}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Embedded Debug Card</h2>
              <span>Live</span>
            </div>
            <p>
              This is the provider-aware debug card used to inspect history, report data, and
              entity selection in one place.
            </p>
            <div class="panel-card__embedded" data-embedded="debug"></div>
          </article>
        </section>
      </section>
    `;
  }

  _pageContent() {
    switch (this._page) {
      case "policy":
        return this._policyPage();
      case "report":
        return this._reportPage();
      case "battery":
        return this._batteryPage();
      case "solar":
        return this._solarPage();
      case "history":
        return this._historyPage();
      case "pricing":
        return this._pricingPage();
      case "debug":
        return this._debugPage();
      case "settings":
        return this._settingsPage();
      case "overview":
      default:
        return this._overviewPage();
    }
  }

  _mountEmbeddedCards() {
    const prefix = this._config?.entity_prefix || "home_energy_manager";
    const settingsTarget = this._config?.settings_target || `select.house_${prefix}_settings_target`;
    const mounts = [
      {
        selector: '[data-embedded="battery-policy"]',
        tag: "home-energy-manager-policy-card",
        config: {
          ...this._config,
          entity_prefix: prefix,
          settings_target: settingsTarget,
          variant: "battery_policy",
        },
      },
      {
        selector: '[data-embedded="feedin-policy"]',
        tag: "home-energy-manager-policy-card",
        config: {
          ...this._config,
          entity_prefix: prefix,
          settings_target: settingsTarget,
          variant: "feedin_policy",
        },
      },
      {
        selector: '[data-embedded="report"]',
        tag: "home-energy-manager-report-card",
        config: {
          ...this._config,
          entity_prefix: prefix,
          settings_target: settingsTarget,
        },
      },
      {
        selector: '[data-embedded="debug"]',
        tag: "home-energy-manager-debug-card",
        config: {
          ...this._config,
          entity_prefix: prefix,
          settings_target: settingsTarget,
        },
      },
    ];

    mounts.forEach(({ selector, tag, config }) => {
      const host = this.shadowRoot.querySelector(selector);
      if (!host) {
        return;
      }
      host.textContent = "";
      try {
        const element = document.createElement(tag);
        if (typeof element.setConfig === "function") {
          element.setConfig(config);
        }
        if (this._hass) {
          element.hass = this._hass;
        }
        host.appendChild(element);
      } catch (error) {
        host.innerHTML = `
          <div class="embedded-fallback">
            <strong>Embedded card unavailable</strong>
            <span>${String(error?.message || error || "Unknown error")}</span>
          </div>
        `;
      }
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entityCount = this._states().length;
    const managedCount = this._managedEntities().length;
    const sensorCount = this._entityCountByDomain("sensor");
    const controlCount =
      this._entityCountByDomain("switch") +
      this._entityCountByDomain("number") +
      this._entityCountByDomain("time") +
      this._entityCountByDomain("button") +
      this._entityCountByDomain("select");
    const connectionLabel = this._hass ? "Connected to Home Assistant" : "Waiting for Home Assistant";
    const title = this._config.title || "Home Energy Manager";
    const subtitle = this._config.subtitle || "Backend-aware control panel with room for custom themes.";
    const routePath = this._route?.path || this._panel?.url_path || "home-energy-manager";
    const availablePages = this._availablePages();

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/local/community/home-energy-manager/home-energy-manager-panel.css?v=${HOME_ENERGY_MANAGER_PANEL_BUILD}">
      <section class="panel shell theme-${this._theme}" data-theme="${this._theme}" style="${this._themeStyleVars()}">
        <header class="hero">
          <div class="hero__badge">v${HOME_ENERGY_MANAGER_PANEL_BUILD}</div>
          <div class="hero__copy">
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="hero__actions">
            <div class="theme-picker" role="group" aria-label="Theme presets">
              ${HOME_ENERGY_MANAGER_PANEL_THEMES.map((theme) => `
                <button
                  type="button"
                  class="theme-pill ${theme.value === this._theme ? "is-active" : ""}"
                  data-theme="${theme.value}"
                >
                  ${theme.label}
                </button>
              `).join("")}
            </div>
          </div>
        </header>

        <nav class="panel-nav" aria-label="Home Energy Manager sections">
          ${availablePages.map((page) => `
            <button
              type="button"
              class="panel-nav__item ${page.value === this._page ? "is-active" : ""}"
              data-page="${page.value}"
            >
              <span class="panel-nav__icon">${page.icon}</span>
              <span>${page.label}</span>
            </button>
          `).join("")}
        </nav>

        <section class="status">
          <div class="status__banner">${connectionLabel}</div>
          <div class="status__meta">
            <span>Route: <strong>${routePath}</strong></span>
            <span>Screen: <strong>${this._narrow ? "narrow" : "wide"}</strong></span>
            <span>Theme: <strong>${this._themeLabel()}</strong></span>
            <span>Page: <strong>${this._pageLabel()}</strong></span>
          </div>
        </section>

        <section class="cards">
          <article>
            <h2>Entities</h2>
            <p>${entityCount}</p>
            <small>All Home Assistant entities currently loaded.</small>
          </article>
          <article>
            <h2>Managed</h2>
            <p>${managedCount}</p>
            <small>Entities provided by Home Energy Manager.</small>
          </article>
          <article>
            <h2>Sensors</h2>
            <p>${sensorCount}</p>
            <small>Monitoring and history surfaces.</small>
          </article>
          <article>
            <h2>Controls</h2>
            <p>${controlCount}</p>
            <small>Switches, numbers, selects, times, buttons.</small>
          </article>
        </section>

        ${this._pageContent()}
      </section>
    `;

    this._mountEmbeddedCards();
    this._bindInteractiveControls();
  }

  _bindInteractiveControls() {
    if (this._hasDelegatedHandlers) {
      return;
    }

    this._hasDelegatedHandlers = true;
    this.shadowRoot.addEventListener("click", (event) => {
      const themeButton = event.target.closest?.("[data-theme]");
      if (themeButton) {
        event.preventDefault();
        this._setTheme(themeButton.dataset.theme);
        return;
      }

      const pageButton = event.target.closest?.("[data-page]");
      if (pageButton && !pageButton.disabled) {
        event.preventDefault();
        this._setPage(pageButton.dataset.page);
      }
    });
    this.shadowRoot.addEventListener("change", (event) => {
      const debugToggle = event.target.closest?.("[data-debug-toggle]");
      if (debugToggle) {
        this._setDebugEnabled(Boolean(debugToggle.checked));
      }
    });
  }
  }
}

if (!customElements.get("home-energy-manager-panel")) {
  customElements.define("home-energy-manager-panel", HomeEnergyManagerPanel);
}

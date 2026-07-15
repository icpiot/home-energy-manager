const HOME_ENERGY_MANAGER_PANEL_BUILD = "001";
const HOME_ENERGY_MANAGER_PANEL_THEME_KEY = "home-energy-manager.panel.theme";
const HOME_ENERGY_MANAGER_PANEL_THEMES = [
  { value: "midnight", label: "Midnight" },
  { value: "sunrise", label: "Sunrise" },
  { value: "neon", label: "Neon" },
];

class HomeEnergyManagerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._theme = this._loadTheme();
  }

  setConfig(config) {
    this._config = config || {};
    this._theme = this._loadTheme();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  set panel(panel) {
    this._panel = panel;
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

  _saveTheme(theme) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_THEME_KEY, theme);
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _setTheme(theme) {
    this._theme = theme;
    this._saveTheme(theme);
    this._render();
  }

  _states() {
    return Object.values(this._hass?.states || {});
  }

  _managedEntities() {
    return this._states().filter((entity) => /home_energy_manager|bytewatt/i.test(entity.entity_id));
  }

  _entityCountByDomain(domain) {
    return this._managedEntities().filter((entity) => entity.entity_id.startsWith(`${domain}.`)).length;
  }

  _themeLabel() {
    return HOME_ENERGY_MANAGER_PANEL_THEMES.find((theme) => theme.value === this._theme)?.label || "Midnight";
  }

  _entitySample() {
    return this._managedEntities()
      .slice(0, 8)
      .map((entity) => {
        const state = entity.state ?? "unknown";
        return `<li><span>${entity.entity_id}</span><strong>${state}</strong></li>`;
      })
      .join("");
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
    const sampleList = this._entitySample() || "<li><span>No matching entities yet</span><strong>idle</strong></li>";

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/local/community/home-energy-manager/home-energy-manager-panel.css?v=${HOME_ENERGY_MANAGER_PANEL_BUILD}">
      <section class="panel shell theme-${this._theme}" data-theme="${this._theme}">
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

        <section class="status">
          <div class="status__banner">${connectionLabel}</div>
          <div class="status__meta">
            <span>Route: <strong>${routePath}</strong></span>
            <span>Screen: <strong>${this._narrow ? "narrow" : "wide"}</strong></span>
            <span>Theme: <strong>${this._themeLabel()}</strong></span>
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
            <small>Entities matching `home_energy_manager` or `bytewatt`.</small>
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

        <section class="grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Live Preview</h2>
              <span>Scaffold only</span>
            </div>
            <p>
              This panel is the future custom sidebar experience. It is not Lovelace, so we can
              own the layout, theming, and navigation independently of dashboards.
            </p>
            <ul class="entity-list">
              ${sampleList}
            </ul>
          </article>

          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Theme Notes</h2>
              <span>Funky by design</span>
            </div>
            <p>
              Theme presets live in the panel shell so you can keep the Home Assistant app
              familiar while letting this view get a bit more expressive.
            </p>
            <p>
              Current theme: <strong>${this._themeLabel()}</strong>
            </p>
          </article>
        </section>
      </section>
    `;

    this.shadowRoot.querySelectorAll(".theme-pill").forEach((button) => {
      button.addEventListener("click", () => this._setTheme(button.dataset.theme));
    });
  }
}

if (!customElements.get("home-energy-manager-panel")) {
  customElements.define("home-energy-manager-panel", HomeEnergyManagerPanel);
}

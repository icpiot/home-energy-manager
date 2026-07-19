import "./home-energy-manager-policy-card.js?v=008";
import "./home-energy-manager-report-card.js?v=302";
import "./home-energy-manager-debug-card.js?v=035";

const HOME_ENERGY_MANAGER_PANEL_BUILD = "068";
const HOME_ENERGY_MANAGER_PANEL_THEME_KEY = "home-energy-manager.panel.theme";
const HOME_ENERGY_MANAGER_PANEL_PAGE_KEY = "home-energy-manager.panel.page";
const HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY = "hem_page";
const HOME_ENERGY_MANAGER_PANEL_BATTERY_KEY = "home-energy-manager.panel.battery";
const HOME_ENERGY_MANAGER_PANEL_DEBUG_KEY = "home-energy-manager.panel.debug";
const HOME_ENERGY_MANAGER_PANEL_PRICING_DRAFT_KEY = "home-energy-manager.panel.pricing.draft";
const HOME_ENERGY_MANAGER_PANEL_PRICING_UI_KEY = "home-energy-manager.panel.pricing.ui";
const HOME_ENERGY_MANAGER_PANEL_SYNC_LOG_URL = "/local/ha-git/home_energy_manager_git_last.txt";
const HOME_ENERGY_MANAGER_INTERACTION_RENDER_HOLD_MS = 1800;
const HOME_ENERGY_MANAGER_SYNC_POLL_MS = 5000;
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
  { value: "forecast", label: "Forecast", icon: "⛅" },
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
    this._renderHoldUntil = 0;
    this._batterySelectorHoldUntil = 0;
    this._batterySelectorOpen = false;
    this._deferredRenderTimer = null;
    this._syncLogTimer = null;
    this._delegatedHandlersBound = false;
    this._boundLocationChange = this._handleLocationChange.bind(this);
  }

  setConfig(config) {
    this._config = config || {};
    this._syncStoredState();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._isSharedBatterySelectorHeld()) {
      this._holdRenderWindow(5000);
      return;
    }
    if (this._shouldHoldRender()) {
      this._queueDeferredRender();
      return;
    }
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
    window.addEventListener("hashchange", this._boundLocationChange);
    window.addEventListener("popstate", this._boundLocationChange);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this._boundLocationChange);
    window.removeEventListener("popstate", this._boundLocationChange);
    this._clearSyncLogTimer();
  }

  _shouldHoldRender() {
    return Date.now() < this._renderHoldUntil;
  }

  _holdRenderWindow(duration = HOME_ENERGY_MANAGER_INTERACTION_RENDER_HOLD_MS) {
    this._renderHoldUntil = Math.max(this._renderHoldUntil, Date.now() + duration);
    this._queueDeferredRender();
  }

  _holdBatterySelectorWindow(duration = 8000) {
    this._batterySelectorHoldUntil = Math.max(this._batterySelectorHoldUntil, Date.now() + duration);
    this._holdRenderWindow(duration);
  }

  _isPricingInteractionTarget(target) {
    return target?.dataset?.pricingField !== undefined
      || target?.dataset?.pricingHolidayField !== undefined
      || target?.dataset?.pricingGroupField !== undefined
      || target?.dataset?.pricingRuleField !== undefined
      || target?.dataset?.pricingRuleDay !== undefined;
  }

  _queueDeferredRender() {
    if (this._deferredRenderTimer) {
      clearTimeout(this._deferredRenderTimer);
    }
    const delay = Math.max(0, this._renderHoldUntil - Date.now());
    this._deferredRenderTimer = window.setTimeout(() => {
      this._deferredRenderTimer = null;
      if (!this._shouldHoldRender()) {
        this._render();
      }
    }, delay + 10);
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
      const url = new URL(window.location.href);
      const hashPage = new URLSearchParams(String(url.hash || "").replace(/^#/, "")).get(HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY);
      const queryPage = url.searchParams.get(HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY);
      return this._normalizePage(
        hashPage || queryPage || localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_PAGE_KEY) || "overview",
      );
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

  _loadSettingsFocus() {
    try {
      return localStorage.getItem("home-energy-manager.panel.settings.focus") || "entities";
    } catch (error) {
      return "entities";
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
      const normalizedPage = this._normalizePage(page);
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_PAGE_KEY, normalizedPage);
      this._syncPageUrl(normalizedPage);
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _loadBatterySelection() {
    try {
      return String(localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_BATTERY_KEY) || "").trim();
    } catch (error) {
      return "";
    }
  }

  _saveBatterySelection(option) {
    try {
      const value = String(option || "").trim();
      if (value) {
        localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_BATTERY_KEY, value);
      } else {
        localStorage.removeItem(HOME_ENERGY_MANAGER_PANEL_BATTERY_KEY);
      }
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _syncPageUrl(page) {
    try {
      const url = new URL(window.location.href);
      url.hash = `${HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY}=${encodeURIComponent(this._normalizePage(page))}`;
      window.history.replaceState({}, "", url);
    } catch (error) {
      // Ignore URL sync failures in sandboxed or restricted environments.
    }
  }

  _saveDebugEnabled(enabled) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_DEBUG_KEY, enabled ? "true" : "false");
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _saveSettingsFocus(focus) {
    try {
      localStorage.setItem("home-energy-manager.panel.settings.focus", focus);
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _syncLogPath() {
    return HOME_ENERGY_MANAGER_PANEL_SYNC_LOG_URL;
  }

  _clearSyncLogTimer() {
    if (this._syncLogTimer) {
      window.clearInterval(this._syncLogTimer);
      this._syncLogTimer = null;
    }
  }

  async _loadSyncLog() {
    if (!this.shadowRoot) {
      return;
    }

    const logEl = this.shadowRoot.querySelector("[data-sync-log]");
    const metaEl = this.shadowRoot.querySelector("[data-sync-log-meta]");
    if (!logEl || !metaEl) {
      return;
    }

    metaEl.textContent = "Refreshing...";

    try {
      const response = await fetch(`${this._syncLogPath()}?_=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      logEl.textContent = text || "(log is empty)";
      metaEl.textContent = `Updated ${new Date().toLocaleString()}`;
    } catch (error) {
      logEl.textContent = `Unable to load sync log: ${error.message}`;
      metaEl.textContent = `Updated ${new Date().toLocaleString()}`;
    }
  }

  _startSyncLogPolling() {
    if (this._page !== "settings") {
      this._clearSyncLogTimer();
      return;
    }

    if (this._syncLogTimer) {
      return;
    }

    this._syncLogTimer = window.setInterval(() => {
      this._loadSyncLog();
    }, HOME_ENERGY_MANAGER_SYNC_POLL_MS);
  }

  _loadPricingDraft() {
    try {
      return JSON.parse(localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_PRICING_DRAFT_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  _savePricingDraft(draft) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_PRICING_DRAFT_KEY, JSON.stringify(draft || {}));
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _clearPricingDraft() {
    try {
      localStorage.removeItem(HOME_ENERGY_MANAGER_PANEL_PRICING_DRAFT_KEY);
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

  _pageHref(page) {
    try {
      const url = new URL(window.location.href);
      url.hash = `${HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY}=${encodeURIComponent(this._normalizePage(page))}`;
      return url.toString();
    } catch (error) {
      return `#${HOME_ENERGY_MANAGER_PANEL_PAGE_FRAGMENT_KEY}=${encodeURIComponent(this._normalizePage(page))}`;
    }
  }

  _availablePages() {
    return HOME_ENERGY_MANAGER_PANEL_PAGES.filter((page) => page.value !== "debug" || this._debugEnabled);
  }

  _syncStoredState() {
    this._theme = this._loadTheme();
    this._debugEnabled = this._loadDebugEnabled();
    this._page = this._loadPage();
  }

  _handleLocationChange() {
    const nextPage = this._loadPage();
    if (nextPage !== this._page) {
      this._page = nextPage;
    }
    this._render();
  }

  _states() {
    return Object.values(this._hass?.states || {});
  }

  _configuredEntityId(key) {
    const entityId = String(this._config?.[key] || "").trim();
    return entityId || null;
  }

  _configuredEntityState(key, fallback = "Unavailable") {
    const entityId = this._configuredEntityId(key);
    if (!entityId) {
      return fallback;
    }
    return this._formatEntityState(this._hass?.states?.[entityId], fallback);
  }

  _stateForConfiguredEntity(configKey, fallbackKey, domain = "sensor", fallback = "Unavailable") {
    const configured = this._configuredEntityState(configKey, null);
    if (configured !== null && configured !== undefined) {
      return configured;
    }
    return this._formattedState(fallbackKey, domain, fallback);
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

  _connectionName() {
    const rawName =
      this._config?.provider_label ||
      this._config?.provider ||
      this._config?.connection_name ||
      this._config?.connection_label ||
      "Home Energy Manager";
    const normalized = String(rawName || "").trim();

    if (!normalized) {
      return "Home Energy Manager";
    }

    if (/^home energy manager$/i.test(normalized)) {
      return "Home Energy Manager";
    }

    if (/^[a-z0-9_-]+$/i.test(normalized)) {
      return normalized
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    return normalized;
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

  _pricingScheduleEntity() {
    return this._entityByKey("pricing_schedule");
  }

  _pricingScheduleData() {
    const entity = this._pricingScheduleEntity();
    const attributes = entity?.attributes || {};
    const rules = Array.isArray(attributes.rules) ? attributes.rules : [];
    const holidayDates = Array.isArray(attributes.holiday_dates) ? attributes.holiday_dates : [];
    const dateMap = attributes.date_map && typeof attributes.date_map === "object" ? attributes.date_map : {};
    const activeRule = attributes.active_rule && typeof attributes.active_rule === "object"
      ? attributes.active_rule
      : null;
    return {
      state: entity?.state || "Unavailable",
      ruleCount: Number(attributes.rule_count ?? rules.length ?? 0),
      holidayCount: Number(attributes.holiday_count ?? holidayDates.length ?? 0),
      holidaySource: String(attributes.holiday_source || "manual"),
      region: String(attributes.region || ""),
      holidayDates,
      dateMap,
      rules,
      activeRule,
      updatedAt: String(attributes.updated_at || ""),
      activeType: String(attributes.active_type || ""),
      activeProvider: String(attributes.active_provider || ""),
    };
  }

  _pricingUiDefaults() {
    return {
      groups: [],
      activeGroupId: "",
      warning: "",
    };
  }

  _loadPricingUi() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOME_ENERGY_MANAGER_PANEL_PRICING_UI_KEY) || "{}") || {};
      return {
        ...this._pricingUiDefaults(),
        ...parsed,
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      };
    } catch (error) {
      return this._pricingUiDefaults();
    }
  }

  _savePricingUi(model) {
    try {
      localStorage.setItem(HOME_ENERGY_MANAGER_PANEL_PRICING_UI_KEY, JSON.stringify({
        ...this._pricingUiDefaults(),
        ...(model || {}),
        groups: Array.isArray(model?.groups) ? model.groups : [],
      }));
    } catch (error) {
      // Ignore storage failures in private browsing / restricted environments.
    }
  }

  _pricingUiGroupDefaults() {
    return {
      group_id: "",
      label: "",
      provider: this._connectionName(),
      plan_name: "",
      effective_start_date: new Date().toISOString().slice(0, 10),
      pricing_type: "dynamic",
      daily_connection_charge: "",
      other_charges: "",
      notes: "",
      rules: [],
    };
  }

  _pricingUiRuleDefaults() {
    return {
      rule_id: "",
      label: "",
      day_types: ["mon", "tue", "wed", "thu", "fri"],
      start_time: "00:00",
      end_time: "23:59",
      import_rate: "",
      export_rate: "",
      export_tier_1_limit: "",
      export_tier_1_rate: "",
      export_tier_2_rate: "",
      controlled_load_rate: "",
      other_charges: "",
      notes: "",
    };
  }

  _pricingUiActiveGroup(model = this._loadPricingUi()) {
    const groups = Array.isArray(model.groups) ? model.groups : [];
    return groups.find((group) => String(group.group_id || "") === String(model.activeGroupId || ""))
      || groups[0]
      || null;
  }

  _readPricingUiGroupForm() {
    const defaults = this._pricingUiGroupDefaults();
    if (!this.shadowRoot) {
      return defaults;
    }
    const form = {};
    this.shadowRoot.querySelectorAll("[data-pricing-group-field]").forEach((field) => {
      const key = field.dataset.pricingGroupField;
      if (key) {
        form[key] = String(field.value || "");
      }
    });
    return {
      ...defaults,
      ...form,
      group_id: String(form.group_id || "").trim() || this._generateRuleId(),
      label: String(form.label || "").trim() || `Rates from ${form.effective_start_date || defaults.effective_start_date}`,
      provider: String(form.provider || "").trim(),
      plan_name: String(form.plan_name || "").trim(),
      effective_start_date: String(form.effective_start_date || defaults.effective_start_date).trim(),
      pricing_type: String(form.pricing_type || defaults.pricing_type).trim().toLowerCase(),
      daily_connection_charge: String(form.daily_connection_charge || "").trim(),
      other_charges: String(form.other_charges || "").trim(),
      notes: String(form.notes || "").trim(),
      rules: [],
    };
  }

  _readPricingUiRuleForm() {
    const defaults = this._pricingUiRuleDefaults();
    if (!this.shadowRoot) {
      return defaults;
    }
    const form = {};
    this.shadowRoot.querySelectorAll("[data-pricing-rule-field]").forEach((field) => {
      const key = field.dataset.pricingRuleField;
      if (!key) {
        return;
      }
      if (field.type === "checkbox") {
        return;
      }
      form[key] = String(field.value || "");
    });
    const dayTypes = Array.from(this.shadowRoot.querySelectorAll("[data-pricing-rule-day]:checked"))
      .map((field) => String(field.dataset.pricingRuleDay || ""))
      .filter(Boolean);
    return {
      ...defaults,
      ...form,
      rule_id: String(form.rule_id || "").trim() || this._generateRuleId(),
      label: String(form.label || "").trim() || "Unnamed rate window",
      day_types: dayTypes.length ? dayTypes : defaults.day_types,
      start_time: String(form.start_time || defaults.start_time).trim(),
      end_time: String(form.end_time || defaults.end_time).trim(),
      import_rate: String(form.import_rate || "").trim(),
      export_rate: String(form.export_rate || form.export_tier_1_rate || "").trim(),
      export_tier_1_limit: String(form.export_tier_1_limit || "").trim(),
      export_tier_1_rate: String(form.export_tier_1_rate || "").trim(),
      export_tier_2_rate: String(form.export_tier_2_rate || "").trim(),
      controlled_load_rate: String(form.controlled_load_rate || "").trim(),
      other_charges: String(form.other_charges || "").trim(),
      notes: String(form.notes || "").trim(),
    };
  }

  _pricingTimeToMinutes(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  _pricingRuleSegments(rule) {
    const start = this._pricingTimeToMinutes(rule.start_time);
    const end = this._pricingTimeToMinutes(rule.end_time);
    if (start === null || end === null || start === end) {
      return [];
    }
    if (end > start) {
      return [{ start, end }];
    }
    return [
      { start, end: 1440 },
      { start: 0, end },
    ];
  }

  _pricingRulesOverlap(ruleA, ruleB) {
    const daysA = Array.isArray(ruleA.day_types) ? ruleA.day_types : [];
    const daysB = Array.isArray(ruleB.day_types) ? ruleB.day_types : [];
    if (!daysA.some((day) => daysB.includes(day))) {
      return false;
    }
    const segmentsA = this._pricingRuleSegments(ruleA);
    const segmentsB = this._pricingRuleSegments(ruleB);
    return segmentsA.some((a) => segmentsB.some((b) => a.start < b.end && b.start < a.end));
  }

  _pricingUiValidationForRule(group, candidateRule, existingRuleId = "") {
    if (!candidateRule.label || !candidateRule.start_time || !candidateRule.end_time) {
      return "Rule label, start time, and end time are required.";
    }
    if (this._pricingRuleSegments(candidateRule).length === 0) {
      return "Rule start and end time must be valid and cannot be the same.";
    }
    if (candidateRule.export_tier_1_limit && !candidateRule.export_tier_1_rate) {
      return "Sell tariff first block rate is required when a first block kWh limit is set.";
    }
    if (candidateRule.export_tier_2_rate && (!candidateRule.export_tier_1_limit || !candidateRule.export_tier_1_rate)) {
      return "Sell tariff remainder rate needs a first block kWh limit and first block rate.";
    }
    const rules = Array.isArray(group?.rules) ? group.rules : [];
    const overlap = rules.find((rule) => (
      String(rule.rule_id || "") !== String(existingRuleId || "") &&
      this._pricingRulesOverlap(rule, candidateRule)
    ));
    if (overlap) {
      return `Overlaps with "${overlap.label || "Unnamed rate window"}". Change the day or time before saving.`;
    }
    return "";
  }

  _pricingUiSortedGroups(model = this._loadPricingUi()) {
    return [...(Array.isArray(model.groups) ? model.groups : [])].sort((a, b) => (
      String(b.effective_start_date || "").localeCompare(String(a.effective_start_date || ""))
    ));
  }

  _handlePricingUiAddGroup() {
    const model = this._loadPricingUi();
    const group = this._readPricingUiGroupForm();
    if (!group.effective_start_date) {
      model.warning = "Rate group effective start date is required.";
      this._savePricingUi(model);
      this._render();
      return;
    }
    if ((model.groups || []).some((item) => String(item.effective_start_date || "") === group.effective_start_date)) {
      model.warning = `A rate group already starts on ${group.effective_start_date}. Delete it or choose a different start date.`;
      this._savePricingUi(model);
      this._render();
      return;
    }
    model.groups = [...(model.groups || []), group];
    model.activeGroupId = group.group_id;
    model.warning = "";
    this._savePricingUi(model);
    this._render();
  }

  _handlePricingUiSelectGroup(groupId) {
    const model = this._loadPricingUi();
    model.activeGroupId = String(groupId || "");
    model.warning = "";
    this._savePricingUi(model);
    this._render();
  }

  _handlePricingUiDeleteGroup(groupId) {
    const model = this._loadPricingUi();
    const deleteGroupId = String(groupId || "");
    model.groups = (model.groups || []).filter((group) => String(group.group_id || "") !== deleteGroupId);
    if (String(model.activeGroupId || "") === deleteGroupId) {
      model.activeGroupId = model.groups[0]?.group_id || "";
    }
    model.warning = "";
    this._savePricingUi(model);
    this._render();
  }

  _handlePricingUiAddRule() {
    const model = this._loadPricingUi();
    const group = this._pricingUiActiveGroup(model);
    if (!group) {
      model.warning = "Add or select a rate group before adding records.";
      this._savePricingUi(model);
      this._render();
      return;
    }
    const rule = this._readPricingUiRuleForm();
    const warning = this._pricingUiValidationForRule(group, rule);
    if (warning) {
      model.warning = warning;
      this._savePricingUi(model);
      this._render();
      return;
    }
    group.rules = [...(Array.isArray(group.rules) ? group.rules : []), rule];
    model.warning = "";
    this._savePricingUi(model);
    this._render();
  }

  _handlePricingUiDeleteRule(ruleId) {
    const model = this._loadPricingUi();
    const group = this._pricingUiActiveGroup(model);
    if (!group) {
      return;
    }
    const deleteRuleId = String(ruleId || "");
    group.rules = (Array.isArray(group.rules) ? group.rules : []).filter((rule) => String(rule.rule_id || "") !== deleteRuleId);
    model.warning = "";
    this._savePricingUi(model);
    this._render();
  }

  _pricingDraftDefaults() {
    return {
      rule_id: "",
      effective_date: new Date().toISOString().slice(0, 10),
      effective_time: "00:00",
      effective_end_date: "",
      effective_end_time: "",
      pricing_type: "fixed",
      provider: this._connectionName(),
      label: "",
      import_rate: "",
      export_rate: "",
      supply_charge: "",
      controlled_load_1: "",
      controlled_load_2: "",
      additional_charge: "",
      holiday_only: false,
      days_of_week: [],
      notes: "",
      region: "",
      holiday_source: "manual",
    };
  }

  _pricingDraft() {
    return { ...this._pricingDraftDefaults(), ...this._loadPricingDraft() };
  }

  _savePricingDraftValue(field, value) {
    const draft = this._pricingDraft();
    draft[field] = value;
    this._savePricingDraft(draft);
  }

  _pricingRuleById(ruleId) {
    const schedule = this._pricingScheduleData();
    return schedule.rules.find((rule) => String(rule.rule_id || "") === String(ruleId || ""));
  }

  _formatPricingRate(value, unit = "c/kWh") {
    if (value === null || value === undefined || value === "") {
      return "Not set";
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return String(value);
    }
    return `${numeric.toFixed(3).replace(/\.?0+$/, "")} ${unit}`;
  }

  _pricingFormDraft() {
    const draft = this._pricingDraftDefaults();
    if (!this.shadowRoot) {
      return draft;
    }

    this.shadowRoot.querySelectorAll("[data-pricing-field]").forEach((field) => {
      const key = field.dataset.pricingField;
      if (!key) {
        return;
      }
      if (field.type === "checkbox") {
        draft[key] = Boolean(field.checked);
        return;
      }
      if (field.tagName === "SELECT") {
        draft[key] = String(field.value || "");
        return;
      }
      draft[key] = String(field.value || "");
    });

    this.shadowRoot.querySelectorAll("[data-pricing-holiday-field]").forEach((field) => {
      const key = field.dataset.pricingHolidayField;
      if (!key) {
        return;
      }
      draft[key] = String(field.value || "");
    });

    return draft;
  }

  _pricingPayloadFromDraft(draft) {
    const payload = { ...this._pricingDraftDefaults(), ...draft };
    const ruleId = String(payload.rule_id || "").trim();
    if (!ruleId) {
      payload.rule_id = this._generateRuleId();
    }
    payload.effective_date = String(payload.effective_date || "").trim();
    payload.effective_time = String(payload.effective_time || "00:00").trim() || "00:00";
    payload.effective_end_date = String(payload.effective_end_date || "").trim();
    payload.effective_end_time = String(payload.effective_end_time || "").trim();
    payload.pricing_type = String(payload.pricing_type || "fixed").trim().toLowerCase();
    payload.provider = String(payload.provider || "").trim();
    payload.label = String(payload.label || "").trim();
    payload.import_rate = String(payload.import_rate ?? "").trim() === "" ? null : Number(payload.import_rate);
    payload.export_rate = String(payload.export_rate ?? "").trim() === "" ? null : Number(payload.export_rate);
    payload.supply_charge = String(payload.supply_charge ?? "").trim() === "" ? null : Number(payload.supply_charge);
    payload.controlled_load_1 = String(payload.controlled_load_1 ?? "").trim() === "" ? null : Number(payload.controlled_load_1);
    payload.controlled_load_2 = String(payload.controlled_load_2 ?? "").trim() === "" ? null : Number(payload.controlled_load_2);
    payload.additional_charge = String(payload.additional_charge ?? "").trim() === "" ? null : Number(payload.additional_charge);
    payload.holiday_only = Boolean(payload.holiday_only);
    payload.days_of_week = Array.isArray(payload.days_of_week) ? payload.days_of_week : [];
    payload.notes = String(payload.notes || "").trim();
    payload.region = String(payload.region || "").trim();
    payload.holiday_source = String(payload.holiday_source || "manual").trim() || "manual";
    payload.holiday_date = String(payload.holiday_date || "").trim();
    return payload;
  }

  _generateRuleId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  _syncPricingDraftFromInputs() {
    const draft = this._pricingFormDraft();
    this._savePricingDraft(draft);
    return draft;
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

  _panelCounts() {
    const entities = this._states().length;
    const managed = this._managedEntities().length;
    const sensors = this._entityCountByDomain("sensor");
    const controls =
      this._entityCountByDomain("switch") +
      this._entityCountByDomain("number") +
      this._entityCountByDomain("time") +
      this._entityCountByDomain("button") +
      this._entityCountByDomain("select");
    return { entities, managed, sensors, controls };
  }

  _listEntityPreview(pattern, limit = 5) {
    const items = this._matchedEntities(pattern)
      .slice(0, limit)
      .map((entity) => entity.entity_id);
    return items.length ? items.join(", ") : "Unavailable";
  }

  _settingsFocusCards() {
    const counts = this._panelCounts();
    return [
      {
        key: "entities",
        label: "Entities",
        value: String(counts.entities),
        note: "All Home Assistant entities currently loaded.",
        description: "Use this to confirm the panel is reading the full Home Assistant state machine.",
        items: [
          { label: "Total entities", value: String(counts.entities) },
          { label: "Active page", value: this._pageLabel() },
          { label: "Connection", value: this._connectionName() },
        ],
      },
      {
        key: "managed",
        label: "Managed",
        value: String(counts.managed),
        note: "Entities provided by Home Energy Manager (HEM).",
        description: "These are the entities the integration is explicitly exposing for the panel.",
        items: [
          { label: "Managed entities", value: String(counts.managed) },
          { label: "Provider", value: this._config.provider || "Configured provider" },
          { label: "Entity prefix", value: this._config.entity_prefix || "home_energy_manager" },
        ],
      },
      {
        key: "sensors",
        label: "Sensors",
        value: String(counts.sensors),
        note: "Monitoring and history surfaces.",
        description: "Sensor values are the live telemetry source for the panel and reporting views.",
        items: [
          { label: "Sensor count", value: String(counts.sensors) },
          { label: "Sample sensors", value: this._listEntityPreview(/^sensor\./, 5) },
        ],
      },
      {
        key: "controls",
        label: "Controls",
        value: String(counts.controls),
        note: "Switches, numbers, selects, times, buttons.",
        description: "Controls are the entities the user can press, toggle, or adjust from the panel.",
        items: [
          { label: "Control count", value: String(counts.controls) },
          { label: "Sample controls", value: this._listEntityPreview(/^(switch|number|time|button|select)\./, 5) },
        ],
      },
    ];
  }

  _settingsFocusDetail(focusKey) {
    return this._settingsFocusCards().find((card) => card.key === focusKey) || this._settingsFocusCards()[0];
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
            workflows in HEM. The panel stays focused on the most useful actions first.
          </p>
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
            The battery page is the day-to-day control surface for charge and discharge
            policy, safety limits, and provider-specific battery modes.
          </p>
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
            This page shows the live policy summary inside the HEM panel so battery charge and
            feed-in rules stay in one place.
          </p>
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
            The report view shows a live summary from the HEM sensors so you can see current
            data while history continues to build.
          </p>
        </article>

        <section class="report__stack">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Report Output</h2>
              <span>Live summary</span>
            </div>
            <p>
            This live report summary is built from the HEM sensors so you still get a visible
            output even before the longer history archive is ready.
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
      { label: "Forecast today", value: this._stateForConfiguredEntity("forecast_generation_today_entity", "forecast_generation_today") },
      { label: "Forecast tomorrow", value: this._stateForConfiguredEntity("forecast_generation_tomorrow_entity", "forecast_generation_tomorrow") },
    ];
    const solarSummary = [
      { label: "Solar now", value: this._formattedState("pv_power") },
      { label: "Grid now", value: this._formattedState("grid_consumption") },
      { label: "Feed in today", value: this._formattedState("feed_in_today") },
      { label: "Forecast today", value: this._stateForConfiguredEntity("forecast_generation_today_entity", "forecast_generation_today") },
    ];
    return `
      <section class="solar">
        <article class="panel-card panel-card--wide solar__hero">
          <div class="panel-card__header">
            <h2>Solar Control</h2>
            <span>Generation layer</span>
          </div>
            <p>
            Solar is where we’ll surface live generation, feed-in, and future forecasting so the
            panel can guide battery and pricing decisions from the same place.
          </p>
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
            This is the current solar view from Home Assistant. As we continue, it can become a
            daily operations page for power flows and solar forecasts.
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
                { label: "Forecast today", value: this._stateForConfiguredEntity("forecast_generation_today_entity", "forecast_generation_today") },
                { label: "Forecast tomorrow", value: this._stateForConfiguredEntity("forecast_generation_tomorrow_entity", "forecast_generation_tomorrow") },
                { label: "Solar forecast", value: this._stateForConfiguredEntity("solar_forecast_entity", "solar_forecast") },
                { label: "Solar page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
        </section>
      </section>
    `;
  }

  _forecastPage() {
    const forecastItems = [
      { label: "Forecast provider", value: this._config?.forecast_provider || "none" },
      { label: "Forecast today", value: this._stateForConfiguredEntity("forecast_generation_today_entity", "forecast_generation_today") },
      { label: "Forecast tomorrow", value: this._stateForConfiguredEntity("forecast_generation_tomorrow_entity", "forecast_generation_tomorrow") },
      { label: "Solar forecast", value: this._stateForConfiguredEntity("solar_forecast_entity", "solar_forecast") },
    ];
    return `
      <section class="forecast">
        <article class="panel-card panel-card--wide forecast__hero">
          <div class="panel-card__header">
            <h2>Forecast</h2>
            <span>Solar outlook</span>
          </div>
          <p>
            This page is wired to the forecast integration you selected during setup. If the
            forecast entities are missing, they will show as unavailable until the provider
            integration starts publishing data.
          </p>
        </article>

        <section class="forecast__tiles">
          ${forecastItems.map((item) => `
            <article class="forecast-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid forecast__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Forecast Setup</h2>
              <span>Configured entities</span>
            </div>
            <p>
              The panel reads the forecast entity IDs you choose during installation so the
              Solar page can show forecast data without assuming a single vendor.
            </p>
            <ul class="key-list key-list--compact">
              ${this._valueList([
                { label: "Today entity", value: this._configuredEntityId("forecast_generation_today_entity") || "Not set" },
                { label: "Tomorrow entity", value: this._configuredEntityId("forecast_generation_tomorrow_entity") || "Not set" },
                { label: "Solar forecast entity", value: this._configuredEntityId("solar_forecast_entity") || "Not set" },
                { label: "Forecast page", value: this._pageLabel() },
              ])}
            </ul>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Forecast Notes</h2>
              <span>Live data</span>
            </div>
            <p>
              If you use forecast.solar or another integration, wire those sensor entities in
              here once and the panel will surface them on both the forecast and solar pages.
            </p>
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
    const model = this._loadPricingUi();
    const groups = this._pricingUiSortedGroups(model);
    const activeGroup = this._pricingUiActiveGroup({ ...model, groups }) || this._pricingUiGroupDefaults();
    const activeRules = Array.isArray(activeGroup.rules) ? activeGroup.rules : [];
    const ruleDraft = this._pricingUiRuleDefaults();
    const groupDraft = {
      ...this._pricingUiGroupDefaults(),
      provider: activeGroup.provider || this._connectionName(),
    };
    const overlapWarnings = activeRules
      .flatMap((rule, index) => activeRules.slice(index + 1).map((other) => [rule, other]))
      .filter(([rule, other]) => this._pricingRulesOverlap(rule, other))
      .map(([rule, other]) => `${rule.label || "Unnamed"} overlaps ${other.label || "Unnamed"}`);
    const ruleTiles = [
      { label: "Rate groups", value: String(groups.length) },
      { label: "Active group rules", value: String(activeRules.length) },
      { label: "Active type", value: String(activeGroup.pricing_type || "dynamic") },
      { label: "Effective from", value: String(activeGroup.effective_start_date || "Not set") },
    ];
    const groupCards = groups.length
      ? groups.map((group) => {
          const isActive = String(group.group_id || "") === String(activeGroup.group_id || "");
          const nextGroup = groups
            .filter((item) => String(item.effective_start_date || "") > String(group.effective_start_date || ""))
            .sort((a, b) => String(a.effective_start_date || "").localeCompare(String(b.effective_start_date || "")))[0];
          return `
            <article class="pricing-rule ${isActive ? "is-selected" : ""}">
              <div class="pricing-rule__header">
                <div>
                  <strong>${this._escapeHtml(String(group.label || "Unnamed rate group"))}</strong>
                  <span>${this._escapeHtml(String(group.provider || "Provider not set"))}${group.plan_name ? ` · ${this._escapeHtml(String(group.plan_name))}` : ""}</span>
                </div>
                <div class="pricing-rule__actions">
                  <button type="button" class="panel-nav__item pricing-rule__button" data-pricing-ui-select-group="${this._escapeHtml(String(group.group_id || ""))}">${isActive ? "Selected" : "Select"}</button>
                  <button type="button" class="panel-nav__item pricing-rule__button" data-pricing-ui-delete-group="${this._escapeHtml(String(group.group_id || ""))}">Delete group</button>
                </div>
              </div>
              <dl class="pricing-rule__meta">
                <div><dt>Starts</dt><dd>${this._escapeHtml(String(group.effective_start_date || "Not set"))}</dd></div>
                <div><dt>Superseded</dt><dd>${nextGroup ? this._escapeHtml(String(nextGroup.effective_start_date || "")) : "When next group starts"}</dd></div>
                <div><dt>Type</dt><dd>${this._escapeHtml(String(group.pricing_type || "dynamic"))}</dd></div>
                <div><dt>Rules</dt><dd>${Array.isArray(group.rules) ? group.rules.length : 0}</dd></div>
              </dl>
              <div class="pricing-rule__rates">
                <span>Daily connection ${this._escapeHtml(this._formatPricingRate(group.daily_connection_charge, "$/day"))}</span>
                ${group.other_charges ? `<span>${this._escapeHtml(String(group.other_charges))}</span>` : ""}
              </div>
            </article>
          `;
        }).join("")
      : '<article class="pricing-rule pricing-rule--empty"><strong>No rate groups yet.</strong><span>Add the first group, e.g. “Rates from Jan 1”.</span></article>';
    const ruleCards = activeRules.length
      ? activeRules.map((rule) => {
          const rateBits = [
            rule.import_rate !== null && rule.import_rate !== undefined ? `Import ${this._formatPricingRate(rule.import_rate)}` : null,
            rule.export_tier_1_rate || rule.export_tier_2_rate
              ? `Sell ${rule.export_tier_1_limit ? `first ${rule.export_tier_1_limit} kWh at ` : ""}${this._formatPricingRate(rule.export_tier_1_rate || rule.export_rate)}${rule.export_tier_2_rate ? `, then ${this._formatPricingRate(rule.export_tier_2_rate)}` : ""}`
              : (rule.export_rate !== null && rule.export_rate !== undefined ? `Sell ${this._formatPricingRate(rule.export_rate)}` : null),
            rule.controlled_load_rate !== null && rule.controlled_load_rate !== undefined ? `Controlled ${this._formatPricingRate(rule.controlled_load_rate)}` : null,
            rule.other_charges ? String(rule.other_charges) : null,
          ].filter(Boolean);
          return `
            <article class="pricing-rule">
              <div class="pricing-rule__header">
                <div>
                  <strong>${this._escapeHtml(String(rule.label || "Unnamed rule"))}</strong>
                  <span>${this._escapeHtml((Array.isArray(rule.day_types) ? rule.day_types : []).join(", ") || "No days selected")}</span>
                </div>
                <div class="pricing-rule__actions">
                  <button type="button" class="panel-nav__item pricing-rule__button" data-pricing-ui-delete-rule="${this._escapeHtml(String(rule.rule_id || ""))}">Delete record</button>
                </div>
              </div>
              <dl class="pricing-rule__meta">
                <div><dt>Days</dt><dd>${this._escapeHtml((Array.isArray(rule.day_types) ? rule.day_types : []).join(", ") || "Not set")}</dd></div>
                <div><dt>Start</dt><dd>${this._escapeHtml(String(rule.start_time || "00:00"))}</dd></div>
                <div><dt>End</dt><dd>${this._escapeHtml(String(rule.end_time || "23:59"))}</dd></div>
                <div><dt>Override</dt><dd>${Array.isArray(rule.day_types) && rule.day_types.includes("public_holiday") ? "Public holiday" : "Standard"}</dd></div>
              </dl>
              <div class="pricing-rule__rates">
                ${rateBits.length ? rateBits.map((bit) => `<span>${this._escapeHtml(bit)}</span>`).join("") : "<span>No rates set yet</span>"}
              </div>
              <p>
                ${rule.notes ? this._escapeHtml(String(rule.notes)) : "No notes"}
              </p>
            </article>
          `;
        }).join("")
      : '<article class="pricing-rule pricing-rule--empty"><strong>No records in selected group.</strong><span>Add fixed or dynamic rate records below. Public holiday records override normal day records.</span></article>';
    const warningMarkup = model.warning || overlapWarnings.length
      ? `<div class="pricing-alert">${this._escapeHtml(model.warning || overlapWarnings.join("; "))}</div>`
      : "";
    return `
      <section class="pricing">
        <article class="panel-card panel-card--wide pricing__hero">
          <div class="panel-card__header">
            <h2>Pricing</h2>
            <span>Date-based schedule</span>
          </div>
          <p>
            Build date-effective rate groups here first. Each new group starts on its effective
            date and supersedes the older group. This is UI-only until we wire persistence and Workday.
          </p>
        </article>

        <section class="pricing__tiles">
          ${ruleTiles.map((item) => `
            <article class="pricing-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </article>
          `).join("")}
        </section>

        <section class="grid pricing__grid pricing__grid--editor">
          <article class="panel-card panel-card--wide pricing-editor-card pricing-group-card">
            <div class="panel-card__header">
              <h2>Rate Group</h2>
              <span>1 active group shown</span>
            </div>
            <p>
              Add a master rate group whenever your provider changes rates. The next group start
              date automatically supersedes prior rates.
            </p>
            ${warningMarkup}
            <div class="pricing-form">
              <label>
                <span>Group label</span>
                <input type="text" data-pricing-group-field="label" value="${this._escapeHtml(String(groupDraft.label || ""))}" placeholder="Rates from Jan 1" />
              </label>
              <label>
                <span>Effective start date</span>
                <input type="date" data-pricing-group-field="effective_start_date" value="${this._escapeHtml(String(groupDraft.effective_start_date || ""))}" />
              </label>
              <label>
                <span>Provider</span>
                <input type="text" data-pricing-group-field="provider" value="${this._escapeHtml(String(groupDraft.provider || ""))}" />
              </label>
              <label>
                <span>Plan name</span>
                <input type="text" data-pricing-group-field="plan_name" value="${this._escapeHtml(String(groupDraft.plan_name || ""))}" placeholder="Optional" />
              </label>
              <label>
                <span>Pricing type</span>
                <select data-pricing-group-field="pricing_type">
                  <option value="fixed">Fixed</option>
                  <option value="dynamic" selected>Dynamic</option>
                </select>
              </label>
              <label>
                <span>Daily connection charge</span>
                <input type="number" step="0.001" data-pricing-group-field="daily_connection_charge" value="" />
              </label>
              <label class="pricing-form__notes">
                <span>Other charges</span>
                <textarea data-pricing-group-field="other_charges" rows="2" placeholder="Named daily/usage charges the user wants to record"></textarea>
              </label>
              <label class="pricing-form__notes">
                <span>Notes</span>
                <textarea data-pricing-group-field="notes" rows="2" placeholder="Optional notes about this rate group"></textarea>
              </label>
            </div>
            <div class="pricing-form__actions">
              <button type="button" class="theme-pill" data-pricing-ui-add-group>Add rate group</button>
            </div>
            <div class="pricing-active-group">
              <span>Active group</span>
              <strong>${activeGroup.group_id ? this._escapeHtml(String(activeGroup.label || "Unnamed rate group")) : "No group yet"}</strong>
              <small>${activeGroup.group_id
                ? `${this._escapeHtml(String(activeGroup.provider || "Provider not set"))}${activeGroup.plan_name ? ` · ${this._escapeHtml(String(activeGroup.plan_name))}` : ""} · starts ${this._escapeHtml(String(activeGroup.effective_start_date || "not set"))}`
                : "Add a group first, then add rate records to it."}</small>
            </div>

            <section class="pricing-group-card__records">
              <div class="panel-card__header panel-card__header--nested">
                <h2>Rate Records</h2>
                <span>${activeRules.length} record(s) attached</span>
              </div>
              <p>
                Add records to the selected group only. Public holiday records override normal day records.
                Overlapping day/time windows are blocked before save.
              </p>
              <div class="pricing-holiday-form pricing-record-form">
                <label class="pricing-record-form__name">
                  <span>Tariff label</span>
                  <input type="text" data-pricing-rule-field="label" value="${this._escapeHtml(String(ruleDraft.label || ""))}" placeholder="Shoulder, PHOL, Peak..." />
                </label>
                <label class="pricing-record-form__time">
                  <span>Start time</span>
                  <input type="time" data-pricing-rule-field="start_time" value="${this._escapeHtml(String(ruleDraft.start_time))}" />
                </label>
                <label class="pricing-record-form__time">
                  <span>End time</span>
                  <input type="time" data-pricing-rule-field="end_time" value="${this._escapeHtml(String(ruleDraft.end_time))}" />
                </label>
                <label class="pricing-record-form__rate">
                  <span>Import rate ($/kWh)</span>
                  <input type="number" step="0.001" data-pricing-rule-field="import_rate" value="" />
                </label>
                <label class="pricing-record-form__rate">
                  <span>Controlled load ($/kWh)</span>
                  <input type="number" step="0.001" data-pricing-rule-field="controlled_load_rate" value="" />
                </label>
                <div class="pricing-field-group pricing-sell-form">
                  <span>Sell / feed-in tariff</span>
                  <div class="pricing-sell-form__grid">
                    <label>
                      <span>First block up to (kWh)</span>
                      <input type="number" step="1" min="0" data-pricing-rule-field="export_tier_1_limit" value="" placeholder="1000" />
                    </label>
                    <label>
                      <span>First block rate ($/kWh)</span>
                      <input type="number" step="0.001" min="0" data-pricing-rule-field="export_tier_1_rate" value="" placeholder="0.08" />
                    </label>
                    <label>
                      <span>Remainder rate ($/kWh)</span>
                      <input type="number" step="0.001" min="0" data-pricing-rule-field="export_tier_2_rate" value="" placeholder="0.02" />
                    </label>
                  </div>
                </div>
                <div class="pricing-field-group pricing-form__notes">
                  <span>Days / override</span>
                  <div class="pricing-day-grid">
                    ${["mon", "tue", "wed", "thu", "fri", "sat", "sun", "public_holiday"].map((day) => `
                      <label class="pricing-day-pill">
                        <input type="checkbox" data-pricing-rule-day="${day}" ${ruleDraft.day_types.includes(day) ? "checked" : ""} />
                        <span>${day === "public_holiday" ? "Public holiday" : day.toUpperCase()}</span>
                      </label>
                    `).join("")}
                  </div>
                </div>
                <label class="pricing-form__notes">
                  <span>Other charges</span>
                  <textarea data-pricing-rule-field="other_charges" rows="2" placeholder="Optional named charges for this record"></textarea>
                </label>
                <label class="pricing-form__notes">
                  <span>Notes</span>
                  <textarea data-pricing-rule-field="notes" rows="2" placeholder="Optional notes about this record"></textarea>
                </label>
                <div class="pricing-form__actions">
                  <button type="button" class="theme-pill" data-pricing-ui-add-rule ${activeGroup.group_id ? "" : "is-disabled"}" ${activeGroup.group_id ? "" : "disabled"}>Add record</button>
                </div>
              </div>
              <div class="pricing-rule-list pricing-rule-list--attached">
                ${ruleCards}
              </div>
            </section>
          </article>
        </section>

        <section class="grid pricing__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Rate Groups</h2>
              <span>${groups.length} group(s)</span>
            </div>
            <div class="pricing-rule-list">
              ${groupCards}
            </div>
          </article>
          <article class="panel-card">
            <div class="panel-card__header">
              <h2>Outstanding Integration</h2>
              <span>Later</span>
            </div>
            <p>
              This screen is intentionally UI-only. Next pass can connect Workday public holidays
              and save these groups through Home Assistant services once you approve the model.
            </p>
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
    const focusKey = this._loadSettingsFocus();
    const focusCards = this._settingsFocusCards();
    const activeFocus = this._settingsFocusDetail(focusKey);
    const syncStatusVisible = this._debugEnabled;
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
            <h2>Forecast Wiring</h2>
            <span>HEM</span>
          </div>
          <ul class="key-list key-list--compact">
            ${this._valueList([
              { label: "Forecast provider", value: this._config?.forecast_provider || "none" },
              { label: "Today entity", value: this._configuredEntityId("forecast_generation_today_entity") || "Not set" },
              { label: "Tomorrow entity", value: this._configuredEntityId("forecast_generation_tomorrow_entity") || "Not set" },
              { label: "Solar forecast entity", value: this._configuredEntityId("solar_forecast_entity") || "Not set" },
            ])}
          </ul>
        </article>
        <article class="panel-card">
          <div class="panel-card__header">
            <h2>HEM Settings</h2>
            <span>Local</span>
          </div>
          <div class="settings-toggle">
            <label class="toggle-row" for="hem-debug-toggle">
              <span class="toggle-row__label">Enable Debug</span>
              <span class="toggle-row__control">
                <input id="hem-debug-toggle" type="checkbox" data-debug-toggle aria-label="Enable debug mode" ${this._debugEnabled ? "checked" : ""} />
                <span class="toggle-row__switch" aria-hidden="true"></span>
              </span>
            </label>
            <p>
              HEM settings keep the panel device-agnostic while still exposing the debug page
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
        ${syncStatusVisible ? `
          <article class="panel-card panel-card--wide sync-status">
            <div class="panel-card__header">
              <h2>Sync Status</h2>
              <span data-sync-log-meta>Latest pull output</span>
            </div>
            <p>
              This shows the latest result from the Home Energy Manager pull script. If a pull
              fails, the reason appears here without opening the log file directly.
            </p>
            <div class="sync-status__actions">
              <button type="button" class="panel-nav__item" data-sync-refresh>Refresh sync status</button>
            </div>
            <pre class="sync-status__log" data-sync-log>Loading latest sync status...</pre>
          </article>
        ` : ""}
      </section>

      <section class="settings-metrics" aria-label="Panel metrics">
        ${focusCards.map((card) => `
          <button
            type="button"
            class="settings-metric ${card.key === activeFocus.key ? "is-active" : ""}"
            data-settings-focus="${card.key}"
          >
            <span>${card.label}</span>
            <strong>${card.value}</strong>
            <small>${card.note}</small>
          </button>
        `).join("")}
      </section>

      <article class="panel-card panel-card--wide settings-detail">
        <div class="panel-card__header">
          <h2>${activeFocus.label} Details</h2>
          <span>Select a metric above</span>
        </div>
        <p>${activeFocus.description}</p>
        <ul class="key-list key-list--compact">
          ${this._valueList(activeFocus.items)}
        </ul>
      </article>
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
            This page is reserved for deeper inspection of the Home Energy Manager (HEM) data model
            and the embedded diagnostics card. The controls stay device-agnostic.
          </p>
        </article>

        <section class="grid debug__grid">
          <article class="panel-card panel-card--wide">
            <div class="panel-card__header">
              <h2>Debug Snapshot</h2>
              <span>Internal</span>
            </div>
            <p>
              The values below should help confirm the panel is using the Home Energy Manager
              entities and that the provider data is flowing through correctly.
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
              This is the provider-aware diagnostics card used to inspect history, report data,
              and entity selection in one place.
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
      case "forecast":
        return this._forecastPage();
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

  _settingsTargetId() {
    const prefix = this._config?.entity_prefix || "home_energy_manager";
    return this._config?.settings_target || `select.house_${prefix}_settings_target`;
  }

  _settingsTargetState() {
    return this._hass?.states?.[this._settingsTargetId()] || null;
  }

  _isSharedBatterySelectorHeld() {
    if (Date.now() < this._batterySelectorHoldUntil) {
      return true;
    }

    if (!this.shadowRoot) {
      return false;
    }

    const selector = this.shadowRoot.querySelector("[data-shared-settings-target-toggle], [data-shared-settings-target-option]");
    if (!selector) {
      return false;
    }

    const activeElement = this.shadowRoot.activeElement || selector.ownerDocument?.activeElement;
    return activeElement === selector || selector.matches(":focus") || selector.matches(":focus-within");
  }

  _closeSharedBatterySelector() {
    this._batterySelectorOpen = false;
    this._holdBatterySelectorWindow(600);
    this._render();
  }

  _openSharedBatterySelector() {
    this._batterySelectorOpen = true;
    this._holdBatterySelectorWindow();
    this._render();
  }

  _renderSharedBatterySelector() {
    const selector = this._settingsTargetState();
    const options = Array.isArray(selector?.attributes?.options) ? selector.attributes.options : [];
    const current = String(selector?.state || "").trim();
    const storedSelection = this._loadBatterySelection();
    const selectedOption = options.includes(storedSelection)
      ? storedSelection
      : options.includes(current) && current !== "unavailable"
        ? current
        : "All systems";
    const hasOptions = options.length > 0;
    const selectedLabel = hasOptions ? selectedOption : "No batteries available";
    const dropdown = this._batterySelectorOpen && hasOptions
      ? `
          <div class="shared-selector__menu" role="listbox" aria-label="Battery Selection">
            ${options
              .map((option) => {
                const selected = option === selectedOption;
                return `
                  <button
                    type="button"
                    class="shared-selector__option ${selected ? "is-selected" : ""}"
                    role="option"
                    aria-selected="${selected ? "true" : "false"}"
                    data-shared-settings-target-option="${this._escapeHtml(option)}"
                  >
                    ${this._escapeHtml(option)}
                  </button>
                `;
              })
              .join("")}
          </div>
        `
      : "";
    return `
      <div class="shared-selector">
        <div class="shared-selector__label" id="hem-shared-battery-label">Battery Selection</div>
        <div class="shared-selector__picker">
          <button
            type="button"
            class="shared-selector__control"
            aria-haspopup="listbox"
            aria-expanded="${this._batterySelectorOpen && hasOptions ? "true" : "false"}"
            aria-labelledby="hem-shared-battery-label"
            data-shared-settings-target-toggle="${this._settingsTargetId()}"
            ${hasOptions ? "" : "disabled"}
          >
            <span>${this._escapeHtml(selectedLabel)}</span>
          </button>
          ${dropdown}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const connectionName = this._connectionName();
    const connectionLabel = this._hass ? `Connected to ${connectionName}` : `Waiting for ${connectionName}`;
    const title = this._config.title || "Home Energy Manager (HEM)";
    const subtitle = this._config.subtitle || "Daily control surface for Home Energy Manager (HEM).";
    const statusMeta = this._page === "settings"
      ? `
          <div class="status__meta">
            <span>Theme: <strong>${this._themeLabel()}</strong></span>
          </div>
        `
      : "";
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

        <nav class="panel-nav" aria-label="Home Energy Manager (HEM) sections">
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
          ${statusMeta}
          ${this._renderSharedBatterySelector()}
        </section>

        ${this._pageContent()}
      </section>
    `;

    this._mountEmbeddedCards();
    this._bindInteractiveControls();
  }

  _bindInteractiveControls() {
    if (!this.shadowRoot) {
      return;
    }

    this.shadowRoot.querySelectorAll('[data-theme]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._setTheme(button.dataset.theme);
      };
    });

    this.shadowRoot.querySelectorAll('[data-page]').forEach((button) => {
      if (button.tagName === "A") {
        return;
      }
      button.onclick = (event) => {
        if (button.disabled) {
          return;
        }
        event.preventDefault();
        this._setPage(button.dataset.page);
      };
    });

    this.shadowRoot.querySelectorAll('[data-settings-focus]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._saveSettingsFocus(button.dataset.settingsFocus || "entities");
        this._render();
      };
    });

    this.shadowRoot.querySelectorAll('[data-debug-toggle]').forEach((input) => {
      input.onchange = (event) => {
        event.preventDefault();
        this._setDebugEnabled(Boolean(input.checked));
      };
    });

    this.shadowRoot.querySelectorAll('[data-sync-refresh]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._loadSyncLog();
      };
    });

    this.shadowRoot.querySelectorAll('[data-pricing-ui-add-group]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._handlePricingUiAddGroup();
      };
    });

    this.shadowRoot.querySelectorAll('[data-pricing-ui-select-group]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._handlePricingUiSelectGroup(button.dataset.pricingUiSelectGroup);
      };
    });

    this.shadowRoot.querySelectorAll('[data-pricing-ui-delete-group]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._handlePricingUiDeleteGroup(button.dataset.pricingUiDeleteGroup);
      };
    });

    this.shadowRoot.querySelectorAll('[data-pricing-ui-add-rule]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._handlePricingUiAddRule();
      };
    });

    this.shadowRoot.querySelectorAll('[data-pricing-ui-delete-rule]').forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        this._handlePricingUiDeleteRule(button.dataset.pricingUiDeleteRule);
      };
    });

    if (this._delegatedHandlersBound) {
      return;
    }

    this._delegatedHandlersBound = true;

    this.shadowRoot.addEventListener("change", async (event) => {
      const target = event.target;
      if (target?.dataset?.pricingField !== undefined || target?.dataset?.pricingHolidayField !== undefined) {
        this._savePricingDraft(this._syncPricingDraftFromInputs());
        this._holdRenderWindow(1200);
        return;
      }
      if (this._isPricingInteractionTarget(target)) {
        this._holdRenderWindow(2500);
        return;
      }

    });

    this.shadowRoot.addEventListener("mousedown", (event) => {
      const path = event.composedPath?.() || [];
      if (path.some((node) => node?.dataset?.sharedSettingsTargetToggle || node?.dataset?.sharedSettingsTargetOption)) {
        this._holdBatterySelectorWindow();
      }
      if (path.some((node) => this._isPricingInteractionTarget(node))) {
        this._holdRenderWindow(8000);
      }
    }, true);

    this.shadowRoot.addEventListener("focusin", (event) => {
      if (event.target?.dataset?.sharedSettingsTargetToggle || event.target?.dataset?.sharedSettingsTargetOption || this._isPricingInteractionTarget(event.target)) {
        if (event.target?.dataset?.sharedSettingsTargetToggle || event.target?.dataset?.sharedSettingsTargetOption) {
          this._holdBatterySelectorWindow();
          return;
        }
        this._holdRenderWindow(1800);
      }
    });

    this.shadowRoot.addEventListener("focusout", (event) => {
      if (this._isPricingInteractionTarget(event.target)) {
        this._renderHoldUntil = Math.max(this._renderHoldUntil, Date.now() + 250);
        this._queueDeferredRender();
      }
    });

    this.shadowRoot.addEventListener("click", async (event) => {
      const path = event.composedPath?.() || [];
      const sharedBatteryToggle = path.find((node) => node?.dataset?.sharedSettingsTargetToggle);
      if (sharedBatteryToggle) {
        event.preventDefault();
        event.stopPropagation();
        if (sharedBatteryToggle.disabled) {
          return;
        }
        if (this._batterySelectorOpen) {
          this._closeSharedBatterySelector();
        } else {
          this._openSharedBatterySelector();
        }
        return;
      }

      const sharedBatteryOption = path.find((node) => node?.dataset?.sharedSettingsTargetOption !== undefined);
      if (sharedBatteryOption) {
        event.preventDefault();
        event.stopPropagation();
        const option = String(sharedBatteryOption.dataset.sharedSettingsTargetOption || "");
        this._batterySelectorOpen = false;
        this._holdBatterySelectorWindow(10000);
        await this._selectSharedBatteryOption(option);
        this._render();
        return;
      }

      if (this._batterySelectorOpen && !path.some((node) => node?.classList?.contains?.("shared-selector"))) {
        this._closeSharedBatterySelector();
        return;
      }

      const themeButton = path.find((node) => node?.dataset?.theme);
      if (themeButton) {
        event.preventDefault();
        this._setTheme(themeButton.dataset.theme);
        return;
      }

      const pageButton = path.find((node) => node?.dataset?.page);
      if (pageButton && !pageButton.disabled) {
        event.preventDefault();
        this._setPage(pageButton.dataset.page);
        return;
      }

      const pricingUiAddGroup = path.find((node) => node?.dataset?.pricingUiAddGroup !== undefined);
      if (pricingUiAddGroup) {
        event.preventDefault();
        const model = this._loadPricingUi();
        const group = this._readPricingUiGroupForm();
        if (!group.effective_start_date) {
          model.warning = "Rate group effective start date is required.";
          this._savePricingUi(model);
          this._render();
          return;
        }
        if ((model.groups || []).some((item) => String(item.effective_start_date || "") === group.effective_start_date)) {
          model.warning = `A rate group already starts on ${group.effective_start_date}. Delete it or choose a different start date.`;
          this._savePricingUi(model);
          this._render();
          return;
        }
        model.groups = [...(model.groups || []), group];
        model.activeGroupId = group.group_id;
        model.warning = "";
        this._savePricingUi(model);
        this._render();
        return;
      }

      const pricingUiSelectGroup = path.find((node) => node?.dataset?.pricingUiSelectGroup);
      if (pricingUiSelectGroup) {
        event.preventDefault();
        const model = this._loadPricingUi();
        model.activeGroupId = pricingUiSelectGroup.dataset.pricingUiSelectGroup;
        model.warning = "";
        this._savePricingUi(model);
        this._render();
        return;
      }

      const pricingUiDeleteGroup = path.find((node) => node?.dataset?.pricingUiDeleteGroup);
      if (pricingUiDeleteGroup) {
        event.preventDefault();
        const model = this._loadPricingUi();
        const groupId = String(pricingUiDeleteGroup.dataset.pricingUiDeleteGroup || "");
        model.groups = (model.groups || []).filter((group) => String(group.group_id || "") !== groupId);
        if (String(model.activeGroupId || "") === groupId) {
          model.activeGroupId = model.groups[0]?.group_id || "";
        }
        model.warning = "";
        this._savePricingUi(model);
        this._render();
        return;
      }

      const pricingUiAddRule = path.find((node) => node?.dataset?.pricingUiAddRule !== undefined);
      if (pricingUiAddRule) {
        event.preventDefault();
        const model = this._loadPricingUi();
        const group = this._pricingUiActiveGroup(model);
        if (!group) {
          model.warning = "Add or select a rate group before adding records.";
          this._savePricingUi(model);
          this._render();
          return;
        }
        const rule = this._readPricingUiRuleForm();
        const warning = this._pricingUiValidationForRule(group, rule);
        if (warning) {
          model.warning = warning;
          this._savePricingUi(model);
          this._render();
          return;
        }
        group.rules = [...(Array.isArray(group.rules) ? group.rules : []), rule];
        model.warning = "";
        this._savePricingUi(model);
        this._render();
        return;
      }

      const pricingUiDeleteRule = path.find((node) => node?.dataset?.pricingUiDeleteRule);
      if (pricingUiDeleteRule) {
        event.preventDefault();
        const model = this._loadPricingUi();
        const group = this._pricingUiActiveGroup(model);
        if (group) {
          const ruleId = String(pricingUiDeleteRule.dataset.pricingUiDeleteRule || "");
          group.rules = (Array.isArray(group.rules) ? group.rules : []).filter((rule) => String(rule.rule_id || "") !== ruleId);
          model.warning = "";
          this._savePricingUi(model);
          this._render();
        }
        return;
      }

      const pricingSave = path.find((node) => node?.dataset?.pricingSaveRule !== undefined);
      if (pricingSave) {
        event.preventDefault();
        const draft = this._pricingPayloadFromDraft(this._syncPricingDraftFromInputs());
        this._savePricingDraft(draft);
        if (!this._hass) {
          return;
        }
        this._hass.callService("home_energy_manager", "pricing_upsert_rule", {
          entry_id: this._config?.entry_id,
          rule_id: draft.rule_id,
          effective_date: draft.effective_date,
          effective_time: draft.effective_time,
          effective_end_date: draft.effective_end_date || undefined,
          effective_end_time: draft.effective_end_time || undefined,
          pricing_type: draft.pricing_type,
          provider: draft.provider,
          label: draft.label,
          import_rate: draft.import_rate ?? undefined,
          export_rate: draft.export_rate ?? undefined,
          supply_charge: draft.supply_charge ?? undefined,
          controlled_load_1: draft.controlled_load_1 ?? undefined,
          controlled_load_2: draft.controlled_load_2 ?? undefined,
          additional_charge: draft.additional_charge ?? undefined,
          holiday_only: Boolean(draft.holiday_only),
          days_of_week: Array.isArray(draft.days_of_week) ? draft.days_of_week : [],
          notes: draft.notes,
          region: draft.region,
          holiday_source: draft.holiday_source,
        }).catch((error) => {
          console.error("Failed to save pricing rule", error);
        });
        this._holdRenderWindow();
        return;
      }

      const pricingClear = path.find((node) => node?.dataset?.pricingClearRule !== undefined);
      if (pricingClear) {
        event.preventDefault();
        this._clearPricingDraft();
        this._render();
        return;
      }

      const pricingLoad = path.find((node) => node?.dataset?.pricingLoadRule);
      if (pricingLoad) {
        event.preventDefault();
        const rule = this._pricingRuleById(pricingLoad.dataset.pricingLoadRule);
        if (rule) {
          this._savePricingDraft({
            ...this._pricingDraftDefaults(),
            rule_id: String(rule.rule_id || ""),
            effective_date: String(rule.effective_date || ""),
            effective_time: String(rule.start_time || "00:00"),
            effective_end_date: String(rule.effective_end_date || ""),
            effective_end_time: String(rule.effective_end_time || rule.end_time || ""),
            pricing_type: String(rule.type || rule.pricing_type || "fixed"),
            provider: String(rule.provider || ""),
            label: String(rule.label || ""),
            import_rate: rule.import_rate ?? "",
            export_rate: rule.export_rate ?? "",
            supply_charge: rule.supply_charge ?? "",
            controlled_load_1: rule.controlled_load_1 ?? "",
            controlled_load_2: rule.controlled_load_2 ?? "",
            additional_charge: rule.additional_charge ?? "",
            holiday_only: Boolean(rule.holiday_only),
            days_of_week: Array.isArray(rule.days_of_week) ? rule.days_of_week : [],
            notes: String(rule.notes || ""),
            region: String(rule.metadata?.region || ""),
            holiday_source: String(rule.metadata?.holiday_source || "manual"),
          });
          this._render();
        }
        return;
      }

      const pricingDelete = path.find((node) => node?.dataset?.pricingDeleteRule);
      if (pricingDelete) {
        event.preventDefault();
        if (!this._hass) {
          return;
        }
        this._hass.callService("home_energy_manager", "pricing_remove_rule", {
          entry_id: this._config?.entry_id,
          rule_id: pricingDelete.dataset.pricingDeleteRule,
        }).catch((error) => {
          console.error("Failed to delete pricing rule", error);
        });
        this._holdRenderWindow();
        return;
      }

      const pricingHolidayAdd = path.find((node) => node?.dataset?.pricingAddHoliday !== undefined);
      if (pricingHolidayAdd) {
        event.preventDefault();
        const draft = this._syncPricingDraftFromInputs();
        if (!this._hass) {
          return;
        }
        const holidayDates = new Set(Array.isArray(this._pricingScheduleData().holidayDates) ? this._pricingScheduleData().holidayDates : []);
        if (draft.holiday_date) {
          holidayDates.add(String(draft.holiday_date));
        }
        this._hass.callService("home_energy_manager", "pricing_set_holidays", {
          entry_id: this._config?.entry_id,
          holiday_dates: Array.from(holidayDates),
          holiday_source: draft.holiday_source || "manual",
          region: draft.region || "",
        }).catch((error) => {
          console.error("Failed to save holiday dates", error);
        });
        this._holdRenderWindow();
        return;
      }

      const pricingHolidayRemove = path.find((node) => node?.dataset?.pricingRemoveHoliday);
      if (pricingHolidayRemove) {
        event.preventDefault();
        if (!this._hass) {
          return;
        }
        const current = new Set(Array.isArray(this._pricingScheduleData().holidayDates) ? this._pricingScheduleData().holidayDates : []);
        current.delete(String(pricingHolidayRemove.dataset.pricingRemoveHoliday || ""));
        const draft = this._syncPricingDraftFromInputs();
        this._hass.callService("home_energy_manager", "pricing_set_holidays", {
          entry_id: this._config?.entry_id,
          holiday_dates: Array.from(current),
          holiday_source: draft.holiday_source || "manual",
          region: draft.region || "",
        }).catch((error) => {
          console.error("Failed to remove holiday date", error);
        });
        this._holdRenderWindow();
      }

      const syncRefresh = path.find((node) => node?.dataset?.syncRefresh !== undefined);
      if (syncRefresh) {
        event.preventDefault();
        this._loadSyncLog();
      }
    });

    this.shadowRoot.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.dataset?.pricingField !== undefined || target?.dataset?.pricingHolidayField !== undefined) {
        this._savePricingDraft(this._syncPricingDraftFromInputs());
        this._holdRenderWindow(1200);
        return;
      }
      if (this._isPricingInteractionTarget(target)) {
        this._holdRenderWindow(1800);
      }
    });

    if (this._page === "settings" && this._debugEnabled) {
      this._loadSyncLog();
      this._startSyncLogPolling();
    } else {
      this._clearSyncLogTimer();
    }
  }

  async _selectSharedBatteryOption(option) {
    const target = this._settingsTargetId();
    if (!target) {
      return;
    }

    this._saveBatterySelection(option);
    if (!this._hass) {
      return;
    }

    try {
      await this._hass.callService("select", "select_option", {
        entity_id: target,
        option,
      });
    } catch (error) {
      console.error("Failed to update battery selection", error);
    } finally {
      this._holdBatterySelectorWindow(10000);
    }
  }

  _escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}

function bootstrapHomeEnergyManagerPanelFallback() {
  document.querySelectorAll("home-energy-manager-panel").forEach((host) => {
    if (host.__hemFallbackBootstrapped) {
      return;
    }
    host.__hemFallbackBootstrapped = true;

    const panel = Object.create(HomeEnergyManagerPanel.prototype);
    panel.shadowRoot = host;
    panel._config = {};
    panel._theme = panel._loadTheme();
    panel._debugEnabled = panel._loadDebugEnabled();
    panel._page = panel._loadPage();
    panel._hass = null;
    panel._panel = null;
    panel._route = null;
    panel._narrow = false;
    panel._hasDelegatedHandlers = false;

    Object.defineProperty(host, "hass", {
      configurable: true,
      get: () => panel._hass,
      set: (value) => {
        panel._hass = value;
        panel._render();
      },
    });
    Object.defineProperty(host, "panel", {
      configurable: true,
      get: () => panel._panel,
      set: (value) => {
        panel._panel = value;
        panel._config = value?.config || panel._config;
        panel._syncStoredState();
        panel._render();
      },
    });
    Object.defineProperty(host, "narrow", {
      configurable: true,
      get: () => panel._narrow,
      set: (value) => {
        panel._narrow = Boolean(value);
        panel._render();
      },
    });
    Object.defineProperty(host, "route", {
      configurable: true,
      get: () => panel._route,
      set: (value) => {
        panel._route = value;
        panel._render();
      },
    });
    host.setConfig = (config) => {
      panel.setConfig(config);
    };
    host.connectedCallback = () => {
      panel._render();
    };

    panel._render();
  });
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("home-energy-manager-panel")) {
    customElements.define("home-energy-manager-panel", HomeEnergyManagerPanel);
  }
} else {
  bootstrapHomeEnergyManagerPanelFallback();
}



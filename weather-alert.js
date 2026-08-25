(() => {
  const ALERTS_URL = 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=-79.95,43.25,-79.65,43.48&limit=25';
  const LOCAL_ALERTS_PAGE = 'https://weather.gc.ca/warnings/report_e.html?onrm70=undefined';
  const alertIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"></path><path d="M12 9v5"></path><circle cx="12" cy="17" r=".8"></circle></svg>';
  const weatherIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 17a4.2 4.2 0 0 1 .8-8.3A5.7 5.7 0 0 1 18 10.2 3.5 3.5 0 0 1 17.2 17h-11Z"></path></svg>';

  function clean(value) {
    return String(value || '').replace(/[—–]/g, ',').replace(/\s+/g, ' ').trim();
  }
  function esc(value) {
    return clean(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function dateText(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
    }).format(date);
  }

  function isCurrent(properties) {
    const expiry = new Date(properties.expiration_datetime || properties.event_end_datetime || 0).getTime();
    return !expiry || expiry > Date.now();
  }

  function rank(properties) {
    const colour = clean(properties.risk_colour_en).toLowerCase();
    const type = clean(properties.alert_type).toLowerCase();
    return ({red: 50, orange: 40, yellow: 30}[colour] || 10) + ({warning: 4, watch: 3, advisory: 2, statement: 1}[type] || 0);
  }

  function installAlert(host, feature) {
    const properties = feature.properties || {};
    const title = clean(properties.alert_name_en || properties.alert_short_name_en || properties.feature_name_en || 'Weather alert');
    const type = clean(properties.alert_type || 'alert');
    const details = clean(properties.alert_text_en || 'Environment Canada has issued an alert for the Burlington area.');
    const until = dateText(properties.expiration_datetime || properties.event_end_datetime);
    const wrapper = document.createElement('span');
    wrapper.className = `weather-alert weather-alert-${clean(properties.risk_colour_en).toLowerCase() || 'yellow'}`;
    wrapper.innerHTML = `<button class="weather-alert-button" type="button" aria-expanded="false">${alertIcon}<span>${esc(type || 'Alert')}</span></button><span class="weather-alert-popover" role="status"><strong>${esc(title)}</strong>${until ? `<time>Until ${esc(until)}</time>` : ''}<span>${esc(details)}</span><a href="${LOCAL_ALERTS_PAGE}" target="_blank" rel="noopener">Environment Canada details</a></span>`;
    host.appendChild(wrapper);
    const button = wrapper.querySelector('button');
    const close = () => { wrapper.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); };
    button.addEventListener('click', event => {
      event.stopPropagation();
      const open = !wrapper.classList.contains('is-open');
      document.querySelectorAll('.weather-alert.is-open').forEach(item => item.classList.remove('is-open'));
      wrapper.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  function loadAlerts() {
    const hosts = [...document.querySelectorAll('[data-weather-alert-host]')];
    if (!hosts.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    fetch(ALERTS_URL, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        const active = (data.features || []).filter(item => isCurrent(item.properties || {})).sort((a, b) => rank(b.properties || {}) - rank(a.properties || {}));
        if (!active.length) return;
        hosts.forEach(host => installAlert(host, active[0]));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  function loadTemperature() {
    const hosts = [...document.querySelectorAll('[data-weather-temperature]')];
    if (!hosts.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=temperature_2m,weather_code&temperature_unit=celsius', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        const temperature = Math.round(Number(data.current?.temperature_2m));
        if (!Number.isFinite(temperature)) return;
        const condition = weatherLabel(Number(data.current?.weather_code));
        hosts.forEach(host => {
          if (host.hasAttribute('data-weather-compact')) {
            host.innerHTML = condition ? `${temperature}°C · ${esc(condition)}` : `${temperature}°C`;
          } else {
            host.innerHTML = `${weatherIcon}<strong>${temperature}°C</strong>${condition ? `<em>${condition}</em>` : ''}`;
          }
          host.setAttribute('aria-label', `${temperature} degrees Celsius in Burlington${condition ? `, ${condition}` : ''}`);
          host.hidden = false;
        });
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  function weatherLabel(code) {
    if (!Number.isFinite(code)) return '';
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Mostly cloudy';
    if (code <= 48) return 'Fog';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    if (code <= 86) return 'Snow showers';
    if (code <= 99) return 'Thunderstorm';
    return '';
  }
  function loadWeather() { loadTemperature(); loadAlerts(); }
  window.BurlingtonWeather = { load: loadWeather };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadWeather);
  else loadWeather();
})();

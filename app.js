/* Bitcoin Node Observatory dashboard (Phase 3: Node Count + Churn)
 *
 * Reads only the pre-aggregated btc-node-data aggregates/*.json.
 * Never chews through the raw daily JSON on the frontend.
 */

// Replace with the btc-node-data raw URL when deploying.
// For local development, symlink the data repo as ../data and point DATA_BASE at it.
const DATA_BASE = window.DATA_BASE ||
  'https://raw.githubusercontent.com/azuchi/btc-node-data/main/aggregates';

const COLORS = {
  clearnetInst: '#f7931a',   // clearnet instantaneous
  clearnetUnion: '#c46f10',  // clearnet union_24h
  onionInst: '#7d4698',      // onion instantaneous
  onionUnion: '#5a2d75',     // onion union_24h
  combined: '#999999'
};

const countChart = echarts.init(document.getElementById('chart-count'));
const churnChart = echarts.init(document.getElementById('chart-churn'));
const mapChart = echarts.init(document.getElementById('chart-map'));
window.addEventListener('resize', () => { countChart.resize(); churnChart.resize(); mapChart.resize(); });

async function loadRange(granularity) {
  const res = await fetch(`${DATA_BASE}/${granularity}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`failed to fetch ${granularity}.json: ${res.status}`);
  return res.json();
}

function toPairs(points, index) {
  return points.map(p => [p[0] * 1000, p[index]]);
}

// Align clearnet and onion timestamps to build the combined (indicative) series
function combinedSeries(clearnet, onion) {
  if (!clearnet.length || !onion.length) return [];
  const onionByTs = new Map(onion.map(p => [p[0], p[1]]));
  const onionTs = onion.map(p => p[0]);
  return clearnet.map(([ts, inst]) => {
    // onion is only measured once a day, so overlay the most recent onion value
    let nearest = null;
    for (const ots of onionTs) { if (ots <= ts) nearest = ots; else break; }
    return nearest === null ? null : [ts * 1000, inst + onionByTs.get(nearest)];
  }).filter(Boolean);
}

function churnSeries(points) {
  return points
    .filter(p => p[2] > 0)
    .map(p => [p[0] * 1000, +(p[1] / p[2]).toFixed(4)]);
}

function render(data) {
  const clearnet = data.series.clearnet || [];
  const onion = data.series.onion || [];

  countChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['clearnet instantaneous', 'clearnet union_24h',
             'onion instantaneous', 'onion union_24h', 'combined (indicative)'],
      selected: { 'combined (indicative)': false }  // combined is secondary: off by default
    },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'nodes', min: 0 },
    dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    grid: { left: 60, right: 20, top: 60, bottom: 70 },
    series: [
      { name: 'clearnet instantaneous', type: 'line', showSymbol: false,
        color: COLORS.clearnetInst, data: toPairs(clearnet, 1) },
      { name: 'clearnet union_24h', type: 'line', showSymbol: false,
        lineStyle: { type: 'dashed' }, color: COLORS.clearnetUnion, data: toPairs(clearnet, 2) },
      { name: 'onion instantaneous', type: 'line', showSymbol: false,
        color: COLORS.onionInst, data: toPairs(onion, 1) },
      { name: 'onion union_24h', type: 'line', showSymbol: false,
        lineStyle: { type: 'dashed' }, color: COLORS.onionUnion, data: toPairs(onion, 2) },
      { name: 'combined (indicative)', type: 'line', showSymbol: false,
        lineStyle: { type: 'dotted' }, color: COLORS.combined, data: combinedSeries(clearnet, onion) }
    ]
  }, true);

  churnChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['clearnet churn', 'onion churn'] },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', min: 0, max: 1 },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    series: [
      { name: 'clearnet churn', type: 'line', showSymbol: false,
        color: COLORS.clearnetInst, data: churnSeries(clearnet) },
      { name: 'onion churn', type: 'line', showSymbol: false,
        color: COLORS.onionInst, data: churnSeries(onion) }
    ]
  }, true);

  updateStats(clearnet, onion);
}

function updateStats(clearnet, onion) {
  const lastC = clearnet[clearnet.length - 1];
  const lastO = onion[onion.length - 1];
  const fmt = n => n == null ? '–' : n.toLocaleString('en-US');
  document.getElementById('stat-clearnet').textContent = fmt(lastC?.[1]);
  document.getElementById('stat-clearnet-union').textContent = fmt(lastC?.[2]);
  document.getElementById('stat-onion').textContent = fmt(lastO?.[1]);
  document.getElementById('stat-churn').textContent =
    lastC && lastC[2] > 0 ? (lastC[1] / lastC[2]).toFixed(3) : '–';
}

async function show(granularity) {
  document.querySelectorAll('#range-switcher button').forEach(b =>
    b.classList.toggle('active', b.dataset.range === granularity));
  try {
    render(await loadRange(granularity));
  } catch (e) {
    console.error(e);
    countChart.setOption({ title: { text: 'Failed to load data', left: 'center', top: 'middle' } });
  }
}

document.querySelectorAll('#range-switcher button').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.range)));

show('week');

/* ---- Country distribution (clearnet): choropleth map + ranking ---------- */

const WORLD_MAP_URL = 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json';

// ISO 3166-1 alpha-2 -> feature names used by the ECharts world map.
// Codes without a polygon in the map data (HK, TW, MO) appear in the ranking only.
const COUNTRY_NAMES = {
  AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AL: 'Albania',
  AM: 'Armenia', AO: 'Angola', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  AZ: 'Azerbaijan', BA: 'Bosnia and Herz.', BB: 'Barbados', BD: 'Bangladesh',
  BE: 'Belgium', BF: 'Burkina Faso', BG: 'Bulgaria', BH: 'Bahrain', BJ: 'Benin',
  BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia', BR: 'Brazil', BS: 'Bahamas',
  BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada',
  CD: 'Dem. Rep. Congo', CG: 'Congo', CH: 'Switzerland', CI: "Côte d'Ivoire",
  CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia', CR: 'Costa Rica',
  CU: 'Cuba', CV: 'Cape Verde', CY: 'Cyprus', CZ: 'Czech Rep.', DE: 'Germany',
  DJ: 'Djibouti', DK: 'Denmark', DO: 'Dominican Rep.', DZ: 'Algeria',
  EC: 'Ecuador', EE: 'Estonia', EG: 'Egypt', ER: 'Eritrea', ES: 'Spain',
  ET: 'Ethiopia', FI: 'Finland', FJ: 'Fiji', FR: 'France', GA: 'Gabon',
  GB: 'United Kingdom', GE: 'Georgia', GH: 'Ghana', GL: 'Greenland',
  GM: 'Gambia', GN: 'Guinea', GR: 'Greece', GT: 'Guatemala', GY: 'Guyana',
  HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary', ID: 'Indonesia',
  IE: 'Ireland', IL: 'Israel', IN: 'India', IQ: 'Iraq', IR: 'Iran',
  IS: 'Iceland', IT: 'Italy', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan',
  KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KP: 'Dem. Rep. Korea',
  KR: 'Korea', KW: 'Kuwait', KY: 'Cayman Is.', KZ: 'Kazakhstan',
  LA: 'Lao PDR', LB: 'Lebanon', LI: 'Liechtenstein', LK: 'Sri Lanka',
  LR: 'Liberia', LS: 'Lesotho', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MD: 'Moldova', ME: 'Montenegro',
  MG: 'Madagascar', MK: 'Macedonia', ML: 'Mali', MM: 'Myanmar',
  MN: 'Mongolia', MR: 'Mauritania', MT: 'Malta', MU: 'Mauritius',
  MW: 'Malawi', MX: 'Mexico', MY: 'Malaysia', MZ: 'Mozambique',
  NA: 'Namibia', NC: 'New Caledonia', NE: 'Niger', NG: 'Nigeria',
  NI: 'Nicaragua', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal',
  NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru',
  PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland',
  PR: 'Puerto Rico', PS: 'Palestine', PT: 'Portugal', PY: 'Paraguay',
  QA: 'Qatar', RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda',
  SA: 'Saudi Arabia', SB: 'Solomon Is.', SC: 'Seychelles', SD: 'Sudan',
  SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia',
  SL: 'Sierra Leone', SN: 'Senegal', SO: 'Somalia', SR: 'Suriname',
  SS: 'S. Sudan', SV: 'El Salvador', SY: 'Syria', SZ: 'Swaziland',
  TD: 'Chad', TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan',
  TL: 'Timor-Leste', TM: 'Turkmenistan', TN: 'Tunisia', TO: 'Tonga',
  TR: 'Turkey', TT: 'Trinidad and Tobago', TZ: 'Tanzania', UA: 'Ukraine',
  UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VE: 'Venezuela', VN: 'Vietnam', VU: 'Vanuatu', WS: 'Samoa', YE: 'Yemen',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe'
};

// Sequential single-hue ramps (low -> high), one per color scheme
const MAP_RAMPS = {
  light: ['#fbe3c5', '#f9c37e', '#f7a03d', '#dd7d12', '#b06010', '#7c450b'],
  dark: ['#4a2d0c', '#6b400d', '#95590f', '#c47513', '#f7931a', '#ffbe66']
};
const MAP_BUCKETS = [
  { min: 1, max: 25 }, { min: 26, max: 100 }, { min: 101, max: 250 },
  { min: 251, max: 500 }, { min: 501, max: 1000 }, { min: 1001 }
];

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let geoLatest = null;

function renderGeoMap(byCountry, date) {
  const ramp = MAP_RAMPS[darkScheme.matches ? 'dark' : 'light'];
  const fmt = n => n.toLocaleString('en-US');
  const data = Object.entries(byCountry)
    .filter(([cc]) => cc !== 'other' && cc !== 'unknown')
    .map(([cc, n]) => ({ name: COUNTRY_NAMES[cc] || cc, value: n }));

  mapChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: p => Number.isFinite(p.value) ? `${p.name}: ${fmt(p.value)} nodes` : `${p.name}: no data`
    },
    visualMap: {
      type: 'piecewise',
      pieces: MAP_BUCKETS.map((b, i) => ({ ...b, color: ramp[i] })),
      orient: 'horizontal',
      left: 0,
      bottom: 0,
      textStyle: { color: cssVar('--muted') }
    },
    series: [{
      type: 'map',
      map: 'world',
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      top: 10,
      label: { show: false },
      emphasis: { label: { show: false } },
      select: { disabled: true },
      itemStyle: { areaColor: 'transparent', borderColor: cssVar('--border') },
      data
    }]
  }, true);
}

function renderCountryList(byCountry, total) {
  const list = document.getElementById('country-list');
  list.textContent = '';
  const entries = Object.entries(byCountry);
  const ranked = entries.filter(([cc]) => cc !== 'other' && cc !== 'unknown')
    .sort((a, b) => b[1] - a[1]).slice(0, 15);
  const rest = entries.filter(([cc]) => cc === 'other' || cc === 'unknown');
  const max = ranked.length ? ranked[0][1] : 1;

  for (const [cc, n] of [...ranked, ...rest]) {
    const row = document.createElement('div');
    row.className = 'country-row' + (cc === 'other' || cc === 'unknown' ? ' other' : '');
    const label = document.createElement('span');
    label.className = 'cc';
    label.textContent = cc;
    label.title = COUNTRY_NAMES[cc] || cc;
    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${Math.max(2, (n / max) * 100)}%`;
    track.appendChild(bar);
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = n.toLocaleString('en-US');
    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '';
    num.appendChild(pct);
    row.append(label, track, num);
    list.appendChild(row);
  }
}

function renderGeo() {
  const clearnet = geoLatest?.networks?.clearnet;
  const byCountry = clearnet?.by_country;
  if (!byCountry || !Object.keys(byCountry).length) {
    document.getElementById('country-list').innerHTML =
      '<p class="geo-empty">No country data yet (GeoIP resolution has not run).</p>';
    return;
  }
  renderGeoMap(byCountry, geoLatest.date);
  renderCountryList(byCountry, clearnet.instantaneous);
}

async function initGeo() {
  try {
    const [worldRes, latestRes] = await Promise.all([
      fetch(WORLD_MAP_URL),
      fetch(`${DATA_BASE}/latest.json`, { cache: 'no-cache' })
    ]);
    if (!worldRes.ok) throw new Error(`world map: ${worldRes.status}`);
    if (!latestRes.ok) throw new Error(`latest.json: ${latestRes.status}`);
    echarts.registerMap('world', await worldRes.json());
    geoLatest = await latestRes.json();
    renderGeo();
  } catch (e) {
    console.error(e);
    document.getElementById('country-list').innerHTML =
      '<p class="geo-empty">Country data unavailable.</p>';
  }
}

darkScheme.addEventListener('change', () => { if (geoLatest) renderGeo(); });
initGeo();

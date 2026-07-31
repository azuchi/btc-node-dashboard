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

/* ---- i18n ---------------------------------------------------------------- */

const I18N = {
  en: {
    'subtitle': 'Continuous measurement of reachable nodes — clearnet and onion measured separately ' +
      '<a href="https://github.com/azuchi/btc-node-data#methodology" target="_blank" rel="noopener">[Methodology]</a>',
    'range.day': 'Day', 'range.week': 'Week', 'range.month': 'Month',
    'range.quarter': 'Quarter', 'range.year': 'Year', 'range.all': 'All',
    'stat.clearnetInst': 'clearnet (reachable now)',
    'stat.clearnetUnion': 'clearnet (seen in 24h)',
    'stat.onionInst': 'onion (reachable now)',
    'stat.churn': 'stability (now / 24h)',
    'nodeCount.title': 'Node Count',
    'nodeCount.note': 'clearnet and onion are measured as <strong>separate series by methodology</strong> ' +
      '(the combined value is indicative only). "Reachable now" (<code>instantaneous</code>) is the ' +
      'number of nodes that answered a handshake in the latest 15-minute round (Bitnodes-style, lower ' +
      'bound); "seen in 24h" (<code>union_24h</code>) counts nodes that answered at least once in the ' +
      'last 24 hours (KIT-style, upper bound). ' +
      '<a href="https://github.com/azuchi/btc-node-data#dual-definition-of-reachability" target="_blank" rel="noopener">Definitions</a>',
    'nodeCount.caveat': '⚠ Onion absolute counts are not authoritative: address count ≠ host count, ' +
      'no cross-checking is possible, Sybil creation costs are near zero, and the figure is capped by ' +
      'our Tor capacity — 98% of onion probes time out, so it reflects what we could confirm, not how ' +
      'many onion nodes exist. Watch trends in ratios instead. ' +
      '<a href="https://github.com/azuchi/btc-node-data#epistemic-weakness-of-onion-node-counts" target="_blank" rel="noopener">Details</a>',
    'churn.title': 'Node-Set Stability (reachable now ÷ seen in 24h)',
    'churn.note': 'The share of nodes seen at least once in the last 24 hours that are reachable ' +
      'right now. Close to 1 means mostly always-on nodes; lower means heavier churn ' +
      '(nodes coming and going).',
    'network.title': 'Network Types (latest)',
    'network.note': 'Breakdown of the latest round by address type. ipv4 / ipv6 are the clearnet ' +
      'series; onion is measured separately and never combined. i2p / cjdns addresses are collected ' +
      'but not probed in v0.1.0, so they have no reachability numbers.',
    'observer.title': "Observer's View",
    'observer.note': 'What our vantage point can see: every address we know (from the observer ' +
      "node's addrman and, when enabled, recursive getaddr discovery), the candidates actually " +
      'probed in the latest round (dead addresses are thinned out by exponential backoff), and ' +
      'the nodes reached. This funnel is why the published counts are lower bounds.',
    'observer.caveat': 'Do not read known ÷ reached as a "survival rate", especially for onion: ' +
      'onion addresses are cheap to create, often duplicated or discarded, and a failed probe ' +
      'cannot be distinguished from a Tor circuit failure. These numbers describe the vantage ' +
      'point, not the network.',
    'observer.known': 'known addresses',
    'observer.candidates': 'probed (after backoff)',
    'observer.reachable': 'reachable',
    'observer.extra': 'Collected but not probed in v0.1.0:',
    'ua.title': 'User Agents (latest)',
    'ua.note': 'Breakdown of successful handshakes by the user agent announced during the handshake ' +
      '(top 20 + other). The user agent is self-reported by each node and can be freely spoofed — ' +
      'treat it as indicative, not verified. clearnet and onion stay separate.',
    'country.title': 'Country Distribution (clearnet)',
    'country.note': "Successful handshakes in the latest daily export, by country of the node's IP address " +
      '(top 20 countries + other). Country reflects where the IP is registered (GeoLite2), ' +
      'not necessarily where the operator lives. Onion nodes have no IP and are excluded.',
    'country.caveat': 'Includes GeoLite2 data created by MaxMind, available from ' +
      '<a href="https://www.maxmind.com" target="_blank" rel="noopener">maxmind.com</a>. ' +
      'Hong Kong and Taiwan appear in the ranking only (no separate polygon in the map data).',
    'footer.text': 'Data: <a href="https://github.com/azuchi/btc-node-data" target="_blank" rel="noopener">btc-node-data</a> ' +
      '(CC-BY 4.0 / raw data archived in Releases and on Zenodo). Measured from a single vantage ' +
      'point; this is not full coverage of the network.',
    'series.clearnetInst': 'clearnet reachable now',
    'series.clearnetUnion': 'clearnet seen in 24h',
    'series.onionInst': 'onion reachable now',
    'series.onionUnion': 'onion seen in 24h',
    'series.combined': 'combined (indicative)',
    'series.clearnetChurn': 'clearnet stability',
    'series.onionChurn': 'onion stability',
    'unit.nodes': 'nodes',
    'map.noData': 'no data',
    'geo.other': 'other',
    'geo.unknown': 'unknown',
    'geo.empty': 'No country data yet (GeoIP resolution has not run).',
    'geo.unavailable': 'Country data unavailable.',
    'ua.empty': 'No data for this network yet.',
    'error.load': 'Failed to load data'
  },
  ja: {
    'subtitle': '到達可能ノードの継続測定 — clearnet と onion は分離して測定 ' +
      '<a href="https://github.com/azuchi/btc-node-data#methodology" target="_blank" rel="noopener">[測定方法]</a>',
    'range.day': '日', 'range.week': '週', 'range.month': '月',
    'range.quarter': '四半期', 'range.year': '年', 'range.all': '全期間',
    'stat.clearnetInst': 'clearnet（現在到達可能）',
    'stat.clearnetUnion': 'clearnet（24時間以内に到達）',
    'stat.onionInst': 'onion（現在到達可能）',
    'stat.churn': '安定度（現在 ÷ 24h）',
    'nodeCount.title': 'ノード数',
    'nodeCount.note': 'clearnet と onion は<strong>測定方法上、別々の系列</strong>として測定しています' +
      '（合算値は参考値）。「現在到達可能」（<code>instantaneous</code>）は直近の15分ラウンドで' +
      'ハンドシェイクに応答したノード数（Bitnodes 方式、下限値）、「24h以内」（<code>union_24h</code>）は' +
      '直近24時間に一度でも応答したノードの総数（KIT 方式、上限値）です。' +
      '<a href="https://github.com/azuchi/btc-node-data#dual-definition-of-reachability" target="_blank" rel="noopener">定義</a>',
    'nodeCount.caveat': '⚠ onion の絶対数は確定的な数値ではありません: アドレス数 ≠ ホスト数であり、' +
      '相互検証が不可能で、Sybil 作成コストがほぼゼロだからです。加えてこの数値は当方の Tor 処理能力に' +
      '律速されており（プローブの98%がタイムアウト）、onion ノードの実数ではなく「確認できた数」です。' +
      '比率の推移に注目してください。' +
      '<a href="https://github.com/azuchi/btc-node-data#epistemic-weakness-of-onion-node-counts" target="_blank" rel="noopener">詳細</a>',
    'churn.title': 'ノード集合の安定度（現在到達可能 ÷ 24時間以内に到達）',
    'churn.note': '直近24時間に一度でも到達できたノードのうち、いま到達できているノードの割合です。' +
      '1 に近いほど常時稼働のノードが中心で、低いほどノードの出入り（チャーン）が激しいことを示します。',
    'network.title': 'ネットワーク種別（最新値）',
    'network.note': '最新ラウンドのアドレス種別ごとの内訳です。ipv4 / ipv6 が clearnet 系列で、' +
      'onion は別系列として測定しています（合算しません）。i2p / cjdns のアドレスも収集していますが、' +
      'v0.1.0 ではプローブ対象外のため到達数はありません。',
    'observer.title': '観測点の視界',
    'observer.note': '観測点が把握しているアドレス数（観測ノードの addrman と、有効な場合は再帰 getaddr ' +
      'による収集の合計）→ 最新ラウンドで実際にプローブした候補数（連続失敗アドレスは指数バックオフで' +
      '間引き）→ 到達できたノード数、という絞り込みを示します。' +
      'このファネルが、公開している数値が下限値である理由です。',
    'observer.caveat': '「保有 ÷ 到達」を生存率として読まないでください。特に onion はアドレス生成コストが' +
      'ほぼゼロで重複・使い捨てが多く、プローブ失敗と Tor の回路構築失敗を区別できません。' +
      'これらの数字は観測点の視界であって、ネットワーク全体の実態ではありません。',
    'observer.known': '保有アドレス',
    'observer.candidates': '候補（バックオフ後）',
    'observer.reachable': '到達',
    'observer.extra': '収集のみ（v0.1.0 ではプローブ対象外）:',
    'ua.title': 'ユーザーエージェント別（最新値）',
    'ua.note': 'ハンドシェイク時にノードが名乗ったユーザーエージェント別の内訳です（上位20 + other）。' +
      'ユーザーエージェントは各ノードの自己申告であり自由に偽装できるため、検証済みの値ではなく参考情報として' +
      '見てください。clearnet と onion は分けて表示しています。',
    'country.title': '国別分布（clearnet）',
    'country.note': '最新の日次エクスポートにおけるハンドシェイク成功ノードの、IP アドレスの国別内訳' +
      '（上位20カ国 + other）。国は IP の登録地（GeoLite2）であり、運用者の所在地とは限りません。' +
      'onion ノードは IP を持たないため対象外です。',
    'country.caveat': '本内訳は MaxMind 作成の GeoLite2 データを含みます' +
      '（<a href="https://www.maxmind.com" target="_blank" rel="noopener">maxmind.com</a>）。' +
      '香港・台湾は地図データに単独ポリゴンがないためランキングのみに表示されます。',
    'footer.text': 'データ: <a href="https://github.com/azuchi/btc-node-data" target="_blank" rel="noopener">btc-node-data</a>' +
      '（CC-BY 4.0 / raw データは Releases と Zenodo にアーカイブ）。単一観測点からの測定であり、' +
      'ネットワーク全体の完全な網羅ではありません。',
    'series.clearnetInst': 'clearnet（現在）',
    'series.clearnetUnion': 'clearnet（24h以内）',
    'series.onionInst': 'onion（現在）',
    'series.onionUnion': 'onion（24h以内）',
    'series.combined': '合算（参考値）',
    'series.clearnetChurn': 'clearnet 安定度',
    'series.onionChurn': 'onion 安定度',
    'unit.nodes': 'ノード',
    'map.noData': 'データなし',
    'geo.other': 'その他',
    'geo.unknown': '不明',
    'geo.empty': '国別データはまだありません（GeoIP 解決が未実行です）。',
    'geo.unavailable': '国別データを取得できません。',
    'ua.empty': 'このネットワークのデータはまだありません。',
    'error.load': 'データの読み込みに失敗しました'
  }
};

let LANG = localStorage.getItem('lang') ||
  ((navigator.language || '').startsWith('ja') ? 'ja' : 'en');
const t = key => I18N[LANG]?.[key] ?? I18N.en[key] ?? key;

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

  // ECharts defaults to near-black text; follow the page theme instead
  const ink = cssVar('--fg');
  const inkMuted = cssVar('--muted');
  const gridLine = cssVar('--border');

  countChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      data: [t('series.clearnetInst'), t('series.clearnetUnion'),
             t('series.onionInst'), t('series.onionUnion'), t('series.combined')],
      selected: { [t('series.combined')]: false },  // combined is secondary: off by default
      textStyle: { color: ink },
      inactiveColor: inkMuted
    },
    xAxis: { type: 'time', axisLabel: { color: inkMuted } },
    yAxis: { type: 'value', name: t('unit.nodes'), min: 0,
             nameTextStyle: { color: inkMuted }, axisLabel: { color: inkMuted },
             splitLine: { lineStyle: { color: gridLine } } },
    dataZoom: [{ type: 'inside' }],
    grid: { left: 60, right: 20, top: 60, bottom: 30 },
    series: [
      { name: t('series.clearnetInst'), type: 'line', showSymbol: false,
        color: COLORS.clearnetInst, data: toPairs(clearnet, 1) },
      { name: t('series.clearnetUnion'), type: 'line', showSymbol: false,
        lineStyle: { type: 'dashed' }, color: COLORS.clearnetUnion, data: toPairs(clearnet, 2) },
      { name: t('series.onionInst'), type: 'line', showSymbol: false,
        color: COLORS.onionInst, data: toPairs(onion, 1) },
      { name: t('series.onionUnion'), type: 'line', showSymbol: false,
        lineStyle: { type: 'dashed' }, color: COLORS.onionUnion, data: toPairs(onion, 2) },
      { name: t('series.combined'), type: 'line', showSymbol: false,
        lineStyle: { type: 'dotted' }, color: COLORS.combined, data: combinedSeries(clearnet, onion) }
    ]
  }, true);

  churnChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: [t('series.clearnetChurn'), t('series.onionChurn')],
              textStyle: { color: ink }, inactiveColor: inkMuted },
    xAxis: { type: 'time', axisLabel: { color: inkMuted } },
    yAxis: { type: 'value', min: 0, max: 1,
             axisLabel: { color: inkMuted },
             splitLine: { lineStyle: { color: gridLine } } },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    series: [
      { name: t('series.clearnetChurn'), type: 'line', showSymbol: false,
        color: COLORS.clearnetInst, data: churnSeries(clearnet) },
      { name: t('series.onionChurn'), type: 'line', showSymbol: false,
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

let lastRangeData = null;

async function show(granularity) {
  document.querySelectorAll('#range-switcher button').forEach(b =>
    b.classList.toggle('active', b.dataset.range === granularity));
  try {
    lastRangeData = await loadRange(granularity);
    render(lastRangeData);
  } catch (e) {
    console.error(e);
    countChart.setOption({ title: { text: t('error.load'), left: 'center', top: 'middle' } });
  }
}

document.querySelectorAll('#range-switcher button').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.range)));

show('day');

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

// Localized country names for the ranking (the map's GeoJSON features stay English)
function regionName(cc) {
  try {
    return new Intl.DisplayNames([LANG], { type: 'region' }).of(cc) || cc;
  } catch {
    return cc;
  }
}

let geoLatest = null;

function renderGeoMap(byCountry, date) {
  const dark = darkScheme.matches;
  const ramp = MAP_RAMPS[dark ? 'dark' : 'light'];
  // Land without data gets a neutral fill slightly off the page background so
  // the landmass silhouette stays visible; country borders use the background
  // color to read as gaps.
  const neutralLand = dark ? '#272c35' : '#ececec';
  const fmt = n => n.toLocaleString('en-US');
  const data = Object.entries(byCountry)
    .filter(([cc]) => cc !== 'other' && cc !== 'unknown')
    .map(([cc, n]) => ({ name: COUNTRY_NAMES[cc] || cc, value: n }));

  mapChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: p => Number.isFinite(p.value)
        ? `${p.name}: ${fmt(p.value)} ${t('unit.nodes')}`
        : `${p.name}: ${t('map.noData')}`
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
      // Fill the box: the world's 2:1 aspect leaves vertical slack at zoom 1
      zoom: 1.2,
      center: [8, 16],
      scaleLimit: { min: 1, max: 8 },
      top: 10,
      label: { show: false },
      emphasis: { label: { show: false } },
      select: { disabled: true },
      itemStyle: { areaColor: neutralLand, borderColor: cssVar('--bg') },
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
    label.textContent = cc === 'other' ? t('geo.other') : cc === 'unknown' ? t('geo.unknown') : regionName(cc);
    label.title = cc;
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

// ipv4/ipv6 shares use clearnet "reachable now" as the denominator; onion is a
// separate series by methodology, so its row shows the count only (no share).
function renderNetworkList() {
  const list = document.getElementById('network-list');
  list.textContent = '';
  const clearnet = geoLatest?.networks?.clearnet;
  const onion = geoLatest?.networks?.onion;
  const rows = [];
  for (const [net, n] of Object.entries(clearnet?.by_network || {})) {
    rows.push({ net, n, total: clearnet.instantaneous, cls: '' });
  }
  for (const [net, n] of Object.entries(onion?.by_network || {})) {
    rows.push({ net, n, total: null, cls: ' onion' });
  }
  if (!rows.length) return;
  const max = Math.max(...rows.map(r => r.n));

  for (const { net, n, total, cls } of rows) {
    const row = document.createElement('div');
    row.className = 'country-row' + cls;
    const label = document.createElement('span');
    label.className = 'cc';
    label.textContent = net;
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

function renderUaList(elementId, network, cls) {
  const list = document.getElementById(elementId);
  list.textContent = '';
  const byUa = network?.by_user_agent;
  if (!byUa || !Object.keys(byUa).length) {
    list.innerHTML = `<p class="geo-empty">${t('ua.empty')}</p>`;
    return;
  }
  const entries = Object.entries(byUa);
  const ranked = entries.filter(([ua]) => ua !== 'other').sort((a, b) => b[1] - a[1]);
  const rest = entries.filter(([ua]) => ua === 'other');
  const max = ranked.length ? ranked[0][1] : 1;
  const total = network.instantaneous;

  for (const [ua, n] of [...ranked, ...rest]) {
    const row = document.createElement('div');
    row.className = 'country-row' + (ua === 'other' ? ' other' : cls);
    const label = document.createElement('span');
    label.className = 'cc';
    label.textContent = ua === 'other' ? t('geo.other') : ua;
    label.title = ua;
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

// Funnel: known addresses -> probed candidates -> reached, per network class
function renderFunnel(elementId, knownCount, network, cls) {
  const list = document.getElementById(elementId);
  list.textContent = '';
  if (!knownCount || !network) {
    list.innerHTML = `<p class="geo-empty">${t('ua.empty')}</p>`;
    return;
  }
  const stages = [
    { key: 'observer.known', n: knownCount },
    { key: 'observer.candidates', n: network.candidates },
    { key: 'observer.reachable', n: network.instantaneous }
  ].filter(s => Number.isFinite(s.n));
  const max = stages[0].n;

  for (const { key, n } of stages) {
    const row = document.createElement('div');
    row.className = 'country-row' + cls;
    const label = document.createElement('span');
    label.className = 'cc';
    label.textContent = t(key);
    label.title = t(key);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${Math.max(1, (n / max) * 100)}%`;
    track.appendChild(bar);
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = n.toLocaleString('en-US');
    row.append(label, track, num);
    list.appendChild(row);
  }
}

function renderObserver() {
  const known = geoLatest?.observer?.known_addresses;
  const nets = geoLatest?.networks || {};
  const clearnetKnown = known ? (known.ipv4 || 0) + (known.ipv6 || 0) : null;
  renderFunnel('funnel-clearnet', clearnetKnown, nets.clearnet, '');
  renderFunnel('funnel-onion', known?.onion, nets.onion, ' onion');

  const extra = document.getElementById('observer-extra');
  if (known && (known.i2p || known.cjdns)) {
    const parts = [];
    if (known.i2p) parts.push(`i2p: ${known.i2p.toLocaleString('en-US')}`);
    if (known.cjdns) parts.push(`cjdns: ${known.cjdns.toLocaleString('en-US')}`);
    extra.textContent = `${t('observer.extra')} ${parts.join(' / ')}`;
  } else {
    extra.textContent = '';
  }
}

function renderGeo() {
  renderNetworkList();
  renderObserver();
  renderUaList('ua-list-clearnet', geoLatest?.networks?.clearnet, '');
  renderUaList('ua-list-onion', geoLatest?.networks?.onion, ' onion');
  const clearnet = geoLatest?.networks?.clearnet;
  const byCountry = clearnet?.by_country;
  if (!byCountry || !Object.keys(byCountry).length) {
    document.getElementById('country-list').innerHTML =
      `<p class="geo-empty">${t('geo.empty')}</p>`;
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
      `<p class="geo-empty">${t('geo.unavailable')}</p>`;
  }
}

darkScheme.addEventListener('change', () => {
  if (lastRangeData) render(lastRangeData);
  if (geoLatest) renderGeo();
});
initGeo();

/* ---- language switching -------------------------------------------------- */

function applyLang(lang) {
  LANG = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('#lang-switcher button').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === lang));
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  // Redraw charts so legends / axis labels / tooltips pick up the new language
  if (lastRangeData) render(lastRangeData);
  if (geoLatest) renderGeo();
}

document.querySelectorAll('#lang-switcher button').forEach(b =>
  b.addEventListener('click', () => applyLang(b.dataset.lang)));

applyLang(LANG);

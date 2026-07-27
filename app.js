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
window.addEventListener('resize', () => { countChart.resize(); churnChart.resize(); });

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

// ===== 地铁渗透率看板 - 城市看板 + 自然月维度 =====
// 数据从外部 JSON 文件加载

let ALL = null, DAP_D = null, MF_MONTHLY = null, MF_DAP = null, COEF = null;

// ===== 异步加载数据 =====
// 从原始 Muse 项目页面拉取 HTML，解析内嵌的数据变量
const SOURCE_URL = 'http://dw5j8w5ip5q4d8yo-et15-sqa.cloudide.dev.alipay.net:8080/metro-dashboard.html';

async function loadData() {
  try {
    // 尝试从本地 data/ 目录加载（GitHub Pages 部署时用）
    try {
      const [allRes, dapRes, mfmRes, mfdRes, coefRes] = await Promise.all([
        fetch('data/all-data.json').then(r => r.json()),
        fetch('data/dap-daily-data.json').then(r => r.json()),
        fetch('data/mf-monthly-data.json').then(r => r.json()),
        fetch('data/mf-dap-monthly-data.json').then(r => r.json()),
        fetch('data/coef-data.json').then(r => r.json()),
      ]);
      ALL = allRes;
      DAP_D = dapRes;
      MF_MONTHLY = mfmRes;
      MF_DAP = mfdRes;
      COEF = coefRes;
      initDashboard();
      return;
    } catch (localErr) {
      console.log('本地数据不可用，尝试从源站加载...');
    }

    // 从原始 Muse 页面加载数据
    const resp = await fetch(SOURCE_URL);
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const scripts = doc.querySelectorAll('script:not[src]');
    for (const script of scripts) {
      const code = script.textContent;
      if (code.includes('__ALL_DATA__')) {
        // 执行数据脚本（在沙箱中）
        const dataScript = document.createElement('script');
        dataScript.textContent = code;
        document.body.appendChild(dataScript);
        dataScript.remove();
      }
    }
    ALL = window.__ALL_DATA__;
    DAP_D = window.__DAP_DAILY_DATA__;
    MF_MONTHLY = window.__MF_MONTHLY_DATA__;
    MF_DAP = window.__MF_DAP_MONTHLY_DATA__;
    COEF = window.__COEF_DATA__;
    initDashboard();
  } catch (e) {
    console.error('数据加载失败:', e);
    document.getElementById('hdrFresh').textContent = '数据加载失败';
  }
}

// ===== 工具函数 =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
function fmt(v, dec=2) { return v == null ? '-' : Number(v).toFixed(dec); }
function fmtW(v) { return v == null ? '—' : (v / 1e4).toFixed(2); }
function pct(v, dec=2) { return v == null ? '-' : (v * 100).toFixed(dec) + '%'; }

// ===== 换乘系数计算 =====
function coefAvg(cityName) {
  if (!COEF) return 1;
  const ci = COEF.cities.indexOf(cityName);
  if (ci < 0) return 1;
  const coefs = COEF.coef[ci].filter(v => v != null);
  if (coefs.length === 0) return 1;
  const last3 = coefs.slice(-3);
  return last3.reduce((a, b) => a + b, 0) / last3.length;
}

function coefByMonth(cityName, monthStr) {
  if (!COEF) return null;
  const ci = COEF.cities.indexOf(cityName);
  if (ci < 0) return null;
  const mi = COEF.months.indexOf(monthStr);
  if (mi < 0) return null;
  return COEF.coef[ci][mi];
}

const COEF_AVG = {};
function initCoefAvg() {
  if (COEF && COEF.cities) {
    COEF.cities.forEach(c => { COEF_AVG[c] = coefAvg(c); });
  }
}

function boardFlow(cityKey, flow, dateStr) {
  if (flow == null) return null;
  if (!ALL) return flow;
  const ci = ALL.cityKeys.indexOf(cityKey);
  if (ci < 0) return flow;
  const cityName = ALL.cityNames[ci];
  let coef = 1;
  if (dateStr && dateStr.length === 8) {
    const monthStr = dateStr.slice(0,4) + '-' + dateStr.slice(4,6);
    let c = coefByMonth(cityName, monthStr);
    if (c != null) {
      coef = c;
    } else {
      coef = COEF_AVG[cityName] || 1;
    }
  } else {
    coef = COEF_AVG[cityName] || 1;
  }
  return flow / coef;
}

// ===== 城市区域映射 =====
const ZONE_MAP = {
  '北京':'西区','上海':'东区','广州':'东区','成都':'西区','深圳':'东区','武汉':'西区','南京':'东区','杭州':'东区','重庆':'西区','西安':'西区','郑州':'东区','天津':'西区','青岛':'西区','苏州':'东区','沈阳':'西区','宁波':'东区','合肥':'东区','大连':'西区','长沙':'东区','济南':'西区','长春':'西区','昆明':'西区','南昌':'东区','佛山':'东区','贵阳':'东区','福州':'东区','南宁':'东区','无锡':'东区','厦门':'东区','东莞':'东区','徐州':'东区','哈尔滨':'西区','石家庄':'西区','绍兴':'东区','南通':'南区','常州':'南区','温州':'东区','太原':'西区','呼和浩特':'西区','芜湖':'南区','洛阳':'东区','兰州':'西区','乌鲁木齐':'西区','嘉兴':'南区',
};

function cityZone(cityName) {
  return ZONE_MAP[cityName] || (MF_DAP && MF_DAP.zones ? (MF_DAP.zones[MF_DAP.cities.indexOf(cityName)] || '东区') : '东区');
}

// ===== Tab 导航 =====
$$('.tabnav .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tabnav .tab').forEach(t => t.classList.remove('on'));
    tab.classList.add('on');
    const target = tab.dataset.tab;
    $$('.card[data-tabcard]').forEach(c => {
      c.classList.toggle('on', c.dataset.tabcard === target);
    });
    if (target === 'dashboard') renderDashboard();
    if (target === 'monthly') renderMF();
  });
});

// ===== Note toggle =====
$('#noteToggle')?.addEventListener('click', () => {
  const m = $('#noteMore');
  if (m.style.display === 'none') { m.style.display = 'inline'; $('#noteToggle').textContent = '收起 ▴'; }
  else { m.style.display = 'none'; $('#noteToggle').textContent = '展开说明 ▾'; }
});

// ===== Tab: 城市看板 =====
const ST_DB = { cityIdx: -1, date: '', metrics: new Set(['flow', 'txn', 'dap', 'pen']), tableDim: 'day', showDays: true, showPrev: true, showYoy: true, chartDays: 30, tableZone: 'all' };
let dbChart = null;

const DB_METRICS = [
  { key: 'flow', label: '进站客流', unit: '万', yAxis: 0, type: 'bar', opacity: 0.7 },
  { key: 'txn', label: '笔数', unit: '万', yAxis: 0, divide: 1e4, type: 'bar', opacity: 0.5 },
  { key: 'dap', label: 'DAP', unit: '万', yAxis: 0, divide: 1e4, type: 'bar', opacity: 0.6 },
  { key: 'pen', label: '渗透率', unit: '%', yAxis: 1, type: 'line' },
];

function dbDefaultDate() {
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yStr = _dbFmtD(yest);
  return DAP_D.dates.includes(yStr) ? yStr : DAP_D.dates[DAP_D.dates.length - 1];
}

function renderDashboard() {
  if (!ALL || !DAP_D) return;
  if (!ST_DB.date) ST_DB.date = dbDefaultDate();
  $('#dbDate').value = ST_DB.date.slice(0,4) + '-' + ST_DB.date.slice(4,6) + '-' + ST_DB.date.slice(6,8);
  if (ST_DB.cityIdx < 0) {
    const bjIdx = DAP_D.cityNames.indexOf('北京');
    ST_DB.cityIdx = bjIdx >= 0 ? bjIdx : 0;
  }
  renderDbCityTags();
  renderDbKpis();
  renderDbChart();
  renderDbTable();
  $('#dbDL').disabled = false;
  $('#hdrFresh').textContent = ALL.lastUpdatedAt ? ALL.lastUpdatedAt.slice(0, 10) : ST_DB.date;
}

function renderDbCityTags() {
  const container = $('#dbCityTags');
  if (!container) return;
  const zones = ['东区','西区','南区'];
  const grouped = {};
  zones.forEach(z => grouped[z] = []);
  DAP_D.cityNames.forEach((cn, i) => {
    const z = cityZone(cn);
    if (!grouped[z]) grouped[z] = [];
    grouped[z].push({ name: cn, idx: i });
  });
  let html = '';
  for (const z of zones) {
    if (!grouped[z] || !grouped[z].length) continue;
    html += `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin-bottom:2px"><span style="font-size:10px;color:var(--muted);font-weight:600;min-width:34px">${z}:</span>`;
    html += grouped[z].map(c =>
      `<span class="mf-tag ${ST_DB.cityIdx === c.idx ? 'on' : ''}" data-ci="${c.idx}" style="font-size:11px">${c.name}</span>`
    ).join('');
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.mf-tag[data-ci]').forEach(t => t.addEventListener('click', () => {
    ST_DB.cityIdx = parseInt(t.dataset.ci);
    renderDbCityTags();
    renderDbKpis();
    renderDbChart();
    renderDbTable();
  }));
}

function dbSnapshot(dim, di, ci) {
  const s = dbWindowStart(dim, di);
  if (s < 0) return { flow: null, txn: null, dap: null, pen: null, flowDays: 0, totalDays: 0 };
  let tFlow = 0, tTxn = 0, tDap = 0, flowDays = 0, txnDays = 0, totalDays = 0;
  for (let k = s; k <= di; k++) {
    totalDays++;
    const date = DAP_D.dates[k];
    const fa = ALL.dates.indexOf(date);
    const f = fa >= 0 ? ALL.flow[fa]?.[ci] : null;
    if (f != null && f > 0) { tFlow += boardFlow(ALL.cityKeys[ci], f, date); flowDays++; }
    const t = DAP_D.txn[k]?.[ci];
    if (t != null) { tTxn += t; txnDays++; }
    const d = DAP_D.dap[k]?.[ci];
    if (d != null) tDap += d;
  }
  let pen = null;
  if (flowDays > 0 && txnDays > 0) {
    if (dim === 'week' && flowDays < 4) {
      pen = null;
    } else if (dim === 'mtd' && totalDays > 0 && flowDays < totalDays * 0.7) {
      pen = null;
    } else {
      pen = (tTxn / txnDays / 1e4) / (tFlow / flowDays);
    }
  }
  return {
    flow: flowDays > 0 ? tFlow / flowDays : null,
    txn: txnDays > 0 ? tTxn / txnDays : null,
    dap: txnDays > 0 ? tDap / txnDays : null,
    pen: pen,
    flowDays: flowDays,
    totalDays: totalDays,
  };
}

function dbWindowStart(dim, di) {
  if (dim === 'day') return di;
  if (dim === 'week') return di - 6;
  const cur = DAP_D.dates[di];
  const m0 = cur.slice(0, 6) + '01';
  const s = DAP_D.dates.indexOf(m0);
  return s < 0 ? 0 : s;
}

function _dbParseD(s) { return new Date(s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8)); }
function _dbFmtD(d) { return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); }

function dbPrevIdx(dim, di) {
  if (dim === 'day') return di - 1;
  if (dim === 'week') return di - 7;
  const cur = DAP_D.dates[di];
  const pd = _dbParseD(cur); pd.setMonth(pd.getMonth() - 1);
  return DAP_D.dates.indexOf(_dbFmtD(pd));
}

function dbYoyIdx(dim, di) {
  if (dim === 'day') return di - 7;
  const yoyD = _dbParseD(DAP_D.dates[di]);
  yoyD.setFullYear(yoyD.getFullYear() - 1);
  return DAP_D.dates.indexOf(_dbFmtD(yoyD));
}

function dbFmtVal(metricKey, snap) {
  if (!snap || snap[metricKey] == null) {
    if (metricKey === 'pen' && snap && snap.flowDays !== undefined) return '客流不足';
    return '-';
  }
  if (metricKey === 'pen') return (snap.pen * 100).toFixed(1) + '%';
  if (metricKey === 'flow') return snap.flow.toFixed(1);
  return (snap[metricKey] / 1e4).toFixed(1);
}

function dbFmtAbs(metricKey, cur, prev) {
  if (!cur || !prev || cur[metricKey] == null || prev[metricKey] == null || prev[metricKey] === 0) return '-';
  let pct;
  if (metricKey === 'pen') {
    pct = ((cur.pen - prev.pen) / prev.pen) * 100;
  } else if (metricKey === 'flow') {
    pct = ((cur.flow - prev.flow) / prev.flow) * 100;
  } else {
    pct = ((cur[metricKey] - prev[metricKey]) / prev[metricKey]) * 100;
  }
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

function renderDbKpis() {
  const ci = ST_DB.cityIdx;
  const cityName = DAP_D.cityNames[ci];
  const zone = cityZone(cityName);
  const di = DAP_D.dates.indexOf(ST_DB.date);
  if (di < 0) return;
  const pi = dbPrevIdx('day', di);
  const yi = dbYoyIdx('day', di);

  for (const [dim, badgeId, kpiId] of [
    ['day', 'dbBadgeDay', 'dbKpiDay'],
    ['week', 'dbBadgeWeek', 'dbKpiWeek'],
    ['mtd', 'dbBadgeMtd', 'dbKpiMtd'],
  ]) {
    const dimDi = dim === 'day' ? di : di;
    const cur = dbSnapshot(dim, dimDi, ci);
    const prevPi = dbPrevIdx(dim, di);
    const prev = prevPi >= 0 ? dbSnapshot(dim, prevPi, ci) : null;
    const yoyI = dbYoyIdx(dim, di);
    const yoy = yoyI >= 0 ? dbSnapshot(dim, yoyI, ci) : null;
    const dimLabel = { day: '日', week: '近7日', mtd: 'MTD' }[dim];
    $('#' + badgeId).textContent = `${cityName} · ${dimLabel} · ${ST_DB.date}`;

    const cards = [
      { key: 'flow', label: '进站客流', unit: '万' },
      { key: 'txn', label: '笔数', unit: '万' },
      { key: 'dap', label: 'DAP', unit: '万' },
      { key: 'pen', label: '渗透率', unit: '%' },
    ];
    const html = cards.map(m => {
      const val = dbFmtVal(m.key, cur);
      const prevAbs = dbFmtAbs(m.key, cur, prev);
      const yoyAbs = dbFmtAbs(m.key, cur, yoy);
      const prevColor = prevAbs.startsWith('-') ? 'var(--red)' : 'var(--green)';
      const yoyColor = yoyAbs.startsWith('-') ? 'var(--red)' : 'var(--green)';
      const prevLabel = { day: '日环比', week: '周环比', mtd: '月环比' }[dim];
      const yoyLabel = { day: '周同比', week: '年同比', mtd: '年同比' }[dim];
      const flowDays = cur ? cur.flowDays : 0;
      const totalDays = cur ? cur.totalDays : 0;
      const prevFlowDays = prev ? prev.flowDays : 0;
      const prevTotalDays = prev ? prev.totalDays : 0;
      const yoyFlowDays = yoy ? yoy.flowDays : 0;
      const yoyTotalDays = yoy ? yoy.totalDays : 0;
      const daysInfo = m.key === 'flow' ? `<span style="font-size:9px;color:var(--muted);white-space:nowrap;margin-left:4px">本期${flowDays}天/环比${prevFlowDays}天/同比${yoyFlowDays}天</span>` : '';
      const fmtPrev = prev ? dbFmtVal(m.key, prev) : '-';
      const fmtYoy = yoy ? dbFmtVal(m.key, yoy) : '-';
      const unitSuffix = m.unit === '%' ? '' : m.unit;
      const prevVal = (fmtPrev !== '-' && fmtPrev !== '客流不足') ? fmtPrev + unitSuffix : fmtPrev;
      const yoyVal = (fmtYoy !== '-' && fmtYoy !== '客流不足') ? fmtYoy + unitSuffix : fmtYoy;
      let bottomLine = '';
      if (m.key === 'pen' && val === '客流不足') {
        bottomLine = '<div class="d" style="color:var(--amber)">客流不足，渗透率不予计算</div>';
      } else {
        bottomLine = `<div class="d">${prevLabel} <span style="color:var(--muted)">${prevVal}</span><span style="color:${prevColor}">${prevAbs}</span>/${yoyLabel} <span style="color:var(--muted)">${yoyVal}</span><span style="color:${yoyColor}">${yoyAbs}</span></div>`;
      }
      return `<div class="kpi"><div class="l">${m.label}</div><div class="v" style="white-space:nowrap">${val}${m.unit==='%'||val==='客流不足'?'':'<span style="font-size:12px;color:var(--muted);margin-left:4px">'+m.unit+'</span>'}${daysInfo}</div>${bottomLine}</div>`;
    }).join('');
    $('#' + kpiId).innerHTML = html;
  }
}

function renderDbChart() {
  if (!DAP_D) return;
  const ci = ST_DB.cityIdx;
  const cityName = DAP_D.cityNames[ci];
  const allDates = DAP_D.dates;
  const chartStart = Math.max(0, allDates.length - ST_DB.chartDays);
  const chartDates = allDates.slice(chartStart);
  const indices = chartDates.map((_, i) => i + chartStart);
  const series = [];
  for (const m of DB_METRICS) {
    const data = indices.map(di => {
      const snap = dbSnapshot('day', di, ci);
      let v = snap[m.key];
      if (m.divide && v != null) v = v / m.divide;
      return v;
    });
    series.push({ name: cityName + '-' + m.label, type: m.type || 'line', data, showSymbol: false, lineStyle: { width: 1.5 }, itemStyle: m.opacity ? { opacity: m.opacity } : undefined, yAxisIndex: m.yAxis, connectNulls: false });
  }
  const penSeries = series.filter(s => s.name.includes('渗透率'));
  const penVals = penSeries.flatMap(s => s.data.filter(v => v != null));
  const penMin = penVals.length ? Math.min(...penVals) : 0;
  const penMax = penVals.length ? Math.max(...penVals) : 1;
  const penMinAxis = penMin - (penMax - penMin) * 0.14;
  if (!dbChart) {
    dbChart = echarts.init($('#dbChart'));
    window.addEventListener('resize', () => dbChart?.resize());
  }
  dbChart.setOption({
    backgroundColor: 'transparent',
    legend: { type: 'scroll', textStyle: { fontSize: 10, color: '#6b7280' }, top: 0 },
    grid: { left: 50, right: 60, top: 40, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' }, formatter: function(p) {
      let lines = [p[0].axisValue];
      p.forEach(function(item) {
        let val = item.data;
        if (val == null) return;
        let formatted;
        if (item.seriesName.includes('渗透率')) { formatted = (val * 100).toFixed(1) + '%'; }
        else { formatted = val.toFixed(1) + '万'; }
        lines.push(item.marker + item.seriesName + ': ' + formatted);
      });
      return lines.join('<br/>');
    }},
    xAxis: { type: 'category', data: chartDates, axisLabel: { fontSize: 10, color: '#6b7280' }, boundaryGap: false },
    yAxis: [
      { type: 'value', name: '万', show: series.length > 0, axisLabel: { fontSize: 10, color: '#6b7280' }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
      { type: 'value', name: '渗透率', show: penSeries.length > 0, min: penSeries.length > 0 && penMinAxis > 0 ? penMinAxis : 0, axisLabel: { fontSize: 10, color: '#6b7280', formatter: v => (v * 100).toFixed(1) + '%' }, splitLine: { show: false } }
    ],
    series,
  }, true);
  $('#dbChartBadge').textContent = `${cityName} · 近${chartDates.length}天`;
}

function renderDbTable() {
  const tbl = $('#dbTable');
  const badge = $('#dbTableBadge');
  if (!tbl || !DAP_D) return;
  const di = DAP_D.dates.indexOf(ST_DB.date);
  if (di < 0) { tbl.innerHTML = '<tbody><tr><td style="color:var(--muted)">无数据</td></tr></tbody>'; return; }

  const dim = ST_DB.tableDim;
  const dimLabel = { day: '日', week: '近7日', mtd: 'MTD' }[dim];
  const prevLabel = { day: '日环比', week: '周环比', mtd: '月环比' }[dim];
  const yoyLabel = { day: '周同比', week: '年同比', mtd: '年同比' }[dim];
  const prevColLabel = { day: '昨日客流', week: '上周同期客流', mtd: '上月同期客流' }[dim];
  const yoyColLabel = { day: '上周同期客流', week: '去年同期客流', mtd: '去年同期客流' }[dim];
  const flowPrevPctRaw = (cur, prev) => {
    if (!cur || !prev || cur.flow == null || prev.flow == null || prev.flow === 0) return null;
    return ((cur.flow - prev.flow) / prev.flow) * 100;
  };
  const txnPrevPctRaw = (cur, prev) => {
    if (!cur || !prev || cur.txn == null || prev.txn == null || prev.txn === 0) return null;
    return ((cur.txn - prev.txn) / prev.txn) * 100;
  };
  const flowYoyPctRaw = (cur, yoy) => {
    if (!cur || !yoy || cur.flow == null || yoy.flow == null || yoy.flow === 0) return null;
    return ((cur.flow - yoy.flow) / yoy.flow) * 100;
  };
  const txnYoyPctRaw = (cur, yoy) => {
    if (!cur || !yoy || cur.txn == null || yoy.txn == null || yoy.txn === 0) return null;
    return ((cur.txn - yoy.txn) / yoy.txn) * 100;
  };
  const isWin = (flowPct, txnPct) => {
    if (flowPct == null || txnPct == null) return null;
    return txnPct > flowPct;
  };
  const prevName = { day: '日', week: '周', mtd: '月' }[dim];
  const yoyName = { day: '周', week: '年', mtd: '年' }[dim];

  const fmtFlow = v => v != null ? v.toFixed(1) : '-';
  const fmtTxn = v => v != null ? (v / 1e4).toFixed(1) : '-';
  const fmtPen = (v, snap) => {
    if (v == null) {
      if (snap && snap.flowDays !== undefined && snap.totalDays !== undefined && snap.totalDays > 0) return '客流不足';
      return '-';
    }
    return (v * 100).toFixed(1) + '%';
  };

  const fmtPct = (cur, prev, key) => {
    if (!cur || !prev || cur[key] == null || prev[key] == null || prev[key] === 0) return '-';
    let pct = ((cur[key] - prev[key]) / prev[key]) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  const dh = ST_DB.showDays ? '' : 'display:none';
  const ph = ST_DB.showPrev ? '' : 'display:none';
  const yh = ST_DB.showYoy ? '' : 'display:none';
  let html = `<thead style="position:sticky;top:0;z-index:2"><tr><th>大区</th><th>城市</th><th>跑赢/输</th><th>DAP涨跌</th><th style="${dh}">有效天数</th>`;
  html += `<th>本期客流</th><th style="${ph}">${prevColLabel}</th><th>${prevLabel}</th><th style="${yh}">${yoyColLabel}</th><th>${yoyLabel}</th>`;
  const prevTxnCol = { day: '昨日笔数', week: '上周同期笔数', mtd: '上月同期笔数' }[dim];
  const yoyTxnCol = { day: '上周同期笔数', week: '去年同期笔数', mtd: '去年同期笔数' }[dim];
  const prevDapCol = { day: '昨日DAP', week: '上周同期DAP', mtd: '上月同期DAP' }[dim];
  const yoyDapCol = { day: '上周同期DAP', week: '去年同期DAP', mtd: '去年同期DAP' }[dim];
  const prevPenCol = { day: '昨日渗透率', week: '上周同期渗透率', mtd: '上月同期渗透率' }[dim];
  const yoyPenCol = { day: '上周同期渗透率', week: '去年同期渗透率', mtd: '去年同期渗透率' }[dim];
  html += `<th>本期笔数</th><th style="${ph}">${prevTxnCol}</th><th>${prevLabel}</th><th style="${yh}">${yoyTxnCol}</th><th>${yoyLabel}</th>`;
  html += `<th>本期DAP</th><th style="${ph}">${prevDapCol}</th><th>${prevLabel}</th><th style="${yh}">${yoyDapCol}</th><th>${yoyLabel}</th>`;
  html += `<th>本期渗透率</th><th style="${ph}">${prevPenCol}</th><th>${prevLabel}</th><th style="${yh}">${yoyPenCol}</th><th>${yoyLabel}</th>`;
  html += `</tr></thead><tbody>`;

  for (let ci = 0; ci < DAP_D.cityNames.length; ci++) {
    const cityName = DAP_D.cityNames[ci];
    const zone = cityZone(cityName);
    if (ST_DB.tableZone !== 'all' && zone !== ST_DB.tableZone) continue;
    const cur = dbSnapshot(dim, di, ci);
    const prevPi = dbPrevIdx(dim, di);
    const prev = prevPi >= 0 ? dbSnapshot(dim, prevPi, ci) : null;
    const yoyI = dbYoyIdx(dim, di);
    const yoy = yoyI >= 0 ? dbSnapshot(dim, yoyI, ci) : null;

    const days = cur.totalDays > 0 ? `${cur.flowDays}` : '-';
    const prevDays = prev && prev.totalDays > 0 ? `${prev.flowDays}` : '-';
    const yoyDays = yoy && yoy.totalDays > 0 ? `${yoy.flowDays}` : '-';
    const daysStr = `本期${days}/环比${prevDays}/同比${yoyDays}`;

    const curFlow = fmtFlow(cur.flow), prevFlow = prev ? fmtFlow(prev.flow) : '-', yoyFlow = yoy ? fmtFlow(yoy.flow) : '-';
    const curTxn = fmtTxn(cur.txn), prevTxn = prev ? fmtTxn(prev.txn) : '-', yoyTxn = yoy ? fmtTxn(yoy.txn) : '-';
    const curDap = fmtTxn(cur.dap), prevDap = prev ? fmtTxn(prev.dap) : '-', yoyDap = yoy ? fmtTxn(yoy.dap) : '-';
    const curPen = fmtPen(cur.pen, cur), prevPen = prev ? fmtPen(prev.pen, prev) : '-', yoyPen = yoy ? fmtPen(yoy.pen, yoy) : '-';

    const flowPrevPct = fmtPct(cur, prev, 'flow'), flowYoyPct = fmtPct(cur, yoy, 'flow');
    const txnPrevPct = fmtPct(cur, prev, 'txn'), txnYoyPct = fmtPct(cur, yoy, 'txn');
    const dapPrevPct = fmtPct(cur, prev, 'dap'), dapYoyPct = fmtPct(cur, yoy, 'dap');
    const penPrevPct = fmtPct(cur, prev, 'pen'), penYoyPct = fmtPct(cur, yoy, 'pen');

    const color = pct => pct.startsWith('-') && pct !== '-' ? 'var(--red)' : 'var(--green)';
    const muted = 'color:var(--muted)';

    const showDays = ST_DB.showDays, showPrev = ST_DB.showPrev, showYoy = ST_DB.showYoy;
    const dh = showDays ? '' : 'display:none';
    const ph = showPrev ? '' : 'display:none';
    const yh = showYoy ? '' : 'display:none';

    let combo = '-';
    if (cur.pen == null) {
      combo = '-';
    } else {
      const fpRaw = flowPrevPctRaw(cur, prev), tpRaw = txnPrevPctRaw(cur, prev);
      const fyRaw = flowYoyPctRaw(cur, yoy), tyRaw = txnYoyPctRaw(cur, yoy);
      const prevWin = isWin(fpRaw, tpRaw);
      const yoyWin = isWin(fyRaw, tyRaw);
      if (prevWin !== null && yoyWin !== null) {
        if (prevWin && yoyWin) combo = '双赢';
        else if (prevWin && !yoyWin) combo = `${prevName}赢${yoyName}输`;
        else if (!prevWin && yoyWin) combo = `${prevName}输${yoyName}赢`;
        else combo = '双输';
      }
    }
    const typeColor = t => {
      if (t === '双赢') return 'var(--green)';
      if (t === '双输') return 'var(--red)';
      return 'var(--amber)';
    };
    const dapPrevRaw = (cur, prev) => {
      if (!cur || !prev || cur.dap == null || prev.dap == null || prev.dap === 0) return null;
      return ((cur.dap - prev.dap) / prev.dap) * 100;
    };
    const dapYoyRaw = (cur, yoy) => {
      if (!cur || !yoy || cur.dap == null || yoy.dap == null || yoy.dap === 0) return null;
      return ((cur.dap - yoy.dap) / yoy.dap) * 100;
    };
    const dpRaw = dapPrevRaw(cur, prev), dyRaw = dapYoyRaw(cur, yoy);
    let dapCombo = '-';
    if (dpRaw !== null && dyRaw !== null) {
      const dpUp = dpRaw >= 0, dyUp = dyRaw >= 0;
      if (dpUp && dyUp) dapCombo = '双涨';
      else if (dpUp && !dyUp) dapCombo = `${prevName}涨${yoyName}降`;
      else if (!dpUp && dyUp) dapCombo = `${prevName}降${yoyName}涨`;
      else dapCombo = '双降';
    }
    const dapColor = t => {
      if (t === '双涨') return 'var(--green)';
      if (t === '双降') return 'var(--red)';
      return 'var(--amber)';
    };

    html += `<tr><td>${zone}</td><td style="text-align:left">${cityName}</td>`;
    html += `<td style="color:${typeColor(combo)};font-size:10px;white-space:nowrap">${combo}</td>`;
    html += `<td style="color:${dapColor(dapCombo)};font-size:10px;white-space:nowrap">${dapCombo}</td>`;
    html += `<td style="${muted};font-size:10px;${dh}">${daysStr}</td>`;
    html += `<td>${curFlow}</td><td style="${muted};${ph}">${prevFlow}</td><td style="color:${color(flowPrevPct)}">${flowPrevPct}</td>`;
    html += `<td style="${muted};${yh}">${yoyFlow}</td><td style="color:${color(flowYoyPct)}">${flowYoyPct}</td>`;
    html += `<td>${curTxn}</td><td style="${muted};${ph}">${prevTxn}</td><td style="color:${color(txnPrevPct)}">${txnPrevPct}</td>`;
    html += `<td style="${muted};${yh}">${yoyTxn}</td><td style="color:${color(txnYoyPct)}">${txnYoyPct}</td>`;
    html += `<td>${curDap}</td><td style="${muted};${ph}">${prevDap}</td><td style="color:${color(dapPrevPct)}">${dapPrevPct}</td>`;
    html += `<td style="${muted};${yh}">${yoyDap}</td><td style="color:${color(dapYoyPct)}">${dapYoyPct}</td>`;
    html += `<td>${curPen}</td><td style="${muted};${ph}">${prevPen}</td><td style="color:${color(penPrevPct)}">${penPrevPct}</td>`;
    html += `<td style="${muted};${yh}">${yoyPen}</td><td style="color:${color(penYoyPct)}">${penYoyPct}</td>`;
    html += `</tr>`;
  }
  html += '</tbody>';
  tbl.innerHTML = html;
  const zoneLabel = ST_DB.tableZone === 'all' ? '全国' : ST_DB.tableZone;
  if (badge) badge.textContent = `${dimLabel} · ${zoneLabel} · ${ST_DB.date}`;
}

// Dashboard events
$('#dbDate')?.addEventListener('change', () => {
  ST_DB.date = $('#dbDate').value.replace(/-/g, '');
  renderDbKpis();
  renderDbChart();
  renderDbTable();
});
$('#dbChartDays')?.addEventListener('change', () => {
  ST_DB.chartDays = parseInt($('#dbChartDays').value);
  renderDbChart();
});
$$('[data-dbtdim]').forEach(t => t.addEventListener('click', () => {
  $$('[data-dbtdim]').forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  ST_DB.tableDim = t.dataset.dbtdim;
  renderDbTable();
}));
$$('[data-dbtzone]').forEach(t => t.addEventListener('click', () => {
  $$('[data-dbtzone]').forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  ST_DB.tableZone = t.dataset.dbtzone;
  renderDbTable();
}));
['dbToggleDays','dbTogglePrev','dbToggleYoy'].forEach(id => {
  const t = document.getElementById(id);
  if (t) {
    t.classList.add('on');
    t.addEventListener('click', () => {
      if (id === 'dbToggleDays') ST_DB.showDays = !ST_DB.showDays;
      if (id === 'dbTogglePrev') ST_DB.showPrev = !ST_DB.showPrev;
      if (id === 'dbToggleYoy') ST_DB.showYoy = !ST_DB.showYoy;
      t.classList.toggle('on');
      renderDbTable();
    });
  }
});
$('#dbDL')?.addEventListener('click', () => {
  if (!DAP_D) return;
  const lastDate = DAP_D.dates[DAP_D.dates.length - 1];
  const firstDate = DAP_D.dates[0];
  const lastFmt = lastDate.slice(0,4)+'-'+lastDate.slice(4,6)+'-'+lastDate.slice(6,8);
  const firstFmt = firstDate.slice(0,4)+'-'+firstDate.slice(4,6)+'-'+firstDate.slice(6,8);
  const html = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);z-index:9999;display:flex;align-items:center;justify-content:center" id="dbDlOverlay">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px 20px;box-shadow:0 4px 12px rgba(0,0,0,.15)">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">下载城市明细 - 选择日期范围</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:11px;color:var(--muted)">开始:</span>
        <input type="date" id="dbDlStart" value="${firstFmt}" style="font-size:12px;padding:4px 6px">
        <span style="font-size:11px;color:var(--muted)">结束:</span>
        <input type="date" id="dbDlEnd" value="${lastFmt}" style="font-size:12px;padding:4px 6px">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="dl-btn" id="dbDlCancel" style="padding:4px 12px">取消</button>
        <button class="dl-btn" id="dbDlConfirm" style="padding:4px 12px;background:var(--accent);color:#fff;border-color:var(--accent)">确认下载</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  $('#dbDlCancel').addEventListener('click', () => $('#dbDlOverlay').remove());
  $('#dbDlConfirm').addEventListener('click', () => {
    const startVal = $('#dbDlStart').value.replace(/-/g,'');
    const endVal = $('#dbDlEnd').value.replace(/-/g,'');
    $('#dbDlOverlay').remove();
    if (!startVal || !endVal) return;
    const dim = ST_DB.tableDim;
    const dimLabel = { day: '日', week: '近7日', mtd: 'MTD' }[dim];
    const lines = ['日期,大区,城市,有效天数,本期进站客流(万),对比期进站客流(万),客流环比,同比期进站客流(万),客流同比,本期笔数(万),本期DAP(万),本期渗透率'];
    const f = v => v != null ? v.toFixed(1) : '';
    const fT = v => v != null ? (v / 1e4).toFixed(1) : '';
    const fP = (v, snap) => { if (v == null) return snap && snap.flowDays !== undefined ? '客流不足' : ''; return (v * 100).toFixed(1) + '%'; };
    const fPct = (cur, prev, key) => { if (!cur || !prev || cur[key] == null || prev[key] == null || prev[key] === 0) return ''; let pct = ((cur[key] - prev[key]) / prev[key]) * 100; return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'; };
    const dateList = DAP_D.dates.filter(d => d >= startVal && d <= endVal);
    for (const dt of dateList) {
      const di = DAP_D.dates.indexOf(dt);
      if (di < 0) continue;
      for (let ci = 0; ci < DAP_D.cityNames.length; ci++) {
        const cityName = DAP_D.cityNames[ci];
        const zone = cityZone(cityName);
        const cur = dbSnapshot(dim, di, ci);
        const prevPi = dbPrevIdx(dim, di);
        const prev = prevPi >= 0 ? dbSnapshot(dim, prevPi, ci) : null;
        const yoyI = dbYoyIdx(dim, di);
        const yoy = yoyI >= 0 ? dbSnapshot(dim, yoyI, ci) : null;
        const days = cur.totalDays > 0 ? `${cur.flowDays}/${cur.totalDays}` : '';
        const prevFlow = prev ? f(prev.flow) : '';
        const yoyFlow = yoy ? f(yoy.flow) : '';
        lines.push([dt, zone, cityName, days, f(cur.flow), prevFlow, fPct(cur, prev, 'flow'), yoyFlow, fPct(cur, yoy, 'flow'), fT(cur.txn), fT(cur.dap), fP(cur.pen, cur)].join(','));
      }
    }
    downloadCSV(lines.join('\n'), '城市明细_' + dimLabel + '_' + startVal + '-' + endVal);
  });
});

// ===== Tab: 自然月维度 =====
const ST_MC = { nation: true, zones: new Set(), cities: new Set(), metrics: new Set(['flow','pen']) };
const ST_M = { month: '' };
let mfChart = null;

const MF_METRICS = [
  { key: 'flow', label: '进站客流', type: 'bar', yAxis: 0, opacity: 0.7 },
  { key: 'txn', label: '笔数', type: 'bar', yAxis: 0, opacity: 0.5 },
  { key: 'dap', label: 'DAP', type: 'bar', yAxis: 0, opacity: 0.6 },
  { key: 'pen', label: '渗透率', type: 'line', yAxis: 1, opacity: 1 },
];

function renderMF() {
  if (!MF_DAP || !MF_MONTHLY) return;
  if (!ST_M.month) ST_M.month = MF_DAP.months[MF_DAP.months.length - 1];
  const sel = $('#mfMonth');
  if (sel && !sel.options.length) {
    MF_DAP.months.slice().reverse().forEach(m => {
      const opt = document.createElement('option'); opt.value = m; opt.textContent = m; sel.add(opt);
    });
    sel.value = ST_M.month;
    sel.addEventListener('change', () => { ST_M.month = sel.value; renderMFTable(); });
  }
  renderMFCityTags();
  renderMFChart();
  renderMFTable();
}

function mfCityData(mi, ci) {
  const month = MF_DAP.months[mi];
  const mfi = MF_MONTHLY && MF_MONTHLY.months ? MF_MONTHLY.months.indexOf(month) : mi;
  const flow = MF_MONTHLY && MF_MONTHLY.flow ? MF_MONTHLY.flow[ci]?.[mfi] : null;
  const txn = MF_DAP.txn ? MF_DAP.txn[mi]?.[ci] : null;
  const dap = MF_DAP.dap ? MF_DAP.dap[mi]?.[ci] : null;
  const pen = flow != null && flow > 0 && txn != null ? txn / flow : null;
  return { flow, txn, dap, pen };
}

function mfAggNation(mi) {
  let tFlow = 0, tTxn = 0, tDap = 0;
  for (let ci = 0; ci < MF_DAP.cities.length; ci++) {
    const d = mfCityData(mi, ci);
    if (d.flow && d.flow > 0) tFlow += d.flow;
    if (d.txn) tTxn += d.txn;
    if (d.dap) tDap += d.dap;
  }
  return { name: '全国', flow: tFlow, txn: tTxn, dap: tDap, pen: tFlow > 0 && tTxn > 0 ? tTxn / tFlow : null };
}

function mfAggZone(mi, zoneFilter) {
  const zoneData = {};
  for (let ci = 0; ci < MF_DAP.cities.length; ci++) {
    const z = MF_DAP.zones[ci];
    if (zoneFilter && zoneFilter !== 'all' && z !== zoneFilter) continue;
    if (!zoneData[z]) zoneData[z] = { name: z, flow: 0, txn: 0, dap: 0 };
    const d = mfCityData(mi, ci);
    if (d.flow && d.flow > 0) zoneData[z].flow += d.flow;
    if (d.txn) zoneData[z].txn += d.txn;
    if (d.dap) zoneData[z].dap += d.dap;
  }
  return Object.values(zoneData).map(d => ({ ...d, pen: d.flow > 0 && d.txn > 0 ? d.txn / d.flow : null }));
}

function renderMFCityTags() {
  const container = $('#mfCityTags');
  if (!container) return;
  const zones = ['东区','西区','南区'];
  const grouped = {};
  zones.forEach(z => grouped[z] = []);
  MF_DAP.cities.forEach((cn, i) => {
    const z = MF_DAP.zones[i] || '东区';
    if (!grouped[z]) grouped[z] = [];
    grouped[z].push({ name: cn, idx: i });
  });
  let html = '';
  for (const z of zones) {
    if (!grouped[z] || !grouped[z].length) continue;
    html += `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin-bottom:2px"><span style="font-size:9px;color:var(--muted);font-weight:600;min-width:34px">${z}:</span>`;
    html += grouped[z].map(c =>
      `<span class="mf-tag mf-mini ${ST_MC.cities.has(c.idx) ? 'on' : ''}" data-ci="${c.idx}">${c.name}</span>`
    ).join('');
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.mf-tag').forEach(t => t.addEventListener('click', () => {
    const ci = parseInt(t.dataset.ci);
    if (ST_MC.cities.has(ci)) ST_MC.cities.delete(ci); else ST_MC.cities.add(ci);
    t.classList.toggle('on'); renderMFChart();
  }));
}

function mfGetEntities() {
  const entities = [];
  if (ST_MC.nation) entities.push({ name: '全国', getData: mi => mfAggNation(mi) });
  for (const z of ST_MC.zones) {
    entities.push({ name: z, getData: mi => mfAggZone(mi, z).find(d => d.name === z) || { name: z, flow: 0, txn: 0, dap: 0, pen: null } });
  }
  for (const ci of ST_MC.cities) {
    entities.push({ name: MF_DAP.cities[ci], getData: mi => mfCityData(mi, ci) });
  }
  return entities;
}

function renderMFChart() {
  if (!MF_DAP) return;
  const months = MF_DAP.months;
  const entities = mfGetEntities();
  if (!entities.length) return;
  const names = entities.map(e => e.name);
  const monthData = months.map((mo, mi) => entities.map(e => e.getData(mi)));

  const series = [];
  for (const m of MF_METRICS) {
    if (!ST_MC.metrics.has(m.key)) continue;
    for (let ni = 0; ni < names.length; ni++) {
      series.push({
        name: names[ni] + '-' + m.label,
        type: m.type,
        yAxisIndex: m.yAxis,
        data: monthData.map(d => d[ni] ? d[ni][m.key] : null),
        itemStyle: m.type === 'bar' ? { opacity: m.opacity } : undefined,
        showSymbol: m.type === 'line' ? false : undefined,
        lineStyle: m.type === 'line' ? { width: 1.5 } : undefined,
        barGap: m.type === 'bar' ? '10%' : undefined,
      });
    }
  }

  const penSeries = series.filter(s => s.name.includes('渗透率'));
  const penVals = penSeries.flatMap(s => s.data.filter(v => v != null));
  const penMin = penVals.length ? Math.min(...penVals) : 0;
  const penMax = penVals.length ? Math.max(...penVals) : 1;
  const penMinAxis = penMin - (penMax - penMin) * 0.14;
  const hasBar = series.some(s => s.type === 'bar');
  const hasLine = penSeries.length > 0;

  if (!mfChart) {
    mfChart = echarts.init($('#mfChart'));
    window.addEventListener('resize', () => mfChart?.resize());
  }
  mfChart.setOption({
    backgroundColor: 'transparent',
    legend: { type: 'scroll', textStyle: { fontSize: 10, color: '#6b7280' }, top: 0 },
    grid: { left: 55, right: 60, top: 40, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: hasBar ? 'shadow' : 'line' }, formatter: function(p) { let lines = [p[0].axisValue]; p.forEach(function(item) { let val = item.data; if (val == null) return; let formatted; if (item.seriesName.includes('渗透率')) { formatted = (val * 100).toFixed(1) + '%'; } else { formatted = val.toFixed(1) + '万'; } lines.push(item.marker + item.seriesName + ': ' + formatted); }); return lines.join('<br/>'); } },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 10, color: '#6b7280' } },
    yAxis: [
      { type: 'value', name: '万', show: hasBar, axisLabel: { fontSize: 10, color: '#6b7280' }, splitLine: { lineStyle: { color: '#e5e7eb' } } },
      { type: 'value', name: '渗透率', show: hasLine, min: hasLine && penMinAxis > 0 ? penMinAxis : 0, axisLabel: { fontSize: 10, color: '#6b7280', formatter: v => (v * 100).toFixed(1) + '%' }, splitLine: { show: false } }
    ],
    series,
  }, true);
}

function renderMFTable() {
  const tbl = $('#mfTable');
  const badge = $('#mfBadge');
  if (!tbl || !MF_DAP) return;
  const mi = MF_DAP.months.indexOf(ST_M.month);
  if (mi < 0) { tbl.innerHTML = '<tbody><tr><td style="color:var(--muted)">无该月数据</td></tr></tbody>'; return; }
  const prevMi = mi - 1 >= 0 ? mi - 1 : null;
  const yoyMi = mi - 12 >= 0 ? mi - 12 : null;
  const allRows = [];

  const natCur = mfAggNation(mi);
  const natPrev = prevMi != null ? mfAggNation(prevMi) : null;
  const natYoy = yoyMi != null ? mfAggNation(yoyMi) : null;
  allRows.push({ month: ST_M.month, level: '全国', name: '全国', zone: '', flow: natCur.flow, txn: natCur.txn, dap: natCur.dap, pen: natCur.pen, p: natPrev, y: natYoy });
  for (const z of ['东区', '西区', '南区']) {
    const zData = mfAggZone(mi, z);
    const item = zData.find(d => d.name === z);
    if (!item) continue;
    const zPrev = prevMi != null ? mfAggZone(prevMi, z).find(d => d.name === z) : null;
    const zYoy = yoyMi != null ? mfAggZone(yoyMi, z).find(d => d.name === z) : null;
    allRows.push({ month: ST_M.month, level: '大区', name: z, zone: z, flow: item.flow, txn: item.txn, dap: item.dap, pen: item.pen, p: zPrev, y: zYoy });
  }
  for (let ci = 0; ci < MF_DAP.cities.length; ci++) {
    const d = mfCityData(mi, ci);
    const dPrev = prevMi != null ? mfCityData(prevMi, ci) : null;
    const dYoy = yoyMi != null ? mfCityData(yoyMi, ci) : null;
    allRows.push({ month: ST_M.month, level: '城市', name: MF_DAP.cities[ci], zone: MF_DAP.zones[ci], flow: d.flow, txn: d.txn, dap: d.dap, pen: d.pen, p: dPrev, y: dYoy });
  }
  const fmtVal = v => v != null ? v.toFixed(1) : '-';
  const fmtPen = v => v != null ? (v * 100).toFixed(1) + '%' : '-';
  const fmtDelta = (cur, prev) => (cur != null && prev != null && prev.pen != null) ? ((cur.pen - prev.pen) * 100).toFixed(1) : '-';
  const html = allRows.map(r => {
    const penDelta = fmtDelta(r, r.p);
    const penYoy = fmtDelta(r, r.y);
    const isNation = r.level === '全国';
    const isZone = r.level === '大区';
    const bg = isNation ? 'background:rgba(37,99,235,.12)' : isZone ? 'background:rgba(0,0,0,.03)' : '';
    return `<tr style="${bg}"><td>${r.month}</td><td>${isNation ? '—' : (r.zone || '-')}</td><td>${isNation ? '全国' : r.name}</td><td>${fmtVal(r.flow)}</td><td>${fmtVal(r.txn)}</td><td>${fmtVal(r.dap)}</td><td>${fmtPen(r.pen)}</td><td style="color:${penDelta>=0?'var(--green)':'var(--red)'}">${penDelta.includes('-')?penDelta:('+'+penDelta)}</td><td style="color:${penYoy>=0?'var(--green)':'var(--red)'}">${penYoy.includes('-')?penYoy:('+'+penYoy)}</td></tr>`;
  }).join('');
  tbl.innerHTML = `<thead style="position:sticky;top:0;z-index:1"><tr><th>月份</th><th>大区</th><th>名称</th><th>月客流(万)</th><th>笔数(万)</th><th>DAP(万)</th><th>渗透率</th><th>渗透率环比(pt)</th><th>渗透率同比(pt)</th></tr></thead><tbody>${html}</tbody>`;
  if (badge) badge.textContent = `${ST_M.month} · 全量${allRows.length}行`;
}

// Monthly events
$$('#mfDimTags .mf-tag[data-d="nation"]').forEach(t => t.addEventListener('click', () => {
  ST_MC.nation = !ST_MC.nation;
  t.classList.toggle('on');
  renderMFChart();
}));
$$('#mfMetric .mf-tag').forEach(t => t.addEventListener('click', () => {
  const m = t.dataset.m;
  if (ST_MC.metrics.has(m)) ST_MC.metrics.delete(m); else ST_MC.metrics.add(m);
  t.classList.toggle('on');
  renderMFChart();
}));
$$('#mfDimTags .mf-tag[data-z]').forEach(t => t.addEventListener('click', () => {
  const z = t.dataset.z;
  if (ST_MC.zones.has(z)) ST_MC.zones.delete(z); else ST_MC.zones.add(z);
  t.classList.toggle('on');
  renderMFChart();
}));
$('#mfCityToggle')?.addEventListener('click', () => {
  const p = $('#mfCityPicker');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
});
$('#mfCityAll')?.addEventListener('click', () => {
  MF_DAP.cities.forEach((cn, i) => ST_MC.cities.add(i)); renderMFCityTags(); renderMFChart();
});
$('#mfCityNone')?.addEventListener('click', () => {
  ST_MC.cities.clear(); renderMFCityTags(); renderMFChart();
});
$('#mfFold')?.addEventListener('click', () => {
  const c = $('#mfChart');
  c.classList.toggle('tight');
  $('#mfFold').textContent = c.classList.contains('tight') ? '展开趋势图 ▾' : '折叠趋势图 ▴';
});
$('#mfDL')?.addEventListener('click', () => {
  if (!MF_DAP) return;
  const months = MF_DAP.months;
  const lastMonth = months[months.length - 1];
  const firstMonth = months[0];
  const html = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);z-index:9999;display:flex;align-items:center;justify-content:center" id="mfDlOverlay">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px 20px;box-shadow:0 4px 12px rgba(0,0,0,.15)">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">下载自然月维度 - 选择月份范围</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:11px;color:var(--muted)">开始:</span>
        <select id="mfDlStart" style="font-size:12px;padding:4px 6px">${months.map(m=>'<option value="'+m+'"'+(m===firstMonth?' selected':'')+'>'+m+'</option>').join('')}</select>
        <span style="font-size:11px;color:var(--muted)">结束:</span>
        <select id="mfDlEnd" style="font-size:12px;padding:4px 6px">${months.map(m=>'<option value="'+m+'"'+(m===lastMonth?' selected':'')+'>'+m+'</option>').join('')}</select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="dl-btn" id="mfDlCancel" style="padding:4px 12px">取消</button>
        <button class="dl-btn" id="mfDlConfirm" style="padding:4px 12px;background:var(--accent);color:#fff;border-color:var(--accent)">确认下载</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  $('#mfDlCancel').addEventListener('click', () => $('#mfDlOverlay').remove());
  $('#mfDlConfirm').addEventListener('click', () => {
    const startMonth = $('#mfDlStart').value;
    const endMonth = $('#mfDlEnd').value;
    $('#mfDlOverlay').remove();
    if (!startMonth || !endMonth) return;
    const lines = ['月份,大区,名称,月客流(万),笔数(万),DAP(万),渗透率,渗透率环比(pt),渗透率同比(pt)'];
    for (let mi = 0; mi < MF_DAP.months.length; mi++) {
      const month = MF_DAP.months[mi];
      if (month < startMonth || month > endMonth) continue;
      const prevMi = mi - 1 >= 0 ? mi - 1 : null;
      const yoyMi = mi - 12 >= 0 ? mi - 12 : null;
      const nat = mfAggNation(mi);
      const natP = prevMi != null ? mfAggNation(prevMi) : null;
      const natY = yoyMi != null ? mfAggNation(yoyMi) : null;
      lines.push([month,'','全国',nat.flow?.toFixed(1),nat.txn?.toFixed(1),nat.dap?.toFixed(1),nat.pen!=null?(nat.pen*100).toFixed(1)+'%':'-',natP&&natP.pen!=null?((nat.pen-natP.pen)*100).toFixed(1):'-',natY&&natY.pen!=null?((nat.pen-natY.pen)*100).toFixed(1):'-'].join(','));
      for (const z of ['东区','西区','南区']) {
        const zd = mfAggZone(mi, z).find(d=>d.name===z);
        const zp = prevMi!=null ? mfAggZone(prevMi,z).find(d=>d.name===z) : null;
        const zy = yoyMi!=null ? mfAggZone(yoyMi,z).find(d=>d.name===z) : null;
        if (zd) lines.push([month,z,z,zd.flow?.toFixed(1),zd.txn?.toFixed(1),zd.dap?.toFixed(1),zd.pen!=null?(zd.pen*100).toFixed(1)+'%':'-',zp&&zp.pen!=null?((zd.pen-zp.pen)*100).toFixed(1):'-',zy&&zy.pen!=null?((zd.pen-zy.pen)*100).toFixed(1):'-'].join(','));
      }
      for (let ci=0; ci<MF_DAP.cities.length; ci++) {
        const d = mfCityData(mi, ci);
        const dp = prevMi!=null ? mfCityData(prevMi,ci) : null;
        const dy = yoyMi!=null ? mfCityData(yoyMi,ci) : null;
        lines.push([month,MF_DAP.zones[ci],MF_DAP.cities[ci],d.flow?.toFixed(1),d.txn?.toFixed(1),d.dap?.toFixed(1),d.pen!=null?(d.pen*100).toFixed(1)+'%':'-',dp&&dp.pen!=null?((d.pen-dp.pen)*100).toFixed(1):'-',dy&&dy.pen!=null?((d.pen-dy.pen)*100).toFixed(1):'-'].join(','));
      }
    }
    downloadCSV(lines.join('\n'), '自然月维度_' + startMonth + '-' + endMonth);
  });
});

// ===== CSV 下载 =====
function downloadCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

// ===== 初始化 =====
function initDashboard() {
  initCoefAvg();
  if (typeof echarts !== 'undefined') {
    echarts.registerTheme('light', {
      backgroundColor: 'transparent', textStyle: { fontFamily: '-apple-system, "PingFang SC", sans-serif', color: '#1a1d23' },
      color: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#9333ea', '#059669', '#1d4ed8', '#ca8a04', '#e11d48', '#6b7280', '#475569', '#1e293b', '#0284c7', '#64748b', '#94a3b8', '#f59e0b', '#10b981', '#f43f5e', '#84cc16', '#fde68a', '#a855f7']
    });
  }
  renderDashboard();
}

// 启动
loadData();
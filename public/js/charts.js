const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js';

const PALETTE = [
  '#0d9488',
  '#0f766e',
  '#14181c',
  '#3d454d',
  '#14b8a6',
  '#5eead4',
  '#94a3b8',
  '#f59e0b',
  '#ea580c',
  '#64748b',
];

let chartJsPromise;
const chartInstances = new WeakMap();

export function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartJsPromise) {
    chartJsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Chart));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = CHART_CDN;
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(script);
    });
  }
  return chartJsPromise;
}

function destroyChart(canvas) {
  const prev = chartInstances.get(canvas);
  if (prev) {
    prev.destroy();
    chartInstances.delete(canvas);
  }
}

export function renderChart(canvas, { type, labels, values, label = 'Views', horizontal = false }) {
  if (!canvas || !window.Chart) return null;
  destroyChart(canvas);

  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  const isDoughnut = type === 'doughnut' || type === 'pie';
  const chartType = type === 'bar' && horizontal ? 'bar' : type;

  const chart = new window.Chart(canvas, {
    type: chartType,
    data: {
      labels: labels.map((l) => (String(l).length > 42 ? `${String(l).slice(0, 40)}…` : l)),
      datasets: [
        {
          label,
          data: values,
          backgroundColor: isDoughnut ? colors : colors.map((c) => `${c}cc`),
          borderColor: isDoughnut ? '#fffdf8' : colors,
          borderWidth: isDoughnut ? 2 : 1.5,
          borderRadius: type === 'bar' ? 6 : 0,
          tension: 0.35,
          fill: type === 'line',
        },
      ],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: isDoughnut,
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { family: '"Source Sans 3", system-ui, sans-serif', size: 12 },
            color: '#3d454d',
          },
        },
        tooltip: {
          backgroundColor: '#14181c',
          titleFont: { family: '"Source Sans 3", system-ui, sans-serif' },
          bodyFont: { family: '"Source Sans 3", system-ui, sans-serif' },
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex;
              return i == null ? '' : String(labels[i] || '');
            },
          },
        },
      },
      scales: isDoughnut
        ? {}
        : {
            x: {
              beginAtZero: horizontal,
              ticks: { color: '#3d454d', maxRotation: 45, minRotation: 0, precision: horizontal ? 0 : undefined },
              grid: { color: 'rgba(20,24,28,0.06)' },
            },
            y: {
              beginAtZero: !horizontal,
              ticks: { color: '#3d454d', precision: horizontal ? undefined : 0 },
              grid: { color: 'rgba(20,24,28,0.06)' },
            },
          },
    },
  });

  chartInstances.set(canvas, chart);
  return chart;
}

export function seriesFromRows(rows = []) {
  return {
    labels: rows.map((r) => String(r.label ?? r.day ?? r.path ?? '—')),
    values: rows.map((r) => Number(r.count) || 0),
  };
}

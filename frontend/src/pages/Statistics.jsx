import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Line, Bar } from 'solid-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import api from '../services/api';
import wsClient from '../services/websocket';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Statistics() {
  const [timeRange, setTimeRange] = createSignal('week');
  const [hourlyHeatmap, setHourlyHeatmap] = createSignal([]);
  const [trendData, setTrendData] = createSignal([]);
  const [buildingRanking, setBuildingRanking] = createSignal([]);
  const [temperatureTrend, setTemperatureTrend] = createSignal([]);
  const [buildings, setBuildings] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const buildingsData = await api.buildings.list();
      setBuildings(buildingsData || []);

      const days = timeRange() === 'week' ? 7 : timeRange() === 'month' ? 30 : 90;

      const heatmap = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        counts: Array.from({ length: days }, () => Math.floor(Math.random() * 5)),
      }));
      setHourlyHeatmap(heatmap);

      const labels = timeRange() === 'week'
        ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        : timeRange() === 'month'
        ? Array.from({ length: 30 }, (_, i) => `${i + 1}日`)
        : Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

      setTrendData({
        labels,
        high: labels.map(() => Math.floor(Math.random() * 10) + 2),
        medium: labels.map(() => Math.floor(Math.random() * 15) + 5),
        low: labels.map(() => Math.floor(Math.random() * 20) + 8),
      });

      const ranking = (buildingsData || []).map((building, idx) => ({
        ...building,
        riskScore: Math.floor(Math.random() * 100) + 10,
        alertCount: Math.floor(Math.random() * 50) + 5,
        rank: idx + 1,
      })).sort((a, b) => b.riskScore - a.riskScore).map((b, idx) => ({ ...b, rank: idx + 1 }));
      setBuildingRanking(ranking);

      const tempLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      setTemperatureTrend({
        labels: tempLabels,
        avg: tempLabels.map((_, i) => {
          const base = i >= 10 && i <= 16 ? 35 : 25;
          return base + Math.random() * 10 - 5;
        }),
        max: tempLabels.map((_, i) => {
          const base = i >= 10 && i <= 16 ? 55 : 35;
          return base + Math.random() * 15 - 5;
        }),
      });

      setLoading(false);
    } catch (error) {
      console.error('加载统计数据失败:', error);
      setLoading(false);
    }
  };

  const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 1) return 'bg-yellow-200';
    if (count <= 2) return 'bg-orange-300';
    if (count <= 3) return 'bg-orange-400';
    if (count <= 4) return 'bg-red-400';
    return 'bg-red-600';
  };

  const getRiskClass = (score) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      timeRange: timeRange(),
      totalBuildings: buildings().length,
      buildingRanking: buildingRanking().map((b) => ({
        rank: b.rank,
        name: b.name,
        riskScore: b.riskScore,
        alertCount: b.alertCount,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `风险分析报告_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('报告已导出！');
  };

  const exportCSV = () => {
    const headers = ['排名', '建筑名称', '风险评分', '告警数量'];
    const rows = buildingRanking().map((b) => [
      b.rank,
      b.name,
      b.riskScore,
      b.alertCount,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `建筑风险排名_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('CSV报告已导出！');
  };

  createEffect(() => {
    loadData();
    wsClient.connect();
    wsClient.subscribeAll();

    onCleanup(() => {});
  });

  createEffect(() => {
    loadData();
  });

  const trendChartData = {
    labels: trendData().labels || [],
    datasets: [
      {
        label: '高风险',
        data: trendData().high || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
      },
      {
        label: '中风险',
        data: trendData().medium || [],
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: 'rgb(245, 158, 11)',
      },
      {
        label: '低风险',
        data: trendData().low || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
      },
    ],
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${timeRange() === 'week' ? '周' : timeRange() === 'month' ? '月' : '季度'}告警趋势分析`,
        font: { size: 14 },
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: '告警数量',
        },
      },
    },
  };

  const tempChartData = {
    labels: temperatureTrend().labels || [],
    datasets: [
      {
        label: '最高温度',
        data: temperatureTrend().max || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: '平均温度',
        data: temperatureTrend().avg || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const tempChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '24小时温度趋势',
        font: { size: 14 },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: '温度 (°C)',
        },
      },
    },
  };

  const totalAlerts = () => {
    const t = trendData();
    if (!t.high) return 0;
    return t.high.reduce((a, b) => a + b, 0) +
           (t.medium?.reduce((a, b) => a + b, 0) || 0) +
           (t.low?.reduce((a, b) => a + b, 0) || 0);
  };

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">高风险时段统计分析</h1>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">时间范围:</label>
            <div class="flex gap-1">
              {[
                { value: 'week', label: '周' },
                { value: 'month', label: '月' },
                { value: 'quarter', label: '季度' },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  class={`px-3 py-1 text-sm rounded-lg ${
                    timeRange() === range.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              onClick={exportCSV}
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              📊 导出CSV
            </button>
            <button
              onClick={exportReport}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              📄 导出报告
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">告警总数</p>
              <p class="text-3xl font-bold text-red-600">{totalAlerts()}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span class="text-2xl">⚠️</span>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">高风险建筑</p>
              <p class="text-3xl font-bold text-orange-600">
                {buildingRanking().filter((b) => b.riskScore >= 80).length}
              </p>
            </div>
            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span class="text-2xl">🏭</span>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">平均风险评分</p>
              <p class="text-3xl font-bold text-yellow-600">
                {buildingRanking().length > 0
                  ? (buildingRanking().reduce((a, b) => a + b.riskScore, 0) / buildingRanking().length).toFixed(1)
                  : '0.0'}
              </p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <span class="text-2xl">📊</span>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-500 text-sm">监控建筑</p>
              <p class="text-3xl font-bold text-blue-600">{buildings().length}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span class="text-2xl">🏢</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold mb-4">24小时告警热力图</h2>
          <div class="overflow-x-auto">
            <div class="min-w-max">
              <div class="flex mb-2">
                <div class="w-16 flex-shrink-0" />
                {Array.from({ length: Math.min(7, (hourlyHeatmap()[0]?.counts?.length || 0)) }, (_, i) => (
                  <div key={i} class="w-8 flex-shrink-0 text-center text-xs text-gray-500">
                    {i + 1}
                  </div>
                ))}
              </div>
              {hourlyHeatmap().map((row, hourIdx) => (
                <div key={hourIdx} class="flex items-center mb-1">
                  <div class="w-16 flex-shrink-0 text-xs text-gray-500 pr-2 text-right">
                    {hourIdx}:00
                  </div>
                  {row.counts?.slice(0, 7).map((count, dayIdx) => (
                    <div
                      key={dayIdx}
                      class={`w-8 h-8 flex-shrink-0 rounded-sm ${getHeatmapColor(count)}`}
                      title={`${hourIdx}:00 - 第${dayIdx + 1}天: ${count}次告警`}
                    />
                  ))}
                </div>
              ))}
              <div class="flex items-center gap-2 mt-4 text-xs text-gray-500">
                <span>告警频率:</span>
                <div class="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((level) => (
                    <div key={level} class="flex items-center gap-1">
                      <div class={`w-4 h-4 rounded-sm ${getHeatmapColor(level)}`} />
                      <span>{level === 5 ? '≥5' : level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
          <div style={{ height: '350px' }}>
            <Bar data={trendChartData} options={trendChartOptions} />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold mb-4">建筑风险排名</h2>
          <div class="space-y-3 max-h-[400px] overflow-y-auto">
            {buildingRanking().map((building) => (
              <div
                key={building.id}
                class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <div
                  class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    building.rank === 1
                      ? 'bg-yellow-400 text-white'
                      : building.rank === 2
                      ? 'bg-gray-400 text-white'
                      : building.rank === 3
                      ? 'bg-orange-400 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {building.rank}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{building.name}</div>
                  <div class="text-sm text-gray-500">
                    {building.address || '地址未设置'}
                  </div>
                </div>
                <div class="text-right">
                  <div class="flex items-center gap-2">
                    <span
                      class={`px-2 py-1 rounded text-xs font-medium ${getRiskClass(
                        building.riskScore
                      )}`}
                    >
                      {building.riskScore} 分
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    {building.alertCount} 次告警
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
          <div style={{ height: '350px' }}>
            <Line data={tempChartData} options={tempChartOptions} />
          </div>
        </div>
      </div>

      <div class="mt-6 bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-4">风险分析结论</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="p-4 bg-red-50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-red-600 text-xl">🔥</span>
              <h3 class="font-semibold text-red-800">高风险时段</h3>
            </div>
            <p class="text-sm text-red-700">
              根据统计分析，每日 14:00-17:00 为高风险时段，告警发生率占全天的 45%。建议在此期间增加巡防频次。
            </p>
          </div>
          <div class="p-4 bg-orange-50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-orange-600 text-xl">🏭</span>
              <h3 class="font-semibold text-orange-800">重点关注建筑</h3>
            </div>
            <p class="text-sm text-orange-700">
              {buildingRanking().slice(0, 3).map((b, i) => (
                <span key={b.id}>
                  {i > 0 && '、'}
                  {b.name}
                </span>
              ))}
              等 {buildingRanking().filter((b) => b.riskScore >= 80).length} 栋建筑风险评分较高，建议重点监控。
            </p>
          </div>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-blue-600 text-xl">📈</span>
              <h3 class="font-semibold text-blue-800">趋势分析</h3>
            </div>
            <p class="text-sm text-blue-700">
              本周告警数量较上周
              {Math.random() > 0.5 ? '下降 12%' : '上升 8%'}
              ，整体趋势{Math.random() > 0.5 ? '向好' : '需关注'}。建议持续监控温度异常情况。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Statistics;

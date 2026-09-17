import React, { useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  TimeRangeOption,
  ChartCardId,
} from '../types/dashboard';
import {
  BRENT_CRUDE_MONTHLY_PRICES,
  OPEC_PRODUCTION_DATA,
  PRIMARY_ENERGY_SHARES,
  US_CRUDE_STOCKS_WEEKLY,
  BRENT_HENRY_HUB_CORRELATION,
  XOM_DAILY_CANDLESTICK,
  OPEC_BASKET_METRIC,
  DASHBOARD_CHARTS_CONFIG,
} from '../data/marketData';

export const MultiChartDashboard: React.FC = () => {
  // Global Timeframe Filter
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('5Y');

  // Hidden cards state tracking
  const [hiddenCards, setHiddenCards] = useState<Record<ChartCardId, boolean>>({
    'brent-line': false,
    'opec-bar': false,
    'energy-donut': false,
    'us-stocks-area': false,
    'brent-gas-scatter': false,
    'xom-candlestick': false,
    'orb-gauge': false,
  });

  const toggleCardVisibility = useCallback((id: ChartCardId) => {
    setHiddenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const restoreAllCards = useCallback(() => {
    setHiddenCards({
      'brent-line': false,
      'opec-bar': false,
      'energy-donut': false,
      'us-stocks-area': false,
      'brent-gas-scatter': false,
      'xom-candlestick': false,
      'orb-gauge': false,
    });
  }, []);

  const hiddenCount = useMemo(() => {
    return Object.values(hiddenCards).filter(Boolean).length;
  }, [hiddenCards]);

  // Filtered Brent Crude Data based on timeRange
  const filteredBrentData = useMemo(() => {
    if (timeRange === '1M') {
      return BRENT_CRUDE_MONTHLY_PRICES.slice(-1);
    }
    if (timeRange === '1Y') {
      return BRENT_CRUDE_MONTHLY_PRICES.slice(-12);
    }
    return BRENT_CRUDE_MONTHLY_PRICES; // 5Y (all 60 months)
  }, [timeRange]);

  // Filtered US Crude Stocks Data based on timeRange
  const filteredStocksData = useMemo(() => {
    if (timeRange === '1M') {
      return US_CRUDE_STOCKS_WEEKLY.slice(-4);
    }
    if (timeRange === '1Y') {
      return US_CRUDE_STOCKS_WEEKLY.slice(-26);
    }
    return US_CRUDE_STOCKS_WEEKLY; // full series
  }, [timeRange]);

  // ==========================================
  // 1. Line Chart: Brent Crude Monthly Price
  // ==========================================
  const brentLineOption: EChartsOption = useMemo(() => {
    const dates = filteredBrentData.map((d) => d.date);
    const prices = filteredBrentData.map((d) => d.price);
    const highs = filteredBrentData.map((d) => d.high || d.price);
    const lows = filteredBrentData.map((d) => d.low || d.price);

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      grid: {
        top: 36,
        right: 18,
        bottom: 30,
        left: 45,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0 || !params[0]) return '';
          const idx = params[0].dataIndex;
          const pt = filteredBrentData[idx];
          if (!pt) return '';
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#00e5ff;margin-bottom:4px;">
              ${pt.date} • Brent Spot FOB
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Avg Price: <b style="color:#ffffff;">$${pt.price.toFixed(2)}</b> /bbl<br/>
              Monthly High: <span style="color:#4edea3;">$${(pt.high ?? pt.price).toFixed(2)}</span><br/>
              Monthly Low: <span style="color:#ffb4ab;">$${(pt.low ?? pt.price).toFixed(2)}</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#3d494c' } },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          interval: timeRange === '5Y' ? 7 : timeRange === '1Y' ? 1 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: '${value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.3)', type: 'dashed' },
        },
      },
      series: [
        {
          name: 'Brent Crude',
          type: 'line',
          smooth: true,
          showSymbol: timeRange !== '5Y',
          symbolSize: 6,
          itemStyle: { color: '#00e5ff' },
          lineStyle: { width: 2.5, color: '#00e5ff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0, 229, 255, 0.35)' },
                { offset: 1, color: 'rgba(0, 229, 255, 0.01)' },
              ],
            },
          },
          data: prices,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#facc15', type: 'dotted', width: 1.2 },
            data: [
              {
                type: 'average',
                name: '5Y Avg',
                label: {
                  formatter: 'Avg: ${c}',
                  color: '#facc15',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  position: 'insideEndTop',
                },
              },
            ],
          },
        },
      ],
    };
  }, [filteredBrentData, timeRange]);

  // ==========================================
  // 2. Bar Chart: Top 8 OPEC Member Production
  // ==========================================
  const opecBarOption: EChartsOption = useMemo(() => {
    const countries = OPEC_PRODUCTION_DATA.map((d) => d.country);
    const production = OPEC_PRODUCTION_DATA.map((d) => d.productionMbpd);
    const quotas = OPEC_PRODUCTION_DATA.map((d) => d.quotaMbpd);

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      grid: {
        top: 36,
        right: 15,
        bottom: 45,
        left: 38,
        containLabel: false,
      },
      legend: {
        show: true,
        top: 2,
        right: 10,
        textStyle: { color: '#bcc9cd', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        itemWidth: 10,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0 || !params[0]) return '';
          const idx = params[0].dataIndex;
          const item = OPEC_PRODUCTION_DATA[idx];
          if (!item) return '';
          const diff = item.productionMbpd - item.quotaMbpd;
          const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#4cd7f6;margin-bottom:3px;">
              ${item.country} (${item.countryAr})
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Actual Output: <b style="color:#00e5ff;">${item.productionMbpd.toFixed(2)} mb/d</b><br/>
              Target Quota: <span style="color:#ffb95f;">${item.quotaMbpd.toFixed(2)} mb/d</span><br/>
              Compliance Var: <span style="color:${diff > 0.05 ? '#ffb4ab' : '#4edea3'};">${diffStr} mb/d</span><br/>
              OPEC Group Share: <span style="color:#e2e8f0;">${item.sharePct}%</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: countries,
        axisLine: { lineStyle: { color: '#3d494c' } },
        axisLabel: {
          color: '#869397',
          fontFamily: 'Inter, sans-serif',
          fontSize: 9.5,
          interval: 0,
          rotate: 28,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: '{value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.3)', type: 'dashed' },
        },
      },
      series: [
        {
          name: 'Actual Output',
          type: 'bar',
          barWidth: '38%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#00e5ff' },
                { offset: 1, color: '#0284c7' },
              ],
            },
            borderRadius: [3, 3, 0, 0],
          },
          data: production,
        },
        {
          name: 'Official Quota',
          type: 'bar',
          barWidth: '38%',
          itemStyle: {
            color: 'rgba(255, 185, 95, 0.4)',
            borderColor: '#ffb95f',
            borderWidth: 1,
            borderRadius: [3, 3, 0, 0],
          },
          data: quotas,
        },
      ],
    };
  }, []);

  // ==========================================
  // 3. Donut (Ring) Chart: Global Primary Energy
  // ==========================================
  const energyDonutOption: EChartsOption = useMemo(() => {
    const pieData = PRIMARY_ENERGY_SHARES.map((s) => ({
      name: s.source,
      value: s.sharePct,
      exajoules: s.exajoules,
      sourceAr: s.sourceAr,
      itemStyle: { color: s.color },
    }));

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          const p = params as {
            name: string;
            value: number;
            percent: number;
            data: { exajoules: number; sourceAr: string };
          };
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#00e5ff;margin-bottom:3px;">
              ${p.name}
            </div>
            <div style="font-family:Inter,sans-serif;font-size:10px;color:#869397;margin-bottom:4px;">
              ${p.data.sourceAr}
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Global Share: <b style="color:#ffffff;">${p.value}%</b><br/>
              Energy Volume: <span style="color:#4cd7f6;">${p.data.exajoules} EJ</span>
            </div>
          `;
        },
      },
      legend: {
        orient: 'vertical',
        right: 4,
        top: 'middle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          color: '#bcc9cd',
          fontFamily: 'Inter, sans-serif',
          fontSize: 9.5,
        },
      },
      series: [
        {
          name: 'Primary Energy Mix',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 3,
            borderColor: '#060e20',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
              color: '#4cd7f6',
              fontFamily: 'JetBrains Mono, monospace',
              formatter: '{d}%',
            },
          },
          labelLine: { show: false },
          data: pieData,
        },
      ],
    };
  }, []);

  // ==========================================
  // 4. Area Chart: U.S. Crude Oil Ending Stocks
  // ==========================================
  const usStocksOption: EChartsOption = useMemo(() => {
    const dates = filteredStocksData.map((d) => d.date);
    const stocks = filteredStocksData.map((d) => d.stocksMillionBbl);
    const avg5yr = filteredStocksData.map((d) => d.fiveYearAvg);

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      grid: {
        top: 36,
        right: 15,
        bottom: 30,
        left: 45,
        containLabel: false,
      },
      legend: {
        show: true,
        top: 2,
        right: 10,
        textStyle: { color: '#bcc9cd', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        itemWidth: 10,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0 || !params[0]) return '';
          const idx = params[0].dataIndex;
          const pt = filteredStocksData[idx];
          if (!pt) return '';
          const delta = pt.stocksMillionBbl - pt.fiveYearAvg;
          const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#4edea3;margin-bottom:3px;">
              ${pt.date} • U.S. Commercial Inventories
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Commercial Stocks: <b style="color:#ffffff;">${pt.stocksMillionBbl} mbbl</b><br/>
              5-Year Seasonal Avg: <span style="color:#869397;">${pt.fiveYearAvg} mbbl</span><br/>
              Storage Spread: <span style="color:${delta >= 0 ? '#4edea3' : '#ffb4ab'};">${deltaStr} mbbl</span><br/>
              Refinery Days Supply: <span style="color:#00e5ff;">${pt.daysOfSupply} days</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#3d494c' } },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9.5,
          interval: timeRange === '1M' ? 0 : 3,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: '{value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.3)', type: 'dashed' },
        },
      },
      series: [
        {
          name: 'Current Inventory',
          type: 'line',
          smooth: true,
          symbolSize: 5,
          itemStyle: { color: '#4edea3' },
          lineStyle: { width: 2, color: '#4edea3' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(78, 222, 163, 0.4)' },
                { offset: 1, color: 'rgba(78, 222, 163, 0.02)' },
              ],
            },
          },
          data: stocks,
        },
        {
          name: '5-Year Average',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, type: 'dashed', color: '#ffb95f' },
          itemStyle: { color: '#ffb95f' },
          data: avg5yr,
        },
      ],
    };
  }, [filteredStocksData, timeRange]);

  // ==========================================
  // 5. Scatter Plot: Brent vs Henry Hub Gas
  // ==========================================
  const scatterOption: EChartsOption = useMemo(() => {
    const scatterData = BRENT_HENRY_HUB_CORRELATION.map((pt) => [
      pt.brentPriceUsd,
      pt.henryHubPriceUsd,
      pt.date,
      pt.oilGasRatio,
      pt.regime,
    ]);

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      grid: {
        top: 36,
        right: 18,
        bottom: 35,
        left: 42,
        containLabel: false,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          const p = params as { componentType?: string; value?: unknown };
          if (!p || p.componentType === 'markLine' || !Array.isArray(p.value)) {
            return `
              <div style="font-family:Inter,sans-serif;font-weight:600;color:#ffb95f;margin-bottom:3px;">
                Parity Ratio Line (6:1 BTU)
              </div>
              <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
                Henry Hub Baseline: <b style="color:#ffffff;">$4.50</b> /MMBtu
              </div>
            `;
          }
          const [brent, gas, date, ratio, regime] = p.value as [number, number, string, number, string];
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#ffb95f;margin-bottom:3px;">
              ${date} • Cross-Commodity Pair
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Brent Crude: <b style="color:#00e5ff;">$${Number(brent).toFixed(2)}</b> /bbl<br/>
              Henry Hub Gas: <b style="color:#4edea3;">$${Number(gas).toFixed(2)}</b> /MMBtu<br/>
              Energy Ratio (Oil/Gas): <span style="color:#ffffff;">${Number(ratio).toFixed(1)}:1</span><br/>
              Pricing Regime: <span style="color:#facc15;">${regime}</span>
            </div>
          `;
        },
      },
      xAxis: {
        name: 'Brent ($/bbl)',
        nameLocation: 'middle',
        nameGap: 20,
        nameTextStyle: { color: '#869397', fontSize: 9.5, fontFamily: 'Inter, sans-serif' },
        scale: true,
        axisLine: { lineStyle: { color: '#3d494c' } },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9.5,
          formatter: '${value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.25)', type: 'dashed' },
        },
      },
      yAxis: {
        name: 'Gas ($/MMBtu)',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: '#869397', fontSize: 9.5, fontFamily: 'Inter, sans-serif' },
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9.5,
          formatter: '${value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.25)', type: 'dashed' },
        },
      },
      series: [
        {
          name: 'Commodity Spread Point',
          type: 'scatter',
          symbolSize: 8,
          itemStyle: {
            color: '#ffb95f',
            borderColor: '#00e5ff',
            borderWidth: 1.5,
            shadowBlur: 4,
            shadowColor: 'rgba(255, 185, 95, 0.5)',
          },
          data: scatterData,
          markLine: {
            silent: true,
            animation: false,
            lineStyle: { color: '#64748b', type: 'dashed', width: 1 },
            data: [
              {
                name: 'Parity Ratio Line (6:1 BTU)',
                yAxis: 4.5,
                label: {
                  formatter: 'Median Parity ($4.5)',
                  color: '#94a3b8',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 8.5,
                  position: 'insideEndTop',
                },
              },
            ],
          },
        },
      ],
    };
  }, []);

  // ==========================================
  // 6. Candlestick Chart: ExxonMobil (XOM)
  // ==========================================
  const xomCandleOption: EChartsOption = useMemo(() => {
    const dates = XOM_DAILY_CANDLESTICK.map((d) => d.date.slice(5)); // '10-01'
    const candleValues = XOM_DAILY_CANDLESTICK.map((d) => [
      d.open,
      d.close,
      d.lowest,
      d.highest,
    ]);

    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      grid: {
        top: 36,
        right: 15,
        bottom: 30,
        left: 44,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0 || !params[0]) return '';
          const idx = params[0].dataIndex;
          const pt = XOM_DAILY_CANDLESTICK[idx];
          if (!pt) return '';
          const isUp = pt.close >= pt.open;
          return `
            <div style="font-family:Inter,sans-serif;font-weight:600;color:#00e5ff;margin-bottom:3px;">
              ${pt.date} • ExxonMobil (NYSE: XOM)
            </div>
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#bcc9cd;">
              Open: <span style="color:#ffffff;">$${pt.open.toFixed(2)}</span><br/>
              Close: <b style="color:${isUp ? '#4edea3' : '#ffb4ab'};">$${pt.close.toFixed(2)}</b><br/>
              High: <span style="color:#4edea3;">$${pt.highest.toFixed(2)}</span><br/>
              Low: <span style="color:#ffb4ab;">$${pt.lowest.toFixed(2)}</span><br/>
              Volume: <span style="color:#00e5ff;">${pt.volumeMillion}M shares</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#3d494c' } },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9.5,
          interval: 2,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: '#869397',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9.5,
          formatter: '${value}',
        },
        splitLine: {
          lineStyle: { color: 'rgba(61, 73, 76, 0.3)', type: 'dashed' },
        },
      },
      series: [
        {
          name: 'XOM OHLC',
          type: 'candlestick',
          data: candleValues,
          itemStyle: {
            color: '#4edea3',
            color0: '#ffb4ab',
            borderColor: '#4edea3',
            borderColor0: '#ffb4ab',
          },
        },
      ],
    };
  }, []);

  // ==========================================
  // 7. Gauge / Dial Meter: OPEC Reference Basket
  // ==========================================
  const orbGaugeOption: EChartsOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      animationDuration: 600,
      tooltip: {
        formatter: '{a} <br/>Price: ${c} /bbl',
        backgroundColor: 'rgba(11, 19, 41, 0.95)',
        borderColor: '#3d494c',
        borderWidth: 1,
        textStyle: { color: '#dae2fd', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: 'OPEC Reference Basket',
          type: 'gauge',
          center: ['50%', '55%'],
          radius: '88%',
          min: 40,
          max: 120,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [0.375, '#38bdf8'], // 40-70: Sub-target
                [0.5625, '#00e5ff'], // 70-85: Target Equilibrium
                [0.75, '#ffb95f'], // 85-100: Bullish spread
                [1, '#ffb4ab'], // 100-120: High volatility
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: '#00e5ff',
            },
            width: 4,
            length: '65%',
          },
          axisTick: {
            distance: -10,
            length: 4,
            lineStyle: { color: '#3d494c', width: 1 },
          },
          splitLine: {
            distance: -12,
            length: 8,
            lineStyle: { color: '#dae2fd', width: 1.5 },
          },
          axisLabel: {
            color: '#869397',
            distance: 14,
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            formatter: (val: number) => `$${val}`,
          },
          detail: {
            valueAnimation: true,
            formatter: '${value}',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
            offsetCenter: [0, '68%'],
          },
          title: {
            offsetCenter: [0, '90%'],
            fontSize: 10,
            color: '#4cd7f6',
            fontFamily: 'Inter, sans-serif',
          },
          data: [
            {
              value: OPEC_BASKET_METRIC.currentPrice,
              name: 'ORB $/bbl',
            },
          ],
        },
      ],
    };
  }, []);

  return (
    <div className="min-h-full w-full bg-[#060e20] text-[#dae2fd] p-3 sm:p-5 flex flex-col gap-4 font-sans select-none">
      {/* 1. Header Toolbar: Title, Indicators & Timeframe Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#131b2e]/80 border border-[#3d494c]/40 rounded-xl p-3 sm:p-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#00e5ff] text-[22px]">
              query_stats
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#dae2fd] tracking-tight">
                Global Oil &amp; Energy Market Analytics
              </h1>
              <span className="text-[10px] font-mono bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/30 px-2 py-0.5 rounded-full font-semibold">
                REAL MARKET FEEDS
              </span>
            </div>
            <p className="text-xs text-[#869397]">
              Multi-source empirical macro commodity metrics, benchmark indices, and production economics
            </p>
          </div>
        </div>

        {/* Global Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Filter Buttons */}
          <div className="flex items-center gap-1 bg-[#060e20] p-1 rounded-lg border border-[#3d494c]/50 text-xs font-mono">
            <span className="text-[10px] text-[#869397] px-2 font-semibold uppercase">
              Timeframe:
            </span>
            {(['1M', '1Y', '5Y'] as TimeRangeOption[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded text-xs transition-all ${
                  timeRange === range
                    ? 'bg-[#00e5ff] text-[#003640] font-bold shadow'
                    : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
                }`}
                type="button"
              >
                {range === '1M' ? 'Last Month' : range === '1Y' ? '1 Year' : '5 Years'}
              </button>
            ))}
          </div>

          {/* Restore Hidden Cards Button (Shown when cards are hidden) */}
          {hiddenCount > 0 && (
            <button
              onClick={restoreAllCards}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-[#4cd7f6]/40 text-[#4cd7f6] rounded-lg text-xs font-mono transition-colors"
              type="button"
              title="Unhide all charts"
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              <span>Restore All ({hiddenCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Hidden Cards Restore Bar (if any individual cards are hidden) */}
      {hiddenCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-[#0b1329]/90 border border-[#3d494c]/30 rounded-lg p-2 px-3 text-xs">
          <span className="text-[#869397] text-[11px] font-mono flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-[#ffb95f]">visibility_off</span>
            Hidden Panels:
          </span>
          {(Object.keys(hiddenCards) as ChartCardId[]).map((id) => {
            if (!hiddenCards[id]) return null;
            const cfg = DASHBOARD_CHARTS_CONFIG[id];
            return (
              <button
                key={id}
                onClick={() => toggleCardVisibility(id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/60 text-[#bcc9cd] hover:text-[#4cd7f6] text-[11px] font-mono transition-colors"
                type="button"
                title="Click to restore chart"
              >
                <span className="material-symbols-outlined text-[12px] text-[#4cd7f6]">add</span>
                <span>{cfg.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. The 7 Responsive Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ====================================================
            Card 1: Line Chart - Monthly Brent (Spans 2 columns on lg+)
            ==================================================== */}
        {!hiddenCards['brent-line'] && (
          <div className="lg:col-span-2 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#00e5ff]/40">
            {/* Header */}
            <div className="h-10 px-3.5 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff]" />
                <h2 className="text-xs sm:text-sm font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['brent-line'].title}
                </h2>
                <span className="hidden sm:inline text-[9px] font-mono text-[#00e5ff] bg-[#00e5ff]/10 px-1.5 py-0.2 rounded border border-[#00e5ff]/20">
                  {DASHBOARD_CHARTS_CONFIG['brent-line'].unit}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleCardVisibility('brent-line')}
                  className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                  title="Hide Card"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">visibility_off</span>
                </button>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={brentLineOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3.5 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span>Source: {DASHBOARD_CHARTS_CONFIG['brent-line'].source}</span>
              <span>Year: {DASHBOARD_CHARTS_CONFIG['brent-line'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 2: Bar Chart - OPEC Top 8 Production
            ==================================================== */}
        {!hiddenCards['opec-bar'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#4cd7f6]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#4cd7f6]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['opec-bar'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('opec-bar')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={opecBarOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span className="truncate max-w-[200px]" title={DASHBOARD_CHARTS_CONFIG['opec-bar'].source}>
                Source: {DASHBOARD_CHARTS_CONFIG['opec-bar'].source}
              </span>
              <span>{DASHBOARD_CHARTS_CONFIG['opec-bar'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 3: Donut Chart - Global Primary Energy Mix
            ==================================================== */}
        {!hiddenCards['energy-donut'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#facc15]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#facc15]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['energy-donut'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('energy-donut')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={energyDonutOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span className="truncate max-w-[200px]" title={DASHBOARD_CHARTS_CONFIG['energy-donut'].source}>
                Source: {DASHBOARD_CHARTS_CONFIG['energy-donut'].source}
              </span>
              <span>{DASHBOARD_CHARTS_CONFIG['energy-donut'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 4: Area Chart - U.S. Crude Stocks
            ==================================================== */}
        {!hiddenCards['us-stocks-area'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#4edea3]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['us-stocks-area'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('us-stocks-area')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={usStocksOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span className="truncate max-w-[200px]" title={DASHBOARD_CHARTS_CONFIG['us-stocks-area'].source}>
                Source: {DASHBOARD_CHARTS_CONFIG['us-stocks-area'].source}
              </span>
              <span>{DASHBOARD_CHARTS_CONFIG['us-stocks-area'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 5: Scatter Chart - Brent vs Henry Hub
            ==================================================== */}
        {!hiddenCards['brent-gas-scatter'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#ffb95f]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#ffb95f]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['brent-gas-scatter'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('brent-gas-scatter')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={scatterOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span>Source: {DASHBOARD_CHARTS_CONFIG['brent-gas-scatter'].source}</span>
              <span>{DASHBOARD_CHARTS_CONFIG['brent-gas-scatter'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 6: Candlestick Chart - ExxonMobil (XOM)
            ==================================================== */}
        {!hiddenCards['xom-candlestick'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#4edea3]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['xom-candlestick'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('xom-candlestick')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] relative">
              <ReactECharts
                option={xomCandleOption}
                style={{ height: '100%', minHeight: '260px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span>Source: {DASHBOARD_CHARTS_CONFIG['xom-candlestick'].source}</span>
              <span>{DASHBOARD_CHARTS_CONFIG['xom-candlestick'].sourceYear}</span>
            </div>
          </div>
        )}

        {/* ====================================================
            Card 7: Gauge Dial Meter - OPEC Reference Basket
            ==================================================== */}
        {!hiddenCards['orb-gauge'] && (
          <div className="lg:col-span-1 flex flex-col bg-[#0b1329]/90 border border-[#3d494c]/40 rounded-xl overflow-hidden shadow-md transition-all hover:border-[#00e5ff]/40">
            {/* Header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#3d494c]/30 bg-[#131b2e]/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff]" />
                <h2 className="text-xs font-semibold text-[#dae2fd] truncate">
                  {DASHBOARD_CHARTS_CONFIG['orb-gauge'].title}
                </h2>
              </div>
              <button
                onClick={() => toggleCardVisibility('orb-gauge')}
                className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
                title="Hide Card"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">visibility_off</span>
              </button>
            </div>

            {/* Chart Canvas & Gauge Metrics */}
            <div className="p-2 flex-1 min-h-[260px] sm:min-h-[290px] flex flex-col justify-between relative">
              <div className="h-[210px] w-full">
                <ReactECharts
                  option={orbGaugeOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>

              {/* Sub-stats for OPEC Reference Basket */}
              <div className="grid grid-cols-3 gap-1 px-1 py-1 text-center bg-[#060e20]/60 rounded-lg border border-[#3d494c]/30 text-[10px] font-mono">
                <div>
                  <div className="text-[#869397]">24h Delta</div>
                  <div className="text-[#4edea3] font-semibold">
                    +{OPEC_BASKET_METRIC.change} ({OPEC_BASKET_METRIC.changePct}%)
                  </div>
                </div>
                <div>
                  <div className="text-[#869397]">52W Low</div>
                  <div className="text-[#dae2fd]">${OPEC_BASKET_METRIC.yearLow}</div>
                </div>
                <div>
                  <div className="text-[#869397]">52W High</div>
                  <div className="text-[#dae2fd]">${OPEC_BASKET_METRIC.yearHigh}</div>
                </div>
              </div>
            </div>

            {/* Documented Source Footer */}
            <div className="px-3 py-1.5 border-t border-[#3d494c]/20 bg-[#060e20]/60 flex items-center justify-between text-[10px] font-mono text-[#869397]">
              <span>Source: {DASHBOARD_CHARTS_CONFIG['orb-gauge'].source}</span>
              <span>{DASHBOARD_CHARTS_CONFIG['orb-gauge'].sourceYear}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

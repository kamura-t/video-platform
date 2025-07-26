'use client'

import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface PieChartData {
  name: string
  value: number
}

interface LineChartData {
  date: string
  views: number
  unique_viewers: number
}

// 円グラフコンポーネント
export function ChartJSPieChart({ data }: { data: PieChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">データがありません</p>
      </div>
    )
  }

  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        data: data.map(item => item.value),
        backgroundColor: [
          '#0088FE',
          '#00C49F',
          '#FFBB28',
          '#FF8042',
          '#8884D8',
          '#82ca9d',
          '#8dd1e1',
          '#d084d0',
        ],
        borderColor: [
          '#0088FE',
          '#00C49F',
          '#FFBB28',
          '#FF8042',
          '#8884D8',
          '#82ca9d',
          '#8dd1e1',
          '#d084d0',
        ],
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || ''
            const value = context.parsed
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = Math.round((value / total) * 100)
            return `${label}: ${value} (${percentage}%)`
          }
        }
      }
    },
  }

  return (
    <div className="w-full h-full">
      <Pie data={chartData} options={options} />
    </div>
  )
}

// 線グラフコンポーネント
export function ChartJSLineChart({ data }: { data: LineChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">データがありません</p>
      </div>
    )
  }

  const chartData = {
    labels: data.map(item => {
      // 日付をフォーマット
      const date = new Date(item.date)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }),
    datasets: [
      {
        label: '視聴数',
        data: data.map(item => item.views),
        borderColor: '#8884d8',
        backgroundColor: 'rgba(136, 132, 216, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointBackgroundColor: '#8884d8',
        pointBorderColor: '#8884d8',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'ユニーク視聴者',
        data: data.map(item => item.unique_viewers),
        borderColor: '#82ca9d',
        backgroundColor: 'rgba(130, 202, 157, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointBackgroundColor: '#82ca9d',
        pointBorderColor: '#82ca9d',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: function(context: any) {
            if (context.length > 0) {
              const index = context[0].dataIndex
              return data[index].date
            }
            return ''
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '日付'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: '数値'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  }

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  )
}

// シンプルな線グラフ（テスト用）
export function ChartJSSimpleLineChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">データがありません</p>
      </div>
    )
  }

  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        label: 'Value',
        data: data.map(item => item.value),
        borderColor: '#8884d8',
        backgroundColor: 'rgba(136, 132, 216, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointBackgroundColor: '#8884d8',
        pointBorderColor: '#8884d8',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  )
}
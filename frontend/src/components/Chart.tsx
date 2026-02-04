import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e']

interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'scatter'
  data: Record<string, any>[]
  xKey?: string
  yKey?: string
  config?: Record<string, any>
}

export function Chart({ type, data, xKey, yKey, config }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        No data to visualize
      </div>
    )
  }

  // Infer keys if not provided
  const keys = Object.keys(data[0])
  const effectiveXKey = xKey || keys[0]
  const effectiveYKey = yKey || keys[1]

  const chartProps = {
    data,
    margin: { top: 20, right: 30, left: 20, bottom: 20 }
  }

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey={effectiveXKey} stroke="var(--text-secondary)" />
            <YAxis stroke="var(--text-secondary)" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey={effectiveYKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey={effectiveXKey} stroke="var(--text-secondary)" />
            <YAxis stroke="var(--text-secondary)" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={effectiveYKey} 
              stroke={COLORS[0]} 
              strokeWidth={2}
              dot={{ fill: COLORS[0] }}
            />
          </LineChart>
        </ResponsiveContainer>
      )

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey={effectiveYKey}
              nameKey={effectiveXKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry) => entry[effectiveXKey]}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey={effectiveXKey} stroke="var(--text-secondary)" name={effectiveXKey} />
            <YAxis dataKey={effectiveYKey} stroke="var(--text-secondary)" name={effectiveYKey} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            />
            <Scatter name="Data" data={data} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      )

    default:
      return null
  }
}

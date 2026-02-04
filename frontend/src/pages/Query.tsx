import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Send, 
  Database, 
  Table2, 
  ChevronRight, 
  ChevronDown,
  RefreshCw,
  Copy,
  Check,
  BarChart3,
  Code
} from 'lucide-react'
import { connectionsApi, queryApi, vizApi } from '../lib/api'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DataTable } from '../components/DataTable'
import { Chart } from '../components/Chart'
import type { Connection, Schema, AskResponse, ChartSuggestion } from '../types'
import clsx from 'clsx'

export function QueryPage() {
  const [searchParams] = useSearchParams()
  const initialConnectionId = searchParams.get('connection')

  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [schema, setSchema] = useState<Schema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)
  
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter'>('bar')
  const [, setChartSuggestions] = useState<ChartSuggestion[]>([])

  const [suggestions, setSuggestions] = useState<string[]>([])
  const queryInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchConnections()
  }, [])

  useEffect(() => {
    if (connections.length > 0 && initialConnectionId) {
      const conn = connections.find(c => c.id === parseInt(initialConnectionId))
      if (conn) handleSelectConnection(conn)
    }
  }, [connections, initialConnectionId])

  const fetchConnections = async () => {
    try {
      const data = await connectionsApi.list()
      setConnections(data)
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    }
  }

  const handleSelectConnection = async (conn: Connection) => {
    setSelectedConnection(conn)
    setLoadingSchema(true)
    setSchema(null)
    setResult(null)
    setSuggestions([])

    try {
      const schemaData = await connectionsApi.getSchema(conn.id)
      setSchema(schemaData)
      
      // Get query suggestions
      try {
        const sugg = await queryApi.suggestions(conn.id)
        setSuggestions(sugg)
      } catch {}
    } catch (err) {
      console.error('Failed to fetch schema:', err)
    } finally {
      setLoadingSchema(false)
    }
  }

  const handleRefreshSchema = async () => {
    if (!selectedConnection) return
    setLoadingSchema(true)
    try {
      const schemaData = await connectionsApi.refreshSchema(selectedConnection.id)
      setSchema(schemaData)
    } catch (err) {
      console.error('Failed to refresh schema:', err)
    } finally {
      setLoadingSchema(false)
    }
  }

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConnection || !query.trim()) return

    setLoading(true)
    setResult(null)
    setChartSuggestions([])

    try {
      const response = await queryApi.ask(selectedConnection.id, query.trim())
      setResult(response)

      // Get chart suggestions if we have results
      if (response.columns && response.rows && response.rows.length > 0) {
        try {
          const suggestions = await vizApi.suggest(response.columns, response.rows.slice(0, 10))
          setChartSuggestions(suggestions)
          if (suggestions.length > 0) {
            setChartType(suggestions[0].chart_type as any)
          }
        } catch {}
      }
    } catch (err: any) {
      setResult({
        sql: '',
        explanation: '',
        error: err.response?.data?.detail || 'Query failed'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    queryInputRef.current?.focus()
  }

  const copySql = async () => {
    if (!result?.sql) return
    await navigator.clipboard.writeText(result.sql)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  // Convert result to chart data
  const chartData = result?.columns && result?.rows
    ? result.rows.map(row => {
        const obj: Record<string, any> = {}
        result.columns!.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
    : []

  return (
    <div className="flex h-full">
      {/* Schema Sidebar */}
      <aside className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-color)]">
          <select
            value={selectedConnection?.id || ''}
            onChange={(e) => {
              const conn = connections.find(c => c.id === parseInt(e.target.value))
              if (conn) handleSelectConnection(conn)
            }}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="">Select connection...</option>
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--text-secondary)]">
          <span>Schema</span>
          {selectedConnection && (
            <button
              onClick={handleRefreshSchema}
              disabled={loadingSchema}
              className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
              title="Refresh Schema"
            >
              <RefreshCw className={clsx('w-4 h-4', loadingSchema && 'animate-spin')} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loadingSchema ? (
            <LoadingSpinner className="mt-8" />
          ) : !selectedConnection ? (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              Select a connection to view schema
            </div>
          ) : !schema?.tables?.length ? (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              No tables found
            </div>
          ) : (
            <div className="space-y-1">
              {schema.tables.map((table) => (
                <div key={table.name}>
                  <button
                    onClick={() => toggleTable(table.name)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors text-sm"
                  >
                    {expandedTables.has(table.name) ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                    <Table2 className="w-4 h-4 text-indigo-500" />
                    <span className="flex-1 text-left truncate">{table.name}</span>
                    {table.row_count !== null && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        {table.row_count.toLocaleString()}
                      </span>
                    )}
                  </button>
                  
                  {expandedTables.has(table.name) && (
                    <div className="ml-6 pl-2 border-l border-[var(--border-color)] space-y-1 mt-1">
                      {table.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center gap-2 px-2 py-1 text-sm"
                        >
                          <span className={clsx(
                            'flex-1 truncate',
                            col.is_primary_key && 'font-medium'
                          )}>
                            {col.name}
                            {col.is_primary_key && ' 🔑'}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {col.data_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Query Input */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={!selectedConnection}
              rows={2}
              className="flex-1 px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <button
              type="submit"
              disabled={!selectedConnection || !query.trim() || loading}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Suggestions */}
          {suggestions.length > 0 && !result && (
            <div className="mt-3">
              <p className="text-xs text-[var(--text-secondary)] mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((sugg, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sugg)}
                    className="px-3 py-1.5 text-sm rounded-full bg-[var(--bg-secondary)] hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-4">
          {!selectedConnection ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
              <Database className="w-16 h-16 mb-4" />
              <p>Select a database connection to get started</p>
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
              <Send className="w-16 h-16 mb-4" />
              <p>Ask a question about your data</p>
            </div>
          ) : result.error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500">
              <p className="font-medium mb-2">Error</p>
              <p>{result.error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SQL & Explanation */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">Generated SQL</span>
                  </div>
                  <button
                    onClick={copySql}
                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors"
                  >
                    {copiedSql ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm">
                  <code>{result.sql}</code>
                </pre>
                {result.explanation && (
                  <div className="px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] text-sm text-[var(--text-secondary)]">
                    {result.explanation}
                  </div>
                )}
              </div>

              {/* Results Info */}
              {result.row_count !== undefined && (
                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                  <span>{result.row_count} rows</span>
                  {result.execution_time_ms && (
                    <span>{result.execution_time_ms}ms</span>
                  )}
                  
                  {/* View Mode Toggle */}
                  {result.columns && result.rows && result.rows.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto bg-[var(--bg-secondary)] rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('table')}
                        className={clsx(
                          'px-3 py-1 rounded text-sm transition-colors',
                          viewMode === 'table'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <Table2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('chart')}
                        className={clsx(
                          'px-3 py-1 rounded text-sm transition-colors',
                          viewMode === 'chart'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Data View */}
              {result.columns && result.rows && (
                viewMode === 'table' ? (
                  <DataTable columns={result.columns} rows={result.rows} />
                ) : (
                  <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
                    {/* Chart Type Selector */}
                    <div className="flex items-center gap-2 mb-4">
                      {['bar', 'line', 'pie', 'scatter'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setChartType(type as any)}
                          className={clsx(
                            'px-3 py-1.5 rounded text-sm capitalize transition-colors',
                            chartType === type
                              ? 'bg-indigo-500 text-white'
                              : 'bg-[var(--bg-primary)] hover:bg-indigo-500/10'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <Chart 
                      type={chartType} 
                      data={chartData}
                      xKey={result.columns[0]}
                      yKey={result.columns[1]}
                    />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

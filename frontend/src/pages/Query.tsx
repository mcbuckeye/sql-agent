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
  Code,
  PanelLeft,
  X
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
  const [schemaSidebarOpen, setSchemaSidebarOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)
  
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter'>('bar')
  const [, setChartSuggestions] = useState<ChartSuggestion[]>([])

  const [suggestions, setSuggestions] = useState<string[]>([])
  const queryInputRef = useRef<HTMLTextAreaElement>(null)

  // Editable SQL state
  const [editableSql, setEditableSql] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  
  // Parameter state
  const [detectedParams, setDetectedParams] = useState<Array<{
    name: string
    label: string
    type: string
    description?: string
    default?: any
    required: boolean
  }>>([])
  const [paramValues, setParamValues] = useState<Record<string, any>>({})
  const [showParamDialog, setShowParamDialog] = useState(false)
  const [pendingQuery, setPendingQuery] = useState('')

  useEffect(() => {
    fetchConnections()
  }, [])

  // Sync editable SQL with result
  useEffect(() => {
    if (result?.sql) {
      setEditableSql(result.sql)
      setIsEditing(false)
    }
  }, [result?.sql])

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
    setDetectedParams([])
    setShowParamDialog(false)

    try {
      // First, detect if parameters are needed
      const paramResult = await queryApi.detectParameters(selectedConnection.id, query.trim())
      
      if (paramResult.needs_parameters && paramResult.parameters.length > 0) {
        // Show parameter dialog
        setDetectedParams(paramResult.parameters)
        // Set default values
        const defaults: Record<string, any> = {}
        paramResult.parameters.forEach(p => {
          if (p.default !== null && p.default !== undefined) {
            defaults[p.name] = p.default
          } else if (p.type === 'date') {
            // Default to today for dates
            defaults[p.name] = new Date().toISOString().split('T')[0]
          }
        })
        setParamValues(defaults)
        setPendingQuery(query.trim())
        setShowParamDialog(true)
        setLoading(false)
        return
      }
      
      // No parameters needed, execute directly
      await executeWithParams(query.trim(), null)
    } catch (err: any) {
      const responseData = err.response?.data
      setResult({
        sql: responseData?.sql || '',
        explanation: responseData?.explanation || '',
        error: responseData?.error || responseData?.detail || err.message || 'Query failed'
      })
      setLoading(false)
    }
  }
  
  const executeWithParams = async (naturalLanguage: string, params: Record<string, any> | null) => {
    if (!selectedConnection) return
    
    setLoading(true)
    setShowParamDialog(false)
    
    try {
      const response = await queryApi.ask(selectedConnection.id, naturalLanguage, true, params || undefined)
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
      const responseData = err.response?.data
      setResult({
        sql: responseData?.sql || '',
        explanation: responseData?.explanation || '',
        error: responseData?.error || responseData?.detail || err.message || 'Query failed'
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleParamSubmit = () => {
    if (pendingQuery) {
      executeWithParams(pendingQuery, paramValues)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    queryInputRef.current?.focus()
  }

  const copySql = async () => {
    if (!result?.sql) return
    await navigator.clipboard.writeText(editableSql || result.sql)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  const handleRunModifiedSql = async () => {
    if (!selectedConnection || !editableSql.trim()) return
    setLoading(true)

    try {
      const execResult = await queryApi.execute(selectedConnection.id, editableSql.trim())

      // Update result with new data while keeping explanation
      setResult(prev => ({
        ...prev!,
        columns: execResult.columns,
        rows: execResult.rows,
        row_count: execResult.row_count,
        execution_time_ms: execResult.execution_time_ms,
        error: undefined
      }))

      // Submit feedback if SQL was corrected
      if (isEditing && result?.sql) {
        try {
          await queryApi.submitFeedback({
            connection_id: selectedConnection.id,
            natural_language: query,
            original_sql: result.sql,
            corrected_sql: editableSql.trim()
          })
        } catch (feedbackErr) {
          console.error('Failed to submit feedback:', feedbackErr)
        }
      }

      setIsEditing(false)
    } catch (err: any) {
      setResult(prev => ({
        ...prev!,
        error: err.response?.data?.detail || err.message || 'Execution failed'
      }))
    } finally {
      setLoading(false)
    }
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
    <div className="flex flex-col lg:flex-row h-full">
      {/* Mobile Schema Toggle & Connection Selector */}
      <div className="lg:hidden p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center gap-2">
        <button
          onClick={() => setSchemaSidebarOpen(true)}
          className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-primary)] transition-colors"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <select
          value={selectedConnection?.id || ''}
          onChange={(e) => {
            const conn = connections.find(c => c.id === parseInt(e.target.value))
            if (conn) handleSelectConnection(conn)
          }}
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="">Select connection...</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Schema Sidebar Overlay */}
      {schemaSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSchemaSidebarOpen(false)}
        />
      )}

      {/* Schema Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-50 w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col transform transition-transform duration-200 ease-in-out',
        schemaSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-2">
          <select
            value={selectedConnection?.id || ''}
            onChange={(e) => {
              const conn = connections.find(c => c.id === parseInt(e.target.value))
              if (conn) handleSelectConnection(conn)
            }}
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="">Select connection...</option>
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSchemaSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Query Input */}
        <div className="p-3 md:p-4 border-b border-[var(--border-color)]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={!selectedConnection}
              rows={2}
              className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50 text-sm md:text-base"
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
              className="px-3 md:px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Suggestions */}
          {suggestions.length > 0 && !result && !showParamDialog && (
            <div className="mt-3">
              <p className="text-xs text-[var(--text-secondary)] mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((sugg, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sugg)}
                    className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full bg-[var(--bg-secondary)] hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Parameter Dialog */}
          {showParamDialog && detectedParams.length > 0 && (
            <div className="mt-3 p-4 bg-[var(--bg-secondary)] border border-indigo-500/30 rounded-lg">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Specify Parameters
              </h3>
              <div className="space-y-3">
                {detectedParams.map((param) => (
                  <div key={param.name} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {param.label}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {param.description && (
                      <p className="text-xs text-[var(--text-secondary)] opacity-70">{param.description}</p>
                    )}
                    <input
                      type={param.type === 'date' ? 'date' : param.type === 'number' ? 'number' : 'text'}
                      value={paramValues[param.name] || ''}
                      onChange={(e) => setParamValues(prev => ({
                        ...prev,
                        [param.name]: param.type === 'number' ? Number(e.target.value) : e.target.value
                      }))}
                      className="px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleParamSubmit}
                  disabled={loading || detectedParams.some(p => p.required && !paramValues[p.name])}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? 'Running...' : 'Run Query'}
                </button>
                <button
                  onClick={() => {
                    setShowParamDialog(false)
                    setDetectedParams([])
                  }}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {!selectedConnection ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
              <Database className="w-12 md:w-16 h-12 md:h-16 mb-4" />
              <p className="text-sm md:text-base text-center">Select a database connection to get started</p>
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
              <Send className="w-12 md:w-16 h-12 md:h-16 mb-4" />
              <p className="text-sm md:text-base text-center">Ask a question about your data</p>
            </div>
          ) : result.error ? (
            <div className="space-y-3 md:space-y-4">
              {/* Show SQL if it was generated, even with error */}
              {result.sql && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <Code className="w-4 h-4 text-indigo-500" />
                      <span className="font-medium">Generated SQL</span>
                      {isEditing && (
                        <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">
                          Modified
                        </span>
                      )}
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
                  <div className="relative">
                    <textarea
                      value={editableSql}
                      onChange={(e) => {
                        setEditableSql(e.target.value)
                        setIsEditing(e.target.value !== result.sql)
                      }}
                      className="w-full p-3 md:p-4 font-mono text-xs md:text-sm bg-[var(--bg-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded cursor-text"
                      rows={Math.min(Math.max(editableSql.split('\n').length + 1, 3), 15)}
                    />
                    {!isEditing && (
                      <div className="absolute bottom-2 right-2 text-xs text-[var(--text-secondary)] opacity-50 pointer-events-none">
                        Click to edit
                      </div>
                    )}
                  </div>
                  {result.explanation && (
                    <div className="px-3 md:px-4 py-2 md:py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] text-xs md:text-sm text-[var(--text-secondary)]">
                      {result.explanation}
                    </div>
                  )}
                  {isEditing && (
                    <div className="px-3 md:px-4 py-2 border-t border-[var(--border-color)] flex items-center gap-2">
                      <button
                        onClick={handleRunModifiedSql}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Running...' : 'Run Modified SQL'}
                      </button>
                      <button
                        onClick={() => {
                          setEditableSql(result.sql || '')
                          setIsEditing(false)
                        }}
                        className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Error message */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 md:p-4 text-red-500">
                <p className="font-medium mb-2 text-sm md:text-base">Execution Error</p>
                <p className="text-sm whitespace-pre-wrap">{result.error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {/* SQL & Explanation - Editable */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <Code className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">Generated SQL</span>
                    {isEditing && (
                      <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">
                        Modified
                      </span>
                    )}
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
                <div className="relative">
                  <textarea
                    value={editableSql}
                    onChange={(e) => {
                      setEditableSql(e.target.value)
                      setIsEditing(e.target.value !== result.sql)
                    }}
                    className="w-full p-3 md:p-4 font-mono text-xs md:text-sm bg-[var(--bg-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded cursor-text"
                    rows={Math.min(Math.max(editableSql.split('\n').length + 1, 3), 15)}
                    placeholder="SQL will appear here..."
                  />
                  {!isEditing && (
                    <div className="absolute bottom-2 right-2 text-xs text-[var(--text-secondary)] opacity-50 pointer-events-none">
                      Click to edit
                    </div>
                  )}
                </div>
                {result.explanation && (
                  <div className="px-3 md:px-4 py-2 md:py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] text-xs md:text-sm text-[var(--text-secondary)]">
                    {result.explanation}
                  </div>
                )}
                {isEditing && (
                  <div className="px-3 md:px-4 py-2 border-t border-[var(--border-color)] flex items-center gap-2">
                    <button
                      onClick={handleRunModifiedSql}
                      disabled={loading}
                      className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Running...' : 'Run Modified SQL'}
                    </button>
                    <button
                      onClick={() => {
                        setEditableSql(result.sql || '')
                        setIsEditing(false)
                      }}
                      className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Results Info */}
              {result.row_count !== undefined && (
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-[var(--text-secondary)]">
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
                          'px-2 md:px-3 py-1 rounded text-sm transition-colors',
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
                          'px-2 md:px-3 py-1 rounded text-sm transition-colors',
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
                  <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 md:p-4">
                    {/* Chart Type Selector */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {['bar', 'line', 'pie', 'scatter'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setChartType(type as any)}
                          className={clsx(
                            'px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm capitalize transition-colors',
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

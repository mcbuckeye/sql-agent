export interface User {
  id: number
  email: string
  created_at: string
}

export interface Connection {
  id: number
  name: string
  db_type: string
  host: string | null
  port: number | null
  database_name: string | null
  username: string | null
  ssl_enabled: boolean
  is_readonly: boolean
  created_at: string
  last_used_at: string | null
}

export interface ConnectionCreate {
  name: string
  db_type: string
  host?: string
  port?: number
  database_name?: string
  username?: string
  password?: string
  ssl_enabled?: boolean
  is_readonly?: boolean
}

export interface Column {
  name: string
  data_type: string
  is_nullable: boolean
  is_primary_key: boolean
  foreign_key: string | null
}

export interface Table {
  name: string
  columns: Column[]
  row_count: number | null
}

export interface Schema {
  tables: Table[]
  cached_at: string | null
}

export interface QueryResult {
  columns: string[]
  rows: any[][]
  row_count: number
  execution_time_ms: number
}

export interface AskResponse {
  sql: string
  explanation: string
  columns?: string[]
  rows?: any[][]
  row_count?: number
  execution_time_ms?: number
  error?: string
}

export interface QueryHistory {
  id: number
  connection_id: number
  natural_language_query: string | null
  generated_sql: string | null
  executed_at: string
  execution_time_ms: number | null
  row_count: number | null
  status: string | null
  error_message: string | null
  is_favorite: boolean
}

export interface ChartSuggestion {
  chart_type: string
  reason: string
  config: Record<string, any>
}

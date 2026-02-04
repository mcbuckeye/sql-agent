import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import clsx from 'clsx'

interface DataTableProps {
  columns: string[]
  rows: any[][]
  maxRows?: number
}

export function DataTable({ columns, rows, maxRows = 100 }: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [copiedCell, setCopiedCell] = useState<string | null>(null)

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(colIndex)
      setSortDirection('asc')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (sortColumn === null) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    
    if (aVal === null) return 1
    if (bVal === null) return -1
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortDirection === 'asc' ? comparison : -comparison
  }).slice(0, maxRows)

  const copyToClipboard = async (value: any, cellId: string) => {
    await navigator.clipboard.writeText(String(value ?? ''))
    setCopiedCell(cellId)
    setTimeout(() => setCopiedCell(null), 2000)
  }

  if (columns.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-secondary)]">
        No data to display
      </div>
    )
  }

  return (
    <div className="overflow-auto border border-[var(--border-color)] rounded-lg -mx-3 md:mx-0">
      <table className="w-full text-xs md:text-sm min-w-[400px]">
        <thead>
          <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            {columns.map((col, i) => (
              <th
                key={i}
                onClick={() => handleSort(i)}
                className="px-2 md:px-4 py-2 md:py-3 text-left font-medium text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-primary)] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  {col}
                  {sortColumn === i && (
                    sortDirection === 'asc' 
                      ? <ChevronUp className="w-3 md:w-4 h-3 md:h-4" />
                      : <ChevronDown className="w-3 md:w-4 h-3 md:h-4" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              className="border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              {row.map((cell, cellIndex) => {
                const cellId = `${rowIndex}-${cellIndex}`
                return (
                  <td
                    key={cellIndex}
                    className="px-2 md:px-4 py-2 md:py-3 group relative"
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        cell === null && 'text-[var(--text-secondary)] italic'
                      )}>
                        {cell === null ? 'NULL' : String(cell)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(cell, cellId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-primary)]"
                      >
                        {copiedCell === cellId ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-[var(--text-secondary)]" />
                        )}
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="px-4 py-2 bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)]">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  )
}

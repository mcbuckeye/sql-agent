# SQL Agent UX Improvements - Implementation Spec

## Overview
Three UX improvements for power users to make the SQL Agent more interactive and learn from corrections.

---

## 1. Editable SQL Textarea

### Current State
- SQL is displayed in a `<pre><code>` block (read-only)
- User can copy but cannot modify

### Implementation

#### Frontend (Query.tsx)
```typescript
// Add state
const [editableSql, setEditableSql] = useState('')
const [isEditing, setIsEditing] = useState(false)

// When result arrives:
useEffect(() => {
  if (result?.sql) {
    setEditableSql(result.sql)
    setIsEditing(false)
  }
}, [result?.sql])
```

Replace the SQL display section with:
```tsx
{/* SQL Display - Editable */}
<div className="relative">
  <textarea
    value={editableSql}
    onChange={(e) => {
      setEditableSql(e.target.value)
      setIsEditing(e.target.value !== result.sql)
    }}
    className="w-full p-3 md:p-4 font-mono text-xs md:text-sm bg-transparent resize-none"
    rows={Math.min(editableSql.split('\n').length + 1, 10)}
  />
  
  {/* Show indicator if modified */}
  {isEditing && (
    <div className="absolute top-2 right-2 px-2 py-1 text-xs bg-amber-500/10 text-amber-500 rounded">
      Modified
    </div>
  )}
</div>

{/* Run Modified SQL button */}
{isEditing && (
  <div className="px-3 md:px-4 py-2 border-t border-[var(--border-color)]">
    <button
      onClick={handleRunModifiedSql}
      disabled={loading}
      className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
    >
      Run Modified SQL
    </button>
  </div>
)}
```

Add handler:
```typescript
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
    
    // Optionally submit feedback if SQL was corrected
    if (isEditing && result?.sql) {
      await queryApi.submitFeedback({
        connection_id: selectedConnection.id,
        natural_language: query,
        original_sql: result.sql,
        corrected_sql: editableSql.trim()
      })
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
```

#### API (api.ts)
Add to queryApi:
```typescript
execute: async (connectionId: number, sql: string) => {
  const response = await api.post('/query/execute', { connection_id: connectionId, sql })
  return response.data
},

submitFeedback: async (data: { connection_id: number, natural_language: string, original_sql: string, corrected_sql: string }) => {
  const response = await api.post('/query/feedback', data)
  return response.data
}
```

---

## 2. Query Feedback System (Learning from Corrections)

### Backend

#### New Model (backend/app/models/query.py)
Add to existing file:
```python
class QueryFeedback(Base):
    __tablename__ = "query_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    connection_id = Column(Integer, ForeignKey("connections.id"))
    natural_language = Column(Text)
    original_sql = Column(Text)
    corrected_sql = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    connection = relationship("Connection")
```

#### Schema (schemas.py)
```python
class QueryFeedbackCreate(BaseModel):
    connection_id: int
    natural_language: str
    original_sql: str
    corrected_sql: str

class QueryFeedbackResponse(BaseModel):
    id: int
    connection_id: int
    natural_language: str
    original_sql: str
    corrected_sql: str
    created_at: datetime
    
    class Config:
        from_attributes = True
```

#### Endpoint (routers/query.py)
```python
@router.post("/feedback", response_model=QueryFeedbackResponse)
def submit_feedback(
    request: QueryFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Store user's SQL correction for learning."""
    feedback = QueryFeedback(
        user_id=current_user.id,
        connection_id=request.connection_id,
        natural_language=request.natural_language,
        original_sql=request.original_sql,
        corrected_sql=request.corrected_sql
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/feedback", response_model=List[QueryFeedbackResponse])
def get_feedback(
    connection_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get stored feedback for few-shot learning."""
    query = db.query(QueryFeedback).filter(
        QueryFeedback.user_id == current_user.id
    )
    if connection_id:
        query = query.filter(QueryFeedback.connection_id == connection_id)
    
    return query.order_by(QueryFeedback.created_at.desc()).limit(limit).all()
```

#### Alembic Migration
Create migration for `query_feedback` table.

---

## 3. Variable Placeholders in Suggestions

### Backend (services/sql_generator.py)
Modify `suggest_queries` to return structured suggestions:

```python
def suggest_queries(self, schema: dict) -> List[dict]:
    """Generate query suggestions with variable placeholders."""
    suggestions = []
    
    for table in schema.get("tables", [])[:5]:
        table_name = table["name"]
        columns = table.get("columns", [])
        
        # Find date columns
        date_cols = [c for c in columns if c.get("data_type", "").lower() in ("date", "timestamp", "datetime")]
        # Find numeric columns
        numeric_cols = [c for c in columns if c.get("data_type", "").lower() in ("integer", "int", "bigint", "float", "decimal", "numeric")]
        
        # Basic count
        suggestions.append({
            "text": f"How many {table_name} are there?",
            "placeholders": []
        })
        
        # Date-filtered query if date column exists
        if date_cols:
            date_col = date_cols[0]["name"]
            suggestions.append({
                "text": f"Show {table_name} from a specific year",
                "placeholders": [
                    {"name": "year", "label": "Enter year", "type": "number", "example": "2024"}
                ]
            })
            suggestions.append({
                "text": f"Show {table_name} from the last N months",
                "placeholders": [
                    {"name": "months", "label": "Number of months", "type": "number", "example": "3"}
                ]
            })
        
        # Aggregation with grouping
        if numeric_cols and len(columns) > 1:
            suggestions.append({
                "text": f"Show total {numeric_cols[0]['name']} by category",
                "placeholders": []
            })
    
    return suggestions[:8]  # Limit to 8 suggestions
```

### Frontend (Query.tsx)

#### Types
```typescript
interface Suggestion {
  text: string
  placeholders: Array<{
    name: string
    label: string
    type: 'text' | 'number' | 'date'
    example?: string
  }>
}
```

#### State
```typescript
const [suggestions, setSuggestions] = useState<Suggestion[]>([])
const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({})
const [showPlaceholderModal, setShowPlaceholderModal] = useState(false)
```

#### Placeholder Modal Component
```tsx
{showPlaceholderModal && selectedSuggestion && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-[var(--bg-primary)] rounded-lg shadow-xl max-w-md w-full p-4">
      <h3 className="font-medium mb-4">{selectedSuggestion.text}</h3>
      
      <div className="space-y-3">
        {selectedSuggestion.placeholders.map((ph) => (
          <div key={ph.name}>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              {ph.label}
            </label>
            <input
              type={ph.type}
              placeholder={ph.example}
              value={placeholderValues[ph.name] || ''}
              onChange={(e) => setPlaceholderValues(prev => ({
                ...prev,
                [ph.name]: e.target.value
              }))}
              className="w-full px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)]"
            />
          </div>
        ))}
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setShowPlaceholderModal(false)}
          className="flex-1 px-3 py-2 rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)]"
        >
          Cancel
        </button>
        <button
          onClick={handleRunWithPlaceholders}
          className="flex-1 px-3 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600"
        >
          Run Query
        </button>
      </div>
    </div>
  </div>
)}
```

#### Handler
```typescript
const handleSuggestionClick = (suggestion: Suggestion) => {
  if (suggestion.placeholders.length > 0) {
    setSelectedSuggestion(suggestion)
    setPlaceholderValues({})
    setShowPlaceholderModal(true)
  } else {
    setQuery(suggestion.text)
    queryInputRef.current?.focus()
  }
}

const handleRunWithPlaceholders = () => {
  if (!selectedSuggestion) return
  
  // Build query with filled placeholders
  let finalQuery = selectedSuggestion.text
  for (const ph of selectedSuggestion.placeholders) {
    const value = placeholderValues[ph.name]
    if (value) {
      // Replace placeholder references in the query
      finalQuery = finalQuery.replace(`a specific ${ph.name}`, value)
      finalQuery = finalQuery.replace(`N ${ph.name}s`, `${value} ${ph.name}s`)
      finalQuery = finalQuery.replace(`the last N`, `the last ${value}`)
    }
  }
  
  setQuery(finalQuery)
  setShowPlaceholderModal(false)
  // Auto-submit
  setTimeout(() => {
    queryInputRef.current?.form?.requestSubmit()
  }, 100)
}
```

---

## Database Migration

```sql
-- Add query_feedback table
CREATE TABLE query_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    connection_id INTEGER REFERENCES connections(id),
    natural_language TEXT,
    original_sql TEXT,
    corrected_sql TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_query_feedback_user_id ON query_feedback(user_id);
CREATE INDEX idx_query_feedback_connection_id ON query_feedback(connection_id);
```

---

## Testing Checklist

1. [ ] Editable SQL textarea appears after query
2. [ ] "Modified" indicator shows when SQL is changed
3. [ ] "Run Modified SQL" button executes the edited query
4. [ ] Feedback is stored when modified SQL is run
5. [ ] Suggestions with placeholders show modal
6. [ ] Placeholder values are incorporated into query
7. [ ] Query history still works
8. [ ] Mobile responsiveness maintained

---

## Deployment

After implementation:
1. Run database migration on sqlagent-postgres
2. Rebuild and redeploy via Dokploy
3. Test at https://sqlagent.machomelab.com

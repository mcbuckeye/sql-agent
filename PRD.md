# SQL Agent - Product Requirements Document

## Overview
SQL Agent is an AI-powered system that converts natural language queries into SQL, executes them against user-provided databases, and visualizes results. It supports multiple database types and provides an intuitive interface for non-technical users to query data.

## Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React + Vite + TypeScript
- **App Database:** PostgreSQL (for storing connections, history, users)
- **AI:** OpenAI API (GPT-4 for NLP→SQL conversion)
- **Visualization:** Recharts
- **Containerization:** Docker Compose

## Core Features

### 1. Authentication
- JWT-based authentication
- Login/logout functionality
- Default user seeded on first run:
  - Email: `steve@ipwatcher.com`
  - Password: `5678*stud`
- Protected routes for all app features

### 2. Database Connection Management
- Add/edit/delete database connections
- Support for multiple database types:
  - PostgreSQL
  - MySQL / MariaDB
  - SQLite
  - Microsoft SQL Server
  - Oracle (optional - complex driver)
- Store connections securely (encrypt credentials at rest)
- Test connection before saving
- Connection status indicator

### 3. Schema Explorer
- Auto-discover database schema on connection
- Display tables, columns, data types, relationships
- Searchable schema browser
- Foreign key visualization
- Sample data preview (first 5 rows)

### 4. Natural Language Query Interface
- Chat-style interface for asking questions
- AI examines schema context before generating SQL
- Show generated SQL before execution (optional auto-execute)
- Explain query logic in plain English
- Support for:
  - SELECT queries (primary)
  - Aggregations (COUNT, SUM, AVG, etc.)
  - JOINs across tables
  - Filtering and sorting
  - Date/time queries
- Query suggestions based on schema

### 5. Query Execution & Results
- Execute generated SQL against connected database
- Display results in interactive table
- Pagination for large result sets
- Export results (CSV, JSON)
- Column sorting and filtering
- Copy cell/row functionality

### 6. Data Visualization
- Auto-suggest appropriate chart types based on data
- Chart types:
  - Bar charts (categorical data)
  - Line charts (time series)
  - Pie charts (proportions)
  - Scatter plots (correlations)
  - Data tables with formatting
- Customizable chart options (colors, labels, axes)
- Save visualizations

### 7. Query History
- Track all queries with timestamps
- Save favorite queries
- Re-run previous queries
- Share queries (copy link)
- Filter by connection, date, status

### 8. Safety Features
- Read-only mode option (prevent INSERT/UPDATE/DELETE)
- Query timeout limits
- Result row limits (prevent memory issues)
- SQL injection prevention
- Audit log of all queries

## Database Schema (App Database)

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Database connections
CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    db_type VARCHAR(50) NOT NULL,  -- postgres, mysql, sqlite, mssql, oracle
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,  -- encrypted at rest
    ssl_enabled BOOLEAN DEFAULT FALSE,
    is_readonly BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP
);

-- Cached schema info
CREATE TABLE schema_cache (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER REFERENCES connections(id),
    schema_json JSONB,
    cached_at TIMESTAMP DEFAULT NOW()
);

-- Query history
CREATE TABLE query_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    connection_id INTEGER REFERENCES connections(id),
    natural_language_query TEXT,
    generated_sql TEXT,
    executed_at TIMESTAMP DEFAULT NOW(),
    execution_time_ms INTEGER,
    row_count INTEGER,
    status VARCHAR(50),  -- success, error, timeout
    error_message TEXT,
    is_favorite BOOLEAN DEFAULT FALSE
);

-- Saved visualizations
CREATE TABLE saved_visualizations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_history_id INTEGER REFERENCES query_history(id),
    chart_type VARCHAR(50),
    chart_config JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Connections
- `GET /api/connections` - List user's connections
- `POST /api/connections` - Add new connection
- `PUT /api/connections/{id}` - Update connection
- `DELETE /api/connections/{id}` - Delete connection
- `POST /api/connections/{id}/test` - Test connection
- `POST /api/connections/{id}/refresh-schema` - Refresh schema cache

### Schema
- `GET /api/connections/{id}/schema` - Get schema for connection
- `GET /api/connections/{id}/tables/{table}/preview` - Preview table data

### Query
- `POST /api/query/generate` - Generate SQL from natural language
- `POST /api/query/execute` - Execute SQL query
- `POST /api/query/ask` - Combined generate + execute
- `GET /api/query/history` - Get query history
- `PUT /api/query/history/{id}/favorite` - Toggle favorite
- `GET /api/query/suggestions` - Get query suggestions

### Visualization
- `POST /api/visualize/suggest` - Suggest chart types for data
- `POST /api/visualizations` - Save visualization
- `GET /api/visualizations` - List saved visualizations

## Frontend Pages

1. **Login** (`/login`)
   - Email/password form
   - Remember me option

2. **Dashboard** (`/`)
   - Recent connections
   - Recent queries
   - Quick stats

3. **Connections** (`/connections`)
   - List of database connections
   - Add/edit connection modal
   - Connection health status

4. **Query Interface** (`/query`)
   - Connection selector
   - Schema browser sidebar
   - Chat-style query input
   - SQL preview panel
   - Results table
   - Visualization panel

5. **History** (`/history`)
   - Filterable query history
   - Favorite queries
   - Re-run functionality

## UI/UX Requirements
- Clean, modern design (Linear/Vercel aesthetic)
- Dark mode support
- Mobile-responsive (though primary use is desktop)
- Keyboard shortcuts for power users
- Loading states and error handling
- Toast notifications for actions

## Docker Configuration

### Container Names (MUST be prefixed)
- `sqlagent-postgres` - App database
- `sqlagent-backend` - FastAPI backend
- `sqlagent-frontend` - React frontend (nginx)

### docker-compose.yml structure
```yaml
version: '3.8'
services:
  sqlagent-postgres:
    image: postgres:15
    container_name: sqlagent-postgres
    environment:
      POSTGRES_USER: sqlagent
      POSTGRES_PASSWORD: sqlagent_secret
      POSTGRES_DB: sqlagent
    volumes:
      - sqlagent-pgdata:/var/lib/postgresql/data
    networks:
      - sqlagent-network

  sqlagent-backend:
    build: ./backend
    container_name: sqlagent-backend
    environment:
      DATABASE_URL: postgresql://sqlagent:sqlagent_secret@sqlagent-postgres:5432/sqlagent
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SECRET_KEY: ${SECRET_KEY:-sqlagent-secret-key-change-in-prod}
    depends_on:
      - sqlagent-postgres
    networks:
      - sqlagent-network
      - dokploy-network

  sqlagent-frontend:
    build: ./frontend
    container_name: sqlagent-frontend
    depends_on:
      - sqlagent-backend
    networks:
      - sqlagent-network
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.sqlagent.rule=Host(`sqlagent.machomelab.com`)"
      - "traefik.http.routers.sqlagent.entrypoints=web"
      - "traefik.http.services.sqlagent.loadbalancer.server.port=80"

volumes:
  sqlagent-pgdata:

networks:
  sqlagent-network:
    driver: bridge
  dokploy-network:
    external: true
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection for app database
- `OPENAI_API_KEY` - OpenAI API key for NLP→SQL
- `SECRET_KEY` - JWT signing secret
- `ENCRYPTION_KEY` - For encrypting stored credentials

## Deployment
- Deploy to Dokploy on MachomeLab
- Domain: `sqlagent.machomelab.com`
- Cloudflare tunnel for HTTPS

## Testing Requirements
- Unit tests for SQL generation logic
- API endpoint tests (pytest)
- Frontend component tests (vitest)
- Integration test: full query flow
- Test with sample databases (SQLite test DBs)

## Security Considerations
- Never log actual credentials
- Encrypt all stored database passwords
- Parameterized queries for app database
- Read-only mode by default for connected DBs
- Rate limiting on API endpoints
- Audit trail for all query executions

## Success Metrics
- User can connect to a database in < 2 minutes
- Natural language queries generate correct SQL 90%+ of the time
- Query execution completes in < 5 seconds for typical queries
- Visualizations render correctly for common data patterns

## Out of Scope (v1)
- Multi-user collaboration
- Scheduled queries / reports
- Data transformation / ETL
- Direct database schema modifications
- Real-time query streaming

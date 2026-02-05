from typing import Dict, Any, List, Optional
from openai import OpenAI
from app.config import get_settings

settings = get_settings()


class SQLGenerator:
    """Service for generating SQL from natural language using OpenAI."""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def detect_parameters(self, natural_language: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Detect if the query requires user-specified parameters."""
        import json
        
        tables = schema.get("tables", [])
        
        # Get brief schema context
        if len(tables) > 50:
            relevant_tables = self._select_relevant_tables(natural_language, tables)
            filtered_schema = {"tables": [t for t in tables if t["name"] in relevant_tables]}
            schema_text = self._format_schema(filtered_schema)
        else:
            schema_text = self._format_schema(schema)
        
        system_prompt = f"""Analyze this natural language query to identify any parameters that need to be specified by the user before generating SQL.

Database Schema:
{schema_text}

Look for:
- Time periods (e.g., "over a specified time period", "between dates", "last N months")
- Specific values to filter by (e.g., "for a specific customer", "a given product")
- Numeric thresholds (e.g., "greater than X", "top N")
- Any placeholder or variable mentioned

For each parameter found, provide:
- name: short identifier (e.g., "start_date", "customer_id", "limit")
- label: user-friendly label (e.g., "Start Date", "Customer", "Number of Results")
- type: one of "date", "datetime", "text", "number", "select"
- description: brief explanation of what this parameter is for
- default: suggested default value if appropriate (null if none)
- required: true/false

If the query is clear and needs no parameters, return empty parameters array.

Respond in JSON format:
{{"needs_parameters": true/false, "parameters": [...], "clarification": "optional message if query is ambiguous"}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": natural_language}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
    
    def generate_sql(self, natural_language: str, schema: Dict[str, Any], db_type: str = "postgres", parameters: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """Generate SQL from natural language query."""
        import json
        
        tables = schema.get("tables", [])
        
        # If schema is large (>50 tables), first select relevant tables
        if len(tables) > 50:
            relevant_tables = self._select_relevant_tables(natural_language, tables)
            filtered_schema = {
                "tables": [t for t in tables if t["name"] in relevant_tables]
            }
            schema_text = self._format_schema(filtered_schema)
        else:
            schema_text = self._format_schema(schema)
        
        # Build parameter context if provided
        param_context = ""
        if parameters:
            param_lines = ["User-provided parameter values:"]
            for key, value in parameters.items():
                param_lines.append(f"- {key}: {value}")
            param_context = "\n" + "\n".join(param_lines) + "\n"
        
        system_prompt = f"""You are a SQL expert. Generate SQL queries based on natural language questions.

Database type: {db_type}

Database Schema:
{schema_text}
{param_context}
Rules:
1. Generate valid SQL for {db_type}
2. Use appropriate JOIN types when needed
3. Include helpful column aliases
4. Limit results to 1000 rows by default unless specified
5. Use proper date/time functions for the database type
6. Be careful with NULL handling
7. Only generate SELECT queries (read-only)
8. For MSSQL, use TOP instead of LIMIT
9. If user-provided parameter values are given above, USE THEM in the query (e.g., for date ranges, filters, limits)

Respond in JSON format:
{{"sql": "YOUR SQL QUERY", "explanation": "Brief explanation of what the query does"}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": natural_language}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        result = json.loads(response.choices[0].message.content)
        
        return {
            "sql": result.get("sql", ""),
            "explanation": result.get("explanation", "")
        }
    
    def _select_relevant_tables(self, query: str, tables: List[Dict]) -> List[str]:
        """Select relevant tables for a query from a large schema."""
        import json
        
        # Format just table names with brief column summary
        table_list = []
        for t in tables:
            cols = [c["name"] for c in t.get("columns", [])[:5]]
            cols_str = ", ".join(cols)
            if len(t.get("columns", [])) > 5:
                cols_str += f", ... ({len(t['columns'])} total)"
            table_list.append(f"- {t['name']}: {cols_str}")
        
        tables_text = "\n".join(table_list)
        
        system_prompt = f"""Given a user's natural language query and a list of database tables, identify which tables are likely relevant.

Available tables:
{tables_text}

Return a JSON object with the table names that would be needed to answer the query.
Select 1-10 most relevant tables.

{{"relevant_tables": ["table1", "table2", ...]}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",  # Use mini for table selection (cheaper, faster)
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("relevant_tables", [])
    
    def _format_schema(self, schema: Dict[str, Any]) -> str:
        """Format schema for LLM context."""
        lines = []
        
        for table in schema.get("tables", []):
            table_name = table["name"]
            columns = table.get("columns", [])
            row_count = table.get("row_count")
            
            col_defs = []
            for col in columns:
                col_str = f"  - {col['name']}: {col['data_type']}"
                if col.get("is_primary_key"):
                    col_str += " (PK)"
                if col.get("foreign_key"):
                    col_str += f" -> {col['foreign_key']}"
                col_defs.append(col_str)
            
            table_info = f"Table: {table_name}"
            if row_count is not None:
                table_info += f" ({row_count:,} rows)"
            
            lines.append(table_info)
            lines.extend(col_defs)
            lines.append("")
        
        return "\n".join(lines)
    
    def suggest_queries(self, schema: Dict[str, Any]) -> List[str]:
        """Suggest useful queries based on schema."""
        import json
        
        tables = schema.get("tables", [])
        
        # For large schemas, just use table names and brief column info
        if len(tables) > 50:
            table_list = []
            for t in tables[:100]:  # Limit to first 100 tables
                cols = [c["name"] for c in t.get("columns", [])[:3]]
                table_list.append(f"- {t['name']}: {', '.join(cols)}...")
            schema_text = "Tables (showing first 100):\n" + "\n".join(table_list)
        else:
            schema_text = self._format_schema(schema)
        
        system_prompt = f"""Based on this database schema, suggest 5 useful analytical queries a user might want to run.

Database Schema:
{schema_text}

Respond in JSON format:
{{"suggestions": ["suggestion 1", "suggestion 2", ...]}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",  # Use mini for suggestions
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "What are some useful queries I could run?"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        result = json.loads(response.choices[0].message.content)
        
        return result.get("suggestions", [])
    
    def suggest_visualizations(self, columns: List[str], sample_data: List[List[Any]]) -> List[Dict[str, Any]]:
        """Suggest appropriate chart types for the data."""
        
        # Format sample data
        data_preview = "Columns: " + ", ".join(columns) + "\n"
        data_preview += "Sample rows:\n"
        for row in sample_data[:5]:
            data_preview += str(row) + "\n"
        
        system_prompt = f"""Based on this query result, suggest appropriate visualizations.

{data_preview}

For each suggestion, provide:
- chart_type: one of "bar", "line", "pie", "scatter", "table"
- reason: why this chart type is appropriate
- config: chart configuration (x_column, y_column, etc.)

Respond in JSON format:
{{"suggestions": [{{"chart_type": "...", "reason": "...", "config": {{...}}}}]}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "What charts would work well for this data?"}
            ],
            response_format={"type": "json_object"},
            temperature=0.5
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        
        return result.get("suggestions", [])

from typing import Dict, Any, List
from openai import OpenAI
from app.config import get_settings

settings = get_settings()


class SQLGenerator:
    """Service for generating SQL from natural language using OpenAI."""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def generate_sql(self, natural_language: str, schema: Dict[str, Any], db_type: str = "postgres") -> Dict[str, str]:
        """Generate SQL from natural language query."""
        
        # Build schema context
        schema_text = self._format_schema(schema)
        
        system_prompt = f"""You are a SQL expert. Generate SQL queries based on natural language questions.

Database type: {db_type}

Database Schema:
{schema_text}

Rules:
1. Generate valid SQL for {db_type}
2. Use appropriate JOIN types when needed
3. Include helpful column aliases
4. Limit results to 1000 rows by default unless specified
5. Use proper date/time functions for the database type
6. Be careful with NULL handling
7. Only generate SELECT queries (read-only)

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
        
        import json
        result = json.loads(response.choices[0].message.content)
        
        return {
            "sql": result.get("sql", ""),
            "explanation": result.get("explanation", "")
        }
    
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
        schema_text = self._format_schema(schema)
        
        system_prompt = f"""Based on this database schema, suggest 5 useful analytical queries a user might want to run.

Database Schema:
{schema_text}

Respond in JSON format:
{{"suggestions": ["suggestion 1", "suggestion 2", ...]}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "What are some useful queries I could run?"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        import json
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

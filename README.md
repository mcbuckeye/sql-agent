# SQL Agent

AI-powered natural language to SQL conversion with multi-database support.

## Features

- 🗣️ **Natural Language Queries** - Ask questions in plain English, get SQL
- 🗄️ **Multi-Database Support** - PostgreSQL, MySQL, SQLite, SQL Server
- 📊 **Smart Visualizations** - Auto-suggested charts based on your data
- 📜 **Query History** - Track and favorite your queries
- 🔒 **Secure** - Encrypted credentials, read-only mode by default
- 🌙 **Dark Mode** - Easy on the eyes

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API key

### Running Locally

1. Clone the repo:
   ```bash
   git clone https://github.com/mcbuckeye/sql-agent.git
   cd sql-agent
   ```

2. Create a `.env` file:
   ```bash
   OPENAI_API_KEY=your-api-key-here
   SECRET_KEY=your-secret-key
   ```

3. Start the services:
   ```bash
   docker-compose up -d
   ```

4. Open http://localhost:80

### Default Login

- Email: `steve@ipwatcher.com`
- Password: `5678*stud`

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Database**: PostgreSQL (app data)
- **AI**: OpenAI GPT-4o
- **Charts**: Recharts

## API Documentation

Once running, visit http://localhost:8000/docs for the Swagger UI.

## License

MIT

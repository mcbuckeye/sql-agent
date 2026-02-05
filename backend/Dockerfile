FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and Microsoft ODBC Driver 18 for SQL Server
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    unixodbc-dev \
    curl \
    gnupg \
    apt-transport-https \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=arm64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

# Create permissive OpenSSL config for legacy SQL Server TLS compatibility
RUN echo 'openssl_conf = openssl_init\n\
[openssl_init]\n\
ssl_conf = ssl_sect\n\
[ssl_sect]\n\
system_default = system_default_sect\n\
[system_default_sect]\n\
MinProtocol = TLSv1\n\
CipherString = DEFAULT:@SECLEVEL=0' > /etc/ssl/openssl-legacy.cnf

ENV OPENSSL_CONF=/etc/ssl/openssl-legacy.cnf

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

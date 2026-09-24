FROM node:22-slim AS zoho-deps
WORKDIR /mcp
COPY alamaticz-zoho-mcp/package.json alamaticz-zoho-mcp/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM python:3.12-slim
COPY --from=zoho-deps /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=zoho-deps /mcp/node_modules ./alamaticz-zoho-mcp/node_modules
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

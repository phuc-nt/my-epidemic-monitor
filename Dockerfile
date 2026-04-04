# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline
COPY . .
RUN npm run build

# Stage 2: Serve with nginx + node API
FROM node:20-alpine
RUN apk add --no-cache nginx

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy API server
COPY --from=builder /app/api /app/api
COPY --from=builder /app/server.cjs /app/server.cjs
COPY --from=builder /app/node_modules /app/node_modules

# Nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80
CMD ["sh", "-c", "node /app/server.cjs & nginx -g 'daemon off;'"]

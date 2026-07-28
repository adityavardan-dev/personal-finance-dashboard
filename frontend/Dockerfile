# Stage 1 - Build the Angular application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Stage 2 - Production image
FROM node:22-alpine

WORKDIR /app

# We're copying only the files needed to run the application from the builder stage into a fresh runtime image
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm install --omit=dev

EXPOSE 4000

CMD ["node", "dist/frontend/server/server.mjs"]
# ==========================
# Stage 1: Build the application
# ==========================

# Start with a lightweight Linux image that already has Node.js 22 installed
FROM node:22-alpine AS builder

# All subsequent commands will execute inside /app
WORKDIR /app

# Copy dependency files first so Docker can cache npm install
# If only source code changes, Docker won't reinstall dependencies
COPY package*.json ./

# Install all dependencies (including dev dependencies required for building)
RUN npm install

# Copy the remaining application source code
COPY . .

# Compile TypeScript into JavaScript (creates the dist/ folder)
RUN npm run build


# ==========================
# Stage 2: Production image
# ==========================

# Start with a fresh, clean Node.js image
# This keeps the final image small by excluding build tools
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy only the compiled application from the builder stage
COPY --from=builder /app/dist ./dist

# Copy package files so production dependencies can be installed
COPY --from=builder /app/package*.json ./

# Install only production dependencies
# Skips Jest, TypeScript, ESLint, Nest CLI, etc.
RUN npm install --omit=dev

# Document that this application listens on port 3000
EXPOSE 3000

# Command executed when the container starts
CMD ["node", "dist/main"]
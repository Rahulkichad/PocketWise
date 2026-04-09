# PocketWise Backend Dockerfile - Development Build
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* .npmrc* ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source files
COPY src ./src

# Expose backend port
EXPOSE 8000

# Run in development mode
CMD ["npm", "run", "dev"]

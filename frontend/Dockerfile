FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose development port
EXPOSE 3000

# Development command (overridden by docker-compose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
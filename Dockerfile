FROM node:22-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 4000

# Start command using index.js
CMD ["node", "index.js"]

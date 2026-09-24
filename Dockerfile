FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Environment default
ENV NODE_ENV=production

CMD ["node", "index.js"]

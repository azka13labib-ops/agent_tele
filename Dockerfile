FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]

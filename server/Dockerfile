FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TS if needed, but we're using ts-node-dev for now or we build?
# Let's assume production build
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/server.js"]

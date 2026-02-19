FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 80

CMD ["node", "dist/index.js"]

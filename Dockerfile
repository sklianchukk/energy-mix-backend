FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# install all deps including devDependencies (tsc needs them)
RUN npm ci

COPY . .

# compile TypeScript → dist/
RUN npm run build

EXPOSE 10000

CMD ["node", "dist/index.js"]
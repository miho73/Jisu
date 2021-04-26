FROM node:14
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 80
EXPOSE 443

CMD [ "node", "server.js" ]
# Dockerfile
FROM node:10.15.2

WORKDIR /app

COPY . /app

RUN npm install

EXPOSE 8000 8001
CMD npm start
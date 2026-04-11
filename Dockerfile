FROM node:20-alpine
WORKDIR /app
COPY api/package.json .
RUN npm install --production
COPY api/server.js .
COPY frontend ../frontend
EXPOSE 3001
CMD ["node", "server.js"]

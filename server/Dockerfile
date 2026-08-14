FROM node:20-alpine
WORKDIR /app
COPY . .
WORKDIR /app/server
RUN mkdir -p /app/server/data
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["node","api.js"]

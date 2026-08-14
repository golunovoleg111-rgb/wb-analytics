FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./package.json
COPY server/api.js ./api.js
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["node","api.js"]

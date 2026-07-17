# Frontend Angular — build de producción servido por nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
# El application builder de Angular genera dist/<proyecto>/browser
COPY --from=build /app/dist/classificador-extractor-documentos/browser /usr/share/nginx/html
EXPOSE 80

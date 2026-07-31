FROM node:20-alpine
WORKDIR /app

# instala dependências (roda no build da VPS; nada de Node no PC)
COPY package*.json ./
RUN npm install

# copia o código
COPY . .

# gera o client do Prisma e faz o build do Next
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# ao subir: cria/atualiza as tabelas no Postgres e inicia o app.
# se o push falhar por qualquer motivo, o app sobe mesmo assim.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss || true; npm start"]

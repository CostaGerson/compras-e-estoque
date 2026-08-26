FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
ARG NEXT_PUBLIC_CRM_URL=http://147.93.35.189:3001
ENV NEXT_PUBLIC_CRM_URL=$NEXT_PUBLIC_CRM_URL
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss || true; node scripts/seed.mjs || true; node scripts/seedFpp.mjs || true; npm start"]

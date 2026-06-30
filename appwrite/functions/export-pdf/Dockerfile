FROM node:20-bookworm

# Instalar dependências do Playwright / Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/server

COPY package.json .

RUN npm install

RUN npx playwright install chromium --with-deps

COPY . .

RUN npm run build 2>/dev/null || true

EXPOSE 3000

CMD ["node", "src/main.js"]

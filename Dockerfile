FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx hardhat compile

ENTRYPOINT ["npx", "hardhat"]
CMD ["test"]

# TCCDelivery — Certificação de TCC via Blockchain

> **Protótipo acadêmico** desenvolvido como POC/MVP para o Trabalho de Conclusão de Curso  
> *"Blockchain e Smart Contracts: barreiras à adoção"*  
> Arthur Naoto Miura — FEMA/IMESA 2026

---

## Propósito

Este projeto implementa um **smart contract Ethereum** para gerenciar o fluxo de entrega e avaliação de TCCs de forma transparente e imutável na blockchain.

O objetivo não é substituir sistemas acadêmicos existentes, mas **demonstrar na prática** como contratos inteligentes funcionam — e quais são suas limitações reais (custo de gas, problema do oráculo, complexidade de adoção).

### Fluxo do contrato

```
Orientador cadastra aluno
        ↓
Aluno submete hash SHA-256 do documento
        ↓
Orientador aprova → NFT (certificado) é emitido para o aluno
        ou
Orientador rejeita → aluno fica bloqueado de resubmeter
```

O certificado de aprovação é emitido como um **NFT ERC-721** ("CertificadoTCC"/"TCC"), ficando registrado permanentemente na carteira do aluno.

---

## Tecnologias

| Tecnologia | Versão | Papel |
|---|---|---|
| Solidity | ^0.8.20 | Linguagem do smart contract |
| Hardhat | ^2.22.0 | Ambiente de desenvolvimento Ethereum |
| OpenZeppelin | ^5.0.0 | Implementação ERC-721 e Ownable |
| Node.js | 20 | Runtime dos scripts e testes |
| Docker | qualquer | Execução reproduzível (sem instalar nada) |

---

## Como rodar

### Opção 1 — Docker (recomendado, zero configuração)

Requer apenas **Docker** instalado. Não precisa de Node.js, npm ou nada mais.

```bash
# Clonar o repositório
git clone https://github.com/R2nin/tcc-defesa.git
cd tcc-defesa

# Rodar os testes (4 cenários)
docker compose run --rm test

# Rodar a demonstração completa da defesa
docker compose run --rm demo
```

### Opção 2 — Node.js local

Requer **Node.js 20+** e **npm**.

```bash
# Clonar o repositório
git clone https://github.com/R2nin/tcc-defesa.git
cd tcc-defesa

# Instalar dependências
npm install

# Compilar o contrato
npm run compile

# Rodar os testes
npm test

# Rodar a demonstração da defesa
npm run demo:full
```

---

## Estrutura do projeto

```
tcc-defesa/
├── contracts/
│   └── TCCDelivery.sol       # Smart contract principal (ERC-721 + Ownable)
├── scripts/
│   ├── deploy.js             # Script de deploy em rede local
│   └── demo-defesa.js        # Demonstração completa com métricas de gas
├── test/
│   └── TCCDelivery.test.js   # Suíte de testes (4 cenários)
├── Dockerfile                # Imagem Docker com Node 20 + Hardhat
├── docker-compose.yml        # Serviços: test e demo
└── hardhat.config.js         # Configuração do Hardhat (EVM Cancun)
```

---

## Cenários de teste / demonstração

| # | Cenário | O que demonstra |
|---|---|---|
| 1 | Fluxo principal | Cadastro → submissão → aprovação + emissão do NFT |
| 2 | Rejeição | Orientador rejeita e bloqueia resubmissão |
| 3 | Problema do Oráculo | Contrato aceita hash de arquivo vazio como válido |
| 4 | Controle de acesso | Funções restritas ao orientador (owner) |

O **Cenário 3** é especialmente relevante para o TCC: ilustra a principal limitação técnica dos smart contracts — a incapacidade de verificar a validade do dado na cadeia por conta própria (o "Problema do Oráculo").

---

## Métricas de gas (rede de teste local)

| Operação | Gas estimado |
|---|---|
| Deploy do contrato | ~1.656.424 |
| `cadastrarAluno` | ~57.000 |
| `submeterTCC` | ~72.000 |
| `aprovarTCC` (com NFT) | ~78.000 |
| `rejeitarTCC` | ~35.000 |

Esses valores são exibidos automaticamente ao rodar `demo`.

---

## Limitações (intencionais — foco do TCC)

- **Problema do Oráculo:** o contrato não consegue verificar se o hash submetido corresponde a um documento real e válido.
- **Custo de gas:** cada operação tem custo financeiro em rede pública Ethereum.
- **Sem metadados do NFT:** o certificado não aponta para o documento (em produção, usaria IPFS).
- **Owner centralizado:** o orientador é um único endereço; em produção, recomenda-se carteira multisig (ex: Gnosis Safe).

---

## Licença

MIT

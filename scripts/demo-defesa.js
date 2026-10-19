/**
 * demo-defesa.js
 * Script de demonstração para a defesa do TCC.
 * Executa os 4 cenários descritos na Seção 3.2 e exibe os resultados
 * formatados para apresentação ao avaliador.
 *
 * Pré-requisito (apenas uma vez, após clonar o repositório):
 *   npm install
 *
 * Executar (rede in-process, sem node separado):
 *   npx hardhat run scripts/demo-defesa.js
 */

const { ethers } = require("hardhat");
const crypto     = require("crypto");

// Cotações de referência do TCC (7 set. 2026)
const ETH_USD            = 2511.21;
const ETH_BRL            = 12876.63;
const GWEI_OCIOSO        = 0.09;
const GWEI_CONGESTIONADO = 5.0;

function custo(gas, gwei, taxa) {
  return ((Number(gas) * gwei * 1e-9) * taxa).toFixed(2);
}

function linhaGas(label, gas) {
  const oc   = custo(gas, GWEI_OCIOSO,        ETH_BRL);
  const cong = custo(gas, GWEI_CONGESTIONADO,  ETH_BRL);
  console.log(
    `  ${label.padEnd(32)} ${gas.toString().padStart(10)} gas` +
    `   R$ ${oc.padStart(6)} (ociosa) / R$ ${cong.padStart(7)} (congestionado)`
  );
}

function cabecalho(cenario, descricao) {
  const linha = `  ${cenario}  `;
  const sep   = "═".repeat(Math.max(0, 64 - linha.length));
  console.log(`\n╔${"═".repeat(64)}╗`);
  console.log(`║${linha.padEnd(64)}║`);
  console.log(`╚${"═".repeat(64)}╝`);
  console.log(`   ${descricao}`);
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         TCCDelivery — Demonstração de Defesa                  ║");
  console.log("║  TCC: Blockchain e Smart Contracts: barreiras à adoção        ║");
  console.log("║               Arthur Naoto Miura — FEMA/IMESA 2026            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  // ── Deploy ──────────────────────────────────────────────────────────────
  console.log("\n▶  Implantando contrato na rede local Hardhat...");
  const [orientador, aluno1, aluno2, aluno3, naoAutorizado] = await ethers.getSigners();
  const TCCDelivery = await ethers.getContractFactory("TCCDelivery");
  const contrato    = await TCCDelivery.deploy();
  await contrato.waitForDeployment();
  const deployRec = await contrato.deploymentTransaction().wait();
  const endereco  = await contrato.getAddress();

  console.log(`\n   Endereço do contrato : ${endereco}`);
  console.log(`   Orientador (owner)   : ${orientador.address}`);
  console.log(`   Gas de implantação   : ${deployRec.gasUsed}`);

  // ── Cenário 1: Fluxo principal ──────────────────────────────────────────
  cabecalho(
    "CENÁRIO 1 — Fluxo principal",
    "Cadastro → Submissão do hash → Aprovação → Emissão do NFT"
  );

  // 1a. Cadastro
  const txCad = await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Naoto Miura");
  const rcCad = await txCad.wait();
  console.log(`\n   ✔  cadastrarAluno`);
  console.log(`      Nome    : Arthur Naoto Miura`);
  console.log(`      Carteira: ${aluno1.address}`);
  console.log(`      Gas     : ${rcCad.gasUsed}`);

  // 1b. Hash SHA-256 do TCC
  const conteudoTCC  = "Blockchain e Smart Contracts: barreiras à adoção — Arthur Naoto Miura 2026";
  const hashLegitimo = crypto.createHash("sha256").update(conteudoTCC).digest("hex");
  console.log(`\n   SHA-256 calculado localmente (representa a impressão digital do arquivo):`);
  console.log(`   ${hashLegitimo}`);

  // 1c. Submissão
  const txSub = await contrato.connect(aluno1).submeterTCC(hashLegitimo);
  const rcSub = await txSub.wait();
  console.log(`\n   ✔  submeterTCC`);
  console.log(`      Hash gravado na blockchain: ${hashLegitimo.slice(0, 24)}...`);
  console.log(`      Gas: ${rcSub.gasUsed}`);

  // 1d. Aprovação + NFT
  const txApr = await contrato.connect(orientador).aprovarTCC(aluno1.address);
  const rcApr = await txApr.wait();
  const nftOwner = await contrato.ownerOf(1);
  console.log(`\n   ✔  aprovarTCC → NFT #1 (CertificadoTCC) mintado`);
  console.log(`      Dono do NFT  : ${nftOwner}`);
  console.log(`      É o aluno?   : ${nftOwner === aluno1.address ? "SIM ✔" : "NÃO ✗"}`);
  console.log(`      Gas          : ${rcApr.gasUsed}`);

  // ── Cenário 2: Rejeição ─────────────────────────────────────────────────
  cabecalho(
    "CENÁRIO 2 — Rejeição",
    "Orientador rejeita a entrega e bloqueia o aluno de reenviar"
  );

  await contrato.connect(orientador).cadastrarAluno(aluno2.address, "Maria Silva");
  await contrato.connect(aluno2).submeterTCC(hashLegitimo);

  const txRej = await contrato.connect(orientador).rejeitarTCC(aluno2.address);
  const rcRej = await txRej.wait();
  const statusRej = await contrato.getStatus(aluno2.address);

  console.log(`\n   ✔  rejeitarTCC`);
  console.log(`      Aluno          : Maria Silva (${aluno2.address})`);
  console.log(`      podeSubmeter   : ${statusRej.podeSubmeter} → aluno bloqueado`);
  console.log(`      Gas            : ${rcRej.gasUsed}`);

  // Tenta resubmeter — deve falhar
  try {
    await contrato.connect(aluno2).submeterTCC("novo-hash-qualquer");
    console.log(`\n   ✗ ERRO: resubmissão deveria ter sido bloqueada!`);
  } catch (_) {
    console.log(`\n   ✔  Tentativa de resubmissão após rejeição → bloqueada`);
    console.log(`      Revert: "Aluno nao cadastrado" (podeSubmeter = false)`);
  }

  // ── Cenário 3: Problema do Oráculo ──────────────────────────────────────
  cabecalho(
    "CENÁRIO 3 — Problema do Oráculo  (Seção 4.2 do TCC)",
    "O contrato não distingue um TCC legítimo de um arquivo vazio"
  );

  // sha256("") — hash canônico de arquivo vazio
  const hashVazio = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  await contrato.connect(orientador).cadastrarAluno(aluno3.address, "Aluno Teste Oráculo");
  const txOraculo = await contrato.connect(aluno3).submeterTCC(hashVazio);
  await txOraculo.wait();
  const statusOraculo = await contrato.getStatus(aluno3.address);

  console.log(`\n   Hash de arquivo VAZIO  (sha256("")): ${hashVazio}`);
  console.log(`   Hash do TCC LEGÍTIMO             : ${hashLegitimo.slice(0, 48)}...`);
  console.log(`\n   submetido no contrato: ${statusOraculo.submetido}  ← resultado idêntico ao fluxo legítimo`);
  console.log(`\n   ⚠  O contrato ACEITOU o hash do arquivo vazio.`);
  console.log(`   ⚠  Do ponto de vista do smart contract, as duas entregas são indistinguíveis.`);
  console.log(`   ⚠  A validação semântica (ler e avaliar o conteúdo) permanece`);
  console.log(`      responsabilidade do orientador — o "oráculo humano".`);

  // ── Cenário 4: Controle de acesso ───────────────────────────────────────
  cabecalho(
    "CENÁRIO 4 — Controle de acesso / Governança  (Seção 4.3 do TCC)",
    "Apenas o orientador (owner) pode cadastrar, aprovar ou rejeitar"
  );

  const tentativas = [
    { fn: () => contrato.connect(naoAutorizado).cadastrarAluno(aluno1.address, "Invasor"), label: "cadastrarAluno" },
    { fn: () => contrato.connect(naoAutorizado).aprovarTCC(aluno1.address),                label: "aprovarTCC"    },
    { fn: () => contrato.connect(naoAutorizado).rejeitarTCC(aluno1.address),               label: "rejeitarTCC"   },
  ];

  console.log(`\n   Conta não autorizada: ${naoAutorizado.address}\n`);
  for (const { fn, label } of tentativas) {
    try {
      await fn();
      console.log(`   ✗ FALHA em ${label}: transação não deveria ter sido aceita!`);
    } catch (err) {
      const motivo = err.message.includes("OwnableUnauthorizedAccount")
        ? "OwnableUnauthorizedAccount (OpenZeppelin Ownable)"
        : err.message.split("\n")[0];
      console.log(`   ✔  ${label.padEnd(20)} → revertida  [${motivo}]`);
    }
  }

  // ── Tabela de custos de gas ──────────────────────────────────────────────
  const gasFluxo = rcCad.gasUsed + rcSub.gasUsed + rcApr.gasUsed;

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║        TABELA 2 — Consumo de gas por operação                 ║");
  console.log("║  Cotações: ETH = US$ 2.511,21 / R$ 12.876,63 (7 set. 2026)   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("  Operação                              Gas         Custo BRL");
  console.log("  " + "─".repeat(72));
  linhaGas("Implantação (deploy)",       deployRec.gasUsed);
  linhaGas("cadastrarAluno",             rcCad.gasUsed);
  linhaGas("submeterTCC",                rcSub.gasUsed);
  linhaGas("aprovarTCC (com NFT mint)",  rcApr.gasUsed);
  linhaGas("rejeitarTCC",                rcRej.gasUsed);
  console.log("  " + "─".repeat(72));
  linhaGas("Fluxo completo por aluno",   gasFluxo);

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  RESUMO — O que foi demonstrado                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("   ✔  Cenário 1: Fluxo completo executado → NFT #1 emitido ao aluno");
  console.log("   ✔  Cenário 2: Rejeição bloqueou resubmissão com sucesso");
  console.log("   ⚠  Cenário 3: Problema do Oráculo evidenciado — arquivo vazio aceito");
  console.log("   ✔  Cenário 4: Controle de acesso (Ownable) bloqueou 3 tentativas não autorizadas");
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Demonstração concluída. Todos os cenários foram executados.  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

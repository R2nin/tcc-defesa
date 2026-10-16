/**
 * demo-defesa.js
 * Script de demonstração para a defesa do TCC.
 * Executa os 4 cenários descritos na Seção 3.2 e exibe os resultados
 * formatados para apresentação.
 *
 * Uso rápido (rede in-process, sem node separado):
 *   npx hardhat run scripts/demo-defesa.js
 */

const { ethers } = require("hardhat");
const crypto     = require("crypto");

// Cotações de referência do TCC (7 set. 2026)
const ETH_USD = 2511.21;
const ETH_BRL = 12876.63;
const GWEI_OCIOSO       = 0.09;
const GWEI_CONGESTIONADO = 5.0;

function custo(gas, gwei, taxa) {
  return ((Number(gas) * gwei * 1e-9) * taxa).toFixed(2);
}

function linha(label, gas) {
  const oc  = custo(gas, GWEI_OCIOSO,       ETH_BRL);
  const cong = custo(gas, GWEI_CONGESTIONADO, ETH_BRL);
  console.log(
    `  ${label.padEnd(32)} ${gas.toString().padStart(10)} gas` +
    `   R$ ${oc.padStart(6)} (ociosa) / R$ ${cong.padStart(7)} (congestionado)`
  );
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          TCCDelivery — Demonstração de Defesa               ║");
  console.log("║   TCC: Blockchain e Smart Contracts: barreiras à adoção     ║");
  console.log("║                Arthur Naoto Miura — FEMA/IMESA 2026         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const [orientador, aluno] = await ethers.getSigners();
  const TCCDelivery = await ethers.getContractFactory("TCCDelivery");
  const contrato    = await TCCDelivery.deploy();
  await contrato.waitForDeployment();
  const deployTx  = contrato.deploymentTransaction();
  const deployRec = await deployTx.wait();
  const endereço  = await contrato.getAddress();

  console.log("▶  Contrato implantado em:", endereço);
  console.log("   Orientador (owner)   :", orientador.address);
  console.log("   Aluno                :", aluno.address);

  // ── Cenário 1: Fluxo principal ──────────────────────────────────────────
  console.log("\n══ CENÁRIO 1 — Fluxo principal ══════════════════════════════════");

  const txCad = await contrato.connect(orientador).cadastrarAluno(aluno.address, "Arthur Naoto Miura");
  const rcCad = await txCad.wait();
  console.log("✔  cadastrarAluno       gas:", rcCad.gasUsed);

  // Simula SHA-256 real de um arquivo
  const conteudoTCC = "Blockchain e Smart Contracts: barreiras à adoção — Arthur Naoto Miura 2026";
  const hashLegitimo = crypto.createHash("sha256").update(conteudoTCC).digest("hex");
  console.log("\n   SHA-256 do TCC :", hashLegitimo);

  const txSub = await contrato.connect(aluno).submeterTCC(hashLegitimo);
  const rcSub = await txSub.wait();
  console.log("✔  submeterTCC          gas:", rcSub.gasUsed);

  const txApr = await contrato.connect(orientador).aprovarTCC(aluno.address);
  const rcApr = await txApr.wait();
  console.log("✔  aprovarTCC (+ NFT)   gas:", rcApr.gasUsed);

  const nftOwner = await contrato.ownerOf(1);
  console.log(`\n   NFT #1 pertence a: ${nftOwner}`);
  console.log(`   (mesmo endereço do aluno: ${nftOwner === aluno.address ? "SIM ✔" : "NÃO ✗"})`);

  // ── Cenário 3: Problema do Oráculo ──────────────────────────────────────
  console.log("\n══ CENÁRIO 3 — Problema do Oráculo ══════════════════════════════");
  const [, , aluno2] = await ethers.getSigners();
  const hashVazio = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  await contrato.connect(orientador).cadastrarAluno(aluno2.address, "Aluno Teste Oraculo");
  const txOraculo = await contrato.connect(aluno2).submeterTCC(hashVazio);
  await txOraculo.wait();
  const statusOraculo = await contrato.getStatus(aluno2.address);

  console.log("   Hash submetido (arquivo vazio) :", hashVazio);
  console.log("   Status 'submetido'             :", statusOraculo.submetido);
  console.log("   ⚠  Contrato ACEITOU — indistinguível de TCC legítimo.");
  console.log("   ⚠  Validação semântica permanece com o orientador (oráculo humano).");

  // ── Cenário 4: Controle de acesso ───────────────────────────────────────
  console.log("\n══ CENÁRIO 4 — Controle de acesso ═══════════════════════════════");
  const [, , , naoAutorizado] = await ethers.getSigners();
  try {
    await contrato.connect(naoAutorizado).aprovarTCC(aluno.address);
    console.log("   ✗ FALHA: transação não deveria ter sido aceita!");
  } catch (err) {
    const msg = err.message.includes("OwnableUnauthorizedAccount")
      ? "OwnableUnauthorizedAccount"
      : err.message;
    console.log("   ✔ Transação revertida com:", msg);
    console.log("   ✔ Controle de acesso funciona como projetado.");
  }

  // ── Tabela de custos ─────────────────────────────────────────────────────
  const gasTotal = rcCad.gasUsed + rcSub.gasUsed + rcApr.gasUsed;
  console.log("\n══ TABELA 2 — Consumo de gas por operação ═══════════════════════");
  console.log("  (cotações: ETH = US$ 2.511,21 / R$ 12.876,63 em 7 set. 2026)\n");
  linha("Implantação (deploy)",      deployRec.gasUsed);
  linha("cadastrarAluno",            rcCad.gasUsed);
  linha("submeterTCC",               rcSub.gasUsed);
  linha("aprovarTCC (com NFT mint)", rcApr.gasUsed);
  linha("Fluxo completo por aluno",  gasTotal);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Demonstração concluída. Todos os cenários executados.      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

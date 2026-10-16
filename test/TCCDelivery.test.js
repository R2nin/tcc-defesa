const { expect }        = require("chai");
const { ethers }        = require("hardhat");
const { loadFixture }   = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Hash SHA-256 dos cenários do TCC
const HASH_LEGITIMO = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const HASH_VAZIO    = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256("")

async function deployFixture() {
  const [orientador, aluno1, aluno2, naoAutorizado] = await ethers.getSigners();
  const TCCDelivery = await ethers.getContractFactory("TCCDelivery");
  const contrato    = await TCCDelivery.deploy();
  return { contrato, orientador, aluno1, aluno2, naoAutorizado };
}

describe("TCCDelivery", function () {

  // ── Cenário 1: fluxo principal (cadastro → submissão → aprovação → NFT) ──
  describe("Cenário 1 — Fluxo principal", function () {
    it("orientador cadastra aluno com sucesso", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await expect(contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura"))
        .to.not.be.reverted;
      const status = await contrato.getStatus(aluno1.address);
      expect(status.nome).to.equal("Arthur Miura");
      expect(status.podeSubmeter).to.be.true;
    });

    it("aluno submete hash do TCC e evento é emitido", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await expect(contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO))
        .to.emit(contrato, "TCCSubmetido")
        .withArgs(aluno1.address, HASH_LEGITIMO);
    });

    it("orientador aprova, NFT é mintado e evento TCCAprovado é emitido", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      await expect(contrato.connect(orientador).aprovarTCC(aluno1.address))
        .to.emit(contrato, "TCCAprovado")
        .withArgs(aluno1.address, 1);
      expect(await contrato.ownerOf(1)).to.equal(aluno1.address);
      const status = await contrato.getStatus(aluno1.address);
      expect(status.aprovado).to.be.true;
      expect(status.tokenId).to.equal(1n);
    });

    it("mede gas do fluxo completo (Tabela 2 do TCC)", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);

      const txCadastro  = await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      const rcCadastro  = await txCadastro.wait();

      const txSubmissao = await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      const rcSubmissao = await txSubmissao.wait();

      const txAprovacao = await contrato.connect(orientador).aprovarTCC(aluno1.address);
      const rcAprovacao = await txAprovacao.wait();

      const gasCadastro  = rcCadastro.gasUsed;
      const gasSubmissao = rcSubmissao.gasUsed;
      const gasAprovacao = rcAprovacao.gasUsed;
      const gasTotal     = gasCadastro + gasSubmissao + gasAprovacao;

      console.log("\n  ┌─────────────────────────────────────────────┐");
      console.log("  │          GAS — Tabela 2 do TCC              │");
      console.log("  ├─────────────────────────────────────────────┤");
      console.log(`  │ cadastrarAluno   : ${gasCadastro.toString().padStart(10)} unidades       │`);
      console.log(`  │ submeterTCC      : ${gasSubmissao.toString().padStart(10)} unidades       │`);
      console.log(`  │ aprovarTCC (NFT) : ${gasAprovacao.toString().padStart(10)} unidades       │`);
      console.log(`  │ FLUXO COMPLETO   : ${gasTotal.toString().padStart(10)} unidades       │`);
      console.log("  └─────────────────────────────────────────────┘\n");

      // Tolerância de 15% em relação aos valores do TCC
      expect(gasCadastro).to.be.lessThan(90000n);
      expect(gasSubmissao).to.be.lessThan(135000n);
      expect(gasAprovacao).to.be.lessThan(125000n);
    });
  });

  // ── Cenário 2: fluxo de rejeição ──────────────────────────────────────────
  describe("Cenário 2 — Rejeição", function () {
    it("orientador rejeita TCC e bloqueia reenvio", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      await expect(contrato.connect(orientador).rejeitarTCC(aluno1.address))
        .to.emit(contrato, "TCCRejeitado")
        .withArgs(aluno1.address);
      const status = await contrato.getStatus(aluno1.address);
      expect(status.podeSubmeter).to.be.false;
    });

    it("mede gas da rejeição", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      const tx = await contrato.connect(orientador).rejeitarTCC(aluno1.address);
      const rc = await tx.wait();
      console.log(`\n  rejeitarTCC : ${rc.gasUsed} unidades de gas`);
      expect(rc.gasUsed).to.be.lessThan(35000n);
    });
  });

  // ── Cenário 3: Problema do Oráculo (Seção 4.2 do TCC) ────────────────────
  describe("Cenário 3 — Problema do Oráculo", function () {
    it("contrato aceita hash de arquivo vazio (evidência da barreira)", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");

      // O contrato NÃO consegue distinguir arquivo vazio de TCC legítimo
      await expect(contrato.connect(aluno1).submeterTCC(HASH_VAZIO))
        .to.emit(contrato, "TCCSubmetido")
        .withArgs(aluno1.address, HASH_VAZIO);

      const status = await contrato.getStatus(aluno1.address);
      expect(status.submetido).to.be.true;
      expect(status.hashTCC).to.equal(HASH_VAZIO);
      // Resultado idêntico ao de um TCC legítimo — demonstra o Problema do Oráculo
    });
  });

  // ── Cenário 4: Controle de acesso (Seção 4.3 do TCC) ─────────────────────
  describe("Cenário 4 — Controle de acesso / Governança", function () {
    it("conta não autorizada não pode cadastrar aluno", async function () {
      const { contrato, aluno1, naoAutorizado } = await loadFixture(deployFixture);
      await expect(
        contrato.connect(naoAutorizado).cadastrarAluno(aluno1.address, "Invasor")
      ).to.be.revertedWithCustomError(contrato, "OwnableUnauthorizedAccount");
    });

    it("conta não autorizada não pode aprovar TCC", async function () {
      const { contrato, orientador, aluno1, naoAutorizado } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      await expect(
        contrato.connect(naoAutorizado).aprovarTCC(aluno1.address)
      ).to.be.revertedWithCustomError(contrato, "OwnableUnauthorizedAccount");
    });

    it("conta não autorizada não pode rejeitar TCC", async function () {
      const { contrato, orientador, aluno1, naoAutorizado } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      await expect(
        contrato.connect(naoAutorizado).rejeitarTCC(aluno1.address)
      ).to.be.revertedWithCustomError(contrato, "OwnableUnauthorizedAccount");
    });
  });

  // ── Validações de estado ──────────────────────────────────────────────────
  describe("Validações de estado", function () {
    it("não cadastra o mesmo aluno duas vezes", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await expect(
        contrato.connect(orientador).cadastrarAluno(aluno1.address, "Duplicado")
      ).to.be.revertedWith("Aluno ja cadastrado");
    });

    it("não permite segunda submissão", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await contrato.connect(aluno1).submeterTCC(HASH_LEGITIMO);
      await expect(
        contrato.connect(aluno1).submeterTCC("outro-hash")
      ).to.be.revertedWith("Ja submetido");
    });

    it("não aprova antes de submissão", async function () {
      const { contrato, orientador, aluno1 } = await loadFixture(deployFixture);
      await contrato.connect(orientador).cadastrarAluno(aluno1.address, "Arthur Miura");
      await expect(
        contrato.connect(orientador).aprovarTCC(aluno1.address)
      ).to.be.revertedWith("Nao submetido");
    });
  });
});

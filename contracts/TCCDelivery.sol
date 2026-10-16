// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TCCDelivery
 * @author Arthur Naoto Miura (FEMA/IMESA 2026)
 * @notice Protótipo para gestão do fluxo de TCC via smart contract.
 *         Fluxo: orientador cadastra aluno → aluno submete hash SHA-256
 *         do arquivo → orientador aprova (emite NFT) ou rejeita.
 * @dev POC/MVP — para produção recomenda-se IPFS para metadados do NFT
 *      e carteira multisig (Gnosis Safe) para o owner.
 */
contract TCCDelivery is ERC721, Ownable {

    struct Aluno {
        string  nome;
        bool    podeSubmeter;
        string  hashTCC;      // Hash SHA-256 do arquivo (prova de integridade)
        bool    submetido;
        bool    aprovado;
        uint256 tokenId;      // ID do NFT emitido na aprovação
    }

    mapping(address => Aluno) public alunos;
    uint256 private nextTokenId = 1;

    event TCCSubmetido(address indexed aluno, string hashTCC);
    event TCCAprovado(address indexed aluno, uint256 tokenId);
    event TCCRejeitado(address indexed aluno);

    constructor() ERC721("CertificadoTCC", "TCC") Ownable(msg.sender) {}

    /// @notice Orientador cadastra um aluno habilitando-o a submeter o TCC.
    function cadastrarAluno(address aluno, string memory nome) external onlyOwner {
        require(!alunos[aluno].podeSubmeter, "Aluno ja cadastrado");
        alunos[aluno] = Aluno(nome, true, "", false, false, 0);
    }

    /// @notice Aluno submete o hash SHA-256 do arquivo do TCC.
    function submeterTCC(string memory hashTCC) external {
        Aluno storage a = alunos[msg.sender];
        require(a.podeSubmeter, "Aluno nao cadastrado");
        require(!a.submetido, "Ja submetido");
        a.hashTCC  = hashTCC;
        a.submetido = true;
        emit TCCSubmetido(msg.sender, hashTCC);
    }

    /// @notice Orientador aprova o TCC e emite o certificado como NFT.
    function aprovarTCC(address aluno) external onlyOwner {
        Aluno storage a = alunos[aluno];
        require(a.submetido,  "Nao submetido");
        require(!a.aprovado,  "Ja aprovado");
        a.aprovado = true;
        a.tokenId  = nextTokenId++;
        _safeMint(aluno, a.tokenId);
        emit TCCAprovado(aluno, a.tokenId);
    }

    /// @notice Orientador rejeita o TCC e bloqueia reenvio.
    function rejeitarTCC(address aluno) external onlyOwner {
        Aluno storage a = alunos[aluno];
        require(a.submetido,  "Nao submetido");
        require(!a.aprovado,  "Ja aprovado");
        a.podeSubmeter = false;
        emit TCCRejeitado(aluno);
    }

    /// @notice Consulta pública do status de um aluno (sem custo).
    function getStatus(address aluno) external view returns (Aluno memory) {
        return alunos[aluno];
    }
}

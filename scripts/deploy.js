const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying com a conta:", deployer.address);

  const TCCDelivery = await ethers.getContractFactory("TCCDelivery");
  const contrato    = await TCCDelivery.deploy();
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  const deploy   = contrato.deploymentTransaction();
  const receipt  = await deploy.wait();

  console.log("TCCDelivery deployed em:", endereco);
  console.log("Gas de implantação     :", receipt.gasUsed.toString(), "unidades");
  console.log("(TCC referência        : 1.656.424 unidades)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

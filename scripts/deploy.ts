import { ethers } from "hardhat";

async function main() {
  const destealth = await ethers.deployContract("DeezStealth", [], {
    value: 0,
  });

  await destealth.waitForDeployment();

  console.log(
    `DeezStealth deployed to ${destealth.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

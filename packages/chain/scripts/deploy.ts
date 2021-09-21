import hre, { ethers } from "hardhat";
import "@nomiclabs/hardhat-etherscan";
import chalk from "chalk";
import fs from "fs";
import { Contract } from "ethers";
import ProgressBar from "progress";

interface DeploymentObject {
  name: string;
  address: string;
  args: any;
  contract: Contract;
}

// custom `deploy` in order to make verifying easier
const deploy = async (contractName: string, _args: any[] = [], overrides = {}, libraries = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs: any = _args || [];
  const stringifiedArgs = JSON.stringify(contractArgs);
  const contractArtifacts = await ethers.getContractFactory(contractName,{libraries: libraries});
  const contract = await contractArtifacts.deploy(...contractArgs, overrides);
  const contractAddress = contract.address;
  fs.writeFileSync(`artifacts/${contractName}.address`, contractAddress);
  fs.writeFileSync(`artifacts/${contractName}.args`, stringifiedArgs);

  // tslint:disable-next-line: no-console
  console.log("Deploying", chalk.cyan(contractName), "contract to", chalk.magenta(contractAddress));

  await contract.deployed();

  const deployed: DeploymentObject = { name: contractName, address: contractAddress, args: contractArgs, contract };

  return deployed
}

const pause = (time: number) => new Promise(resolve => setTimeout(resolve, time));

const verifiableNetwork = ["mainnet", "ropsten", "rinkeby", "goerli", "kovan"];

async function main() {
  const network = process.env.HARDHAT_NETWORK === undefined ? "localhost" : process.env.HARDHAT_NETWORK;
  
  // tslint:disable-next-line: no-console
  console.log("🚀 Deploying to", chalk.magenta(network), "!");
  if(
    network === "localhost" || 
    network === "hardhat"
  ) {
    const [deployer] = await ethers.getSigners();

    // tslint:disable-next-line: no-console
    console.log(
      chalk.cyan("deploying contracts with the account:"),
      chalk.green(deployer.address)
    );

    // tslint:disable-next-line: no-console
    console.log("Account balance:", (await deployer.getBalance()).toString());
  }

  // this array stores the data for contract verification
  let contracts: DeploymentObject[] = [];

  // In order to set scripts for certain nets (rinkeby, mainnet), use the 
  // network variable. For example, if you want to set conditions that are 
  // only triggered in a mainnet deployment:
  // if(network === "mainnet"){
  //   // set logic here
  // }

  // See README in this directory for more detailed instructions about using this script!

  // In order to deploy, do NOT use the standard ethers.getContractFactory pattern - 
  //   the deploy() function will take care of that for you. Just follow the example
  //   with "Token" below.
  // The deploy() function returns a "DeploymentObject", a custom type that makes
  //   auto-verification easier. It contains the name, address, arguments, and Contract
  //   of the contract being deployed. It follows that if you'd want to include logic
  //   calling the mint function on the Token contract that you'd call `token.contact.mint()`

  // some notes on the deploy function: 
  //    - arguments should be passed in an array after the contract name
  //      args need to be formatted properly for verification to pass
  //      see: https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#complex-arguments
  //      example: await deploy("Token", ["Test", "TST"]);
  //    - custom ethers parameters like gasLimit go in an object after that
  //      EVEN IF THERE ARE NO ARGS (put an empty array for the args)
  //      example: await deploy("Token", [], { gasLimit: 300000 });
  //    - libraries can be added by address after that
  //      example: await deploy("Token", [], {}, { "SafeMath": "0x..."});

  let curve: DeploymentObject;
  let bzzToken: DeploymentObject;
  let mockDai: DeploymentObject;
  let ethBroker: DeploymentObject;

  switch(network) {
    case "mainnet":
      curve = await deploy("Curve", [
        process.env.BZZ_DEPLOYED_MAINNET,
        process.env.DAI_ADDRESS_MAINNET
      ]);
      contracts.push(curve);

      console.log("\nBonding curve deployed");

      await curve.contract.transferOwnership(process.env.OWNER_ADDRESS);

      console.log(">>>\tBZZ Curve deployed to mainnet\n\n" +
        "Please follow the below steps for a successful ecosystem setup:\n\n" + 
        "\t1. Add the BZZ Curve as a minter on the BZZ token\n\t" + 
        "2. Pre-minted at least the minimum number of tokens (62500000 1e16)\n\t" + 
        "3. Ensure the init address has sufficient collateral to initialise\n\t   (call `requiredCollateral` on the BZZ curve)\n\t" + 
        "4. Approve the BZZ curve as a spender of the required collateral amount\n\t" + 
        "5. Call the init function and the curve will be operational");

      break;

    case "goerli":
      mockDai = await deploy("Mock_dai", [
        process.env.COLLATERAL_TOKEN_NAME,
        process.env.COLLATERAL_TOKEN_SYMBOL,
        process.env.COLLATERAL_TOKEN_DECIMAL
      ]);
      contracts.push(mockDai);

      bzzToken = await deploy("Token", [
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMAL,
        process.env.TOKEN_CAP
      ]);
      contracts.push(bzzToken);

      curve = await deploy("Curve", [
        bzzToken.address,
        mockDai.address
      ]);
      contracts.push(curve);

      ethBroker = await deploy("Eth_broker", [
        curve.address,
        mockDai.address,
        process.env.ROUTER_ADDRESS_GOERLI
      ])

      await curve.contract.transferOwnership(process.env.OWNER_ADDRESS);

      console.log("\nOwnership transferred to owner address")

      await (await bzzToken.contract.addMinter(curve.address)).wait();

      console.log("\nCurve added as minter");

      // Minting the pre-mint tokens to the pre-mint owner
      await (await bzzToken.contract.mint(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("62500000", 16)
      )).wait();

      console.log("\nBZZ token pre-mint completed");

      let requiredCollateralDai = await curve.contract.requiredCollateral(
        ethers.utils.parseUnits("62500000", 16)
      );

      console.log("\nSuccessfully queried for required collateral amount");

      // This is the amount of required collateral for the curve
      await (await mockDai.contract.mint(
        requiredCollateralDai
      )).wait();

      console.log("\nRequired collateral has been minted");

      // Approving the curve as a spender of the required amount
      await (await mockDai.contract.approve(
        curve.address,
        requiredCollateralDai
      )).wait();

      console.log("\nCurve has been approved as spender for required collateral");

      // Minting mock DAI for tester
      await (await mockDai.contract.mint(ethers.utils.parseUnits("2000000", 18))).wait()
      // Transferring to tester
      await (await mockDai.contract.transfer(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()

      console.log("\nTester has been minted gDAI");

      // Initialising the curve 
      await (await curve.contract.init()).wait();

      console.log("\nCurve has been initialised");

      console.table([
        { Contract: "Token", Address: bzzToken.address },
        { Contract: "Mock Dai", Address: mockDai.address },
        { Contract: "Curve", Address: curve.address },
        { Contract: "Broker", Address: ethBroker.address }
      ]);

      break;

    default:
      mockDai = await deploy("Mock_dai", [
        process.env.COLLATERAL_TOKEN_NAME,
        process.env.COLLATERAL_TOKEN_SYMBOL,
        process.env.COLLATERAL_TOKEN_DECIMAL
      ]);
      contracts.push(mockDai);

      bzzToken = await deploy("Token", [
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMAL,
        process.env.TOKEN_CAP
      ]);
      contracts.push(bzzToken);

      curve = await deploy("Curve", [
        bzzToken.address,
        mockDai.address
      ]);
      contracts.push(curve);

      const router = await deploy("Mock_router", [
        "0xacDdD0dBa07959Be810f6cd29E41b127b29E4A8a"
      ]);
      contracts.push(router);

      ethBroker = await deploy("Eth_broker", [
        curve.address,
        mockDai.address,
        router.address
      ]);

      // Adding the curve as a minter on the token
      await (await bzzToken.contract.addMinter(curve.address)).wait();

      console.log("\nCurve added as minter");

      // Minting the pre-mint tokens to the pre-mint owner
      await (await bzzToken.contract.mint(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("62500000", 16)
      )).wait();

      console.log("\nBZZ token pre-mint completed");

      let requiredCollateral = await curve.contract.requiredCollateral(
        ethers.utils.parseUnits("62500000", 16)
      );

      console.log("\nSuccessfully queried for required collateral amount");

      // This is the amount of required collateral for the curve
      await (await mockDai.contract.mint(
        requiredCollateral
      )).wait();

      console.log("\nRequired collateral has been minted");

      // Approving the curve as a spender of the required amount
      await (await mockDai.contract.approve(
        curve.address,
        requiredCollateral
      )).wait();

      console.log("\nCurve has been approved as spender for required collateral");

      // Minting mock DAI for tester
      await (await mockDai.contract.mint(ethers.utils.parseUnits("2000000", 18))).wait()
      // Transfering to tester
      await (await mockDai.contract.transfer(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()

      console.log("\nTester has been minted test DAI");

      // Transferring to Mock Router
      await (await mockDai.contract.transfer(
        router.address,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()

      console.log("\nRouter has been pre-funded");

      await (await curve.contract.init()).wait();

      console.log("\nCurve has been initialised");

      console.table([
        { Contract: "Token", Address: bzzToken.address },
        { Contract: "Mock Dai", Address: mockDai.address },
        { Contract: "Curve", Address: curve.address },
        { Contract: "Router", Address: router.address },
        { Contract: "Broker", Address: ethBroker.address }
      ]);

      break;
  }

  // verification
  if(
    verifiableNetwork.includes(network)
    ) {
      let counter = 0;
      
      // tslint:disable-next-line: no-console
      console.log("Beginning Etherscan verification process...\n", 
        chalk.yellow(`WARNING: The process will wait two minutes for Etherscan \nto update their backend before commencing, please wait \nand do not stop the terminal process...`)
      );

      const bar = new ProgressBar('Etherscan update: [:bar] :percent :etas', { 
        total: 50,
        complete: '\u2588',
        incomplete: '\u2591',
      });
      // two minute timeout to let Etherscan update
      const timer = setInterval(() => {
        bar.tick();
        if(bar.complete) {
          clearInterval(timer);
        }
      }, 2300);

      await pause(120000);

      // there may be some issues with contracts using libraries 
      // if you experience problems, refer to https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#providing-libraries-from-a-script-or-task
      // tslint:disable-next-line: no-console
      console.log(chalk.cyan("\n🔍 Running Etherscan verification..."));
      
      await Promise.all(contracts.map(async contract => {
        // tslint:disable-next-line: no-console
        console.log(`Verifying ${contract.name}...`);
        try {
          await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: contract.args
          });
          // tslint:disable-next-line: no-console
          console.log(chalk.cyan(`✅ ${contract.name} verified!`));
        } catch (error) {
          // tslint:disable-next-line: no-console
          console.log(error);
        }
      }));

  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    // tslint:disable-next-line: no-console
    console.error(error);
    process.exit(1);
  });
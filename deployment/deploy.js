// env reader
require("dotenv").config();
// Tools
const helpers = require("./helper.js");
const etherlime = require("etherlime-lib");
const ethers = require("ethers");
// Contracts (Swarm Ecosystem)
const BzzToken = require("../build/Token.json");
const BzzCurve = require("../build/Curve.json");
const EthBroker = require("../build/Eth_broker.json");
// Contracts (Mocks for testing)
const MockDai = require("../build/Mock_dai.json");
const MockRouter = require("../build/Mock_router.json");

function delay(s) {
  return new Promise(r => setTimeout(r, s * 1000));
}

const defaultConfigs = {
  gasLimit: ethers.utils.parseUnits(process.env.GAS_LIMIT, 0),
  gasPrice: ethers.utils.parseUnits(process.env.GAS_PRICE, 0),
  chainId: 1,
	etherscanApiKey: ""
};

const deploy = async (network, secret) => {
  // RPC provider for deployment (network dependent)
  var RPC = null;
  // Deployer EOA wallet for deployment
  var deployer = null;
  // ethers provider
  var provider = null;
  // Contract instances (Swarm Ecosystem)
  var bzzTokenInstance = null;
  var bzzCurveInstance = null;
  var ethBrokerInstance = null;
  // Contract instances (Mocks for testing)
  var mockDaiInstance = null;
  var mockRouterInstance = null;
  // Variables for a neat deployment log
  var tokenContract = { Contract: "Token", Address: null };
  var curveContract = { Contract: "Curve", Address: null };
  var ethBrokerContract = { Contract: "ETH Broker", Address: null };
  var mockDaiContract = { Contract: "Mock Dai", Address: null, };

  /**
   * Switch case that will set up all the network dependant variables
   */
  switch(network) {
    case "local":
      // Overriding default config for local test net
			defaultConfigs.chainId = 1337;
			// Setting private key for this network
			secret = process.env.DEPLOYER_PRIVATE_KEY_LOCAL;
			// Setting the RPC
			RPC = 'http://localhost:8545/';
			// Setting up the deployer for local
			deployer = new etherlime.JSONRPCPrivateKeyDeployer(
				secret, 
				RPC, 
				defaultConfigs
			);
			// Setting up provider for network
			provider = new ethers.providers.JsonRpcProvider();
			// Setting up deployer ethers wallet
			deployerWallet = new ethers.Wallet(
				process.env.DEPLOYER_PRIVATE_KEY_LOCAL,
				provider
			);
      console.log("\n>>>\tDeploying to local network");
      break;
    case "rinkeby":
      // Overriding default config for rinkeby test net
			defaultConfigs.chainId = 4;
			// Setting private key for this network
			secret = process.env.DEPLOYER_PRIVATE_KEY_RINKEBY;
			// Setting the RPC
			// RPC = 'https://rinkeby.infura.io'
			RPC = `https:/rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`;
			// Setting up the deployer for rinkeby
			deployer = new etherlime.InfuraPrivateKeyDeployer(
				secret, 
				network, 
				process.env.INFURA_API_KEY, 
				defaultConfigs
			);
			// Setting up provider for network
			provider = new ethers.providers.InfuraProvider(
				network, 
				process.env.INFURA_API_KEY
			);
			// Setting up deployer ethers wallet
			deployerWallet = new ethers.Wallet(
				process.env.DEPLOYER_PRIVATE_KEY_RINKEBY,
				provider
      );
      console.log("\n>>>\tDeploying to rinkeby network");
      break;
    case "goerli":
      // Overriding default config for rinkeby test net
			defaultConfigs.chainId = 5;
			// Setting private key for this network
			secret = process.env.DEPLOYER_PRIVATE_KEY_GOERLI;
			// Setting the RPC
			// RPC = 'https://rinkeby.infura.io'
			RPC = `https:/goerli.infura.io/v3/${process.env.INFURA_API_KEY}`;
			// Setting up the deployer for rinkeby
			deployer = new etherlime.InfuraPrivateKeyDeployer(
				secret, 
				network, 
				process.env.INFURA_API_KEY, 
				defaultConfigs
			);
			// Setting up provider for network
			provider = new ethers.providers.InfuraProvider(
				network, 
				process.env.INFURA_API_KEY
			);
			// Setting up deployer ethers wallet
			deployerWallet = new ethers.Wallet(
				process.env.DEPLOYER_PRIVATE_KEY_GOERLI,
				provider
      );
      console.log("\n>>>\tDeploying to goerli network");
      break;
    case "mainnet":
      // Overriding default config for rinkeby test net
			defaultConfigs.chainId = 1;
			// Setting private key for this network
			secret = process.env.DEPLOYER_PRIVATE_KEY_MAINNET;
			// Setting the RPC
			RPC = `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
			// Setting the gas price for fast
			defaultConfigs.gasPrice = helpers._getGasPrice();
			// Setting up the deployer for rinkeby
			deployer = new etherlime.InfuraPrivateKeyDeployer(
				secret, 
				network, 
				process.env.INFURA_API_KEY, 
				defaultConfigs
			);
			// Setting up provider for network
			provider = new ethers.providers.InfuraProvider(
				network,
				process.env.INFURA_API_KEY
			);
			// Setting up deployer ethers wallet
			deployerWallet = new ethers.Wallet(
				process.env.DEPLOYER_PRIVATE_KEY_MAINNET,
				provider
      );
      console.log("\n>>>\tDeploying to main network");
			break;
    default:
      throw new Error("\n>>>\tInvalid or unsupported network");
  };

  /**
   * Deploying the smart contracts
   */
  switch(network) {
    case "mainnet":
      bzzCurveInstance = await deployer.deploy(
        BzzCurve,
        false,
        process.env.BZZ_DEPLOYED_MAINNET,
        process.env.DAI_ADDRESS_MAINNET
      );

      console.log("\nBonding curve deployed");

      await bzzCurveInstance.transferOwnership(process.env.OWNER_ADDRESS);

      console.log("\nOwnership transferred to owner address")

      tokenContract.Address = bzzCurveInstance.contract.address;

      console.log(">>>\tBZZ Curve deployed to mainnet\n\n" +
        "Please follow the below steps for a successful ecosystem setup:\n\n" + 
        "\t1. Add the BZZ Curve as a minter on the BZZ token\n\t" + 
        "2. Pre-minted at least the minimum number of tokens (62500000 1e16)\n\t" + 
        "3. Ensure the init address has sufficient collateral to initialise\n\t   (call `requiredCollateral` on the BZZ curve)\n\t" + 
        "4. Approve the BZZ curve as a spender of the required collateral amount\n\t" + 
        "5. Call the init function and the curve will be operational");

    // GOERLI DEPLOYMENT START //
  
    case "goerli":

      // Deploying the collateral mock
      mockDaiInstance = await deployer.deploy(
        MockDai,
        false,
        process.env.COLLATERAL_TOKEN_NAME,
        process.env.COLLATERAL_TOKEN_SYMBOL,
        process.env.COLLATERAL_TOKEN_DECIMAL
      );
      // Setting for print
      mockDaiContract.Address = mockDaiInstance.contract.address;

      bzzTokenInstance = await deployer.deploy(
        BzzToken,
        false,
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMAL,
        process.env.TOKEN_CAP
      );

      tokenContract.Address = bzzTokenInstance.contract.address;

      console.log("\Token deployed");

      bzzCurveInstance = await deployer.deploy(
        BzzCurve,
        false,
        bzzTokenInstance.contract.address,
        mockDaiInstance.contract.address
      );
      curveContract.Address = bzzTokenInstance.contract.address;

      console.log("\nBonding curve deployed");

      ethBrokerInstance = await deployer.deploy(
        EthBroker,
        false,
        bzzCurveInstance.contract.address,
        mockDaiInstance.contract.address,
        process.env.ROUTER_ADDRESS_GOERLI
      );
      // Setting up for print
      ethBrokerContract.Address = ethBrokerInstance.contract.address;

      console.log("\nETHBroker Deployed")

      await bzzCurveInstance.transferOwnership(process.env.OWNER_ADDRESS);

      console.log("\nOwnership transferred to owner address")

      tokenContract.Address = bzzCurveInstance.contract.address;

      await (await bzzTokenInstance.addMinter(bzzCurveInstance.contract.address)).wait();

      console.log("\nCurve added as minter");
      // Minting the pre-mint tokens to the pre-mint owner
      await (await bzzTokenInstance.mint(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("62500000", 16)
      )).wait();

      console.log("\nBZZ token pre-mint completed");
      // Getting the required collateral for the pre-mint tokens
      let requiredCollateralDai = await bzzCurveInstance.requiredCollateral(
        ethers.utils.parseUnits("62500000", 16)
      );
      console.log("\nSuccessfully queried for required collateral amount");

      // This is the amount of required collateral for the curve
      await (await mockDaiInstance.mint(
        requiredCollateralDai
      )).wait();
      console.log("\nRequired collateral has been minted");
      // Approving the curve as a spender of the required amount
      await (await mockDaiInstance.approve(
        bzzCurveInstance.contract.address,
        requiredCollateralDai
      )).wait();
      
      console.log("\nCurve has been approved as spender for required collateral");
      // Minting mock DAI for tester
      await (await mockDaiInstance.mint(ethers.utils.parseUnits("2000000", 18))).wait()
      // Transfering to tester
      await (await mockDaiInstance.transfer(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()
      console.log("\nTester has been minted gDAI")

      // Initialising the curve 
      await (await bzzCurveInstance.init()).wait();
      console.log("\nCurve has been initialised");
      
      console.table([
        tokenContract, 
        mockDaiContract, 
        curveContract, 
        ethBrokerContract
      ]);
      break;

  // GOERLI DEPLOYMENT END //
    default:
      // Deploying the token
      bzzTokenInstance = await deployer.deploy(
        BzzToken,
        false,
        process.env.TOKEN_NAME,
        process.env.TOKEN_SYMBOL,
        process.env.TOKEN_DECIMAL,
        process.env.TOKEN_CAP
      );
      // Setting for print
      tokenContract.Address = bzzTokenInstance.contract.address;
      // Deploying the collateral mock
      mockDaiInstance = await deployer.deploy(
        MockDai,
        false,
        process.env.COLLATERAL_TOKEN_NAME,
        process.env.COLLATERAL_TOKEN_SYMBOL,
        process.env.COLLATERAL_TOKEN_DECIMAL
      );
      // Setting for print
      mockDaiContract.Address = mockDaiInstance.contract.address;
      // Deploying the curve
      bzzCurveInstance = await deployer.deploy(
        BzzCurve,
        false,
        bzzTokenInstance.contract.address,
        mockDaiInstance.contract.address
      );
      // Setting for print
      curveContract.Address = bzzCurveInstance.contract.address;
      // Deploying the router mock
      mockRouterInstance = await deployer.deploy(
        MockRouter,
        false,
        "0xacDdD0dBa07959Be810f6cd29E41b127b29E4A8a"
      );
      // Deploying the ETH router
      ethBrokerInstance = await deployer.deploy(
        EthBroker,
        false,
        bzzCurveInstance.contract.address,
        mockDaiInstance.contract.address,
        mockRouterInstance.contract.address
      );
      // Setting up for print
      ethBrokerContract.Address = ethBrokerInstance.contract.address;
      // Adding the curve as a minter on the token
      await (await bzzTokenInstance.addMinter(bzzCurveInstance.contract.address)).wait();


      console.log("\nCurve added as minter");
      // Minting the pre-mint tokens to the pre-mint owner
      await (await bzzTokenInstance.mint(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("62500000", 16)
      )).wait();
      console.log("\nBZZ token pre-mint completed");
      // Getting the required collateral for the pre-mint tokens
      let requiredCollateral = await bzzCurveInstance.requiredCollateral(
        ethers.utils.parseUnits("62500000", 16)
      );
      console.log("\nSuccessfully queried for required collateral amount");
      // This is the amount of required collateral for the curve
      await (await mockDaiInstance.mint(
          requiredCollateral
      )).wait();
      console.log("\nRequired collateral has been minted");
      // Approving the curve as a spender of the required amount
      await (await mockDaiInstance.approve(
        bzzCurveInstance.contract.address,
        requiredCollateral
      )).wait();
      console.log("\nCurve has been approved as spender for required collateral");
      // Minting mock DAI for tester
      await (await mockDaiInstance.mint(ethers.utils.parseUnits("2000000", 18))).wait()
      // Transfering to tester
      await (await mockDaiInstance.transfer(
        process.env.ADDRESS_OF_TESTER,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()
      // Transferring to Mock Router
      await (await mockDaiInstance.transfer(
        mockRouterInstance.contract.address,
        ethers.utils.parseUnits("1000000", 18)
      )).wait()
      console.log("\nTester has been minted mock DAI")

      // Initialising the curve 
      await (await bzzCurveInstance.init()).wait();
      console.log("\nCurve has been initialised");
      
      console.table([
        tokenContract, 
        mockDaiContract, 
        curveContract, 
        ethBrokerContract
      ]);
      break;
  }
}

module.exports = {
  deploy,
};

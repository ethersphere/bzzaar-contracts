require("@nomiclabs/hardhat-waffle");
const hre = require("hardhat");
const { expect } = require("chai");
const {
    ethers,
    curve_test_abi,
    token_abi,
    mock_dai_abi,
    pre_mint_sequence,
    tokenSettings,
    test_settings
} = require("./settings.test.js");

describe("🧮 Curve Calculations Tests", () => {
    let investor;
    let owner;
    let user;
    let user_two;
    
    let deployer;
    let tokenInstance;
    let collateralInstance;
    let curveTestInstance;

    beforeEach(async () => {
      const accounts = await ethers.getSigners();
      owner = accounts[0];
      investor = accounts[1];
      user = accounts[2];
      user_two = accounts[3];

      const accountSlice = accounts.slice(4,19);
      const lossaEther = ethers.utils.parseEther("9999.99");
      for (let i = 0; i < accountSlice.length; i++) {
        await accountSlice[i].sendTransaction({ to: owner.address, value: lossaEther}) 
      }

      const tokenArtifacts = await ethers.getContractFactory("Token");
      tokenInstance = await tokenArtifacts.deploy(
        tokenSettings.bzz.name,
        tokenSettings.bzz.symbol,
        tokenSettings.bzz.decimals,
        tokenSettings.bzz.cap
      );

      const collateralArtifacts = await ethers.getContractFactory("Mock_dai");
      collateralInstance = await collateralArtifacts.deploy(
        tokenSettings.dai.name,
        tokenSettings.dai.symbol,
        tokenSettings.dai.decimals
      );
      
      const curveTestArtifacts = await ethers.getContractFactory("curve_test");
      curveTestInstance = await curveTestArtifacts.deploy(
        tokenInstance.address,
        collateralInstance.address
      );
    });

    describe('Curve pre-init tests', () => {
        /**
         * Testing that the cost for the pre-mint is consistent no matter where
         * you get the amount from (consistency between calculating functions)
         */
        it("Pre-mint cost consistent", async () => {
            // Getting the cost of the initial tokens through the mint function
            let buyCost = await curveTestInstance.mathMint(
                pre_mint_sequence.whole,
                0
            );
            // Getting the cost of the initial tokens through the init function
            let initialCost = await curveTestInstance.initializeCurve(
                pre_mint_sequence.whole
            );
            // Getting the primitive function for the initial supply (0)
            let primFuncAtZero = await curveTestInstance.primitiveFunction(0);
            // Getting the primitive function for the pre-mint supply
            let primFuncAtPreMint = await curveTestInstance.primitiveFunction(
                pre_mint_sequence.whole
            );
            // Testing expected behaviour
            expect(buyCost.toString()).to.equal(initialCost.toString());
            // assert.equal(
            //     buyCost.toString(),
            //     initialCost.toString(),
            //     "Init and mint function providing different costs"
            // );
            expect(buyCost.toString()).to.equal(primFuncAtPreMint.toString());
            // assert.equal(
            //     buyCost.toString(),
            //     primFuncAtPreMint.toString(),
            //     "Mint cost and primitive function return different results"
            // );
            expect(initialCost.toString()).to.equal(pre_mint_sequence.dai.cost);
            // assert.equal(
            //     initialCost.toString(),
            //     pre_mint_sequence.dai.cost,
            //     "Cost for curve init is incorrect"
            // );
            expect(primFuncAtZero.toString()).to.equal("0");
            // assert.equal(
            //     primFuncAtZero.toString(),
            //     0,
            //     "Prim function for 0 supply is non-zero"
            // );
        });
        /**
         * Testing that the price per token is never 0, even before the curve has
         * had it's pre-mint
         */
        it("Spot price before init", async () => {
            // Getting the price of one token before the curve has been initialized
            let spotPriceAtStart = await curveTestInstance.spotPrice(0);
            // Testing expected behaviour
            expect(spotPriceAtStart.toString()).to.not.equal("0");
            // assert.notEqual(
            //     spotPriceAtStart.toString(),
            //     0,
            //     "FATAL Price per token is 0"
            // );
            expect(spotPriceAtStart.toString()).to.equal("1");
            // assert.equal(
            //     spotPriceAtStart.toString(),
            //     1,
            //     "Price per token is not expected"
            // );
        });
    });

    describe('Curve post-init tests', () => {
        beforeEach(async () => {
            //------------------------------------------------------------------
            // Setting up the curve pre-mint
            // For the pre-mint tests please see the pre-mint test file
            //------------------------------------------------------------------

            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.connect(owner).mint(
                investor.address,
                pre_mint_sequence.whole
            )
            // Adding the curve as a minter on the token
            await tokenInstance.connect(owner).addMinter(
                curveTestInstance.address
            );
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveTestInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            // This is the amount of required collateral for the curve
            // 1 230 468 . 599 843 763 228 132 556
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.connect(owner).mint(
                requiredCollateral
            );
            // Approving the curve as a spender of the required amount
            await collateralInstance.connect(owner).approve(
                curveTestInstance.address,
                requiredCollateral
            );
            // Initialising the curve 
            await curveTestInstance.connect(owner).init();
        });
        /**
         * Testing the helper value is expected
         */
        it("Helper is correct", async () => {
            // Getting the helper
            let helper = await curveTestInstance.helper(pre_mint_sequence.whole);
            // Testing expected behaviour
            expect(helper.toString()).to.equal(test_settings.helper_value);
            // assert.equal(
            //     helper.toString(),
            //     test_settings.helper_value,
            //     "Helper value unexpected"
            // );
        });
        /**
         * Testing that after the curve has pre-minted that the price for each
         * token is expected
         */
        it("Price at start of curve", async () => {
            // Getting the cost of the initial tokens through the mint function
            let buyCost = await curveTestInstance.mathMint(
                test_settings.bzz.buyAmount,
                pre_mint_sequence.whole,
            );
            // Getting the primitive function for the initial supply (0)
            let primFuncAtZero = await curveTestInstance.primitiveFunction(
                pre_mint_sequence.whole
            );
            // Getting the primitive function for the pre-mint supply
            let primFuncAtPreMint = await curveTestInstance.primitiveFunction(
                test_settings.bzz.supply_at_buy
            );
            // Getting the price for one token at current supply
            let spotPricePostMint = await curveTestInstance.spotPrice(pre_mint_sequence.whole);
            // Testing expected behaviour
            expect(buyCost.toString()).to.equal(test_settings.dai.buyCost);
            // assert.equal(
            //     buyCost.toString(),
            //     test_settings.dai.buyCost,
            //     "Mint cost incorrect"
            // );
            expect(primFuncAtZero.toString()).to.equal(pre_mint_sequence.dai.cost);
            // assert.equal(
            //     primFuncAtZero.toString(),
            //     pre_mint_sequence.dai.cost,
            //     "Prim function for pre-buy incorrect"
            // );
            expect(primFuncAtPreMint.toString()).to.equal(test_settings.dai.curve_coll_at_prem);
            // assert.equal(
            //     primFuncAtPreMint.toString(),
            //     test_settings.dai.curve_coll_at_prem,
            //     "Prim function for post-buy incorrect"
            // );
            expect(spotPricePostMint.toString()).to.equal(test_settings.dai.one_cost);
            // assert.equal(
            //     spotPricePostMint.toString(),
            //     test_settings.dai.one_cost,
            //     "Start cost per token incorrect"
            // );
        });
        /**
         * Testing that after the curves pre-mint the sell price for each token
         * is expected
         */
        it("Withdraw reward at start", async () => {
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveTestInstance.buyPrice(test_settings.bzz.buyAmount);
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveTestInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            // Mints tokens
            await curveTestInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            let currentSupply = await tokenInstance.totalSupply();
            // Getting the cost of the initial tokens through the mint function
            let sellRewardWithdraw = await curveTestInstance.withdraw(
                test_settings.bzz.buyAmount,
                currentSupply,
            );
            // Testing expected behaviour
            expect(sellRewardWithdraw[0].toString()).to.equal(test_settings.dai.buyCost);
            // assert.equal(
            //     sellRewardWithdraw[0].toString(),
            //     test_settings.dai.buyCost,
            //     "Sell reward is incorrect"
            // );
        });
    });
});
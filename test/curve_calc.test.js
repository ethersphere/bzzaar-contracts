const {
    ethers,
    etherlime,
    curve_test_abi,
    token_abi,
    mock_dai_abi,
    pre_mint_sequence,
    tokenSettings,
    test_settings
} = require("./settings.test.js");

describe("🧮 Curve Calculations Tests", () => {
    let investor = accounts[0];
    let owner = accounts[1];
    let user = accounts[2];
    let user_two = accounts[3];

    let deployer;
    let tokenInstance;
    let collateralInstance;
    let curveTestInstance;

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);

        tokenInstance = await deployer.deploy(
            token_abi,
            false,
            tokenSettings.bzz.name,
            tokenSettings.bzz.symbol,
            tokenSettings.bzz.decimals,
            tokenSettings.bzz.cap
        );

        collateralInstance = await deployer.deploy(
            mock_dai_abi,
            false,
            tokenSettings.dai.name,
            tokenSettings.dai.symbol,
            tokenSettings.dai.decimals
        );

        curveTestInstance = await deployer.deploy(
            curve_test_abi,
            false,
            tokenInstance.contract.address,
            collateralInstance.contract.address,
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
            assert.equal(
                buyCost.toString(),
                initialCost.toString(),
                "Init and mint function providing different costs"
            );
            assert.equal(
                buyCost.toString(),
                primFuncAtPreMint.toString(),
                "Mint cost and primitive function return different results"
            );
            assert.equal(
                initialCost.toString(),
                pre_mint_sequence.dai.cost,
                "Cost for curve init is incorrect"
            );
            assert.equal(
                primFuncAtZero.toString(),
                0,
                "Prim function for 0 supply is non-zero"
            );
        });
        /**
         * Testing that the price per token is never 0, even before the curve has
         * had it's pre-mint
         */
        it("Spot price before init", async () => {
            // Getting the price of one token before the curve has been initialized
            let spotPriceAtStart = await curveTestInstance.spotPrice(0);
            // Testing expected behaviour
            assert.notEqual(
                spotPriceAtStart.toString(),
                0,
                "FATAL Price per token is 0"
            );
            assert.equal(
                spotPriceAtStart.toString(),
                1,
                "Price per token is not expected"
            );
        });
    });

    describe('Curve post-init tests', () => {
        beforeEach(async () => {
            //------------------------------------------------------------------
            // Setting up the curve pre-mint
            // For the pre-mint tests please see the pre-mint test file
            //------------------------------------------------------------------

            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.from(owner).mint(
                investor.signer.address,
                pre_mint_sequence.whole
            )
            // Adding the curve as a minter on the token
            await tokenInstance.from(owner).addMinter(
                curveTestInstance.contract.address
            );
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveTestInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            // This is the amount of required collateral for the curve
            // 1 230 468 . 599 843 763 228 132 556
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.from(owner).mint(
                requiredCollateral
            );
            // Approving the curve as a spender of the required amount
            await collateralInstance.from(owner).approve(
                curveTestInstance.contract.address,
                requiredCollateral
            );
            // Initialising the curve 
            await curveTestInstance.from(owner).init();
        });
        /**
         * Testing the helper value is expected
         */
        it("Helper is correct", async () => {
            // Getting the helper
            let helper = await curveTestInstance.helper(pre_mint_sequence.whole);
            // Testing expected behaviour
            assert.equal(
                helper.toString(),
                test_settings.helper_value,
                "Helper value unexpected"
            );
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
            assert.equal(
                buyCost.toString(),
                test_settings.dai.buyCost,
                "Mint cost incorrect"
            );
            assert.equal(
                primFuncAtZero.toString(),
                pre_mint_sequence.dai.cost,
                "Prim function for pre-buy incorrect"
            );
            assert.equal(
                primFuncAtPreMint.toString(),
                test_settings.dai.curve_coll_at_prem,
                "Prim function for post-buy incorrect"
            );
            assert.equal(
                spotPricePostMint.toString(),
                test_settings.dai.one_cost,
                "Start cost per token incorrect"
            );
        });
        /**
         * Testing that after the curves pre-mint the sell price for each token
         * is expected
         */
        it("Withdraw reward at start", async () => {
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveTestInstance.buyPrice(test_settings.bzz.buyAmount);
            // Approving the curve as a spender of collateral
            await collateralInstance.from(user).approve(
                curveTestInstance.contract.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.from(user).mint(buyCost);
            // Mints tokens
            await curveTestInstance.from(user).mint(
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
            assert.equal(
                sellRewardWithdraw[0].toString(),
                test_settings.dai.buyCost,
                "Sell reward is incorrect"
            );
        });
    });
});
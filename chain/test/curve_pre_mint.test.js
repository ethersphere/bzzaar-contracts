require("@nomiclabs/hardhat-waffle");
const hre = require("hardhat");
const { expect, assert  } = require("chai");
const { 
    ethers,
    curve_abi,
    token_abi,
    mock_dai_abi,
    pre_mint_sequence,
    tokenSettings,
    test_settings
 } = require("./settings.test.js");

 describe('🍃 Curve pre-mint tests', () => {
    let investor;
    let owner;
    let user;
    let user_two;

    let deployer;
    let tokenInstance;
    let curveInstance;
    let collateralInstance;

    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        investor = accounts[1];
        user = accounts[2];
        user_two = accounts[3];

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

        const curveArtifacts = await ethers.getContractFactory("Curve");
        curveInstance = await curveArtifacts.deploy(
            tokenInstance.address,
            collateralInstance.address
        );
    });

    describe('Curve initialisation tests', () => {
        /**
         * Testing the curves set up and connection to the token without the token
         * having minted anything (i.e a 0 `totalSupply()`).
         */
        it("Can't set up curve with less than expected pre-mint", async() => {
            let isOwnerMinterBefore = await tokenInstance.isMinter(owner.address);
            let isCurveMinterBefore = await tokenInstance.isMinter(
                curveInstance.address
            );
            let isCurveActiveBefore = await curveInstance.isCurveActive();
            // Adding the curve as a minter on the token
            await tokenInstance.connect(owner).addMinter(curveInstance.address);
            let isCurveMinter = await tokenInstance.isMinter(curveInstance.address);
            let requiredCollateral = await curveInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            // Initialising the curve (will fail without pre-mint)
            await expect(curveInstance.connect(user).init())
                .to.be.revertedWith(test_settings.errors.curve_requires_pre_mint);
            let isCurveActiveAfter = await curveInstance.isCurveActive();
            // Testing expected behaviour
            assert.equal(
                isOwnerMinterBefore,
                true,
                "Owner is not minter"
            );
            assert.equal(
                isCurveMinterBefore,
                false,
                "Curve is minter before being set"
            );
            assert.equal(
                isCurveActiveBefore,
                false,
                "Curve is active before activation"
            );
            assert.equal(
                isCurveMinter,
                true,
                "Curve is not minter after being set"
            );
            assert.equal(
                requiredCollateral.toString(),
                pre_mint_sequence.dai.cost,
                "Required collateral is incorrect"
            );
            assert.equal(
                isCurveActiveAfter,
                false,
                "Curve is active after incorrect activation"
            );
        });
        /**
         * Testing the curves set up and connection to the token with the expected
         * pre-mint amount of tokens minted. 
         */
        it("Curve set up with pre-mint (exact)", async() => {
            let investorBalanceBeforeMint = await tokenInstance.balanceOf(
                investor.address
            );
            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.connect(owner).mint(
                investor.address,
                pre_mint_sequence.whole
            );
            let investorBalanceAfterMint = await tokenInstance.balanceOf(
                investor.address
            );
            // Adding the curve as a minter on the token
            await tokenInstance.connect(owner).addMinter(curveInstance.address);
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            
            let ownerBalanceBefore = await collateralInstance.balanceOf(owner.address);
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.connect(owner).mint(
                requiredCollateral
            );
            let ownerBalanceAfter = await collateralInstance.balanceOf(owner.address);
            // Approving the curve as a spender of the required amount
            await collateralInstance.connect(owner).approve(
                curveInstance.address,
                requiredCollateral
            );
            let isCurveActiveBefore = await curveInstance.isCurveActive();
            // Initialising the curve 
            await curveInstance.connect(owner).init();
            let isCurveActiveAfter = await curveInstance.isCurveActive();
            let startingPrice = await curveInstance.buyPrice(
                test_settings.bzz.one
            );
            // Testing expected behaviour
            assert.equal(
                investorBalanceBeforeMint.toString(),
                0,
                "Pre-mine has balance before pre-mine"
            );
            assert.equal(
                investorBalanceAfterMint.toString(),
                pre_mint_sequence.whole.toString(),
                "Pre-mine does not have balance after pre-mine"
            );
            assert.equal(
                requiredCollateral.toString(),
                pre_mint_sequence.dai.cost,
                "Pre-mine does not cost expected amount"
            );
            assert.equal(
                ownerBalanceBefore.toString(),
                0,
                "Owner has collateral balance before mint"
            );
            assert.equal(
                ownerBalanceAfter.toString(),
                requiredCollateral.toString(),
                "Owner has incorrect collateral balance after mint"
            );
            assert.equal(
                isCurveActiveBefore,
                false,
                "Curve is active before activation"
            );
            assert.equal(
                isCurveActiveAfter,
                true,
                "Curve is not active after activation"
            );
            assert.equal(
                startingPrice.toString(),
                test_settings.dai.firstOneCost,
                "Starting price for token after pre-sale incorrect"
            );
        });
        /**
         * Testing the curves set up and connection to the token with more than the 
         * expected pre-mint amount of tokens minted. 
         */
        it("Curve set up with pre-mint (above expected)", async() => {
            let investorBalanceBeforeMint = await tokenInstance.balanceOf(
                investor.address
            );
            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.connect(owner).mint(
                investor.address,
                pre_mint_sequence.above_expected
            );
            let investorBalanceAfterMint = await tokenInstance.balanceOf(
                investor.address
            );
            // Adding the curve as a minter on the token
            await tokenInstance.connect(owner).addMinter(curveInstance.address);
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveInstance.requiredCollateral(
                pre_mint_sequence.above_expected
            );
            let ownerBalanceBefore = await collateralInstance.balanceOf(owner.address);
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.connect(owner).mint(
                requiredCollateral
            );
            let ownerBalanceAfter = await collateralInstance.balanceOf(owner.address);
            // Approving the curve as a spender of the required amount
            await collateralInstance.connect(owner).approve(
                curveInstance.address,
                requiredCollateral
            );
            let isCurveActiveBefore = await curveInstance.isCurveActive();
            // Initialising the curve 
            await curveInstance.connect(owner).init();
            let isCurveActiveAfter = await curveInstance.isCurveActive();
            let startingPrice = await curveInstance.buyPrice(
                test_settings.bzz.one
            );
            // Testing expected behaviour
            assert.equal(
                investorBalanceBeforeMint.toString(),
                0,
                "Pre-mine has balance before pre-mine"
            );
            assert.equal(
                investorBalanceAfterMint.toString(),
                pre_mint_sequence.above_expected.toString(),
                "Pre-mine does not have balance after pre-mine"
            );
            assert.equal(
                requiredCollateral.toString(),
                pre_mint_sequence.dai.above_expected_cost,
                "Pre-mine does not cost expected amount"
            );
            assert.equal(
                ownerBalanceBefore.toString(),
                0,
                "Owner has collateral balance before mint"
            );
            assert.equal(
                ownerBalanceAfter.toString(),
                requiredCollateral.toString(),
                "Owner has incorrect collateral balance after mint"
            );
            assert.equal(
                isCurveActiveBefore,
                false,
                "Curve is active before activation"
            );
            assert.equal(
                isCurveActiveAfter,
                true,
                "Curve is not active after activation"
            );
            assert.equal(
                startingPrice.toString(),
                test_settings.dai.above_expected_firstOneCost,
                "Starting price for token after pre-sale incorrect"
            );
        });
        /**
         * Testing the ability to buy tokens (basic test)
         */
        it("Can buy tokens", async() => {
            // Setting up curve
            //------------------------------------------------------------------
                // Minting the pre-mint tokens to the pre-mint owner
                await tokenInstance.connect(owner).mint(
                    investor.address,
                    pre_mint_sequence.whole
                );
                // Adding the curve as a minter on the token
                await tokenInstance.connect(owner).addMinter(curveInstance.address);
                // Getting the required collateral for the pre-mint tokens
                let requiredCollateral = await curveInstance.requiredCollateral(
                    pre_mint_sequence.whole
                );
                // The owner is minting the required number of tokens in collateral (DAI)
                await collateralInstance.connect(owner).mint(
                    requiredCollateral
                );
                // Approving the curve as a spender of the required amount
                await collateralInstance.connect(owner).approve(
                    curveInstance.address,
                    requiredCollateral
                );
                // Initialising the curve 
                await curveInstance.connect(owner).init();
            //------------------------------------------------------------------
            // Minting testing
            //------------------------------------------------------------------
            let userCollateralBalanceBefore = await collateralInstance.balanceOf(
                user.address
            );
            // Getting buy cost for buying `buyAmount` (see settings.test.js)
            let buyCost = await curveInstance.buyPrice(
                test_settings.bzz.buyAmount
            );
            // User minting collateral tokens
            await collateralInstance.connect(user).mint(
                buyCost
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            // User approves the curve as a spender of the collateral token (DAI)
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            let curveAllowance = await collateralInstance.allowance(
                user.address,
                curveInstance.address
            );
            let userTokenBalanceBefore = await tokenInstance.balanceOf(user.address);
            // User mints tokens from the curve
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(user.address);
            let userCollateralBalanceAfterMint = await collateralInstance.balanceOf(
                user.address
            );
            // Testing expected behaviour
            assert.equal(
                userCollateralBalanceBefore.toString(),
                0,
                "User has incorrect collateral balance before mint"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                test_settings.dai.buyCost,
                "User has incorrect collateral balance after mint"
            );
            assert.equal(
                curveAllowance.toString(),
                test_settings.dai.buyCost,
                "Curve has incorrect allowance on user"
            );
            assert.equal(
                userTokenBalanceBefore.toString(),
                0,
                "User has incorrect token balance before mint"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User has incorrect token balance after mint"
            );
            assert.equal(
                userCollateralBalanceAfterMint.toString(),
                0,
                "User has incorrect collateral balance after minting tokens"
            );
        });
        /**
         * Testing the ability to sell tokens (basic test)
         */
        it("Can sell tokens", async() => {
            // Setting up curve
            //------------------------------------------------------------------
                // Minting the pre-mint tokens to the pre-mint owner
                await tokenInstance.connect(owner).mint(
                    investor.address,
                    pre_mint_sequence.whole
                );
                // Adding the curve as a minter on the token
                await tokenInstance.connect(owner).addMinter(curveInstance.address);
                // Getting the required collateral for the pre-mint tokens
                let requiredCollateral = await curveInstance.requiredCollateral(
                    pre_mint_sequence.whole
                );
                // The owner is minting the required number of tokens in collateral (DAI)
                await collateralInstance.connect(owner).mint(
                    requiredCollateral
                );
                // Approving the curve as a spender of the required amount
                await collateralInstance.connect(owner).approve(
                    curveInstance.address,
                    requiredCollateral
                );
                // Initialising the curve 
                await curveInstance.connect(owner).init();
            //------------------------------------------------------------------
            // Minting
            //------------------------------------------------------------------
                // Getting buy cost for buying `buyAmount` (see settings.test.js)
                let buyCost = await curveInstance.buyPrice(
                    test_settings.bzz.buyAmount
                );
                // User minting collateral tokens
                await collateralInstance.connect(user).mint(
                    buyCost
                );
                // User approves the curve as a spender of the collateral token (DAI)
                await collateralInstance.connect(user).approve(
                    curveInstance.address,
                    buyCost
                );
                // User mints tokens from the curve
                await curveInstance.connect(user).mint(
                    test_settings.bzz.buyAmount,
                    buyCost
                );
                let userCollateralBalanceBefore = await collateralInstance.balanceOf(
                    user.address
                );
                let userTokenBalanceBefore = await tokenInstance.balanceOf(
                    user.address
                );
            //------------------------------------------------------------------
            // Burning testing 
            //------------------------------------------------------------------
            let sellReward = await curveInstance.sellReward(test_settings.bzz.sellAmount);
            // Approving the curve to spend the sell amount of tokens
            await tokenInstance.connect(user).approve(
                curveInstance.address,
                test_settings.bzz.buyAmount
            );
            let balanceOfCurve = await collateralInstance.balanceOf(
                curveInstance.address
            );
            // User burns half the tokens they bought
            await curveInstance.connect(user).redeem(
                test_settings.bzz.sellAmount,
                sellReward
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            let balanceOfCurveAfter = await collateralInstance.balanceOf(
                curveInstance.address
            );
            // Testing expected behaviour
            assert.equal(
                userCollateralBalanceBefore.toString(),
                0,
                "User has collateral after buying tokens"
            );
            assert.equal(
                sellReward.toString(),
                test_settings.dai.sellReward,
                "Sell reward is incorrect"
            );
            assert.equal(
                balanceOfCurve.toString(),
                test_settings.dai.curve_collateral_after_buy,
                "Collateral owned by curve is incorrect"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                test_settings.dai.sellReward,
                "User collateral balance incorrect after sell"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.sellAmount.toString(),
                "User token balance is incorrect"
            );
            assert.equal(
                balanceOfCurveAfter.toString(),
                test_settings.dai.curve_collateral_after_sell,
                "Curve collateral balance incorrect after sell"
            );
        });
        /**
         * Tests that the curve cannot be initialized multiple times
         */
        it("Cannot double initialize", async() => {
            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.connect(owner).mint(
                investor.address,
                pre_mint_sequence.whole
            );
            // Adding the curve as a minter on the token
            await tokenInstance.connect(owner).addMinter(curveInstance.address);
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.connect(owner).mint(
                requiredCollateral
            );
            // Approving the curve as a spender of the required amount
            await collateralInstance.connect(owner).approve(
                curveInstance.address,
                requiredCollateral
            );
            // Initialising the curve 
            await curveInstance.connect(owner).init();
            // Testing expected behaviour
            await expect(curveInstance.connect(owner).init())
                .to.be.revertedWith(test_settings.errors.init);
       });
       /**
        * Tests that the curve cannot be initialized if the curve has 
        * not been given minter rights on the token
        */
       it.only("Cannot initialize if curve is not minter", async() => {
            // Minting the pre-mint tokens to the pre-mint owner
            await tokenInstance.connect(owner).mint(
                investor.address,
                pre_mint_sequence.whole
            );
            // Getting the required collateral for the pre-mint tokens
            let requiredCollateral = await curveInstance.requiredCollateral(
                pre_mint_sequence.whole
            );
            // The owner is minting the required number of tokens in collateral (DAI)
            await collateralInstance.connect(owner).mint(
                requiredCollateral
            );
            // Approving the curve as a spender of the required amount
            await collateralInstance.connect(owner).approve(
                curveInstance.address,
                requiredCollateral
            );
            // Testing expected behaviour
            await expect(curveInstance.connect(owner).init())
                .to.be.revertedWith(test_settings.errors.minter_approval);
        });
    });
});


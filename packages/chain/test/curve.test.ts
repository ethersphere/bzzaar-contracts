import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, assert } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { 
    pre_mint_sequence,
    tokenSettings,
    test_settings
 } from "./settings.test";

 describe('📈 Curve tests', () => {
    let investor: SignerWithAddress;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let user_two: SignerWithAddress;

    let tokenInstance: Contract;
    let curveInstance: Contract;
    let collateralInstance: Contract;

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
        await tokenInstance.connect(owner).addMinter(curveInstance.address);
        // Getting the required collateral for the pre-mint tokens
        let requiredCollateral = await curveInstance.requiredCollateral(
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
            curveInstance.address,
            requiredCollateral
        );
        // Initialising the curve 
        await curveInstance.connect(owner).init();
    });

    describe('Curve pre-mint collateral tests', () => {
        /**
         * Can sell tokens back down the curve after the collateral back fill
         */
        it("Pre-mint can sell down curve (partial)", async() => {
            let investorCollateralBalance = await collateralInstance.balanceOf(
                investor.address
            );
            let investorTokenBalance = await tokenInstance.balanceOf(
                investor.address
            );
            // Approving the curve as a spender of tokens
            await tokenInstance.connect(investor).approve(
                curveInstance.address,
                test_settings.bzz.sellAmount
            );
            let rewardForBurn = await curveInstance.sellReward(test_settings.bzz.sellAmount);
            // Selling the tokens against the curve
            await curveInstance.connect(investor).redeem(
                test_settings.bzz.sellAmount,
                rewardForBurn
            );
            let investorCollateralBalanceAfter = await collateralInstance.balanceOf(
                investor.address
            );
            let investorTokenBalanceAfter = await tokenInstance.balanceOf(
                investor.address
            );
            // Testing expected behaviour
            assert.equal(
                investorCollateralBalance.toString(),
                0,
                "Investor has incorrect collateral balance before burn"
            );
            assert.equal(
                investorTokenBalance.toString(),
                pre_mint_sequence.whole.toString(),
                "Investor has incorrect token balance before burn"
            );
            assert.equal(
                rewardForBurn.toString(),
                test_settings.dai.sellReward_preMint,
                "Reward for burn incorrect"
            );
            assert.equal(
                investorCollateralBalanceAfter.toString(),
                test_settings.dai.sellReward_preMint,
                "Reward for burn incorrect, collateral balance incorrect"
            );
            assert.equal(
                investorTokenBalanceAfter.toString(),
                test_settings.bzz.preMint_tokenBalance,
                "Investor has incorrect token balance after burn"
            );
        });
        /**
         * The curve can handle almost all of the tokens in the curve being sold.
         * Note that the curve requires there to be at least 1 "cent" (0.1e16) to
         * be left in the curve
         */
        it("Pre-mint can sell down curve (almost whole pre-mint)", async() => {
            let investorCollateralBalance = await collateralInstance.balanceOf(
                investor.address
            );
            let investorTokenBalance = await tokenInstance.balanceOf(
                investor.address
            );
            // Approving the curve as a spender of tokens
            await tokenInstance.connect(investor).approve(
                curveInstance.address,
                pre_mint_sequence.almost_whole
            );
            let rewardForBurn = await curveInstance.sellReward(test_settings.bzz.sellAmount);
            // Selling the tokens against the curve
            await curveInstance.connect(investor).redeem(
                pre_mint_sequence.almost_whole,
                rewardForBurn
            );
            let investorCollateralBalanceAfter = await collateralInstance.balanceOf(
                investor.address
            );
            let investorTokenBalanceAfter = await tokenInstance.balanceOf(
                investor.address
            );
            // Testing expected behaviour
            assert.equal(
                investorCollateralBalance.toString(),
                0,
                "Investor has incorrect collateral balance before burn"
            );
            assert.equal(
                investorTokenBalance.toString(),
                pre_mint_sequence.whole.toString(),
                "Investor has incorrect token balance before burn"
            );
            assert.equal(
                rewardForBurn.toString(),
                pre_mint_sequence.dai.almost_whole_cost,
                "Reward for burn incorrect"
            );
            assert.equal(
                investorCollateralBalanceAfter.toString(),
                pre_mint_sequence.dai.balance_after_burn,
                "Reward for burn incorrect, collateral balance incorrect"
            );
            assert.equal(
                investorTokenBalanceAfter.toString(),
                pre_mint_sequence.token_balance_after_burn,
                "Investor has incorrect token balance after burn"
            );
        });
        /**
         * After the curve has been initialized with the collateral for the pre-mint
         * the curve can handle "sliding" back into the pre-mint price range
         */
        it("Price can slide back to pre-mint supply", async() => {
            // Approving the curve as a spender of tokens
            await tokenInstance.connect(investor).approve(
                curveInstance.address,
                test_settings.bzz.sellAmount
            );
            let rewardForBurn = await curveInstance.sellReward(test_settings.bzz.sellAmount);
            // Selling the tokens against the curve
            await curveInstance.connect(investor).redeem(
                test_settings.bzz.sellAmount,
                rewardForBurn
            );
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            // Buying the tokens at the expected price
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            // Testing expected behaviour
            assert.equal(
                buyCost.toString(),
                test_settings.dai.buy_cost_pre_mint,
                "Buy cost is unexpected"
            );
            assert.equal(
                userCollateralBalance.toString(),
                buyCost.toString(),
                "User collateral balance unexpected"
            );
            assert.equal(
                userTokenBalance.toString(),
                0,
                "User token balance unexpected"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                0,
                "User collateral balance after mint unexpected"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User token balance after mint unexpected"
            );
        });
    });

    describe('Curve slippage tests', () => {
        /**
         * Tests that slippage guard on buying tokens works as expected (i.e
         * the max spend amount will revert if not met)
         */
        it("Price cannot exceed max spend (buy)", async() => {
            //------------------------------------------------------------------
            // User minting set up
            //------------------------------------------------------------------
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            //------------------------------------------------------------------
            // User 2 creates slippage
            //------------------------------------------------------------------
            let userTwoTokenBalance = await tokenInstance.balanceOf(
                user_two.address
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user_two).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user_two).mint(buyCost);
            let userTwoCollateralBalance = await collateralInstance.balanceOf(
                user_two.address
            );
            // Mints tokens
            await curveInstance.connect(user_two).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            //------------------------------------------------------------------
            // User mint fails
            //------------------------------------------------------------------
            // Buying the tokens at the expected price
            await expect(curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            )).to.be.revertedWith(test_settings.errors.max_spend);

            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            let userTwoCollateralBalanceAfter = await collateralInstance.balanceOf(
                user_two.address
            );
            let userTwoTokenBalanceAfter = await tokenInstance.balanceOf(
                user_two.address
            );
            // Testing expected behaviour
            assert.equal(
                buyCost.toString(),
                test_settings.dai.buyCost,
                "Buy cost unexpected"
            );
            assert.equal(
                userTokenBalance.toString(),
                0,
                "User token balance non-zero at start"
            );
            assert.equal(
                userCollateralBalance.toString(),
                test_settings.dai.buyCost,
                "User collateral balance unexpected after mint"
            );
            assert.equal(
                userTwoTokenBalance.toString(),
                0,
                "User 2 token balance non-zero at start"
            );
            assert.equal(
                userTwoCollateralBalance.toString(),
                test_settings.dai.buyCost,
                "User two collateral balance unexpected after mint"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                test_settings.dai.buyCost,
                "User balance incorrectly changed after failing buy"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                0,
                "User token balance increased after failing buy"
            );
            assert.equal(
                userTwoCollateralBalanceAfter.toString(),
                0,
                "User two collateral balance non-zero after buying tokens"
            );
            assert.equal(
                userTwoTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User 2 token balance incorrect after buy"
            );
        });
        /**
         * Tests that slippage guard on selling tokens works as expected (i.e
         * the min sell reward will revert if not met)
         */
        it("Price cannot exceed max spend (sell)", async() => {
            //------------------------------------------------------------------
            // User mints tokens
            //------------------------------------------------------------------
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            // Mints tokens
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            //------------------------------------------------------------------
            // User 2 mints tokens
            //------------------------------------------------------------------
            buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            let userTwoTokenBalance = await tokenInstance.balanceOf(
                user_two.address
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user_two).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user_two).mint(buyCost);
            let userTwoCollateralBalance = await collateralInstance.balanceOf(
                user_two.address
            );
            // Mints tokens
            await curveInstance.connect(user_two).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            //------------------------------------------------------------------
            // User 2 creates sell slippage tokens
            //------------------------------------------------------------------
            let rewardForSell = await curveInstance.sellReward(
                test_settings.bzz.sellAmount
            );
            // Approving the curve as a spender of tokens
            await tokenInstance.connect(user_two).approve(
                curveInstance.address,
                test_settings.bzz.sellAmount
            );
            // User 2 sells tokens
            await curveInstance.connect(user_two).redeem(
                test_settings.bzz.sellAmount,
                rewardForSell
            );
            let userTwoTokenBalanceAfter = await tokenInstance.balanceOf(
                user_two.address
            );
            let userTwoCollateralBalanceAfter = await collateralInstance.balanceOf(
                user_two.address
            );
            //------------------------------------------------------------------
            // User sell fails
            //------------------------------------------------------------------
            // Approving the curve as a spender of tokens
            await tokenInstance.connect(user).approve(
                curveInstance.address,
                test_settings.bzz.sellAmount
            );
            // Selling the tokens at the expected price
            await expect(curveInstance.connect(user).redeem(
                test_settings.bzz.sellAmount,
                rewardForSell
            )).to.be.revertedWith(test_settings.errors.min_reward);
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            // Testing expected behaviour
            assert.equal(
                rewardForSell.toString(),
                test_settings.dai.sellReward_doubleMint,
                "Sell reward unexpected"
            );
            assert.equal(
                userTokenBalance.toString(),
                0,
                "User token balance non-zero at start"
            );
            assert.equal(
                userCollateralBalance.toString(),
                test_settings.dai.buyCost,
                "User collateral balance unexpected after mint"
            );
            assert.equal(
                userTwoTokenBalance.toString(),
                0,
                "User 2 token balance non-zero at start"
            );
            assert.equal(
                userTwoCollateralBalance.toString(),
                test_settings.dai.user_two_collateral,
                "User two collateral balance unexpected after mint"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                0,
                "User balance incorrectly changed after buy"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User token balance incorrectly changed after buy"
            );
            assert.equal(
                userTwoCollateralBalanceAfter.toString(),
                test_settings.dai.sellReward_doubleMint,
                "User two collateral balance non-zero after buying tokens"
            );
            assert.equal(
                userTwoTokenBalanceAfter.toString(),
                test_settings.bzz.sellAmount.toString(),
                "User 2 token balance incorrect after buy"
            );
        });
    });

    describe('Curve calculations tests', () => {
        /**
         * Cannot buy a "cent" token for 0 collateral
         */
        it("Cannot buy for 0", async() => {
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.one_token);
            // Testing expected behaviour
            assert.notEqual(
                buyCost.toString(),
                0,
                "Buy cost of 1 decimal token is 0"
            );
            assert.equal(
                buyCost.toString(),
                test_settings.dai.one_cost,
                "Buy cost is unexpected"
            );
        });
        /**
         * Ensuring the curve balance is correct with token buys
         */
        it("Tokens correctly minted on buy", async() => {
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            let curveCollateralBalance = await collateralInstance.balanceOf(
                curveInstance.address
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            // Mints tokens
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            let curveCollateralBalanceAfter = await collateralInstance.balanceOf(
                curveInstance.address
            );
            // Testing expected behaviour
            assert.equal(
                userTokenBalance.toString(),
                0,
                "User token balance is non-zero"
            );
            assert.equal(
                curveCollateralBalance.toString(),
                pre_mint_sequence.dai.cost,
                "Curve collateral balance starts incorrectly"
            );
            assert.equal(
                userCollateralBalance.toString(),
                test_settings.dai.buyCost,
                "User collateral balance incorrect after buy"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                0,
                "User collateral balance incorrect after buy"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User token balance incorrect after buy"
            );
            assert.equal(
                curveCollateralBalanceAfter.toString(),
                test_settings.dai.curve_collateral_after_buy,
                "Curve balance after buy incorrect"
            );
        });
        /**
         * Ensuring the curve balance is correct with token buys using mintTo
         */
        it("Tokens correctly minted on mintTo buy", async() => {
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            let curveCollateralBalance = await collateralInstance.balanceOf(
                curveInstance.address
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            let userReceiverTokenBalance = await tokenInstance.balanceOf(
                user_two.address
            );
            let userReceiverCollateralBalance = await collateralInstance.balanceOf(
                user_two.address
            );
            // Mints tokens
            await curveInstance.connect(user).mintTo(
                test_settings.bzz.buyAmount,
                buyCost,
                user_two.address
            );
            let userCollateralBalanceAfter = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );
            let curveCollateralBalanceAfter = await collateralInstance.balanceOf(
                curveInstance.address
            );
            let userReceiverTokenBalanceAfter = await tokenInstance.balanceOf(
                user_two.address
            );
            let userReceiverCollateralBalanceAfter = await collateralInstance.balanceOf(
                user_two.address
            );
            // Testing expected behaviour
            assert.equal(
                userReceiverTokenBalance.toString(),
                0,
                "Receiver User token balance is non-zero"
            );
            assert.equal(
                userReceiverCollateralBalance.toString(),
                0,
                "Receiver User token balance is non-zero"
            );
            assert.equal(
                userTokenBalance.toString(),
                0,
                "User token balance is non-zero"
            );
            assert.equal(
                curveCollateralBalance.toString(),
                pre_mint_sequence.dai.cost,
                "Curve collateral balance starts incorrectly"
            );
            assert.equal(
                userCollateralBalance.toString(),
                test_settings.dai.buyCost,
                "User collateral balance incorrect after buy"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                0,
                "User collateral balance incorrect after buy"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                0,
                "User token balance incorrect after buy"
            );
            assert.equal(
                userReceiverCollateralBalanceAfter.toString(),
                0,
                "Receiver User token balance incorrect after buy"
            );
            assert.equal(
                userReceiverTokenBalanceAfter.toString(),
                test_settings.bzz.buyAmount.toString(),
                "Receiver User token balance incorrect after buy"
            );
            assert.equal(
                curveCollateralBalanceAfter.toString(),
                test_settings.dai.curve_collateral_after_buy,
                "Curve balance after buy incorrect"
            );
        });
        /**
         * Cannot sell a "cent" token for 0 collateral
         */
        it("Cannot sell for 0", async() => {
            let sellReward = await curveInstance.sellReward(test_settings.bzz.one_token);
            // Testing expected behaviour
            assert.notEqual(
                sellReward.toString(),
                0,
                "Sell reward of 1 decimal token is 0"
            );
            assert.equal(
                sellReward.toString(),
                test_settings.dai.one_cost,
                "Sell reward is unexpected"
            );
        });
        /**
         * Tests that the balances change correctly after burn
         */
        it("Tokens correctly burnt on sell", async() => {
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            // Mints tokens
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            let userCollateralBalance = await collateralInstance.balanceOf(
                user.address
            );
            let userTokenBalance = await tokenInstance.balanceOf(
                user.address
            );
            let curveCollateralBalance = await collateralInstance.balanceOf(
                curveInstance.address
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
            // User burns half the tokens they bought
            await curveInstance.connect(user).redeem(
                test_settings.bzz.sellAmount,
                sellReward
            );
            let balanceOfCurve = await collateralInstance.balanceOf(
                curveInstance.address
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
                userCollateralBalance.toString(),
                0,
                "User collateral balance is non-zero"
            );
            assert.equal(
                userTokenBalance.toString(),
                test_settings.bzz.buyAmount.toString(),
                "User token balance incorrect after mint"
            );
            assert.equal(
                curveCollateralBalance.toString(),
                test_settings.dai.curve_collateral_after_buy,
                "Curve balance incorrect"
            );
            assert.equal(
                balanceOfCurve.toString(),
                test_settings.dai.curve_collateral_after_sell,
                "Balance of curve after burn incorrect"
            );
            assert.equal(
                userCollateralBalanceAfter.toString(),
                test_settings.dai.sellReward,
                "User collateral balance after burn incorrect"
            );
            assert.equal(
                userTokenBalanceAfter.toString(),
                test_settings.bzz.sellAmount,
                "User balance after sell incorrect"
            );
            assert.equal(
                balanceOfCurveAfter.toString(),
                test_settings.dai.curve_collateral_after_sell,
                "Curve balance after burn incorrect"
            );
        });
        /**
         * Testing that the open market price is as expected
         */
        it("Open market price correct", async() => {
            let buyCost = await curveInstance.buyPrice(test_settings.bzz.one);
            // Testing expected behaviour
            assert.notEqual(
                buyCost.toString(),
                0,
                "Buy cost of 1 decimal token is 0"
            );
            assert.equal(
                buyCost.toString(),
                test_settings.dai.firstOneCost,
                "Buy cost is unexpected"
            );
        });
        /**
         * Tests that the curve is returning the correct bonded token address
         */
        it("Bonded token address", async() => {
            let tokenAddress = await curveInstance.bondedToken();
            // Testing expected behaviour
            assert.equal(
                tokenAddress,
                tokenInstance.address,
                "Bonded token address incorrect"
            );
        });
        /**
         * Tests that the curve is returning the correct collateral token address
         */
        it("Collateral token address", async() => {
            let tokenAddress = await curveInstance.collateralToken();
            // Testing expected behaviour
            assert.equal(
                tokenAddress,
                collateralInstance.address,
                "Collateral token address incorrect"
            );
        });
    });

    describe('Curve shut down tests', () => {
        /**
         * Tests the emergency shut down deactivates the curve
         */
        it("Can shut down the curve", async() => {
            let isActive = await curveInstance.isCurveActive();
            // Admin emergency shut down
            await curveInstance.connect(owner).shutDown();
            let isActiveAfter = await curveInstance.isCurveActive();
            // Testing expected behaviour
            assert.equal(
                isActive,
                true,
                "Curve was inactive before shut down"
            );
            assert.equal(
                isActiveAfter,
                false,
                "Curve was not shut down after call"
            );
        });
        /**
         * Tests that only the owner can shut down the curve
         */
        it("Non owner cannot shut down the curve", async() => {
            // Non-admin cannot access function
            await expect(curveInstance.connect(user).shutDown())
                .to.be.revertedWith(test_settings.errors.owner);
        });
        /**
         * Tests that once the curve is shut down non of the blocked functions can
         * be accessed 
         */
        it("Once shut, blocked functions cannot be accessed", async() => {
            // Admin emergency shut down
            await curveInstance.connect(owner).shutDown();
            // Testing expected behaviour
            await expect(curveInstance.connect(user).buyPrice(
                test_settings.bzz.buyAmount
            )).to.be.revertedWith(test_settings.errors.inactive);
            await expect(curveInstance.connect(user).sellReward(
                test_settings.bzz.buyAmount
            )).to.be.revertedWith(test_settings.errors.inactive);
            await expect(curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                test_settings.dai.buyCost
            )).to.be.revertedWith(test_settings.errors.inactive);
            await expect(curveInstance.connect(user).redeem(
                test_settings.bzz.sellAmount,
                test_settings.dai.sellReward
            )).to.be.revertedWith(test_settings.errors.inactive);
        });
    });

    describe('Curve ownership tests', () => {
        /**
         * Tests that the owner is set correctly
         */
        it("Owner is set correctly", async() => {
            let curveOwner = await curveInstance.owner();
            // Testing expected behaviour
            assert.equal(
                curveOwner,
                owner.address,
                "Owner of curve is incorrect"
            );
        });
        /**
         * Tests that ownership can be transferred
         */
        it("Ownership can be transferred correctly", async() => {
            let curveOwner = await curveInstance.owner();
            await curveInstance.connect(owner).transferOwnership(
                investor.address
            );
            let curveOwnerAfter = await curveInstance.owner();
            // Testing expected behaviour
            assert.equal(
                curveOwner,
                owner.address,
                "Owner of curve is incorrect"
            );
            assert.equal(
                curveOwnerAfter,
                investor.address,
                "Owner of curve is incorrect after transfer"
            );
        });
    });

    describe('Curve bonded token tests', () => {
        /**
         * Tests that if a non-minter role address tries to burn or burnFrom 
         * on the bonded token (BZZ) that the transaction will fail.
         */
        it("Bonded tokens burnt outside of curve blocked", async() => {
            // User buys some tokens
            // Getting the buy cost for 1000 tokens
            let buyCost = await curveInstance.buyPrice(
                test_settings.bzz.buyAmount
            );
            // Approving the curve as a spender of collateral
            await collateralInstance.connect(user).approve(
                curveInstance.address,
                buyCost
            );
            // Minting the collateral tokens for the user
            await collateralInstance.connect(user).mint(buyCost);
            // Mints tokens
            await curveInstance.connect(user).mint(
                test_settings.bzz.buyAmount,
                buyCost
            );
            // Checks that a non minter cannot burn tokens
            await expect(tokenInstance.connect(user).burn(
                test_settings.bzz.sellAmount
            )).to.be.revertedWith(test_settings.errors.minter_is_minter);

            // Approve a spender 
            await tokenInstance.connect(user).approve(
                user_two.address,
                buyCost
            );
            // Checks that a non minter cannot burnFrom tokens
            await expect(tokenInstance.connect(user).burnFrom(
                user_two.address,
                test_settings.bzz.sellAmount
            )).to.be.revertedWith(test_settings.errors.minter_is_minter);

        });
        /**
         * Tests that if a user with a minter role can burn and burnFrom.
         */
        it("Bonded tokens can only be burnt by minter", async() => {
            // Investor sends tokens to owner
            await tokenInstance.connect(investor).transfer(
                owner.address,
                test_settings.bzz.buyAmount
            );
            // Investor sends tokens to user
            await tokenInstance.connect(investor).transfer(
                user.address,
                test_settings.bzz.sellAmount
            );
            // Getting the owners balance
            let ownerBalance = await tokenInstance.balanceOf(
                owner.address
            );
            // Getting the owners balance
            let userBalance = await tokenInstance.balanceOf(
                user.address
            );
            // Checks that a minter can burn tokens
            await tokenInstance.connect(owner).burn(
                test_settings.bzz.sellAmount
            );
            // Getting the owners balance after burn
            let ownerBalanceAfter = await tokenInstance.balanceOf(
                owner.address
            );
            // User approves the owner as a spender
            await tokenInstance.connect(user).approve(
                owner.address,
                test_settings.bzz.sellAmount
            );
            // Checks that a minter can burnFrom tokens
            await tokenInstance.connect(owner).burnFrom(
                user.address,
                test_settings.bzz.sellAmount
            );
            // Getting the owners balance
            let userBalanceAfter = await tokenInstance.balanceOf(
                user.address
            );

            // Testing expected behaviour
            assert.equal(
                ownerBalance.toString(),
                test_settings.bzz.buyAmount.toString(),
                "Owner starts with incorrect BZZ balance"
            );
            assert.equal(
                userBalance.toString(),
                test_settings.bzz.sellAmount.toString(),
                "User starts with incorrect BZZ balance"
            );
            assert.equal(
                ownerBalanceAfter.toString(),
                test_settings.bzz.sellAmount.toString(),
                "Owner has incorrect BZZ balance after burn"
            );
            assert.equal(
                userBalanceAfter.toString(),
                0,
                "User has incorrect BZZ balance after burnFrom"
            );
        });
    });

    describe('Curve safe math tests', () => {
        /**
         * Tests that a number too large will revert (and not overflow) on buy
         * price. Buy price is used in mint. 
         */
        it("Reverts on buy price if amount too large", async () => {
            await expect(curveInstance.buyPrice(
                test_settings.large.max_uint256
            )).to.be.revertedWith(test_settings.errors.safe_math_add);
        });
        /**
         * Tests that buy Price reverts if supply past max
         */
        it("Reverts on buy price if amount at max supply", async () => {
            await expect(curveInstance.buyPrice(
                test_settings.large.max_supply
            )).to.be.revertedWith(test_settings.errors.safe_math_mul);
        });
        /**
         * Tests that buy Price doesn't revert under max
         */
        it("Reverts on buy price if amount at max supply", async () => {
            let buyPrice = await curveInstance.buyPrice(
                test_settings.large.just_under_max
            );
            
            assert.equal(
                buyPrice.toString(),
                test_settings.dai.max_supply_buy,
                "Max supply buy price incorrect"
            );
        });
        /**
         * Tests buy price of 0 token is 0
         */
        it("Buy price if amount 0 is 0", async () => {
            let result = await curveInstance.buyPrice(
                0
            );
            assert.equal(
                result.toString(),
                0,
                "0 token costs more than 0"
            );
        });
        /**
         * Tests that buy price of 1 decimal token is not 0
         */
        it("Reverts on buy price of 1 dec is not 0", async () => {
            let result = await curveInstance.buyPrice(
                1
            );

            assert.notEqual(
                result.toString(),
                0,
                "Buy cost of 1 decimal token is 0"
            );
        });
        /**
         * Tests that a number too large will revert (and not overflow) on sell 
         * reward. Sell reward is used in redeem.
         */
        it("Reverts on sell reward if amount too large", async () => {
            await expect(curveInstance.sellReward(
                test_settings.large.max_uint256
            )).to.be.revertedWith(test_settings.errors.safe_math_sub);
        });
        /**
         * Tests that sell reward reverts if supply past max
         */
        it("Reverts on sell reward if amount at max supply", async () => {
            await expect(curveInstance.sellReward(
                test_settings.large.max_supply
            )).to.be.revertedWith(test_settings.errors.safe_math_sub);
        });
        /**
         * Tests that 0 will revert (and not underflow) on sell reward.
         * Sell reward is used in redeem.
         */
        it("Reverts on sell reward if amount 0", async () => {
            await expect(curveInstance.sellReward(
                0
            )).to.be.revertedWith(test_settings.errors.safe_math_div_zero);
        });
        /**
         * Tests that buy price of 1 decimal token is not 0
         */
        it("Reverts on sell reward of 1 dec is not 0", async () => {
            let result = await curveInstance.sellReward(
                1
            );

            assert.notEqual(
                result.toString(),
                0,
                "Buy cost of 1 decimal token is 0"
            );
        });
    });
});


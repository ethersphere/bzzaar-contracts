import { formatUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, assert } from "chai";
import { Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import {
  pre_mint_sequence,
  tokenSettings,
  test_settings,
} from "./settings.test";


describe("🤝 Broker tests", () => {
  let investor: SignerWithAddress;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let user_two: SignerWithAddress;

  let tokenInstance: Contract;
  let curveInstance: Contract;
  let collateralInstance: Contract;
  let brokerInstance: Contract;
  let mockRouterInstance: Contract;
  let mockWethInstance: Contract;

  const provider = waffle.provider;

  beforeEach(async () => {
    await provider.ready
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
    await tokenInstance
      .connect(owner)
      .mint(investor.getAddress(), pre_mint_sequence.whole);
    // Adding the curve as a minter on the token
    await tokenInstance.connect(owner).addMinter(curveInstance.address);
    // Getting the required collateral for the pre-mint tokens
    let requiredCollateral = await curveInstance.requiredCollateral(
      pre_mint_sequence.whole
    );
    // This is the amount of required collateral for the curve
    // 1 230 468 . 599 843 763 228 132 556
    // The owner is minting the required number of tokens in collateral (DAI)
    await collateralInstance.connect(owner).mint(requiredCollateral);
    // Approving the curve as a spender of the required amount
    await collateralInstance
      .connect(owner)
      .approve(curveInstance.address, requiredCollateral);
    // Initialising the curve
    await curveInstance.connect(owner).init();

    //------------------------------------------------------------------
    // Deploying the eth broker + mock router + mock WETH
    //------------------------------------------------------------------

    const mockWethArtifacts = await ethers.getContractFactory("Mock_dai")
    mockWethInstance = await mockWethArtifacts.deploy(
      tokenSettings.weth.name,
      tokenSettings.weth.symbol,
      tokenSettings.weth.decimals
    );

    const mockRouterArtifacts = await ethers.getContractFactory("Mock_router");
    mockRouterInstance = await mockRouterArtifacts.deploy(
      mockWethInstance.address,
    );
    await owner.sendTransaction({
      to: mockRouterInstance.address,
      value: test_settings.eth_broker.eth.seed_eth_amount
    });

    // Minting DAI to seed the router
    await collateralInstance
      .connect(user)
      .mint(test_settings.eth_broker.eth.seed_eth_amount);
    // Sending seed DAI to router
    await collateralInstance
      .connect(user)
      .transfer(
        mockRouterInstance.address,
        test_settings.eth_broker.eth.seed_eth_amount
      );

    const brokerArtifacts = await ethers.getContractFactory("Eth_broker");
    brokerInstance = await brokerArtifacts.deploy(
      curveInstance.address,
      collateralInstance.address,
      mockRouterInstance.address
    );
  });

  describe("Mock router tests", () => {
    /**
     * Tests that the getAmountsIn on the mocked router works as expected
     * against the hardcoded conversion rate given.
     */
    it("Gets Amounts In returns correct values", async () => {
      let ethValue = await mockRouterInstance.getAmountsIn(
        test_settings.eth_broker.dai.almost_one_eth,
        [mockWethInstance.address, collateralInstance.address]
      );

      // Testing expected behaviour
      assert.equal(
        ethValue[0].toString(),
        test_settings.eth_broker.eth.almost_one_eth,
        "DAI to ETH conversion incorrect against expected"
      );
    });
    /**
     * The WETH address of the mocked WETH is correct
     */
    it("get weth address expected", async () => {
      let wethAddress = await mockRouterInstance.WETH();

      // Testing expected behaviour
      assert.equal(
        wethAddress,
        "0xacDdD0dBa07959Be810f6cd29E41b127b29E4A8a",
        "Weth address in mock router incorrect"
      );
    });
    /**
     * Ensures that the ETH to DAI router functionality is mocked correctly,
     * and that the balances of involved addresses changes correctly.
     */
    it("Swap ETH for exact tokens (DAI) test", async () => {
      // let balanceOfUserInEthBefore = await ???
      let balanceOfUserDaiBefore = await collateralInstance.balanceOf(
        user.address
      );
      // Getting the current time
      let time = await brokerInstance.getTime();
      // Swapping ETH for an exact amount of tokens (DAI)
      await mockRouterInstance
        .connect(user)
        .swapETHForExactTokens(
          test_settings.eth_broker.dai.almost_one_eth,
          [
            mockWethInstance.address,
            collateralInstance.address,
          ],
          user.address,
          time,
          { value: "0x" + test_settings.eth_broker.eth.almost_one_eth }
        );

      let balanceOfUserDaiAfter = await collateralInstance.balanceOf(
        user.address
      );

      // Testing expected behaviour
      assert.equal(
        balanceOfUserDaiBefore.toString(),
        0,
        "User started with incorrect DAI balance"
      );
      assert.equal(
        balanceOfUserDaiAfter.toString(),
        test_settings.eth_broker.dai.almost_one_eth,
        "User does not have DAI balance after trade"
      );
    });
    /**
     * Ensures that the DAI to ETH router functionality is mocked correctly,
     * and that the balances of the involved addresses changes correctly.
     */
    it("Swap exact tokens (DAI) for ETH test", async () => {
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.address
      );

      await collateralInstance
        .connect(user)
        .mint(test_settings.eth_broker.dai.almost_one_eth);
      let balanceOfUserDAI = await collateralInstance.balanceOf(
        user.address
      );

      // approving router as spender
      await collateralInstance
        .connect(user)
        .approve(
          mockRouterInstance.address,
          test_settings.eth_broker.dai.almost_one_eth
        );
      // Getting the current time
      let time = await brokerInstance.getTime();
      // Swapping the exact DAI amount for ETH
      await mockRouterInstance
        .connect(user)
        .swapExactTokensForETH(
          test_settings.eth_broker.dai.almost_one_eth,
          test_settings.eth_broker.eth.almost_one_eth,
          [
            collateralInstance.address,
            mockWethInstance.address,
          ],
          user.address,
          time + 100
        );

      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.address
      );
      let balanceOfUserDaiAfter = await collateralInstance.balanceOf(
        user.address
      );

      // Testing expected behaviour
      // expect(mockRouterEthBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount.toString());
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Eth balance of broker is incorrect"
      );
      // expect(mockRouterEthBalanceAfter.toString()).to.equal(test_settings.eth_broker.eth.mock_router_eth_balance_after_swap.toString());
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_swap.toString(),
        "Eth balance of broker is incorrect after swap"
      );
      // expect(balanceOfUserDAI.toString()).to.equal(test_settings.eth_broker.dai.almost_one_eth);
      assert.equal(
        balanceOfUserDAI.toString(),
        test_settings.eth_broker.dai.almost_one_eth,
        "User started with incorrect DAI balance"
      );
      // expect(balanceOfUserDaiAfter.toString()).to.equal("0");
      assert.equal(
        balanceOfUserDaiAfter.toString(),
        0,
        "User incorrectly has DAI balance after trade"
      );
    });
  });

  describe("broker view tests", () => {
    /**
     * Ensures that the buy price for the specified number of bzz is as
     * expected given the mocked conversion rate.
     */
    it("buy price expected", async () => {
      let buyPrice = await brokerInstance.buyPrice(test_settings.bzz.buyAmount);

      // expect(buyPrice.toString()).to.equal(test_settings.eth_broker.eth.buy_price);
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.buy_price,
        "buy price unexpected"
      );
    });
    /**
     * Ensures that the sell reward for the specified number of bzz is
     * as expected given the mocked conversion rate.
     */
    it("sell reward expected", async () => {
      let sellRewardAmount = await brokerInstance.sellReward(
        test_settings.bzz.buyAmount
      );

      // Testing expected behaviour
      // expect(sellRewardAmount.toString()).to.equal(test_settings.eth_broker.eth.sell_reward);
      assert.equal(
        sellRewardAmount.toString(),
        test_settings.eth_broker.eth.sell_reward,
        "sell reward unexpected"
      );
    });
    /**
     * Tests that the direct DAI to ETH conversion produces expected results
     * given the hardcoded conversion rate within the mock router.
     */
    it("sell reward dai expected", async () => {
      let sellRewardAmount = await brokerInstance.sellRewardDai(
        test_settings.eth_broker.dai.almost_one_eth
      );

      // Testing expected behaviour
      // expect(sellRewardAmount.toString()).to.equal(test_settings.eth_broker.eth.almost_one_eth);
      assert.equal(
        sellRewardAmount.toString(),
        test_settings.eth_broker.eth.almost_one_eth,
        "DAI to ETH amount unexpected"
      );
    });
    /**
     * The trade path generator correctly generates a path in both the buy
     * and sell directions.
     */
    it("Get path expected", async () => {
      let buyPath = await brokerInstance.getPath(true);
      let sellPath = await brokerInstance.getPath(false);
      let hardCodedWethAddress = "0xacDdD0dBa07959Be810f6cd29E41b127b29E4A8a";

      // Testing expected behaviour
      // expect(buyPath[0]).to.equal(hardCodedWethAddress);
      assert.equal(
        buyPath[0],
        hardCodedWethAddress,
        "WETH address in trade route incorrect"
      );
      // expect(sellPath[1]).to.equal(hardCodedWethAddress);
      assert.equal(
        sellPath[1],
        hardCodedWethAddress,
        "WETH address in trade route incorrect"
      );
      // expect(buyPath[1]).to.equal(collateralInstance.address);
      assert.equal(
        buyPath[1],
        collateralInstance.address,
        "DAI address in trade route incorrect"
      );
      // expect(sellPath[0]).to.equal(collateralInstance.address);
      assert.equal(
        sellPath[0],
        collateralInstance.address,
        "DAI address in trade route incorrect"
      );
    });
    /**
     * Testing that the network returns a valid time.
     */
    it("get time works as expected", async () => {
      let time = await brokerInstance.getTime();

      // expect(time.toString()).to.not.equal("0");
      assert.notEqual(time.toString(), 0, "Time has not be correctly relayed");
    });
  });

  describe("broker tests", () => {
    /**
     * The max dai spend slippage check is honoured
     */
    it("mint slippage check", async () => {

      await collateralInstance.connect(owner).mint(ethers.utils.parseUnits("1000000"));

      let time = await brokerInstance.getTime();
      // Testing expected behaviour
      await expect(brokerInstance.connect(owner).mint(
        test_settings.bzz.buyAmount,
        test_settings.dai.sellReward,
        time,
        { value: "0x" + test_settings.eth_broker.eth.buy_price }
      )).to.be.revertedWith(test_settings.errors.dai_slippage)
    });
    /**
     * Ensures that all the various involved parties balances change as
     * expected. The following balances: ETH, DAI, BZZ are checked on the
     * following involved entities: user, curve, mock router, broker. The
     * BZZ tokens supply change is also checked.
     */
    it("mint balance checks", async () => {
      let time = await brokerInstance.getTime();

      let userDaiBalance = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.address);
      let userEthBalance = await provider.getBalance(user.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupply = await tokenInstance.totalSupply();
      let daiCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.buyPrice(test_settings.bzz.buyAmount);

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance
        .connect(user)
        .mint(test_settings.bzz.buyAmount, test_settings.dai.buyCost, time, {
          value: test_settings.eth_broker.eth.buy_price_encoded,
        });

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      // expect(mockRouterEthBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount);
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router ETH balance incorrect"
      );
      // expect(mockRouterEthBalanceAfter.toString()).to.equal(test_settings.eth_broker.eth.mock_router_eth_balance_after_mint);
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_mint,
        "Mock router ETH balance incorrect after mint"
      );
      // expect(userEthBalance.toString()).to.not.equal(userEthBalanceAfter.toString());
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance does not change with mint"
      );
      // expect(daiCost.toString()).to.equal(test_settings.dai.buyCost);
      assert.equal(
        daiCost.toString(),
        test_settings.dai.buyCost,
        "DAI cost for token amount unexpected"
      );
      // expect(ethCost.toString()).to.equal(test_settings.eth_broker.eth.buy_price);
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH cost for token amount unexpected"
      );
      // expect(buyPrice.toString()).to.equal(test_settings.eth_broker.eth.buy_price);
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH (raw) cost for token amount unexpected"
      );
      // user balances changes as expected with mint
      // expect(userDaiBalance.toString()).to.equal("0");
      assert.equal(userDaiBalance.toString(), 0, "User starts without DAI");
      // expect(userBzzBalance.toString()).to.equal("0");
      assert.equal(userBzzBalance.toString(), 0, "User starts without BZZ");
      // expect(userEthBalance.toString()).to.not.equal(userEthBalanceAfter.toString());
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      // expect(userDaiBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      // expect(userBzzBalanceAfter.toString()).to.equal(test_settings.bzz.buyAmount);
      assert.equal(
        userBzzBalanceAfter.toString(),
        test_settings.bzz.buyAmount,
        "User BZZ balance did not increase with specified mint amount"
      );
      // broker balance remains 0 on all assets
      // expect("0").to.equal(brokerDaiBalance.toString());
      assert.equal(0, brokerDaiBalance.toString(), "broker dai balance non 0");
      // expect(brokerBzzBalance.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerBzzBalance.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance non 0"
      );
      // expect(brokerEthBalance.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerEthBalance.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance non 0"
      );
      // expect(brokerDaiBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker dai balance after non 0"
      );
      // expect(brokerBzzBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance after non 0"
      );
      // expect(brokerEthBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerEthBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance after non 0"
      );
      // Curve DAI balances correct
      // expect(curveDaiBalance.toString()).to.equal(pre_mint_sequence.dai.cost);
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve DAI is not as expected before mint"
      );
      // expect(curveDaiBalanceAfter.toString()).to.equal(test_settings.dai.curve_collateral_after_buy);
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.dai.curve_collateral_after_buy,
        "Curve DAI balance did not increase with mint"
      );
      // Token supply increases as expected
      // expect(tokenSupply.toString()).to.equal(test_settings.eth_broker.bzz.initial_supply);
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "initial supply of bzz token unexpected"
      );
      // expect(tokenSupplyAfter.toString()).to.equal(test_settings.eth_broker.bzz.after_buy);
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_buy,
        "BZZ token supply after mint incorrect"
      );
      // Mock router balances change as expected
      // expect(mockRouterBzzBalance.toString()).to.equal(mockRouterBzzBalanceAfter.toString());
      assert.equal(
        mockRouterBzzBalance.toString(),
        mockRouterBzzBalanceAfter.toString(),
        "Mock router BZZ balance incorrect (non 0)"
      );
      // expect(mockRouterDaiBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount);
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "mock router starts with incorrect dai balance"
      );
      // expect(mockRouterDaiBalanceAfter.toString()).to.equal(test_settings.eth_broker.dai.mock_router_dai_balance_after_mint);
      assert.equal(
        mockRouterDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.mock_router_dai_balance_after_mint,
        "mock router dai balance after buy incorrect"
      );
    });

    /**
     * Ensures that all the various involved parties balances change as
     * expected. The following balances: ETH, DAI, BZZ are checked on the
     * following involved entities: user, curve, mock router, broker. The
     * BZZ tokens supply change is also checked.
     */
    it("mintTo balance checks", async () => {
      let time = await brokerInstance.getTime();

      let userDaiBalance = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.address);
      let userEthBalance = await provider.getBalance(user.address);
      let userReceiverDaiBalance = await collateralInstance.balanceOf(
        user_two.address
      );
      let userReceiverBzzBalance = await tokenInstance.balanceOf(user_two.address);
      let userReceiverEthBalance = await provider.getBalance(user_two.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupply = await tokenInstance.totalSupply();
      let daiCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.buyPrice(test_settings.bzz.buyAmount);

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance.connect(user).mintTo(
        test_settings.bzz.buyAmount, 
        test_settings.dai.buyCost, 
        time, 
        user_two.address,
        { value: test_settings.eth_broker.eth.buy_price_encoded, }
      );

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.address);

      let userReceiverDaiBalanceAfter = await collateralInstance.balanceOf(
        user_two.address
      );
      let userReceiverBzzBalanceAfter = await tokenInstance.balanceOf(user_two.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      // expect(mockRouterEthBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount);
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router ETH balance incorrect"
      );
      // expect(mockRouterEthBalanceAfter.toString()).to.equal(test_settings.eth_broker.eth.mock_router_eth_balance_after_mint);
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_mint,
        "Mock router ETH balance incorrect after mint"
      );
      // expect(userEthBalance.toString()).to.not.equal(userEthBalanceAfter.toString());
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance does not change with mint"
      );
      // expect(daiCost.toString()).to.equal(test_settings.dai.buyCost);
      assert.equal(
        daiCost.toString(),
        test_settings.dai.buyCost,
        "DAI cost for token amount unexpected"
      );
      // expect(ethCost.toString()).to.equal(test_settings.eth_broker.eth.buy_price);
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH cost for token amount unexpected"
      );
      // expect(buyPrice.toString()).to.equal(test_settings.eth_broker.eth.buy_price);
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH (raw) cost for token amount unexpected"
      );
      // user balances changes as expected with mint
      // expect(userDaiBalance.toString()).to.equal("0");
      assert.equal(userDaiBalance.toString(), 0, "User starts without DAI");
      // expect(userBzzBalance.toString()).to.equal("0");
      assert.equal(userBzzBalance.toString(), 0, "User starts without BZZ");
      // expect(userEthBalance.toString()).to.not.equal(userEthBalanceAfter.toString());
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      // expect(userDaiBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      // expect(userBzzBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userBzzBalanceAfter.toString(),
        0,
        "User BZZ balance did not increase with specified mint amount"
      );
      // user receiver balances changes as expected with mint
      // expect(userReceiverDaiBalance.toString()).to.equal("0");
      assert.equal(userReceiverDaiBalance.toString(), 0, "User starts without DAI");
      // expect(userReceiverBzzBalance.toString()).to.equal("0");
      assert.equal(userReceiverBzzBalance.toString(), 0, "User starts without BZZ");
      // expect(userReceiverEthBalance.toString()).to.not.equal(userEthBalanceAfter.toString());
      assert.notEqual(
        userReceiverEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      // expect(userReceiverDaiBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userReceiverDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      // expect(userReceiverBzzBalanceAfter.toString()).to.equal(test_settings.bzz.buyAmount.toString());
      assert.equal(
        userReceiverBzzBalanceAfter.toString(),
        test_settings.bzz.buyAmount.toString(),
        "User BZZ balance did not increase with specified mint amount"
      );
      // broker balance remains 0 on all assets
      // expect("0").to.equal(brokerDaiBalance.toString());
      assert.equal(0, brokerDaiBalance.toString(), "broker dai balance non 0");
      // expect(brokerBzzBalance.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerBzzBalance.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance non 0"
      );
      // expect(brokerEthBalance.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerEthBalance.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance non 0"
      );
      // expect(brokerDaiBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker dai balance after non 0"
      );
      // expect(brokerBzzBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance after non 0"
      );
      // expect(brokerEthBalanceAfter.toString()).to.equal(brokerDaiBalance.toString());
      assert.equal(
        brokerEthBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance after non 0"
      );
      // Curve DAI balances correct
      // expect(curveDaiBalance.toString()).to.equal(pre_mint_sequence.dai.cost);
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve DAI is not as expected before mint"
      );
      // expect(curveDaiBalanceAfter.toString()).to.equal(test_settings.dai.curve_collateral_after_buy);
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.dai.curve_collateral_after_buy,
        "Curve DAI balance did not increase with mint"
      );
      // Token supply increases as expected
      // expect(tokenSupply.toString()).to.equal(test_settings.eth_broker.bzz.initial_supply);
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "initial supply of bzz token unexpected"
      );
      // expect(tokenSupplyAfter.toString()).to.equal(test_settings.eth_broker.bzz.after_buy);
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_buy,
        "BZZ token supply after mint incorrect"
      );
      // Mock router balances change as expected
      // expect(mockRouterBzzBalance.toString()).to.equal(mockRouterBzzBalanceAfter.toString());
      assert.equal(
        mockRouterBzzBalance.toString(),
        mockRouterBzzBalanceAfter.toString(),
        "Mock router BZZ balance incorrect (non 0)"
      );
      // expect(mockRouterDaiBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount);
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "mock router starts with incorrect dai balance"
      );
      // expect(mockRouterDaiBalanceAfter.toString()).to.equal(test_settings.eth_broker.dai.mock_router_dai_balance_after_mint);
      assert.equal(
        mockRouterDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.mock_router_dai_balance_after_mint,
        "mock router dai balance after buy incorrect"
      );
    });
    /**
     * Ensures that the transaction will fail without being approved
     */
    it("burn fails without approval", async () => {
      let time = await brokerInstance.getTime();

      await expect(brokerInstance
        .connect(user)
        .redeem(
          test_settings.bzz.buyAmount,
          test_settings.dai.sellReward,
          time
        )).to.be.revertedWith(test_settings.errors.transfer_failed);
    });
    /**
     * Ensures that the burn function works as expected and all involved
     * parties (curve, mock router, broker, token) balances change correctly
     * in the various involved currencies (ETH, BZZ, DAI).
     */
    it("burn balance checks", async () => {
      let time = await brokerInstance.getTime();

      // User receives BZZ
      await tokenInstance
        .connect(investor)
        .transfer(user.address, test_settings.bzz.buyAmount);

      // approving the broker as a spender
      await tokenInstance
        .connect(user)
        .approve(brokerInstance.address, test_settings.bzz.buyAmount);

      let allowanceOfBroker = await tokenInstance.allowance(
        user.address,
        brokerInstance.address
      );
      let userDaiBalance = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.address);
      let userEthBalance = await provider.getBalance(user.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupply = await tokenInstance.totalSupply();

      let daiCost = await curveInstance.sellReward(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.sellReward(
        test_settings.bzz.buyAmount
      );

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance.connect(user).redeem(
        test_settings.bzz.buyAmount,
        10,
        time
      );

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      // expect(allowanceOfBroker.toString()).to.equal(test_settings.bzz.buyAmount.toString());
      assert.equal(
        allowanceOfBroker.toString(),
        test_settings.bzz.buyAmount.toString(),
        "broker allowance incorrect"
      );
      // User balance in various currencies expected
      // expect(userDaiBalance.toString()).to.equal("0");
      assert.equal(userDaiBalance.toString(), 0, "User DAI balance incorrect");
      // expect(userBzzBalance.toString()).to.equal(test_settings.bzz.buyAmount.toString());
      assert.equal(
        userBzzBalance.toString(),
        test_settings.bzz.buyAmount.toString(),
        "User BZZ balance incorrect"
      );
      // expect(userEthBalance.toString()).to.not.equal("0");
      assert.notEqual(
        userEthBalance.toString(),
        "0",
        "User ETH balance incorrect"
      );
      // broker balances are as expected
      // expect(brokerDaiBalance.toString()).to.equal("0");
      assert.equal(
        brokerDaiBalance.toString(),
        0,
        "broker incorrectly has a balance in DAI"
      );
      // expect(brokerBzzBalance.toString()).to.equal("0");
      assert.equal(
        brokerBzzBalance.toString(),
        0,
        "broker incorrectly has a balance in BZZ"
      );
      // expect(brokerEthBalance.toString()).to.equal("0");
      assert.equal(
        brokerEthBalance.toString(),
        "0",
        "broker incorrectly has a balance in ETH"
      );
      // Curve has correct balance
      // expect(curveDaiBalance.toString()).to.equal(pre_mint_sequence.dai.cost);
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve has unexpected balance after pre-mint"
      );
      // Router balances are as expected
      // expect(mockRouterDaiBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount.toString());
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router has incorrect DAI balance"
      );
      // expect(mockRouterBzzBalance.toString()).to.equal("0");
      assert.equal(
        mockRouterBzzBalance.toString(),
        0,
        "Mock router has incorrect BZZ balance"
      );
      // expect(mockRouterEthBalance.toString()).to.equal(test_settings.eth_broker.eth.seed_eth_amount.toString());
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router has incorrect ETH balance"
      );
      // Testing that pricing & supply are as expected
      // expect(tokenSupply.toString()).to.equal(test_settings.eth_broker.bzz.initial_supply);
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "BZZ current supply incorrect"
      );
      // expect(daiCost.toString()).to.equal(test_settings.eth_broker.dai.buy_cost);
      assert.equal(
        daiCost.toString(),
        test_settings.eth_broker.dai.buy_cost,
        "DAI cost for token amount unexpected"
      );
      // expect(ethCost.toString()).to.equal(test_settings.eth_broker.eth.sell_reward);
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.sell_reward,
        "ETH cost for token amount unexpected"
      );
      // expect(buyPrice.toString()).to.equal(test_settings.eth_broker.eth.sell_reward);
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.sell_reward,
        "ETH (raw) cost for token amount unexpected"
      );
      // User balance in various currencies expected after burn
      // expect(userDaiBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User incorrectly has left over DAI after burn"
      );
      // expect(userBzzBalanceAfter.toString()).to.equal("0");
      assert.equal(
        userBzzBalanceAfter.toString(),
        0,
        "User incorrectly has left over BZZ after burn"
      );
      // expect(userEthBalanceAfter.toString()).to.not.equal(userEthBalance.toString());
      assert.notEqual(
        userEthBalanceAfter.toString(),
        userEthBalance.toString(),
        "User ETH balance did not change with burn"
      );
      // broker balances are as expected after burn
      // expect(brokerDaiBalanceAfter.toString()).to.equal("0");
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        0,
        "broker incorrectly has a balance in DAI"
      );
      // expect(brokerBzzBalanceAfter.toString()).to.equal("0");
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        0,
        "broker incorrectly has a balance in BZZ"
      );
      // expect(brokerEthBalanceAfter.toString()).to.equal("0");
      assert.equal(
        brokerEthBalanceAfter.toString(),
        "0",
        "broker incorrectly has a balance in ETH after burn"
      );
      // Curve has correct balance
      // expect(curveDaiBalanceAfter.toString()).to.equal(test_settings.eth_broker.dai.curve_balance_after_burn);
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.curve_balance_after_burn,
        "Curve has unexpected DAI balance after burn"
      );
      // Router balances are as expected after burn
      // expect(mockRouterDaiBalanceAfter.toString()).to.equal(test_settings.eth_broker.dai.mock_router_dai_balance_after_burn.toString());
      assert.equal(
        mockRouterDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.mock_router_dai_balance_after_burn.toString(),
        "Mock router has incorrect DAI balance"
      );
      // expect(mockRouterBzzBalanceAfter.toString()).to.equal("0");
      assert.equal(
        mockRouterBzzBalanceAfter.toString(),
        0,
        "Mock router has incorrect BZZ balance"
      );
      // expect(mockRouterEthBalanceAfter.toString()).to.equal(test_settings.eth_broker.eth.mock_router_eth_balance_after_burn.toString());
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_burn.toString(),
        "Mock router has incorrect ETH balance"
      );
      // Token supply on curve correctly affected by burn
      // expect(tokenSupplyAfter.toString()).to.equal(test_settings.eth_broker.bzz.after_burn);
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_burn,
        "Total supply incorrectly affected by burn"
      );
    });
  });
});


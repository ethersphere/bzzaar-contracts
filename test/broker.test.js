const {
  ethers,
  etherlime,
  curve_abi,
  token_abi,
  mock_dai_abi,
  eth_broker_abi,
  mock_router_abi,
  pre_mint_sequence,
  tokenSettings,
  test_settings,
} = require("./settings.test.js");

describe("🤝 Broker tests", () => {
  let investor = accounts[0];
  let owner = accounts[1];
  let user = accounts[2];
  let user_two = accounts[3];

  let deployer;
  let tokenInstance;
  let curveInstance;
  let collateralInstance;
  let brokerInstance;
  let mockRouterInstance;
  let mockWethInstance;

  const provider = new ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );

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

    curveInstance = await deployer.deploy(
      curve_abi,
      false,
      tokenInstance.contract.address,
      collateralInstance.contract.address
    );

    //------------------------------------------------------------------
    // Setting up the curve pre-mint
    // For the pre-mint tests please see the pre-mint test file
    //------------------------------------------------------------------

    // Minting the pre-mint tokens to the pre-mint owner
    await tokenInstance
      .from(owner)
      .mint(investor.signer.address, pre_mint_sequence.whole);
    // Adding the curve as a minter on the token
    await tokenInstance.from(owner).addMinter(curveInstance.contract.address);
    // Getting the required collateral for the pre-mint tokens
    let requiredCollateral = await curveInstance.requiredCollateral(
      pre_mint_sequence.whole
    );
    // This is the amount of required collateral for the curve
    // 1 230 468 . 599 843 763 228 132 556
    // The owner is minting the required number of tokens in collateral (DAI)
    await collateralInstance.from(owner).mint(requiredCollateral);
    // Approving the curve as a spender of the required amount
    await collateralInstance
      .from(owner)
      .approve(curveInstance.contract.address, requiredCollateral);
    // Initialising the curve
    await curveInstance.from(owner).init();

    //------------------------------------------------------------------
    // Deploying the eth broker + mock router + mock WETH
    //------------------------------------------------------------------

    mockWethInstance = await deployer.deploy(
      mock_dai_abi,
      false,
      tokenSettings.weth.name,
      tokenSettings.weth.symbol,
      tokenSettings.weth.decimals
    );

    mockRouterInstance = await deployer.deploy(
      mock_router_abi,
      false,
      mockWethInstance.contract.address,
      { value: test_settings.eth_broker.eth.seed_eth_amount }
    );
    // Minting DAI to seed the router
    await collateralInstance
      .from(user)
      .mint(test_settings.eth_broker.eth.seed_eth_amount);
    // Sending seed DAI to router
    await collateralInstance
      .from(user)
      .transfer(
        mockRouterInstance.contract.address,
        test_settings.eth_broker.eth.seed_eth_amount
      );

    brokerInstance = await deployer.deploy(
      eth_broker_abi,
      false,
      curveInstance.contract.address,
      collateralInstance.contract.address,
      mockRouterInstance.contract.address
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
        [mockWethInstance.contract.address, collateralInstance.contract.address]
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
        user.signer.address
      );
      // Getting the current time
      let time = await brokerInstance.getTime();
      // Swapping ETH for an exact amount of tokens (DAI)
      await mockRouterInstance
        .from(user)
        .swapETHForExactTokens(
          test_settings.eth_broker.dai.almost_one_eth,
          [
            mockWethInstance.contract.address,
            collateralInstance.contract.address,
          ],
          user.signer.address,
          time,
          { value: "0x" + test_settings.eth_broker.eth.almost_one_eth }
        );

      let balanceOfUserDaiAfter = await collateralInstance.balanceOf(
        user.signer.address
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
        mockRouterInstance.contract.address
      );

      await collateralInstance
        .from(user)
        .mint(test_settings.eth_broker.dai.almost_one_eth);
      let balanceOfUserDAI = await collateralInstance.balanceOf(
        user.signer.address
      );

      // approving router as spender
      await collateralInstance
        .from(user)
        .approve(
          mockRouterInstance.contract.address,
          test_settings.eth_broker.dai.almost_one_eth
        );
      // Getting the current time
      let time = await brokerInstance.getTime();
      // Swapping the exact DAI amount for ETH
      await mockRouterInstance
        .from(user)
        .swapExactTokensForETH(
          test_settings.eth_broker.dai.almost_one_eth,
          test_settings.eth_broker.eth.almost_one_eth,
          [
            collateralInstance.contract.address,
            mockWethInstance.contract.address,
          ],
          user.signer.address,
          time + 100
        );

      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let balanceOfUserDaiAfter = await collateralInstance.balanceOf(
        user.signer.address
      );

      // Testing expected behaviour
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Eth balance of broker is incorrect"
      );
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_swap.toString(),
        "Eth balance of broker is incorrect after swap"
      );
      assert.equal(
        balanceOfUserDAI.toString(),
        test_settings.eth_broker.dai.almost_one_eth,
        "User started with incorrect DAI balance"
      );
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
      assert.equal(
        buyPath[0],
        hardCodedWethAddress,
        "WETH address in trade route incorrect"
      );
      assert.equal(
        sellPath[1],
        hardCodedWethAddress,
        "WETH address in trade route incorrect"
      );
      assert.equal(
        buyPath[1],
        collateralInstance.contract.address,
        "DAI address in trade route incorrect"
      );
      assert.equal(
        sellPath[0],
        collateralInstance.contract.address,
        "DAI address in trade route incorrect"
      );
    });
    /**
     * Testing that the network returns a valid time.
     */
    it("get time works as expected", async () => {
      let time = await brokerInstance.getTime();

      assert.notEqual(time.toString(), 0, "Time has not be correctly relayed");
    });
  });

  describe("broker tests", () => {
    /**
     * The max dai spend slippage check is honoured
     */
    it("mint slippage check", async () => {
      let time = await brokerInstance.getTime();
      // Testing expected behaviour
      await assert.revertWith(
        brokerInstance.mint(
          test_settings.bzz.buyAmount,
          test_settings.dai.sellReward,
          time,
          { value: "0x" + test_settings.eth_broker.eth.buy_price }
        ),
        test_settings.errors.dai_slippage
      );
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
        user.signer.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.signer.address);
      let userEthBalance = await provider.getBalance(user.signer.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupply = await tokenInstance.totalSupply();
      let daiCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.buyPrice(test_settings.bzz.buyAmount);

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance
        .from(user)
        .mint(test_settings.bzz.buyAmount, test_settings.dai.buyCost, time, {
          value: test_settings.eth_broker.eth.buy_price_encoded,
        });

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.signer.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.signer.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.signer.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "Mock router ETH balance incorrect"
      );
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_mint,
        "Mock router ETH balance incorrect after mint"
      );
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance does not change with mint"
      );
      assert.equal(
        daiCost.toString(),
        test_settings.dai.buyCost,
        "DAI cost for token amount unexpected"
      );
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH cost for token amount unexpected"
      );
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH (raw) cost for token amount unexpected"
      );
      // user balances changes as expected with mint
      assert.equal(userDaiBalance.toString(), 0, "User starts without DAI");
      assert.equal(userBzzBalance.toString(), 0, "User starts without BZZ");
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      assert.equal(
        userBzzBalanceAfter.toString(),
        test_settings.bzz.buyAmount,
        "User BZZ balance did not increase with specified mint amount"
      );
      // broker balance remains 0 on all assets
      assert.equal(0, brokerDaiBalance.toString(), "broker dai balance non 0");
      assert.equal(
        brokerBzzBalance.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance non 0"
      );
      assert.equal(
        brokerEthBalance.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance non 0"
      );
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker dai balance after non 0"
      );
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance after non 0"
      );
      assert.equal(
        brokerEthBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance after non 0"
      );
      // Curve DAI balances correct
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve DAI is not as expected before mint"
      );
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.dai.curve_collateral_after_buy,
        "Curve DAI balance did not increase with mint"
      );
      // Token supply increases as expected
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "initial supply of bzz token unexpected"
      );
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_buy,
        "BZZ token supply after mint incorrect"
      );
      // Mock router balances change as expected
      assert.equal(
        mockRouterBzzBalance.toString(),
        mockRouterBzzBalanceAfter.toString(),
        "Mock router BZZ balance incorrect (non 0)"
      );
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "mock router starts with incorrect dai balance"
      );
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
        user.signer.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.signer.address);
      let userEthBalance = await provider.getBalance(user.signer.address);
      let userReceiverDaiBalance = await collateralInstance.balanceOf(
        user_two.signer.address
      );
      let userReceiverBzzBalance = await tokenInstance.balanceOf(user_two.signer.address);
      let userReceiverEthBalance = await provider.getBalance(user_two.signer.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupply = await tokenInstance.totalSupply();
      let daiCost = await curveInstance.buyPrice(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.buyPrice(test_settings.bzz.buyAmount);

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance.from(user).mintTo(
        test_settings.bzz.buyAmount, 
        test_settings.dai.buyCost, 
        time, 
        user_two.signer.address,
        { value: test_settings.eth_broker.eth.buy_price_encoded, }
      );

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.signer.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.signer.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.signer.address);

      let userReceiverDaiBalanceAfter = await collateralInstance.balanceOf(
        user_two.signer.address
      );
      let userReceiverBzzBalanceAfter = await tokenInstance.balanceOf(user_two.signer.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "Mock router ETH balance incorrect"
      );
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_mint,
        "Mock router ETH balance incorrect after mint"
      );
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance does not change with mint"
      );
      assert.equal(
        daiCost.toString(),
        test_settings.dai.buyCost,
        "DAI cost for token amount unexpected"
      );
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH cost for token amount unexpected"
      );
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.buy_price,
        "ETH (raw) cost for token amount unexpected"
      );
      // user balances changes as expected with mint
      assert.equal(userDaiBalance.toString(), 0, "User starts without DAI");
      assert.equal(userBzzBalance.toString(), 0, "User starts without BZZ");
      assert.notEqual(
        userEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      assert.equal(
        userBzzBalanceAfter.toString(),
        0,
        "User BZZ balance did not increase with specified mint amount"
      );
      // user receiver balances changes as expected with mint
      assert.equal(userReceiverDaiBalance.toString(), 0, "User starts without DAI");
      assert.equal(userReceiverBzzBalance.toString(), 0, "User starts without BZZ");
      assert.notEqual(
        userReceiverEthBalance.toString(),
        userEthBalanceAfter.toString(),
        "User ETH balance did not change with mint"
      );
      assert.equal(
        userReceiverDaiBalanceAfter.toString(),
        0,
        "User DAI balance incorrectly changed with eth mint"
      );
      assert.equal(
        userReceiverBzzBalanceAfter.toString(),
        test_settings.bzz.buyAmount.toString(),
        "User BZZ balance did not increase with specified mint amount"
      );
      // broker balance remains 0 on all assets
      assert.equal(0, brokerDaiBalance.toString(), "broker dai balance non 0");
      assert.equal(
        brokerBzzBalance.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance non 0"
      );
      assert.equal(
        brokerEthBalance.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance non 0"
      );
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker dai balance after non 0"
      );
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker bzz balance after non 0"
      );
      assert.equal(
        brokerEthBalanceAfter.toString(),
        brokerDaiBalance.toString(),
        "broker eth balance after non 0"
      );
      // Curve DAI balances correct
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve DAI is not as expected before mint"
      );
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.dai.curve_collateral_after_buy,
        "Curve DAI balance did not increase with mint"
      );
      // Token supply increases as expected
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "initial supply of bzz token unexpected"
      );
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_buy,
        "BZZ token supply after mint incorrect"
      );
      // Mock router balances change as expected
      assert.equal(
        mockRouterBzzBalance.toString(),
        mockRouterBzzBalanceAfter.toString(),
        "Mock router BZZ balance incorrect (non 0)"
      );
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount,
        "mock router starts with incorrect dai balance"
      );
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

      await assert.revertWith(
        brokerInstance
          .from(user)
          .redeem(
            test_settings.bzz.buyAmount,
            test_settings.dai.sellReward,
            time
          ),
        test_settings.errors.transfer_failed
      );
    });
    /**
     * Ensures that the burn function works as expected and all involved
     * parties (curve, mock router, broker, token) balances change correctly
     * in the various involved currencies (ETH, BZZ, DAI).
     */
    it("burn balance checks", async () => {
      let time = await brokerInstance.getTime();

      // User recives BZZ
      await tokenInstance
        .from(investor)
        .transfer(user.signer.address, test_settings.bzz.buyAmount);

      // approving the broker as a spender
      await tokenInstance
        .from(user)
        .approve(brokerInstance.contract.address, test_settings.bzz.buyAmount);

      let allowanceOfbroker = await tokenInstance.allowance(
        user.signer.address,
        brokerInstance.contract.address
      );
      let userDaiBalance = await collateralInstance.balanceOf(
        user.signer.address
      );
      let userBzzBalance = await tokenInstance.balanceOf(user.signer.address);
      let userEthBalance = await provider.getBalance(user.signer.address);
      let brokerDaiBalance = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalance = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalance = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalance = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalance = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalance = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalance = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupply = await tokenInstance.totalSupply();

      let daiCost = await curveInstance.sellReward(test_settings.bzz.buyAmount);
      let ethCost = await brokerInstance.sellRewardDai(daiCost);
      let buyPrice = await brokerInstance.sellReward(
        test_settings.bzz.buyAmount
      );

      // Minting 1000 BZZ for 0.5611 ETH
      await brokerInstance.from(user).redeem(
        test_settings.bzz.buyAmount,
        10,
        time
      );

      let userDaiBalanceAfter = await collateralInstance.balanceOf(
        user.signer.address
      );
      let userBzzBalanceAfter = await tokenInstance.balanceOf(
        user.signer.address
      );
      let userEthBalanceAfter = await provider.getBalance(user.signer.address);
      let brokerDaiBalanceAfter = await collateralInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerBzzBalanceAfter = await tokenInstance.balanceOf(
        brokerInstance.contract.address
      );
      let brokerEthBalanceAfter = await provider.getBalance(
        brokerInstance.contract.address
      );
      let curveDaiBalanceAfter = await collateralInstance.balanceOf(
        curveInstance.contract.address
      );
      let mockRouterDaiBalanceAfter = await collateralInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterBzzBalanceAfter = await tokenInstance.balanceOf(
        mockRouterInstance.contract.address
      );
      let mockRouterEthBalanceAfter = await provider.getBalance(
        mockRouterInstance.contract.address
      );
      let tokenSupplyAfter = await tokenInstance.totalSupply();

      // Testing expected behaviour
      assert.equal(
        allowanceOfbroker.toString(),
        test_settings.bzz.buyAmount.toString(),
        "broker allowance incorrect"
      );
      // User balance in various currencies expected
      assert.equal(userDaiBalance.toString(), 0, "User DAI balance incorrect");
      assert.equal(
        userBzzBalance.toString(),
        test_settings.bzz.buyAmount.toString(),
        "User BZZ balance incorrect"
      );
      assert.notEqual(
        userEthBalance.toString(),
        0,
        "User ETH balance incorrect"
      );
      // broker balances are as expected
      assert.equal(
        brokerDaiBalance.toString(),
        0,
        "broker incorrectly has a balance in DAI"
      );
      assert.equal(
        brokerBzzBalance.toString(),
        0,
        "broker incorrectly has a balance in BZZ"
      );
      assert.equal(
        brokerEthBalance.toString(),
        0,
        "broker incorrectly has a balance in ETH"
      );
      // Curve has correct balance
      assert.equal(
        curveDaiBalance.toString(),
        pre_mint_sequence.dai.cost,
        "Curve has unexpected balance after pre-mint"
      );
      // Router balances are as expected
      assert.equal(
        mockRouterDaiBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router has incorrect DAI balance"
      );
      assert.equal(
        mockRouterBzzBalance.toString(),
        0,
        "Mock router has incorrect BZZ balance"
      );
      assert.equal(
        mockRouterEthBalance.toString(),
        test_settings.eth_broker.eth.seed_eth_amount.toString(),
        "Mock router has incorrect ETH balance"
      );
      // Testing that pricing & supply are as expected
      assert.equal(
        tokenSupply.toString(),
        test_settings.eth_broker.bzz.initial_supply,
        "BZZ current supply incorrect"
      );
      assert.equal(
        daiCost.toString(),
        test_settings.eth_broker.dai.buy_cost,
        "DAI cost for token amount unexpected"
      );
      assert.equal(
        ethCost.toString(),
        test_settings.eth_broker.eth.sell_reward,
        "ETH cost for token amount unexpected"
      );
      assert.equal(
        buyPrice.toString(),
        test_settings.eth_broker.eth.sell_reward,
        "ETH (raw) cost for token amount unexpected"
      );
      // User balance in various currencies expected after burn
      assert.equal(
        userDaiBalanceAfter.toString(),
        0,
        "User incorrectly has left over DAI after burn"
      );
      assert.equal(
        userBzzBalanceAfter.toString(),
        0,
        "User incorrectly has left over BZZ after burn"
      );
      assert.notEqual(
        userEthBalanceAfter.toString(),
        userEthBalance.toString(),
        "User ETH balance did not change with burn"
      );
      // broker balances are as expected after burn
      assert.equal(
        brokerDaiBalanceAfter.toString(),
        0,
        "broker incorrectly has a balance in DAI"
      );
      assert.equal(
        brokerBzzBalanceAfter.toString(),
        0,
        "broker incorrectly has a balance in BZZ"
      );
      assert.equal(
        brokerEthBalanceAfter.toString(),
        0,
        "broker incorrectly has a balance in ETH after burn"
      );
      // Curve has correct balance
      assert.equal(
        curveDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.curve_balance_after_burn,
        "Curve has unexpected DAI balance after burn"
      );
      // Router balances are as expected after burn
      assert.equal(
        mockRouterDaiBalanceAfter.toString(),
        test_settings.eth_broker.dai.mock_router_dai_balance_after_burn.toString(),
        "Mock router has incorrect DAI balance"
      );
      assert.equal(
        mockRouterBzzBalanceAfter.toString(),
        0,
        "Mock router has incorrect BZZ balance"
      );
      assert.equal(
        mockRouterEthBalanceAfter.toString(),
        test_settings.eth_broker.eth.mock_router_eth_balance_after_burn.toString(),
        "Mock router has incorrect ETH balance"
      );
      // Token supply on curve correctly affected by burn
      assert.equal(
        tokenSupplyAfter.toString(),
        test_settings.eth_broker.bzz.after_burn,
        "Total supply incorrectly affected by burn"
      );
    });
  });
});

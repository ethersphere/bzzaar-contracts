const etherlime = require("etherlime-lib");
const ethers = require("ethers");

let curve_abi = require("../build/Curve.json");
let curve_test_abi = require("../build/Curve_test.json");
let token_abi = require("../build/Token.json");
let i_token_abi = require("../build/I_Token.json");
let i_curve_abi = require("../build/I_Curve.json");
let mock_dai_abi = require("../build/Mock_dai.json");
let eth_broker_abi = require("../build/Eth_broker.json");
let mock_router_abi = require("../build/Mock_router.json");

const pre_mint_sequence = {
  // These amounts are each half of the open market supply
  first_half: ethers.utils.parseUnits("31250000", 16),
  second_half: ethers.utils.parseUnits("31250000", 16),
  // This amount is the full open market
  whole: ethers.utils.parseUnits("62500000", 16),
  // Just under the whole amount
  almost_whole: ethers.utils.parseUnits("624999999999999999999999", 0),
  // More than expected
  above_expected: ethers.utils.parseUnits("68300000", 16),
  token_balance_after_burn: "1",
  // The cost for the pre-mint tokens in collateral
  dai: {
    cost: "1250000000000000000000000",
    above_expected_cost: "11378029335573157356496046",
    almost_whole_cost: "164980161587107946530",
    balance_after_burn: "1249999999999999999999999",
    co: "32000007936001269000",
  },
};

const tokenSettings = {
  dai: {
    name: "DAI",
    symbol: "DAI",
    decimals: 18,
  },
  bzz: {
    name: "BZZ",
    symbol: "BZZ",
    decimals: 16,
    cap: ethers.utils.parseUnits("1250000000000000000000000", 0),
  },
  weth: {
    name: "WETH",
    symbol: "WETH",
    decimals: 18,
  },
};

const test_settings = {
  bzz: {
    one: ethers.utils.parseUnits("1", tokenSettings.bzz.decimals),
    buyAmount: ethers.utils.parseUnits("1000", tokenSettings.bzz.decimals),
    sellAmount: ethers.utils.parseUnits("500", tokenSettings.bzz.decimals),
    one_token: ethers.utils.parseUnits("000000000000000001", 0),
    preMint_tokenBalance: "624995000000000000000000",
    supply_at_buy: ethers.utils.parseUnits("626000", 18),
  },
  dai: {
    buyCost: "330079372699073053579",
    firstOneCost: "330000079360012690",
    above_expected_firstOneCost: "5020849434941449787",
    sellReward: "165059531111780991856",
    sellReward_preMint: "164980161587107946530",
    sellReward_doubleMint: "165138938742513301487",
    user_two_collateral: "330238168905297915788",
    curve_collateral_after_buy: "1250330079372699073053579",
    curve_coll_at_prem: "1283806446221456618676654",
    one_cost: "33",
    curve_collateral_after_sell: "1250165019841587292061723",
    buy_cost_pre_mint: "330000003174400008253",
    buy_cost_token_burn: "330158761274565606157",
    max_supply_buy: "2684354560000000000000000000000000"
  },
  token_supply_after_mint: ethers.utils.parseUnits(
    "658781236895288088986887",
    0
  ),
  helper_value: "625000000000000000000000",
  large: {
    max_uint256: ethers.constants.MaxUint256,
    max_supply: ethers.utils.parseUnits("1.25", 25),
    just_under_max: ethers.utils.parseUnits("62500000", 16)
  },
  errors: {
    zero_address: "0x0000000000000000000000000000000000000000",
    curve_requires_pre_mint: "Curve equation requires pre-mint",
    max_spend: "Price exceeds max spend",
    min_reward: "Reward under min sell",
    owner: "Ownable: caller is not the owner",
    inactive: "Curve inactive",
    init: "Curve is init",
    minter_approval: "Curve is not minter",
    dai_slippage: "DAI required for trade above max",
    bzz_transfer_fail: "Transferring of bzz failed",
    dai_sell_slippage: "DAI required for trade below min",
    not_approved: "Transferring BZZ failed",
    transfer_failed: "ERC20: transfer amount exceeds balance",
    safe_math_add: "SafeMath: addition overflow",
    safe_math_sub: "SafeMath: subtraction overflow",
    safe_math_mul: "SafeMath: multiplication overflow",
    safe_math_div_zero: "SafeMath: division by zero"
  },
  eth_broker: {
    dai: {
      almost_one_eth: ethers.utils.parseUnits("588", 18),
      max_slippage_protect: "330079372699073053579",
      mock_router_dai_balance_after_mint: "9669920627300926946421",
      buy_cost: "329920652696127210368",
      curve_balance_after_burn: "1249670079347303872789632",
      mock_router_dai_balance_after_burn: "10329920652696127210368",
    },
    eth: {
      almost_one_eth: "999600000000000000",
      seed_eth_amount: ethers.utils.parseUnits("10000", 18),
      buy_price: "561134933588424191",
      buy_price_encoded: "0x7C98D3FC399B5FF",
      sell_reward: "560865109583416257",
      user_balance_before: "191408831393027855447563427831363046221",
      user_balance_after_mint: "191408831393027853859903276258779284924",
      mock_router_eth_balance_after_burn: "9999439134890416583743",
      mock_router_eth_balance_after_swap: "9999000400000000000000",
      mock_router_eth_balance_after_mint: "10000561134933588424191"
    },
    bzz: {
      initial_supply: "625000000000000000000000",
      after_buy: "625010000000000000000000",
      after_burn: "624990000000000000000000",
    },
  },
};

var erc20 = {
  events: {
    transfer: "Transfer",
    approval: "Approval",
    minterAdded: "MinterAdded",
    minterRemoved: "MinterRemoved",
  },
  errors: {
    transfer_sender: "ERC20: transfer from the zero address",
    transfer_recipient: "ERC20: transfer to the zero address",
    mint_account: "ERC20: mint to the zero address",
    burn_account: "ERC20: burn from the zero address",
    approve_owner: "ERC20: approve from the zero address",
    approve_spender: "ERC20: approve to the zero address",
    minter_is_minter: "MinterRole: caller does not have the Minter role",
    minter_has_role: "Roles: account already has role",
    minter_not_minter: "Roles: account does not have role",
    minter_is_role: "Roles: account is the zero address",
    cap_zero: "ERC20Capped: cap is 0",
    cap_exceeded: "ERC20Capped: cap exceeded",
  },
  constructor_valid: {
    name: "Swarm Token",
    symbol: "BZZ",
    decimals: 18,
    cap: ethers.utils.parseUnits("1000000", 18),
  },
  constructor_invalid: {
    cap: 0,
    zero_address: "0x0000000000000000000000000000000000000000",
  },
};

module.exports = {
  ethers,
  etherlime,
  curve_abi,
  curve_test_abi,
  token_abi,
  i_token_abi,
  i_curve_abi,
  mock_dai_abi,
  eth_broker_abi,
  mock_router_abi,
  pre_mint_sequence,
  tokenSettings,
  test_settings,
  erc20,
};

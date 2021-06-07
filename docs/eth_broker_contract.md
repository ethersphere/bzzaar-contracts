<div align="center">
<img src="../docs/Swarm_Logo_Small.png">
 <h1>BZZ Smart Contract Ecosystem</h1>
  <h3>ETH Broker Contract</h3>
</div>

---

# Index

#### [ETH Broker Contract](#eth-broker-contract)

- [Inheritance](#inheritance)
- [Implementation](#implementation)
    - [Views](#views)
        - [`buyPrice`](#buyprice)
        - [`sellReward`](#sellreward)
        - [`sellRewardDai`](#sellrewarddai)
        - [`getPath`](#getpath)
        - [`getTime`](#gettime)
    - [State Modifying](#state-modifying)
        - [`mint`](#mint)
        - [`burn`](#burn)
        - [Fallback Function](#fallback-function)

### Additional documentation

#### [< `README`](../README.md)
#### [~ ETH Broker Contract](./eth_broker_contract.md)
#### [> Audit Report and Info](../audit/Audit_report_and_info.md)
#### [> Admin Permissions and Risks](./admin_permissions_and_risks.md)
#### [> Token Contract](./token_contract.md)
#### [> Curve Contract](./curve_contract.md)

---

# ETH Broker Contract

The ETH broker contract enables users to be able to mint and burn [BZZ Tokens](./token_contract.md) with ETH rather than the collateral currency (DAI). 

## Implementation

Below is a function by function breakdown of the curve contract.

### Views

#### `buyPrice`

**Purpose:** The `buyPrice` function allows a user to check how much it will cost them in ETH to buy the desired amount of the bonded token (BZZ). 

**Parameters:**
- The `_amount` of bonded tokens the user would like to buy.

**Returns:**
- The ETH cost for buying the token amount.

**Possible Exceptions:**
- N/A

#### `sellReward`

**Purpose:** The `sellReward` function allows the user to check how much ETH they will get for selling the specified amount of bonded tokens (BZZ). 

**Parameters:**
- The `_amount` of bonded tokens the user would like to sell.

**Returns:**
- The ETH reward for selling the specified amount of bonded tokens. 

**Possible Exceptions:**
- N/A

#### `sellRewardDai`

**Purpose:** Allows a user to see the current conversion rate between the collateral token of the curve (DAI) and ETH.

**Parameters:**
- The `_daiAmount`.

**Returns:**
- The ETH amount the user can get for selling the specified DAI amount.

**Possible Exceptions:**
- N/A

#### `getPath`

**Purpose:** Gets the trading path needed by Uniswap to trade between DAI and ETH. 

**Parameters:**
- A `bool` switch for if it is a buy path.

**Returns:**
- If the `bool` is `true` then the path will return the WETH address followed by the DAI address, if `false` it will return the DAI address first, WETH second.

**Possible Exceptions:**
- N/A

#### `getTime`

**Purpose:** To return the current time stamp held on the blockchain.

**Parameters:**
- N/A

**Returns:**
- The current Unix time stamp. 

**Possible Exceptions:**
- N/A

### State Modifying

#### `mint`

**Purpose:** Allows a user to mint the curves bonded tokens (BZZ) with ETH. 

**Parameters:**
- The `_tokenAmount` of bonded tokens the user would like to buy.
- The `_maxDaiSpendAmount` is the max amount of collateral tokens the user wants to spend in order to buy the desired amount of bonded tokens. 
- The time stamp `_deadline` by which the transaction will expire and revert. 

**Returns:**
- The success state of the mint. If `true` the mint executed successfully.

**Events:**
```
// Emitted when tokens are minted
    event mintTokensWithEth(
        address indexed buyer,      // The address of the buyer
        uint256 amount,             // The amount of bonded tokens to mint
        uint256 priceForTokensDai,  // The price in DAI for the token amount
        uint256 EthTradedForDai,    // The ETH amount sold for DAI
        uint256 maxSpendDai         // The max amount of DAI to spend
    );
```

**Possible Exceptions:**
- If the required DAI amount is higher than the users `_maxDaiSpendAmount` then the revert message will be `"DAI required for trade above max"`.
- If the transferring of BZZ from the broker to the user fails the revert message will be `"Transferring of bzz failed"`. **Note** that should this revert message be received there is a fatal flaw. This message should not be received. 

#### `burn`

**Purpose:** Allows a user to burn their bonded tokens (BZZ) for ETH. 

**Parameters:**
- The `_tokenAmount` of bonded tokens (BZZ) the user would like to buy.
- The `_minDaiSellValue` is the minimum amount of collateral token (DAI) the user is willing to receive for selling the specified amount of bonded tokens. 
- The time stamp `_deadline` by which the transaction will expire and revert. 

**Returns:**
- The success state of the burn. If `true` the burn executed successfully.

**Events:**
```
// Emitted when tokens are burnt
    event burnTokensWithEth(
        address indexed seller,     // The address of the seller
        uint256 amount,             // The amount of bonded tokens to burn
        uint256 rewardReceivedDai,  // The amount of DAI received for selling
        uint256 ethReceivedForDai,  // How much ETH the DAI was traded for
        uint256 minRewardDai        // The min amount of DAI to sell for
    );
```

**Possible Exceptions:**
- If the DAI reward for selling the bonded tokens is below the users `_minDaiSellValue` then the revert message will be `"DAI required for trade below min"`.
- If the user has not approved the broker as a spender of their bonded tokens (BZZ) the revert message will be `"Transferring BZZ failed"`.
- If the broker fails to burn the bonded tokens against the curve the revert message will be `"Curve burn failed"`. **Note** that should this revert message be received there is a fatal flaw. This message should not be received. 

#### Fallback Function

**Purpose:** Allows the Uniswap router to send ETH to the broker.

**Parameters:** 
- N/A

**Returns:**
- N/A

**Events:**
- N/A

**Possible Exceptions:**
- If the `msg.sender` is not the router address the revert message will be `"ETH not accepted outside router"`.
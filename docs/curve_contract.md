<div align="center">
<img src="../docs/Swarm_Logo_Small.png">
 <h1>BZZ Smart Contract Ecosystem</h1>
  <h3>Curve Contract</h3>
</div>

---

# Index

#### [Curve Contract](#curve-contract)

- [Interface](#interface)
- [Inheritance](#inheritance)
- [Implementation](#implementation)
    - [Views](#views)
        - [`buyPrice`](#buyprice)
        - [`sellReward`](#sellreward)
        - [`isCurveActive`](#iscurveactive)
        - [`requiredCollateral`](#requiredcollateral)
        - [`bondedToken`](#bondedtoken)
        - [`collateralToken`](#collateraltoken)
    - [State Modifying](#state-modifying)
        - [`init`](#init)
        - [`mint`](#mint)
        - [`burn`](#burn)
        - [`shutDown`](#shutdown)

### Additional documentation

#### [< `README`](../README.md)
#### [~ Curve Contract](./curve_contract.md)
#### [> Audit Report and Info](../audit/Audit_report_and_info.md)
#### [> Admin Permissions and Risks](./admin_permissions_and_risks.md)
#### [> Token Contract](./token_contract.md)
#### [> ETH Broker Contract](./eth_broker_contract.md)

---

# Curve Contract

The curve contract enables users to be able to mint and burn [BZZ Tokens](./token_contract.md) with the selected collateral currency (DAI).

## Interface

The full interface of publicly callable functions for the Token contract can be found [here](../contracts/I_Curve.sol).

## Inheritance

The curve contract inherits `ownable` and `I_Curve`. For more information around the `ownable` risks, see [admin permissions and risks: Ownable](./admin_permissions_and_risks.md#ownable).

## Implementation

Below is a function by function breakdown of the curve contract.

### Views

Below is a function by function breakdown of the `view` (non state changing) curve functions. 

#### `buyPrice`

**Purpose:** The `buyPrice` function allows a user to check how much it will cost them in the collateral token (DAI) to buy the desired amount of the bonded token (BZZ). 

**Parameters:** 
- The `_amount` of bonded tokens (BZZ) the user would like to buy.

**Returns:**
- The `collateralRequired` in the collateral token (DAI) to buy the desired amount of bonded tokens.

**Possible Exceptions:** 
- If the curve has not been initialised the function will revert with `"Curve inactive"`.

#### `sellReward`

**Purpose:** The `sellReward` function allows a user to check how much they can get in collateral tokens (DAI) for selling the desired amount of bonded tokens (BZZ).

**Parameters:**
- The `_amount` of bonded tokens (BZZ) the user would like to sell.

**Returns:**
- The `collateralReward` in collateral token (DAI) the user would receive for selling the specified amount of bonded tokens (BZZ).

**Possible Exceptions:**
- If the curve has not been initialised the function will revert with `"Curve inactive"`.

#### `isCurveActive`

**Purpose:** Allows a user to check that the curve contract has been initialised and has not been shut down.

**Parameters:**
- N/A

**Returns:**
- Will return `true` if the curve is initialised and active. Will return `false` if the curve has not been initialised or if the curve has been shut down.

**Possible Exceptions:**
- N/A

#### `requiredCollateral`

**Purpose:** Allows a user to check how much collateral token (DAI) would be needed to initialise the curve given the `_initialSupply` passed in. This allows a user to know how many collateral tokens to approve the curve as a spender on in order to initialise the contract. 

**Parameters:**
- The `_initialSupply` expected.

**Returns:**
- The amount of collateral tokens needed in order to back fill the curve for all the minted tokens.

**Possible Exceptions:**
- N/A. **Note** that this function will not revert if the `_initialSupply` is less than the required pre-mint amount.

#### `bondedToken`

**Purpose:** Allows a user to check the address of the bonded token (BZZ).

**Parameters:**
- N/A

**Returns:**
- The address of the bonded token.

**Possible Exceptions:**
- N/A

#### `collateralToken`

**Purpose:** Allows a user to check the address of the collateral token (DAI).

**Parameters:**
- N/A

**Returns:**
- The address of the collateral token.

**Possible Exceptions:**
- N/A

### State Modifying 

Below is a function by function breakdown of the state modifying curve functions. 

#### `init`
This function will initialise the curve so that it can start functioning as the bonded curve to the bonded token. This function requires the caller to have approved the curve for the required collateral amount (this can be checked by calling [`requiredCollateral`](#requiredcollateral)). The user will also need to have the same required amount of collateral token in their wallet.

**Purpose:** Allows a user to initialise the curve contract, and back fill the collateral token need for the pre-mint amount.

**Parameters:**
- N/A

**Returns:**
- N/A

**Possible Exceptions:**
- If the curve has already been initialised the revert message will be `"Curve is init"`.
- If the curve has not been given `minterRole` permissions on the bonded token the revert message will be `"Curve is not minter"`.
- If the bonded tokens supply is less than the expected pre-mint amount the revert message will be `"Curve equation requires pre-mint"`.
- If the calling address has not _both approved and has_ the required collateral to back fill the curve in collateral tokens for the pre-mint amount the revert message will be `"Failed to collateralized the curve"`.

#### `mint`

**Purpose:** Allows the user to mint bonded tokens in exchange for the collateral token cost.

**Parameters:**
- The `_amount` of bonded tokens the user wants to buy.
- The `_maxCollateralSpend` is the max amount of collateral tokens the user wants to spend in order to buy the desired amount of bonded tokens. 

**Returns:**
- The `success` state of the mint. If `true` the mint executed successfully.

**Events:**
```
// Emitted when tokens are minted
    event mintTokens(
        address indexed buyer,      // The address of the buyer
        uint256 amount,             // The amount of bonded tokens to mint
        uint256 pricePaid,          // The price in collateral tokens 
        uint256 maxSpend            // The max amount of collateral to spend
    );
```

**Possible Exceptions:**
- If the cost to buy the `_amount` of bonded tokens is higher than the users `_maxCollateralSpend` amount, the revert message will be `"Price exceeds max spend"`.
- If the user has not approved the curve as a spender of the required amount of collateral the revert message will be `"Transferring collateral failed"`.
- If the bonded token mint fails the revert message will be `"Minting tokens failed"`. **Note** that should this revert message be received there is a fatal flaw. This message should not be received. 

#### `burn`

**Purpose:** Allows the user to sell bonded tokens in exchange for the collateral token reward.

**Parameters:**
- The `_amount` of tokens the user would like to sell.
- The `_minCollateralReward` is the minimum amount of collateral the user is willing to receive in exchange for their bonded tokens.

**Returns:**
- The `success` state of the burn. If `true` the burn executed successfully.

**Events:**
```
// Emitted when tokens are burnt
    event burnTokens(
        address indexed seller,     // The address of the seller
        uint256 amount,             // The amount of bonded tokens to sell
        uint256 rewardReceived,     // The collateral tokens received
        uint256 minReward           // The min collateral reward for tokens
    );
```

**Possible Exceptions:**
- If the reward for selling the `_amount` of bonded tokens is lower than the `_minCollateralReward` the revert message will be `"Reward under min sell"`.
- If the curve fails to send the user the required amount of collateral tokens the revert message will be `"Transferring collateral failed"`. **Note** that should this revert message be received there is a fatal flaw. This message should not be received. 

#### `shutDown`

**Purpose:** Allows the owner to shut down the curve, so that the bonding curve can no longer mint or burn user tokens.

**Parameters:**
- N/A

**Returns:**
- N/A

**Events:**
```
// Emitted when the curve is permanently shut down
    event shutDownOccurred(address indexed owner);
```

**Possible Exceptions:**
- Should the curve already be removed as a `minterRole` from the token the revert message will be `"Roles: account does not have role"`. **Note** that should this revert message be received there is a fatal flaw. This message should not be received.

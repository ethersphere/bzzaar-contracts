<div align="center">
<img src="../docs/Swarm_Logo_Small.png">
 <h1>BZZ Smart Contract Ecosystem</h1>
  <h3>Admin Permissions and Risks</h3>
</div>

---

# Index

#### [Admin Permissions and Risks](#admin-permissions-and-risks)

- [Ownable](#ownable) in Curve 
  - [Owner Permissions](#owner-permissions)
  - [Risks of Ownership](#risks-of-ownership)
- [MinterRole](#minterrole) in Token
    - [MinterRole permissions](#minterrole-permissions)
    - [Risks of MinterRole](#risks-of-minterrole)
- [Shut Down](#shutdown) in Curve
  - [Shutdown Risks](#shutdown-risks)
- [Initialising](#initialising) in curve

### Additional documentation

#### [< `README`](../README.md)
#### [~ Admin Permissions and Risks](./admin_permissions_and_risks.md)
#### [> Audit Report and Info](../audit/Audit_report_and_info.md)
#### [> Token Contract](./token_contract.md)
#### [> Curve Contract](./curve_contract.md)
#### [> ETH Broker Contract](./eth_broker_contract.md)

---

# Admin Permissions and Risks

## Ownable

The curve is Ownable, using the [OpenZeppelin Ownable smart contract](https://docs.openzeppelin.com/contracts/2.x/api/ownership). Through ownership, the owner can call functions that require elevated permissions. These elevated permissions will be explored in each of the specific instances. In this section, we will specifically discuss the ownable permissions and risks.

### Owner Permissions

1. The owner is able to call role protected functions `onlyOwner()`.
2. The owner is able to renounce their ownership `renounceOwnership()`.
3. The owner is able to transfer their ownership role to another address `transferOwnership(address newOwner)`.

### Risks of Ownership

It should be noted that the `owner` address will be a multiple signature smart contract wallet. This significantly decreases the risk of a "rouge" owner, and the risk of the owner wallet becoming compromised.

1. Risks associated with raised permissions will be explored in the specific instances in the shutdown section.
2. Should the owner choose to renounce their ownership the curve will not have an owner, and a new one can never be added. The side affects of the curve becoming un-owned will be explored in the specific instances in the shutdown section.
3. Should the owner transfer ownership away from the multi-sig the new owner would be able to execute the raised permission protected functions.

## MinterRole

The token contract is both [OpenZeppelin (v2.x) `mintable`](https://docs.openzeppelin.com/contracts/2.x/api/token/erc20#ERC20Mintable) and [OpenZeppelin (v2.x) `burnable`](https://docs.openzeppelin.com/contracts/2.x/api/token/erc20#ERC20Burnable). In the token there is a permissioning change so that the `burnable` functions are protected by the same `minterRole` protections provided by the `mintable` contract. 

### MinterRole permissions

Unlike the [Ownable](#ownable) role protections, `mintable` allows for multiple addresses to have the `mintable` role on the token contract. This role can be transferred, renounced, and new addresses added. 

This role allows addresses with the permissions to mint tokens freely. As burnable has been added to the protected role, addresses will also need the `minterRole` in order to `burn` and `burnFrom` against the token. The `burn` and `burnFrom` functionality was added under this protection to prevent a situation where a user might unknowingly burn tokens against the token contract instead of the curve contract, resulting in them permanently loosing the tokens without compensation. 

### Risks of MinterRole

It should be noted that the `minterRole` will never be owned by more than one address. When the token is deployed the `minterRole` will be held by the same multiple signature smart contract wallet as the `ownable` role on the curve. During their mintable period, the pre-mint amount (125 000 000 bonded tokens) will be minted and distributed. When the curve is deployed the `minterRole` will be transferred, leaving the curve as the sole minter. Should the curve ever shut down, the token supply will become capped at the circulating supply at that time. 

1. Should a malicious address gain `minterRole` permissions, they would be able to mint tokens unchecked. The address would not be able to burn other users tokens unless those users have approved the address as a spender.
2. Should the `minterRole` address choose to renounce their role without passing the permissions onto the curve, the token supply will become capped at the circulating supply and the curve will never be functional (it requires `minterRole` permissions in order to function).

## Shutdown

The curve has a shut down function protected by the `onlyOwner()` modifier. This `shutDown()` function allows the owner to permanently disable the curve's functionality, as well as the curve renouncing it's minter role on the token contract. Once the shut down function is called there will no longer be a minter on the token contract, effectively capping the token supply at the supply at the time of shut down.

### Shutdown Risks

1. Should an admin choose to, they are be able to shut down the curve and cap the supply. They would not be able to withdraw any collateral from the curve or mint themselves any tokens.
2. Should an admin choose to renounce their ownership, the curve contract would be left without an owner. This would mean that the curve could never be shut down. This could have negative implications in the instance of a vulnerability being discovered on the curve. The curve would not be able to be disabled, and the potential for the curve to be drained is present.
3. Should the ownership be transferred to a rouge account, the new owner would be able to cap the token supply by shutting down the curve contract.

## Initialising

This section will briefly cover the initialisation process, as while this is not a admin/owner protected role, it is important that the process is understood.

The `init()` function allows _any_ address to call it. Calling init will only succeed if the following criteria is met:

1. The curve contract has been deployed (`msg.sender` will become owner, see [Ownable](#ownable) for permissions and risks).
2. The token has been set up as a minter on the BZZ token contract.
3. The curve has not already been initialized.
4. The BZZ token contract has already minted the required pre-mint amount.
5. The caller has approved the curve as a spender of the required collateral amount in the given collateral currency (DAI). This amount can be checked by calling `requiredCollateral()` on the curve contract.

If all the above criteria is met the function will transfer the required amount of collateral to the curve from the calling user. The function will then activate the curve and the curve will become operational for buy and sell functionally.

---
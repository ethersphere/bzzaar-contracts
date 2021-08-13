<div align="center">
<img src="../docs/Swarm_Logo_Small.png">
 <h1>BZZ Smart Contract Ecosystem</h1>
 <h3>Audit Findings & Responses</h3>
</div>

---

# Audit Findings & Responses

Issue | Status | Project Notes
|:----|:------:|:-------------|
| QSP-1 | Resolved | Additional checks were added to `Eth_broker.sol` to ensure no blank addresses (`0x0`) can be entered.
| QSP-2 | Resolved | Flattered file contained artifacts of older versions of the `Eth_portal.sol` and `Curve.sol` contracts. Files have been removed. `Eth_broker.sol` and `Curve.sol` have reentrancy guards.
| QSP-3 | Acknowledged | `increaseAllowance` and `decreaseAllowance` are available on the `Token.sol` contract. App developers have been informed to use increase and decrease over approve.
| QSP-4 | Acknowledged | Should Ether be forcibly sent to the contract a user on mint or burn may receive more Ether than expected. This does not affect any logic nor UX negatively.
| QSP-5 | Resolved | Checks have been added. See QSP-2.
| QSP-6 | Resolved | Updated visibility of `Curve.sol` `public` functions to `external`. 
| QSP-7 | Resolved | Additional `require`'s added for `approve` and `mintTo` calls. `require` not added to Uniswap calls as they handle failure through `revert`.
| QSP-8 | Resolved | Variables mentioned are actually intended on being `constant`. Declaration has been updated to `constant`. `openMarketSupply` has been renamed to make it more clear as `_MARKET_OPENING_SUPPLY`.
| QSP-9 | Resolved | Additional documentation was added to clear up the understanding of the `_helper` function in the `Curve.sol`. 
| QSP-10 | Resolved | Changes `Eth_broker.sol` `redeem` function to use `dai_.balanceOf(address(this))` instead of `_minDaiSellValue`.
| QSP-11 | Resolved | Variables where artifacts of outdated math implementation. They have been removed. 
| QSP-12 | Resolved | See QSP-2.
| QSP-13 | Resolved | See QSP-2. Additional unused return value of `_mint` in `Curve.sol` has also been removed and tests updated.
| Code Documentation | Resolved | Mentioned documentation has been updated to reflect code functionally. 
| Adherence to Best Practices | Resolved | Common functionality in `Curve` `mint` and `mintTo` moved to an internal function `_commonMint`. Same thing for `Eth_broker` `mint` and `mintTo`. Variable naming between the `Curve` and `Broker` have been updated to be more consistent. 

### Commit Hash

Phase (Delivery Date, YYYY-MM-DD) | Commit Hash
|:--------------------|:-----------|
| Initial Audit (2021-02-10) | 9a9a0ae71f1294faa76c12642809159361820ea3 |
| Final Audit (2021-02-24) | dc28d883e496759eb2115e05a705fd714ae8473b

### Status Reference

| Status | Definition |
|:-------|:-----------|
| Unresolved | Acknowledged the existence of the risk, and decided to accept it without engaging in special efforts to control it. |
| Acknowledged | The issue remains in the code but is a result of an intentional business or design decision. As such, it is supposed to be addressed outside the programmatic means, such as: 1) comments, documentation, README, FAQ; 2) business processes; 3) analyses showing that the issue shall have no negative consequences in practice (e.g., gas analysis, deployment settings). |
| Resolved | Adjusted program implementation, requirements or constraints to eliminate the risk. |
| Mitigated | Implemented actions to minimize the impact or likelihood of the risk. |


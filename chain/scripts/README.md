# Warp Core Deploy Script

## Introduction

Welcome to the Warp Core deploy script! We've augmented the standard Hardhat deploy script with some extra features that we find make life much easier. As a result, there may be a couple of things that are a bit different than how you're used to deploying using Ethers and Hardhat. This README is meant to get you up to speed.

## How to Deploy Using `deploy.ts`

### Simple Deploy
One thing introduced in the deploy script is a custom `deploy()` function. You should be using this instead of the standard `ethers.getContractFactory("MyContract");` pattern. All you need to do is pass in the name of the contract like you would to `getContractFactory`. Using a contract called `MyContract`, for example, you'd do something like:
```typescript
const myContract = await deploy("MyContract");
```
The deploy() function returns a `DeploymentObject`, a custom type that makes auto-verification easier:
```typescript
interface DeploymentObject {
  name: string;
  address: string;
  args: any;
  contract: Contract;
}
```
### Calling Functions on Deployed Contracts
If `MyContract` has a function `init()` that you would like to call as part of the deployment, you would call it like this:
```typescript
await myContract.contract.init();
```
### Constructor Arguments
Arguments should be included in the call to the `deploy()` function in an array after the name of the contract. If you had another contract being deployed called `"SecondContract"`, and it needed the address of `MyContract` as a constructor argument, the process would look like this:
```typescript
const secondContract = await deploy("Second Contract", [myContract.address]);
```
### Transaction Parameters
If you'd like to fine-tune the paramters of the transaction (setting the gas limit manually, for example), this can be included in an object as the third argument to `deploy()`. If you don't have any constructor arguments, leave an empty array as the second. For example, if, in the example above, gas estimations for deploying `MyContract` aren't working, you can set the gas limit manually like this:
```typescript
const myContract = await deploy("MyContract", [], { gasLimit: 300000 }));
```
The available parameters should be identical to the standrad [overrides](https://docs.ethers.io/v5/api/contract/contract/#Contract--methods) in an Ethers contract call.
### Libraries
If your contract is relying on libraries, they can be included as the fourth and last argument to `deploy()`. As above, if there are no arguments, an empty array should be passed in the second argument, and if you aren't passing in any custom transaction parameters, an empty array should be passed in as the third. The libraries can be passed in an object with their name as the key, and the address of the deployed library as the value. If `MyContract` used a deployed instance of `SafeMath`, for example:
```typescript
const myContract = await deploy("MyContract", [], {}, { "SafeMath": "0x..." });
```

## Auto-Verification

The real superpower of this script (so far) is automatic Etherscan verification. In order to get this, we leverage Hardhat's Etherscan [plugin]https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html). In order to use this, you'll need an [Etherscan](https://etherscan.io) API key. You can create up to three with a free account using the "API-KEYS" option in your personal dashboard. Once you have one, put it in your `.env` as the `ETHERSCAN_API_KEY`. When you deploy to any network supported on Etherscan, your contract will automatically be verified.

In order to do this, the deploy script has a pause built in to it to allow Etherscan's backends to update after the contract is deployed. Please do not close the terminal process during the pause.

Currently, the supported networks are:
 - Ethereum Mainnet
 - Ropsten
 - Rinkeby
 - Goerli
 - Kovan

We are investigating the best way to add chains from other platforms.

### Adding Networks

If you would like to add another network, you may be able to add it manually to your instance of Warp Core. You'll need the network name as Hardhat recognizes it (what you'll set as the `defaultNetwork` in `hardhat.config` or pass in using the `--network` flag).

If you look in `deploy.ts`, you'll see an array called `verifiableNetworks`. This array keeps track of the different networks Warp Core can auto-verify on. Add your network's name as a string. Put the API key for the block explorer on your chain of choice, and don't forget to switch the `defaultNetwork`, or pass in your chain using the `--network` flag.

Some chains may not work. There is a known issue with the Blockscout block explorers (POA, xDai, and Sokol), for example.

# Bzzzar Hardhat Migration

This repo has been set up to move the Bzzzar contracts from an Etherlime development environment to Hardhat, as Etherlime is no longer under active development. This was necessitated due to changes to the Eth Broker contract which caused the contract to longer pass its test suite in the Etherlime environment.

This branch of the repo still has failing tests in the Eth Broker test suite. There was a desire for separate PRs for migrating to Hardhat and fixing the Eth Broker tests. As a result, in this branch the tests and deploy script have been migrated to Hardhat, but broken tests have note been fixed.

### Setup

Install the relevant packages with:
```
yarn
```

### Running the Tests

To run all of the tests:

run
```
yarn test:chain
```

The command for running only the Eth Broker tests is:
```
yarn test:chain ./packages/chain/test/broker.test.js
```

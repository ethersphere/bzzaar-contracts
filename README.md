# Bzzzar Hardhat Migration

This repo has been set up to move the Bzzzar contracts from an Etherlime development environment to Hardhat, as Etherlime is no longer under active development. This was necessitated due to changes to the Eth Broker contract which caused the contract to longer pass its test suite in the Etherlime environment.

Due to the time-intensive nature of converting the test suite, at this juncture only the tests for the Eth Broker (`/test/broker.test.ts`) have been converted into the Hardhat-Waffle test format. Similarly, the deploy script is not yet converted to Hardhat.

### Setup

Install the relevant packages with:
```
yarn
```

### Running the Eth Broker Tests

To run all of the tests:

run
```
yarn test:chain
```

The command for running only the Eth Broker tests is:
```
yarn test:chain ./test/broker.test.js
```
The other tests are all passing in the original Etherlime environment, even though we would like to migrate them to Hardhat too.

### Known Issues

#### Running out of funds

The deployer account runs out of Eth if the Eth Broker tests are run all at once. Our current solution until we can find the cause in the tests is to run the tests one at a time, and to restart the chain after each test. You can single out a particular test by tagging it with `only`, for example:
```javascript
it.only("burn balance checks", async () => {
```
This would make only the `"burn balance checks"` test run. You can then rest the dev chain (CTRL+C to stop then `yarn chain` again to run), and switch to the next test.

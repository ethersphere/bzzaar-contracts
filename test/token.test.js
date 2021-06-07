const { 
    ethers,
    etherlime,
    token_abi,
    erc20,
    tokenSettings
} = require("./settings.test.js");

describe("🤑 Token Tests", () => {
    // Users
    let insecureDeployer = accounts[0];

    // Deployer instance
    let deployer;

    // Contract instances
    let tokenInstance;

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(insecureDeployer.secretKey);
    });

    describe("Parent input validation checks", () => {
        it("(detailed) Correct deployment", async () => {
            tokenInstance = await deployer.deploy(
                token_abi,
                false,
                tokenSettings.bzz.name,
                tokenSettings.bzz.symbol,
                tokenSettings.bzz.decimals,
                tokenSettings.bzz.cap
            );

            let name = await tokenInstance.name();
            let symbol = await tokenInstance.symbol();
            let decimals = await tokenInstance.decimals();

            assert.equal(
                name,
                tokenSettings.bzz.name,
                "Name parameter incorrect"
            );
            assert.equal(
                symbol,
                tokenSettings.bzz.symbol,
                "Symbol parameter incorrect"
            );
            assert.equal(
                decimals,
                tokenSettings.bzz.decimals,
                "Decimals parameter incorrect"
            );
        });

        it("🚫 (cap) Can't deploy a 0 cap", async () => {
            await assert.revertWith(
                tokenInstance = deployer.deploy(
                    token_abi,
                    false,
                    erc20.constructor_valid.name,
                    erc20.constructor_valid.symbol,
                    erc20.constructor_valid.decimals,
                    erc20.constructor_invalid.cap
                ), 
                erc20.errors.cap_zero
            );
        });
    });
});

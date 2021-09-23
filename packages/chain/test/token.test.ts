import  { expect, assert } from "chai";
import { ethers } from "hardhat";
import  { 
    erc20,
    tokenSettings
} from "./settings.test";

describe("🤑 Token Tests", () => {
    // Contract instance
    let tokenInstance;

    describe("Parent input validation checks", () => {
        it("(detailed) Correct deployment", async () => {
            const tokenArtifacts = await ethers.getContractFactory("Token");
            tokenInstance = await tokenArtifacts.deploy(
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
            const tokenArtifacts = await ethers.getContractFactory("Token");
            await expect(tokenArtifacts.deploy(
                erc20.constructor_valid.name,
                erc20.constructor_valid.symbol,
                erc20.constructor_valid.decimals,
                erc20.constructor_invalid.cap
            )).to.be.revertedWith(erc20.errors.cap_zero);
        });
    });
});

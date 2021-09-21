pragma solidity 0.5.0;

/**
 * @title   Interface Curve
 * @notice  This contract acts as an interface to the curve contract. For
 *          documentation please see the curve smart contract.
 */
interface I_Curve {
    
    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /**
     * @notice This function is only callable after the curve contract has been
     *         initialized.
     * @param  _amount The amount of tokens a user wants to buy
     * @return uint256 The cost to buy the _amount of tokens in the collateral
     *         currency (see collateral token).
     */
    function buyPrice(uint256 _amount)
        external
        view
        returns (uint256 collateralRequired);

    /**
     * @notice This function is only callable after the curve contract has been
     *         initialized.
     * @param  _amount The amount of tokens a user wants to sell
     * @return collateralReward The reward for selling the _amount of tokens in the
     *         collateral currency (see collateral token).
     */
    function sellReward(uint256 _amount)
        external
        view
        returns (uint256 collateralReward);

    /**
      * @return If the curve is both active and initialised.
      */
    function isCurveActive() external view returns (bool);

    /**
      * @return The address of the collateral token (DAI)
      */
    function collateralToken() external view returns (address);

    /**
      * @return The address of the bonded token (BZZ).
      */
    function bondedToken() external view returns (address);

    /**
      * @return The required collateral amount (DAI) to initialise the curve.
      */
    function requiredCollateral(uint256 _initialSupply)
        external
        view
        returns (uint256);

    // -------------------------------------------------------------------------
    // State modifying functions
    // -------------------------------------------------------------------------

    /**
     * @notice This function initializes the curve contract, and ensure the
     *         curve has the required permissions on the token contract needed
     *         to function.
     */
    function init() external;

    /**
      * @param  _amount The amount of tokens (BZZ) the user wants to buy.
      * @param  _maxCollateralSpend The max amount of collateral (DAI) the user is
      *         willing to spend in order to buy the _amount of tokens.
      * @return The status of the mint. Note that should the total cost of the
      *         purchase exceed the _maxCollateralSpend the transaction will revert.
      */
    function mint(uint256 _amount, uint256 _maxCollateralSpend)
        external
        returns (bool success);

    /**
      * @param  _amount The amount of tokens (BZZ) the user wants to buy.
      * @param  _maxCollateralSpend The max amount of collateral (DAI) the user is
      *         willing to spend in order to buy the _amount of tokens.
      * @param  _to The address to send the tokens to.
      * @return The status of the mint. Note that should the total cost of the
      *         purchase exceed the _maxCollateralSpend the transaction will revert.
      */
    function mintTo(
        uint256 _amount, 
        uint256 _maxCollateralSpend, 
        address _to
    )
        external
        returns (bool success);

    /**
      * @param  _amount The amount of tokens (BZZ) the user wants to sell.
      * @param  _minCollateralReward The min amount of collateral (DAI) the user is
      *         willing to receive for their tokens.
      * @return The status of the burn. Note that should the total reward of the
      *         burn be below the _minCollateralReward the transaction will revert.
      */
    function redeem(uint256 _amount, uint256 _minCollateralReward)
        external
        returns (bool success);

    /**
      * @notice Shuts down the curve, disabling buying, selling and both price
      *         functions. Can only be called by the owner. Will renounce the
      *         minter role on the bonded token.
      */
    function shutDown() external;
}

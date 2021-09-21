pragma solidity 0.5.0;

/**
 * @title   Interface Token
 * @notice  Allows the Curve contract to interact with the token contract
 *          without importing the entire smart contract. For documentation
 *          please see the token contract:
 *          https://gitlab.com/linumlabs/swarm-token
 * @dev     This is not a full interface of the token, but instead a partial
 *          interface covering only the functions that are needed by the curve.
 */
interface I_Token {
    // -------------------------------------------------------------------------
    // IERC20 functions
    // -------------------------------------------------------------------------

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    // -------------------------------------------------------------------------
    // ERC20 functions
    // -------------------------------------------------------------------------

    function increaseAllowance(address spender, uint256 addedValue)
        external
        returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        returns (bool);

    // -------------------------------------------------------------------------
    // ERC20 Detailed
    // -------------------------------------------------------------------------

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    // -------------------------------------------------------------------------
    // Burnable functions
    // -------------------------------------------------------------------------

    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;

    // -------------------------------------------------------------------------
    // Mintable functions
    // -------------------------------------------------------------------------

    function isMinter(address account) external view returns (bool);

    function addMinter(address account) external;

    function renounceMinter() external;

    function mint(address account, uint256 amount) external returns (bool);

    // -------------------------------------------------------------------------
    // Capped functions
    // -------------------------------------------------------------------------

    function cap() external view returns (uint256);
}

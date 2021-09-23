pragma solidity 0.5.0;

import "./I_router_02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Mock_router is I_router_02 {
    address internal weth_;

    constructor(address _weth) public payable {
        weth_ = _weth;
    }

    function WETH() external pure returns (address) {
        return 0xacDdD0dBa07959Be810f6cd29E41b127b29E4A8a;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts) 
    {
        require(
            path[0] != address(0),
            "Valid path is required"
        );
        amounts = new uint256[](2);
        amounts[0] = amountIn; // Eth for DAI
        amounts[1] = 0;
    }

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(
            path[0] != address(0),
            "Valid path is required"
        );
        // AmountOut DAI
        amounts = new uint256[](2);
        amounts[0] = (amountOut*17)/10000; // Eth for DAI
        amounts[1] = 0;
    }

    // State modifying
    function swapETHForExactTokens(
        uint256 amountOut,          // DAI
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        // Getting the eth amount from the internal calculation 
        amounts = this.getAmountsIn(amountOut, path);
        // Ensureing the user has sent enough ETH for their desired amountOut
        require(msg.value >= amounts[0], "Insufficient Eth sent");
        require(
            deadline != 0,
            "Invalid deadline"
        );
        // Sending the user the required amount of DAI
        // Note that this contract will need to be seeded with collateral
        IERC20(path[1]).transfer(to, amountOut);

        return(amounts);
    }

    function swapExactTokensForETH(
        uint256 amountIn,           // DAI amount (pre-approved)
        uint256 amountOutMin,       // Min ETH for DAI amount
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        // Transfering DAI to this router 
        IERC20(path[0]).transferFrom(
            msg.sender, 
            address(this),
            amountIn
        );
        amounts = this.getAmountsIn(amountIn, path);
        // Checks rates user will get within min range
        require(
            amounts[0] >= amountOutMin,
            "Receivable ETH less than min"
        );
        require(
            to != address(0),
            "Mock needs to == msg.sender"
        );
        require(
            deadline != 0,
            "Invalid deadline"
        );
        // Sending user ETH amount
        to.call.value(amounts[0])("");

        return(amounts);
    }

    function() external payable {}
}

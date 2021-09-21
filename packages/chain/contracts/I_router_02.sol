pragma solidity 0.5.0;

/**
  * Please note that this interface was created as IUniswapV2Router02 uses
  * Solidity >= 0.6.2, and the BZZ infastructure uses 0.5.0. 
  */
interface I_router_02 {
    // Views & Pure
    function WETH() external pure returns (address);

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
   
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);

    // State modifying
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn, 
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline
    )
        external
        returns (uint[] memory amounts);
}
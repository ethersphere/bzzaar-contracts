pragma solidity 0.5.0;

import "./I_Curve.sol";
import "./I_router_02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Eth_broker {
    // The instance of the curve
    I_Curve internal curve_;
    // The instance of the Uniswap router
    I_router_02 internal router_;
    // The instance of the DAI token
    IERC20 internal dai_;
    // The address for the underlying token address
    IERC20 internal bzz_;
    // Mutex guard for state modifying functions
    uint256 private status_;
    // States for the guard 
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    // Emitted when tokens are minted
    event mintTokensWithEth(
        address indexed buyer,      // The address of the buyer
        uint256 amount,             // The amount of bonded tokens to mint
        uint256 priceForTokensDai,  // The price in DAI for the token amount
        uint256 EthTradedForDai,    // The ETH amount sold for DAI
        uint256 maxSpendDai         // The max amount of DAI to spend
    );
    // Emitted when tokens are minted
    event mintTokensToWithEth(
        address indexed buyer,      // The address of the buyer
        address indexed receiver,   // The address of the receiver of the tokens
        uint256 amount,             // The amount of bonded tokens to mint
        uint256 priceForTokensDai,  // The price in DAI for the token amount
        uint256 EthTradedForDai,    // The ETH amount sold for DAI
        uint256 maxSpendDai         // The max amount of DAI to spend
    );
    // Emitted when tokens are burnt
    event burnTokensWithEth(
        address indexed seller,     // The address of the seller
        uint256 amount,             // The amount of bonded tokens to burn
        uint256 rewardReceivedDai,  // The amount of DAI received for selling
        uint256 ethReceivedForDai,  // How much ETH the DAI was traded for
        uint256 minRewardDai        // The min amount of DAI to sell for
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /**
      * @notice Checks if the curve is active (may be redundant).
      */
    modifier isCurveActive() {
        require(curve_.isCurveActive(), "Curve inactive");
        _;
    }

    /**
      * @notice Protects against re-entrancy attacks
      */
    modifier mutex() {
        require(status_ != _ENTERED, "ReentrancyGuard: reentrant call");
        // Any calls to non Reentrant after this point will fail
        status_ = _ENTERED;
        // Function executes
        _;
        // Status set to not entered
        status_ = _NOT_ENTERED;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _bzzCurve, 
        address _collateralToken, 
        address _router02
    ) 
        public 
    {
        require(
            _bzzCurve != address(0) &&
            _collateralToken != address(0) &&
            _router02 != address(0),
            "Addresses of contracts cannot be 0x address"
        );
        curve_ = I_Curve(_bzzCurve);
        dai_ = IERC20(_collateralToken);
        router_ = I_router_02(_router02);
        // Setting the address of the underlying token (BZZ)
        bzz_ = IERC20(curve_.bondedToken());
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /**
     * @notice This function is only callable after the curve contract has been
     *         initialized.
     * @param  _amount The amount of tokens a user wants to buy
     * @return uint256 The cost to buy the _amount of tokens in ETH
     */
    function buyPrice(uint256 _amount)
        public
        view
        isCurveActive()
        returns (uint256)
    {
        // Getting the current DAI cost for token amount
        uint256 daiCost = curve_.buyPrice(_amount);
        // Returning the required ETH to buy DAI amount
        return router_.getAmountsIn(
            daiCost, 
            getPath(true)
        )[0];
    }

    /**
     * @notice This function is only callable after the curve contract has been
     *         initialized.
     * @param  _amount The amount of tokens a user wants to sell
     * @return uint256 The reward for selling the _amount of tokens in ETH
     */
    function sellReward(uint256 _amount)
        public
        view
        isCurveActive()
        returns (uint256)
    {
        // Getting the current DAI reward for token amount
        uint256 daiReward = curve_.sellReward(_amount);
        // Returning the ETH reward for token sale
        return router_.getAmountsIn(
            daiReward, 
            getPath(true)
        )[0];
    }
    
    /**
      * @param  _daiAmount The amount of dai to be traded for ETH
      * @return uint256 The amount of ETH that can be traded for given the
      *         dai amount
      */
    function sellRewardDai(uint256 _daiAmount)
        public
        view
        isCurveActive()
        returns (uint256)
    {
        // Returning the ETH reward for the dai amount
        return router_.getAmountsIn(
            _daiAmount, 
            getPath(true)
        )[0];
    }
    
    /**
      * @param  _buy If the path is for a buy or sell transaction
      * @return address[] The path for the transaction
      */
    function getPath(bool _buy) public view returns(address[] memory) {
        address[] memory buyPath = new address[](2);
        if(_buy) {
            buyPath[0] = router_.WETH();
            buyPath[1] = address(dai_);
        } else {
            buyPath[0] = address(dai_);
            buyPath[1] = router_.WETH();
        }
        
        return buyPath;
    }
    
    /**
      * @return Gets the current time
      */
    function getTime() public view returns(uint256) {
        return now;
    }

    // -------------------------------------------------------------------------
    // State modifying functions
    // -------------------------------------------------------------------------

    /**
      * @param  _tokenAmount The amount of BZZ tokens the user would like to
      *         buy from the curve.
      * @param  _maxDaiSpendAmount The max amount of collateral (DAI) the user
      *         is willing to spend to buy the amount of tokens.
      * @param  _deadline Unix timestamp after which the transaction will 
      *         revert. - Taken from Uniswap documentation: 
      *         https://uniswap.org/docs/v2/smart-contracts/router02/#swapethforexacttokens
      * @return bool If the transaction completed successfully.
      * @notice Before this function is called the caller does not need to
      *         approve the spending of anything. Please assure that the amount
      *         of ETH sent with this transaction is sufficient by first calling
      *         `buyPrice` with the same token amount. Add your % slippage to
      *         the max dai spend amount (you can get the expected amount by 
      *         calling `buyPrice` on the curve contract).
      */
    function mint(
        uint256 _tokenAmount, 
        uint256 _maxDaiSpendAmount, 
        uint _deadline
    )
        external
        payable
        isCurveActive()
        mutex()
        returns (bool)
    {
        (uint256 daiNeeded, uint256 ethReceived) = _commonMint(
            _tokenAmount,
            _maxDaiSpendAmount,
            _deadline,
            msg.sender
        );
        // Emitting event with all important info
        emit mintTokensWithEth(
            msg.sender, 
            _tokenAmount, 
            daiNeeded, 
            ethReceived, 
            _maxDaiSpendAmount
        );
        // Returning that the mint executed successfully
        return true;
    }

    /**
      * @param  _tokenAmount The amount of BZZ tokens the user would like to
      *         buy from the curve.
      * @param  _maxDaiSpendAmount The max amount of collateral (DAI) the user
      *         is willing to spend to buy the amount of tokens.
      * @param  _deadline Unix timestamp after which the transaction will 
      *         revert. - Taken from Uniswap documentation: 
      *         https://uniswap.org/docs/v2/smart-contracts/router02/#swapethforexacttokens
      * @return bool If the transaction completed successfully.
      * @notice Before this function is called the caller does not need to
      *         approve the spending of anything. Please assure that the amount
      *         of ETH sent with this transaction is sufficient by first calling
      *         `buyPrice` with the same token amount. Add your % slippage to
      *         the max dai spend amount (you can get the expected amount by 
      *         calling `buyPrice` on the curve contract).
      */
    function mintTo(
        uint256 _tokenAmount, 
        uint256 _maxDaiSpendAmount, 
        uint _deadline,
        address _to
    )
        external
        payable
        isCurveActive()
        mutex()
        returns (bool)
    {
        (uint256 daiNeeded, uint256 ethReceived) = _commonMint(
            _tokenAmount,
            _maxDaiSpendAmount,
            _deadline,
            _to
        );
        // Emitting event with all important info
        emit mintTokensToWithEth(
            msg.sender, 
            _to,
            _tokenAmount, 
            daiNeeded, 
            ethReceived, 
            _maxDaiSpendAmount
        );
        // Returning that the mint executed successfully
        return true;
    }

    /**
      * @notice The user needs to have approved this contract as a spender of
      *         of the desired `_tokenAmount` to sell before calling this
      *         transaction. Failure to do so will result in the call reverting.
      *         This function is payable to receive ETH from internal calls.
      *         Please do not send ETH to this function.
      * @param  _tokenAmount The amount of BZZ tokens the user would like to
      *         sell.
      * @param  _minDaiSellValue The min value of collateral (DAI) the user
      *         is willing to sell their tokens for.
      * @param  _deadline Unix timestamp after which the transaction will 
      *         revert. - Taken from Uniswap documentation: 
      *         https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensforeth
      * @return bool If the transaction completed successfully.
      */
    function redeem(
        uint256 _tokenAmount, 
        uint256 _minDaiSellValue,
        uint _deadline
    )
        external
        payable
        isCurveActive()
        mutex()
        returns (bool)
    {
        // Gets the current reward for selling the amount of tokens
        uint256 daiReward = curve_.sellReward(_tokenAmount);
        // The check that the dai reward amount is not more than the min sell 
        // amount happens in the curve.

        // Transferring _amount of tokens into this contract
        require(
            bzz_.transferFrom(
                msg.sender,
                address(this),
                _tokenAmount
            ),
            "Transferring BZZ failed"
        );
        // Approving the curve as a spender
        require(
            bzz_.approve(
                address(curve_),
                _tokenAmount
            ),
            "BZZ approve failed"
        );
        // Selling tokens for DAI
        require(
            curve_.redeem(
                _tokenAmount,
                daiReward
            ),
            "Curve burn failed"
        );
        // Getting expected ETH for DAI
        uint256 ethMin = sellRewardDai(dai_.balanceOf(address(this)));
        // Approving the router as a spender
        require(
            dai_.approve(
                address(router_),
                daiReward
            ),
            "DAI approve failed"
        );
        // Selling DAI received for ETH
        router_.swapExactTokensForETH(
            daiReward, 
            ethMin, 
            getPath(false), 
            msg.sender, 
            _deadline
        );
        // Emitting event with all important info
        emit burnTokensWithEth(
            msg.sender, 
            _tokenAmount, 
            daiReward, 
            ethMin, 
            _minDaiSellValue
        );
        // Returning that the burn executed successfully
        return true;
    }

    function() external payable {
        require(
            msg.sender == address(router_),
            "ETH not accepted outside router"
        );
    }


    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    /**
      * @param  _tokenAmount The amount of BZZ tokens the user would like to
      *         buy from the curve.
      * @param  _maxDaiSpendAmount The max amount of collateral (DAI) the user
      *         is willing to spend to buy the amount of tokens.
      * @param  _deadline Unix timestamp after which the transaction will 
      *         revert. - Taken from Uniswap documentation: 
      *         https://uniswap.org/docs/v2/smart-contracts/router02/#swapethforexacttokens
      * @return uint256 The dai needed to buy the tokens.
      * @return uint256 The Ether received from the user for the trade.
      * @notice Before this function is called the caller does not need to
      *         approve the spending of anything. Please assure that the amount
      *         of ETH sent with this transaction is sufficient by first calling
      *         `buyPrice` with the same token amount. Add your % slippage to
      *         the max dai spend amount (you can get the expected amount by 
      *         calling `buyPrice` on the curve contract).
      */
    function _commonMint(
        uint256 _tokenAmount, 
        uint256 _maxDaiSpendAmount, 
        uint _deadline,
        address _to
    )
        internal
        returns(
            uint256 daiNeeded,
            uint256 ethReceived
        )
    {
        // Getting the exact needed amount of DAI for desired token amount
        daiNeeded = curve_.buyPrice(_tokenAmount);
        // Checking that this amount is not more than the max spend amount
        require(
            _maxDaiSpendAmount >= daiNeeded,
            "DAI required for trade above max"
        );
        // Swapping sent ETH for exact amount of DAI needed
        router_.swapETHForExactTokens.value(msg.value)(
            daiNeeded, 
            getPath(true), 
            address(this), 
            _deadline
        );
        // Getting the amount of ETH received
        ethReceived = address(this).balance;
        // Approving the curve as a spender
        require(
            dai_.approve(address(curve_), daiNeeded),
            "DAI approve failed"
        );
        // Buying tokens (BZZ) against the curve
        require(
            curve_.mintTo(_tokenAmount, daiNeeded, _to),
            "BZZ mintTo failed"
        );
        // Refunding user excess ETH
        msg.sender.transfer(ethReceived);
    }
}
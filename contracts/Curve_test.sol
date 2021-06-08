pragma solidity 0.5.0;

import "./Curve.sol";

contract Curve_test is Curve {
    constructor(address _token, address _collateralToken)
        public
        Curve(_token, _collateralToken)
    {}

    function helper(uint256 _x) public view returns (uint256) {
        return _helper(_x);
    }

    function primitiveFunction(uint256 _s) public view returns (uint256) {
        return _primitiveFunction(_s);
    }

    function spotPrice(uint256 _supply) public view returns (uint256) {
        return _spotPrice(_supply);
    }

    function mathMint(uint256 _amount, uint256 _currentSupply)
        public
        view
        returns (uint256)
    {
        return _mint(_amount, _currentSupply);
    }

    function withdraw(uint256 _amount, uint256 _currentSupply)
        public
        view
        returns (uint256, uint256)
    {
        return _withdraw(_amount, _currentSupply);
    }

    function initializeCurve(uint256 _initialSupply)
        public
        view
        returns (uint256)
    {
        return _initializeCurve(_initialSupply);
    }
}

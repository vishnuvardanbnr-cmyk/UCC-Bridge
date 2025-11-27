// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/**
 * @title USDT Token for Universe Chain
 * @dev ERC20 token representing USDT on Universe Chain
 * Note: This is a wrapped or bridged version of USDT, not official Tether USDT
 */
contract USDT is ERC20, Ownable {
    uint8 private _decimals = 18;


    /**
     * @param initialRecipient Address that will receive the initial 10,000,000 USDT
     */
    constructor(address initialRecipient) ERC20("Tether USD", "USDT") Ownable(msg.sender)
 {
        require(initialRecipient != address(0), "Invalid recipient");
        _mint(initialRecipient, 10_000_000 * 10**18);
    }


    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }


    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }


    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}





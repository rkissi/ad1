// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MetaverseAdToken
 * @dev ERC20 token for the Metaverse Advertising Platform
 */
contract MetaverseAdToken {
    string public name = "Metaverse Ad Token";
    string public symbol = "MAT";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Minting control
    address public owner;
    mapping(address => bool) public minters;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner, "Not authorized to mint");
        _;
    }
    
    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        totalSupply = _initialSupply * 10**decimals;
        balanceOf[msg.sender] = totalSupply;
        minters[msg.sender] = true;
        
        emit Transfer(address(0), msg.sender, totalSupply);
        emit MinterAdded(msg.sender);
    }
    
    /**
     * @dev Transfer tokens
     */
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    /**
     * @dev Transfer tokens from one address to another
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        
        emit Transfer(from, to, value);
        return true;
    }
    
    /**
     * @dev Approve spender to spend tokens
     */
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    /**
     * @dev Mint new tokens (only authorized minters)
     */
    function mint(address to, uint256 value) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        
        totalSupply += value;
        balanceOf[to] += value;
        
        emit Transfer(address(0), to, value);
    }
    
    /**
     * @dev Burn tokens
     */
    function burn(uint256 value) external {
        require(balanceOf[msg.sender] >= value, "Insufficient balance to burn");
        
        balanceOf[msg.sender] -= value;
        totalSupply -= value;
        
        emit Transfer(msg.sender, address(0), value);
    }
    
    /**
     * @dev Add a new minter
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove a minter
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @dev Batch transfer to multiple addresses
     */
    function batchTransfer(address[] memory recipients, uint256[] memory values) external returns (bool) {
        require(recipients.length == values.length, "Arrays length mismatch");
        
        uint256 totalValue = 0;
        for (uint256 i = 0; i < values.length; i++) {
            totalValue += values[i];
        }
        
        require(balanceOf[msg.sender] >= totalValue, "Insufficient balance for batch transfer");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Transfer to zero address");
            balanceOf[msg.sender] -= values[i];
            balanceOf[recipients[i]] += values[i];
            emit Transfer(msg.sender, recipients[i], values[i]);
        }
        
        return true;
    }
    
    /**
     * @dev Increase allowance
     */
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        allowance[msg.sender][spender] += addedValue;
        emit Approval(msg.sender, spender, allowance[msg.sender][spender]);
        return true;
    }
    
    /**
     * @dev Decrease allowance
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "Decreased allowance below zero");
        
        allowance[msg.sender][spender] = currentAllowance - subtractedValue;
        emit Approval(msg.sender, spender, allowance[msg.sender][spender]);
        return true;
    }
}
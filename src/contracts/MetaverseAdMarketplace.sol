// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MetaverseAdToken.sol";

/**
 * @title MetaverseAdMarketplace
 * @dev Smart contract for managing advertising campaigns, escrow, and automated payouts
 */
contract MetaverseAdMarketplace {
    MetaverseAdToken public immutable token;
    
    struct Campaign {
        string campaignId;
        address advertiser;
        uint256 totalBudget;
        uint256 lockedAmount;
        uint256 spentAmount;
        bool isActive;
        uint256 createdAt;
        mapping(address => uint256) pendingPayouts;
    }
    
    struct ConsentRecord {
        string userDid;
        string scope;
        string campaignId;
        uint256 timestamp;
        bool isActive;
    }
    
    // Campaign storage
    mapping(string => Campaign) public campaigns;
    mapping(address => string[]) public advertiserCampaigns;
    
    // Consent management
    mapping(bytes32 => ConsentRecord) public consents;
    mapping(string => bytes32[]) public userConsents;
    
    // Payout rules (basis points: 10000 = 100%)
    uint256 public constant USER_SHARE = 6000;      // 60%
    uint256 public constant PUBLISHER_SHARE = 3500; // 35%
    uint256 public constant PROTOCOL_SHARE = 500;   // 5%
    
    // Protocol treasury
    address public protocolTreasury;
    
    // Events
    event CampaignCreated(string indexed campaignId, address indexed advertiser, uint256 budget);
    event FundsDeposited(string indexed campaignId, uint256 amount, address indexed advertiser);
    event FundsReleased(string indexed campaignId, address[] recipients, uint256[] amounts);
    event ConsentRecorded(string indexed userDid, string scope, string campaignId, uint256 timestamp);
    event ConsentRevoked(string indexed userDid, string scope, string campaignId, uint256 timestamp);
    event PayoutExecuted(string indexed campaignId, address indexed recipient, uint256 amount, string role);
    
    // Modifiers
    modifier onlyAdvertiser(string memory campaignId) {
        require(campaigns[campaignId].advertiser == msg.sender, "Not campaign advertiser");
        _;
    }
    
    modifier campaignExists(string memory campaignId) {
        require(campaigns[campaignId].advertiser != address(0), "Campaign does not exist");
        _;
    }
    
    modifier campaignActive(string memory campaignId) {
        require(campaigns[campaignId].isActive, "Campaign not active");
        _;
    }
    
    constructor(address _tokenAddress, address _protocolTreasury) {
        token = MetaverseAdToken(_tokenAddress);
        protocolTreasury = _protocolTreasury;
    }
    
    /**
     * @dev Create a new advertising campaign
     */
    function createCampaign(
        string memory campaignId,
        uint256 budget
    ) external {
        require(campaigns[campaignId].advertiser == address(0), "Campaign already exists");
        require(budget > 0, "Budget must be greater than 0");
        
        Campaign storage campaign = campaigns[campaignId];
        campaign.campaignId = campaignId;
        campaign.advertiser = msg.sender;
        campaign.totalBudget = budget;
        campaign.lockedAmount = 0;
        campaign.spentAmount = 0;
        campaign.isActive = false;
        campaign.createdAt = block.timestamp;
        
        advertiserCampaigns[msg.sender].push(campaignId);
        
        emit CampaignCreated(campaignId, msg.sender, budget);
    }
    
    /**
     * @dev Deposit funds into campaign escrow
     */
    function depositCampaignFunds(
        string memory campaignId,
        uint256 amount
    ) external campaignExists(campaignId) onlyAdvertiser(campaignId) {
        require(amount > 0, "Amount must be greater than 0");
        
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.lockedAmount + amount <= campaign.totalBudget, "Exceeds campaign budget");
        
        // Transfer tokens from advertiser to contract
        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        
        campaign.lockedAmount += amount;
        campaign.isActive = true;
        
        emit FundsDeposited(campaignId, amount, msg.sender);
    }
    
    /**
     * @dev Release funds to multiple recipients
     */
    function releaseFunds(
        string memory campaignId,
        address[] memory recipients,
        uint256[] memory amounts
    ) external campaignExists(campaignId) onlyAdvertiser(campaignId) {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "No recipients specified");
        
        Campaign storage campaign = campaigns[campaignId];
        uint256 totalAmount = 0;
        
        // Calculate total amount
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalAmount <= campaign.lockedAmount, "Insufficient locked funds");
        
        // Transfer tokens to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] > 0) {
                require(token.transfer(recipients[i], amounts[i]), "Token transfer failed");
            }
        }
        
        campaign.lockedAmount -= totalAmount;
        campaign.spentAmount += totalAmount;
        
        emit FundsReleased(campaignId, recipients, amounts);
    }
    
    /**
     * @dev Execute automated payout based on events
     */
    function executeAutomatedPayout(
        string memory campaignId,
        address userAddress,
        address publisherAddress,
        uint256 eventValue
    ) external campaignExists(campaignId) campaignActive(campaignId) {
        // In production, this would be called by an oracle or authorized service
        // For now, allowing anyone to call for demo purposes
        
        Campaign storage campaign = campaigns[campaignId];
        require(eventValue <= campaign.lockedAmount, "Insufficient funds for payout");
        
        // Calculate payouts based on protocol rules
        uint256 userPayout = (eventValue * USER_SHARE) / 10000;
        uint256 publisherPayout = (eventValue * PUBLISHER_SHARE) / 10000;
        uint256 protocolPayout = (eventValue * PROTOCOL_SHARE) / 10000;
        
        // Execute transfers
        if (userPayout > 0) {
            require(token.transfer(userAddress, userPayout), "User payout failed");
            emit PayoutExecuted(campaignId, userAddress, userPayout, "user");
        }
        
        if (publisherPayout > 0) {
            require(token.transfer(publisherAddress, publisherPayout), "Publisher payout failed");
            emit PayoutExecuted(campaignId, publisherAddress, publisherPayout, "publisher");
        }
        
        if (protocolPayout > 0) {
            require(token.transfer(protocolTreasury, protocolPayout), "Protocol payout failed");
            emit PayoutExecuted(campaignId, protocolTreasury, protocolPayout, "protocol");
        }
        
        // Update campaign state
        campaign.lockedAmount -= eventValue;
        campaign.spentAmount += eventValue;
    }
    
    /**
     * @dev Record user consent on blockchain
     */
    function recordConsent(
        string memory userDid,
        string memory scope,
        string memory campaignId
    ) external {
        bytes32 consentHash = keccak256(abi.encodePacked(userDid, scope, campaignId));
        
        ConsentRecord storage consent = consents[consentHash];
        consent.userDid = userDid;
        consent.scope = scope;
        consent.campaignId = campaignId;
        consent.timestamp = block.timestamp;
        consent.isActive = true;
        
        userConsents[userDid].push(consentHash);
        
        emit ConsentRecorded(userDid, scope, campaignId, block.timestamp);
    }
    
    /**
     * @dev Revoke user consent
     */
    function revokeConsent(
        string memory userDid,
        string memory scope,
        string memory campaignId
    ) external {
        bytes32 consentHash = keccak256(abi.encodePacked(userDid, scope, campaignId));
        
        ConsentRecord storage consent = consents[consentHash];
        require(consent.timestamp > 0, "Consent does not exist");
        
        consent.isActive = false;
        
        emit ConsentRevoked(userDid, scope, campaignId, block.timestamp);
    }
    
    /**
     * @dev Verify user consent
     */
    function verifyConsent(
        string memory userDid,
        string memory scope,
        string memory campaignId
    ) external view returns (bool) {
        bytes32 consentHash = keccak256(abi.encodePacked(userDid, scope, campaignId));
        ConsentRecord storage consent = consents[consentHash];
        return consent.isActive && consent.timestamp > 0;
    }
    
    /**
     * @dev Get campaign balance
     */
    function getCampaignBalance(string memory campaignId) 
        external 
        view 
        campaignExists(campaignId) 
        returns (uint256) 
    {
        return campaigns[campaignId].lockedAmount;
    }
    
    /**
     * @dev Get campaign details
     */
    function getCampaignDetails(string memory campaignId) 
        external 
        view 
        campaignExists(campaignId) 
        returns (
            address advertiser,
            uint256 totalBudget,
            uint256 lockedAmount,
            uint256 spentAmount,
            bool isActive,
            uint256 createdAt
        ) 
    {
        Campaign storage campaign = campaigns[campaignId];
        return (
            campaign.advertiser,
            campaign.totalBudget,
            campaign.lockedAmount,
            campaign.spentAmount,
            campaign.isActive,
            campaign.createdAt
        );
    }
    
    /**
     * @dev Get advertiser campaigns
     */
    function getAdvertiserCampaigns(address advertiser) 
        external 
        view 
        returns (string[] memory) 
    {
        return advertiserCampaigns[advertiser];
    }
    
    /**
     * @dev Get user consents
     */
    function getUserConsents(string memory userDid) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userConsents[userDid];
    }
    
    /**
     * @dev Emergency withdraw (only for testing)
     */
    function emergencyWithdraw(string memory campaignId) 
        external 
        campaignExists(campaignId) 
        onlyAdvertiser(campaignId) 
    {
        Campaign storage campaign = campaigns[campaignId];
        uint256 amount = campaign.lockedAmount;
        
        if (amount > 0) {
            campaign.lockedAmount = 0;
            campaign.isActive = false;
            require(token.transfer(msg.sender, amount), "Emergency withdraw failed");
        }
    }
    
    /**
     * @dev Update protocol treasury (only owner)
     */
    function updateProtocolTreasury(address newTreasury) external {
        // In production, this would have proper access control
        require(newTreasury != address(0), "Invalid treasury address");
        protocolTreasury = newTreasury;
    }
}
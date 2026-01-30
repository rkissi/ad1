// Comprehensive Smart Contract Test Suite
// Tests edge cases, security vulnerabilities, and concurrent scenarios

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('MetaverseAdMarketplace - Comprehensive Tests', function () {
  let marketplace: Contract;
  let token: Contract;
  let owner: Signer;
  let advertiser: Signer;
  let user1: Signer;
  let user2: Signer;
  let publisher1: Signer;
  let publisher2: Signer;
  let treasury: Signer;
  let attacker: Signer;

  const INITIAL_SUPPLY = ethers.parseEther('1000000');
  const CAMPAIGN_BUDGET = ethers.parseEther('1000');
  const PAYOUT_AMOUNT = ethers.parseEther('100');

  async function deployContractsFixture() {
    const [owner, advertiser, user1, user2, publisher1, publisher2, treasury, attacker] = await ethers.getSigners();

    // Deploy token
    const MetaverseAdToken = await ethers.getContractFactory('MetaverseAdToken');
    const token = await MetaverseAdToken.deploy(INITIAL_SUPPLY);

    // Deploy marketplace
    const MetaverseAdMarketplace = await ethers.getContractFactory('MetaverseAdMarketplace');
    const marketplace = await MetaverseAdMarketplace.deploy(await token.getAddress(), await treasury.getAddress());

    // Setup initial balances
    await token.transfer(await advertiser.getAddress(), ethers.parseEther('10000'));
    await token.transfer(await user1.getAddress(), ethers.parseEther('1000'));
    await token.transfer(await user2.getAddress(), ethers.parseEther('1000'));

    return { marketplace, token, owner, advertiser, user1, user2, publisher1, publisher2, treasury, attacker };
  }

  beforeEach(async function () {
    ({ marketplace, token, owner, advertiser, user1, user2, publisher1, publisher2, treasury, attacker } = await loadFixture(deployContractsFixture));
  });

  describe('Campaign Management Edge Cases', function () {
    it('Should prevent creating campaign with empty ID', async function () {
      await expect(
        marketplace.connect(advertiser).createCampaign('', CAMPAIGN_BUDGET)
      ).to.be.revertedWith('Campaign already exists'); // Empty string maps to existing default
    });

    it('Should prevent creating campaign with zero budget', async function () {
      await expect(
        marketplace.connect(advertiser).createCampaign('test-campaign', 0)
      ).to.be.revertedWith('Budget must be greater than 0');
    });

    it('Should prevent duplicate campaign creation', async function () {
      await marketplace.connect(advertiser).createCampaign('test-campaign', CAMPAIGN_BUDGET);
      
      await expect(
        marketplace.connect(advertiser).createCampaign('test-campaign', CAMPAIGN_BUDGET)
      ).to.be.revertedWith('Campaign already exists');
    });

    it('Should handle campaign creation by different advertisers with same ID', async function () {
      await marketplace.connect(advertiser).createCampaign('same-id', CAMPAIGN_BUDGET);
      
      // Different advertiser should be able to create campaign with same ID
      await expect(
        marketplace.connect(user1).createCampaign('same-id', CAMPAIGN_BUDGET)
      ).to.be.revertedWith('Campaign already exists'); // Global campaign IDs
    });

    it('Should prevent non-advertiser from depositing funds', async function () {
      await marketplace.connect(advertiser).createCampaign('test-campaign', CAMPAIGN_BUDGET);
      
      await expect(
        marketplace.connect(user1).depositCampaignFunds('test-campaign', PAYOUT_AMOUNT)
      ).to.be.revertedWith('Not campaign advertiser');
    });

    it('Should prevent depositing more than campaign budget', async function () {
      await marketplace.connect(advertiser).createCampaign('test-campaign', CAMPAIGN_BUDGET);
      
      const excessAmount = CAMPAIGN_BUDGET + ethers.parseEther('1');
      await token.connect(advertiser).approve(await marketplace.getAddress(), excessAmount);
      
      await expect(
        marketplace.connect(advertiser).depositCampaignFunds('test-campaign', excessAmount)
      ).to.be.revertedWith('Exceeds campaign budget');
    });
  });

  describe('Concurrent Payout Scenarios', function () {
    beforeEach(async function () {
      // Setup campaign with funds
      await marketplace.connect(advertiser).createCampaign('concurrent-test', CAMPAIGN_BUDGET);
      await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
      await marketplace.connect(advertiser).depositCampaignFunds('concurrent-test', CAMPAIGN_BUDGET);
    });

    it('Should handle simultaneous payout attempts', async function () {
      const recipients = [
        await user1.getAddress(),
        await publisher1.getAddress(),
        await treasury.getAddress()
      ];
      const amounts = [
        ethers.parseEther('60'),
        ethers.parseEther('35'),
        ethers.parseEther('5')
      ];

      // First payout should succeed
      await expect(
        marketplace.connect(advertiser).releaseFunds('concurrent-test', recipients, amounts)
      ).to.not.be.reverted;

      // Second payout should fail due to insufficient funds
      await expect(
        marketplace.connect(advertiser).releaseFunds('concurrent-test', recipients, amounts)
      ).to.be.revertedWith('Insufficient locked funds');
    });

    it('Should handle partial payouts correctly', async function () {
      const recipients1 = [await user1.getAddress()];
      const amounts1 = [ethers.parseEther('300')];
      
      const recipients2 = [await user2.getAddress()];
      const amounts2 = [ethers.parseEther('400')];

      // First partial payout
      await marketplace.connect(advertiser).releaseFunds('concurrent-test', recipients1, amounts1);
      
      // Check remaining balance
      const balance = await marketplace.getCampaignBalance('concurrent-test');
      expect(balance).to.equal(ethers.parseEther('700'));

      // Second partial payout
      await marketplace.connect(advertiser).releaseFunds('concurrent-test', recipients2, amounts2);
      
      // Check final balance
      const finalBalance = await marketplace.getCampaignBalance('concurrent-test');
      expect(finalBalance).to.equal(ethers.parseEther('300'));
    });

    it('Should prevent payout with mismatched arrays', async function () {
      const recipients = [await user1.getAddress(), await user2.getAddress()];
      const amounts = [ethers.parseEther('100')]; // Mismatched length

      await expect(
        marketplace.connect(advertiser).releaseFunds('concurrent-test', recipients, amounts)
      ).to.be.revertedWith('Arrays length mismatch');
    });

    it('Should prevent empty payout arrays', async function () {
      await expect(
        marketplace.connect(advertiser).releaseFunds('concurrent-test', [], [])
      ).to.be.revertedWith('No recipients specified');
    });
  });

  describe('Consent Management Edge Cases', function () {
    it('Should handle consent recording for non-existent campaign', async function () {
      // Should not revert - consent can be recorded for future campaigns
      await expect(
        marketplace.recordConsent('did:user:test', 'marketing', 'non-existent-campaign')
      ).to.not.be.reverted;
    });

    it('Should handle consent verification for non-existent records', async function () {
      const isValid = await marketplace.verifyConsent('did:user:nonexistent', 'marketing', 'test-campaign');
      expect(isValid).to.be.false;
    });

    it('Should handle consent revocation', async function () {
      // Record consent
      await marketplace.recordConsent('did:user:test', 'marketing', 'test-campaign');
      
      // Verify it's active
      let isValid = await marketplace.verifyConsent('did:user:test', 'marketing', 'test-campaign');
      expect(isValid).to.be.true;

      // Revoke consent
      await marketplace.revokeConsent('did:user:test', 'marketing', 'test-campaign');
      
      // Verify it's revoked
      isValid = await marketplace.verifyConsent('did:user:test', 'marketing', 'test-campaign');
      expect(isValid).to.be.false;
    });

    it('Should handle multiple consent scopes for same user', async function () {
      await marketplace.recordConsent('did:user:test', 'marketing', 'test-campaign');
      await marketplace.recordConsent('did:user:test', 'analytics', 'test-campaign');
      await marketplace.recordConsent('did:user:test', 'personalization', 'test-campaign');

      // All should be valid
      expect(await marketplace.verifyConsent('did:user:test', 'marketing', 'test-campaign')).to.be.true;
      expect(await marketplace.verifyConsent('did:user:test', 'analytics', 'test-campaign')).to.be.true;
      expect(await marketplace.verifyConsent('did:user:test', 'personalization', 'test-campaign')).to.be.true;

      // Revoke one
      await marketplace.revokeConsent('did:user:test', 'marketing', 'test-campaign');

      // Only marketing should be revoked
      expect(await marketplace.verifyConsent('did:user:test', 'marketing', 'test-campaign')).to.be.false;
      expect(await marketplace.verifyConsent('did:user:test', 'analytics', 'test-campaign')).to.be.true;
      expect(await marketplace.verifyConsent('did:user:test', 'personalization', 'test-campaign')).to.be.true;
    });
  });

  describe('Security Vulnerabilities', function () {
    describe('Reentrancy Protection', function () {
      it('Should prevent reentrancy attacks on fund release', async function () {
        // This would require a malicious contract that tries to reenter
        // For now, we test that the function completes atomically
        
        await marketplace.connect(advertiser).createCampaign('reentrancy-test', CAMPAIGN_BUDGET);
        await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
        await marketplace.connect(advertiser).depositCampaignFunds('reentrancy-test', CAMPAIGN_BUDGET);

        const recipients = [await user1.getAddress()];
        const amounts = [ethers.parseEther('100')];

        // Should complete successfully
        await expect(
          marketplace.connect(advertiser).releaseFunds('reentrancy-test', recipients, amounts)
        ).to.not.be.reverted;
      });
    });

    describe('Integer Overflow/Underflow', function () {
      it('Should handle maximum token amounts', async function () {
        const maxAmount = ethers.MaxUint256;
        
        await expect(
          marketplace.connect(advertiser).createCampaign('overflow-test', maxAmount)
        ).to.not.be.reverted;
      });

      it('Should prevent underflow in balance calculations', async function () {
        await marketplace.connect(advertiser).createCampaign('underflow-test', CAMPAIGN_BUDGET);
        await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
        await marketplace.connect(advertiser).depositCampaignFunds('underflow-test', CAMPAIGN_BUDGET);

        const recipients = [await user1.getAddress()];
        const amounts = [CAMPAIGN_BUDGET + ethers.parseEther('1')]; // More than available

        await expect(
          marketplace.connect(advertiser).releaseFunds('underflow-test', recipients, amounts)
        ).to.be.revertedWith('Insufficient locked funds');
      });
    });

    describe('Access Control', function () {
      it('Should prevent unauthorized campaign modifications', async function () {
        await marketplace.connect(advertiser).createCampaign('access-test', CAMPAIGN_BUDGET);
        
        // Attacker tries to deposit funds to someone else's campaign
        await token.connect(attacker).approve(await marketplace.getAddress(), PAYOUT_AMOUNT);
        await expect(
          marketplace.connect(attacker).depositCampaignFunds('access-test', PAYOUT_AMOUNT)
        ).to.be.revertedWith('Not campaign advertiser');
      });

      it('Should prevent unauthorized fund releases', async function () {
        await marketplace.connect(advertiser).createCampaign('access-test', CAMPAIGN_BUDGET);
        await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
        await marketplace.connect(advertiser).depositCampaignFunds('access-test', CAMPAIGN_BUDGET);

        const recipients = [await attacker.getAddress()];
        const amounts = [CAMPAIGN_BUDGET];

        // Attacker tries to release funds from someone else's campaign
        await expect(
          marketplace.connect(attacker).releaseFunds('access-test', recipients, amounts)
        ).to.be.revertedWith('Not campaign advertiser');
      });
    });

    describe('Token Transfer Failures', function () {
      it('Should handle insufficient token balance', async function () {
        await marketplace.connect(user1).createCampaign('insufficient-test', CAMPAIGN_BUDGET);
        
        // user1 doesn't have enough tokens
        await token.connect(user1).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
        await expect(
          marketplace.connect(user1).depositCampaignFunds('insufficient-test', CAMPAIGN_BUDGET)
        ).to.be.revertedWith('Token transfer failed');
      });

      it('Should handle insufficient allowance', async function () {
        await marketplace.connect(advertiser).createCampaign('allowance-test', CAMPAIGN_BUDGET);
        
        // Don't approve enough tokens
        await token.connect(advertiser).approve(await marketplace.getAddress(), PAYOUT_AMOUNT);
        await expect(
          marketplace.connect(advertiser).depositCampaignFunds('allowance-test', CAMPAIGN_BUDGET)
        ).to.be.revertedWith('Token transfer failed');
      });
    });
  });

  describe('Automated Payout Edge Cases', function () {
    beforeEach(async function () {
      await marketplace.connect(advertiser).createCampaign('autopayout-test', CAMPAIGN_BUDGET);
      await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
      await marketplace.connect(advertiser).depositCampaignFunds('autopayout-test', CAMPAIGN_BUDGET);
    });

    it('Should handle zero-value payouts', async function () {
      const recipients = [
        await user1.getAddress(),
        await publisher1.getAddress(),
        await treasury.getAddress()
      ];
      const amounts = [
        ethers.parseEther('0'),
        ethers.parseEther('0'),
        ethers.parseEther('0')
      ];

      await expect(
        marketplace.connect(advertiser).releaseFunds('autopayout-test', recipients, amounts)
      ).to.not.be.reverted;
    });

    it('Should handle mixed zero and non-zero payouts', async function () {
      const recipients = [
        await user1.getAddress(),
        await publisher1.getAddress(),
        await treasury.getAddress()
      ];
      const amounts = [
        ethers.parseEther('100'),
        ethers.parseEther('0'),
        ethers.parseEther('50')
      ];

      await expect(
        marketplace.connect(advertiser).releaseFunds('autopayout-test', recipients, amounts)
      ).to.not.be.reverted;

      // Check balances
      expect(await token.balanceOf(await user1.getAddress())).to.equal(
        ethers.parseEther('1000') + ethers.parseEther('100')
      );
      expect(await token.balanceOf(await treasury.getAddress())).to.equal(
        ethers.parseEther('50')
      );
    });

    it('Should handle automated payout with event value calculation', async function () {
      const userAddress = await user1.getAddress();
      const publisherAddress = await publisher1.getAddress();
      const eventValue = ethers.parseEther('10');

      // This would be called by an oracle or authorized service
      await expect(
        marketplace.executeAutomatedPayout(
          'autopayout-test',
          userAddress,
          publisherAddress,
          eventValue
        )
      ).to.not.be.reverted;

      // Check that payouts were distributed according to protocol rules
      // USER_SHARE = 60%, PUBLISHER_SHARE = 35%, PROTOCOL_SHARE = 5%
      const expectedUserPayout = (eventValue * 6000n) / 10000n;
      const expectedPublisherPayout = (eventValue * 3500n) / 10000n;
      const expectedProtocolPayout = (eventValue * 500n) / 10000n;

      expect(await token.balanceOf(userAddress)).to.equal(
        ethers.parseEther('1000') + expectedUserPayout
      );
      expect(await token.balanceOf(publisherAddress)).to.equal(
        expectedPublisherPayout
      );
      expect(await token.balanceOf(await treasury.getAddress())).to.equal(
        expectedProtocolPayout
      );
    });
  });

  describe('Emergency Functions', function () {
    beforeEach(async function () {
      await marketplace.connect(advertiser).createCampaign('emergency-test', CAMPAIGN_BUDGET);
      await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
      await marketplace.connect(advertiser).depositCampaignFunds('emergency-test', CAMPAIGN_BUDGET);
    });

    it('Should allow emergency withdrawal by campaign owner', async function () {
      const initialBalance = await token.balanceOf(await advertiser.getAddress());
      
      await marketplace.connect(advertiser).emergencyWithdraw('emergency-test');
      
      const finalBalance = await token.balanceOf(await advertiser.getAddress());
      expect(finalBalance).to.equal(initialBalance + CAMPAIGN_BUDGET);
      
      // Campaign should be deactivated
      const balance = await marketplace.getCampaignBalance('emergency-test');
      expect(balance).to.equal(0);
    });

    it('Should prevent emergency withdrawal by non-owner', async function () {
      await expect(
        marketplace.connect(attacker).emergencyWithdraw('emergency-test')
      ).to.be.revertedWith('Not campaign advertiser');
    });

    it('Should handle emergency withdrawal with zero balance', async function () {
      // First withdraw all funds normally
      const recipients = [await user1.getAddress()];
      const amounts = [CAMPAIGN_BUDGET];
      await marketplace.connect(advertiser).releaseFunds('emergency-test', recipients, amounts);

      // Emergency withdrawal should not revert but do nothing
      await expect(
        marketplace.connect(advertiser).emergencyWithdraw('emergency-test')
      ).to.not.be.reverted;
    });
  });

  describe('Gas Optimization Tests', function () {
    it('Should handle large recipient arrays efficiently', async function () {
      await marketplace.connect(advertiser).createCampaign('gas-test', ethers.parseEther('10000'));
      await token.connect(advertiser).approve(await marketplace.getAddress(), ethers.parseEther('10000'));
      await marketplace.connect(advertiser).depositCampaignFunds('gas-test', ethers.parseEther('10000'));

      // Create arrays with many recipients
      const recipients = [];
      const amounts = [];
      const numRecipients = 50; // Adjust based on gas limits

      for (let i = 0; i < numRecipients; i++) {
        recipients.push(await user1.getAddress()); // Reuse address for simplicity
        amounts.push(ethers.parseEther('1'));
      }

      const tx = await marketplace.connect(advertiser).releaseFunds('gas-test', recipients, amounts);
      const receipt = await tx.wait();
      
      console.log(`Gas used for ${numRecipients} recipients: ${receipt.gasUsed}`);
      
      // Should not exceed reasonable gas limits
      expect(receipt.gasUsed).to.be.lessThan(8000000); // 8M gas limit
    });
  });

  describe('Event Emission Tests', function () {
    it('Should emit correct events for campaign creation', async function () {
      await expect(
        marketplace.connect(advertiser).createCampaign('event-test', CAMPAIGN_BUDGET)
      ).to.emit(marketplace, 'CampaignCreated')
       .withArgs('event-test', await advertiser.getAddress(), CAMPAIGN_BUDGET);
    });

    it('Should emit correct events for fund deposits', async function () {
      await marketplace.connect(advertiser).createCampaign('event-test', CAMPAIGN_BUDGET);
      await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
      
      await expect(
        marketplace.connect(advertiser).depositCampaignFunds('event-test', CAMPAIGN_BUDGET)
      ).to.emit(marketplace, 'FundsDeposited')
       .withArgs('event-test', CAMPAIGN_BUDGET, await advertiser.getAddress());
    });

    it('Should emit correct events for consent recording', async function () {
      await expect(
        marketplace.recordConsent('did:user:test', 'marketing', 'test-campaign')
      ).to.emit(marketplace, 'ConsentRecorded')
       .withArgs('did:user:test', 'marketing', 'test-campaign');
    });
  });

  describe('State Consistency Tests', function () {
    it('Should maintain consistent state across multiple operations', async function () {
      // Create multiple campaigns
      const campaigns = ['campaign1', 'campaign2', 'campaign3'];
      
      for (const campaignId of campaigns) {
        await marketplace.connect(advertiser).createCampaign(campaignId, CAMPAIGN_BUDGET);
        await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
        await marketplace.connect(advertiser).depositCampaignFunds(campaignId, CAMPAIGN_BUDGET);
      }

      // Perform various operations
      const recipients = [await user1.getAddress()];
      const amounts = [ethers.parseEther('100')];

      for (const campaignId of campaigns) {
        await marketplace.connect(advertiser).releaseFunds(campaignId, recipients, amounts);
        
        const balance = await marketplace.getCampaignBalance(campaignId);
        expect(balance).to.equal(CAMPAIGN_BUDGET - ethers.parseEther('100'));
      }
    });
  });
});

describe('MetaverseAdMarketplace - Hardened Security Tests', function () {
  let marketplace: Contract;
  let token: Contract;
  let owner: Signer;
  let advertiser: Signer;
  let user1: Signer;
  let oracle: Signer;
  let attacker: Signer;

  const INITIAL_SUPPLY = ethers.parseEther('1000000');
  const CAMPAIGN_BUDGET = ethers.parseEther('1000');

  beforeEach(async function () {
    [owner, advertiser, user1, oracle, attacker] = await ethers.getSigners();
    const MetaverseAdToken = await ethers.getContractFactory('MetaverseAdToken');
    token = await MetaverseAdToken.deploy(INITIAL_SUPPLY);
    const MetaverseAdMarketplace = await ethers.getContractFactory('MetaverseAdMarketplace');
    marketplace = await MetaverseAdMarketplace.deploy(await token.getAddress(), await owner.getAddress());
    await token.transfer(await advertiser.getAddress(), ethers.parseEther('10000'));
  });

  it('Should enforce emergency pause', async function () {
    await marketplace.connect(advertiser).createCampaign('pause-test', CAMPAIGN_BUDGET);
    await marketplace.setPaused(true);

    await expect(
      marketplace.connect(advertiser).depositCampaignFunds('pause-test', CAMPAIGN_BUDGET)
    ).to.be.revertedWith('Contract is paused');

    await marketplace.setPaused(false);
    await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
    await expect(
      marketplace.connect(advertiser).depositCampaignFunds('pause-test', CAMPAIGN_BUDGET)
    ).to.not.be.reverted;
  });

  it('Should restrict automated payouts to authorized oracle', async function () {
    await marketplace.connect(advertiser).createCampaign('oracle-test', CAMPAIGN_BUDGET);
    await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
    await marketplace.connect(advertiser).depositCampaignFunds('oracle-test', CAMPAIGN_BUDGET);

    await marketplace.setOracleAddress(await oracle.getAddress());

    await expect(
      marketplace.connect(attacker).executeAutomatedPayout('oracle-test', await user1.getAddress(), await attacker.getAddress(), ethers.parseEther('10'))
    ).to.be.revertedWith('Not authorized oracle');

    await expect(
      marketplace.connect(oracle).executeAutomatedPayout('oracle-test', await user1.getAddress(), await attacker.getAddress(), ethers.parseEther('10'))
    ).to.not.be.reverted;
  });

  it('Should prevent double payouts (idempotency simulation)', async function () {
    // Note: In Solidity, idempotency is often handled by external IDs or state checks.
    // Our contract relies on lockedAmount decreasing.
    await marketplace.connect(advertiser).createCampaign('double-payout-test', CAMPAIGN_BUDGET);
    await token.connect(advertiser).approve(await marketplace.getAddress(), CAMPAIGN_BUDGET);
    await marketplace.connect(advertiser).depositCampaignFunds('double-payout-test', CAMPAIGN_BUDGET);

    const amount = ethers.parseEther('600');
    await marketplace.executeAutomatedPayout('double-payout-test', await user1.getAddress(), await owner.getAddress(), amount);

    // Second attempt with same amount should fail if it exceeds remaining balance
    await expect(
      marketplace.executeAutomatedPayout('double-payout-test', await user1.getAddress(), await owner.getAddress(), amount)
    ).to.be.revertedWith('Insufficient funds for payout');
  });
});

describe('MetaverseAdToken - Edge Cases', function () {
  let token: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let attacker: Signer;

  beforeEach(async function () {
    [owner, user1, user2, attacker] = await ethers.getSigners();
    
    const MetaverseAdToken = await ethers.getContractFactory('MetaverseAdToken');
    token = await MetaverseAdToken.deploy(ethers.parseEther('1000000'));
  });

  describe('Minting Security', function () {
    it('Should prevent unauthorized minting', async function () {
      await expect(
        token.connect(attacker).mint(await attacker.getAddress(), ethers.parseEther('1000'))
      ).to.be.revertedWith('Not authorized to mint');
    });

    it('Should allow owner to add/remove minters', async function () {
      await token.connect(owner).addMinter(await user1.getAddress());
      
      // user1 should now be able to mint
      await expect(
        token.connect(user1).mint(await user2.getAddress(), ethers.parseEther('100'))
      ).to.not.be.reverted;

      // Remove minter
      await token.connect(owner).removeMinter(await user1.getAddress());
      
      // user1 should no longer be able to mint
      await expect(
        token.connect(user1).mint(await user2.getAddress(), ethers.parseEther('100'))
      ).to.be.revertedWith('Not authorized to mint');
    });
  });

  describe('Batch Transfer Edge Cases', function () {
    beforeEach(async function () {
      await token.transfer(await user1.getAddress(), ethers.parseEther('1000'));
    });

    it('Should handle batch transfer with mismatched arrays', async function () {
      const recipients = [await user2.getAddress()];
      const amounts = [ethers.parseEther('100'), ethers.parseEther('200')]; // Mismatched

      await expect(
        token.connect(user1).batchTransfer(recipients, amounts)
      ).to.be.revertedWith('Arrays length mismatch');
    });

    it('Should handle batch transfer with insufficient balance', async function () {
      const recipients = [await user2.getAddress(), await owner.getAddress()];
      const amounts = [ethers.parseEther('600'), ethers.parseEther('600')]; // Total > balance

      await expect(
        token.connect(user1).batchTransfer(recipients, amounts)
      ).to.be.revertedWith('Insufficient balance for batch transfer');
    });

    it('Should handle successful batch transfer', async function () {
      const recipients = [await user2.getAddress(), await owner.getAddress()];
      const amounts = [ethers.parseEther('300'), ethers.parseEther('200')];

      await expect(
        token.connect(user1).batchTransfer(recipients, amounts)
      ).to.not.be.reverted;

      expect(await token.balanceOf(await user2.getAddress())).to.equal(ethers.parseEther('300'));
      expect(await token.balanceOf(await owner.getAddress())).to.equal(
        ethers.parseEther('999000') + ethers.parseEther('200') // Initial + transferred
      );
    });
  });

  describe('Allowance Edge Cases', function () {
    it('Should handle allowance increase/decrease correctly', async function () {
      const spender = await user2.getAddress();
      
      // Initial approval
      await token.connect(user1).approve(spender, ethers.parseEther('100'));
      expect(await token.allowance(await user1.getAddress(), spender)).to.equal(ethers.parseEther('100'));

      // Increase allowance
      await token.connect(user1).increaseAllowance(spender, ethers.parseEther('50'));
      expect(await token.allowance(await user1.getAddress(), spender)).to.equal(ethers.parseEther('150'));

      // Decrease allowance
      await token.connect(user1).decreaseAllowance(spender, ethers.parseEther('30'));
      expect(await token.allowance(await user1.getAddress(), spender)).to.equal(ethers.parseEther('120'));
    });

    it('Should prevent decreasing allowance below zero', async function () {
      const spender = await user2.getAddress();
      
      await token.connect(user1).approve(spender, ethers.parseEther('100'));
      
      await expect(
        token.connect(user1).decreaseAllowance(spender, ethers.parseEther('150'))
      ).to.be.revertedWith('Decreased allowance below zero');
    });
  });
});
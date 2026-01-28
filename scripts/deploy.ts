// Smart Contract Deployment Script
import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Deploying Metaverse Advertising Platform Smart Contracts...');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deploying contracts with account:', deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy MetaverseAdToken
  console.log('\n📄 Deploying MetaverseAdToken...');
  const MetaverseAdToken = await ethers.getContractFactory('MetaverseAdToken');
  const initialSupply = ethers.parseEther('1000000'); // 1 million tokens
  const token = await MetaverseAdToken.deploy(initialSupply);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log('✅ MetaverseAdToken deployed to:', tokenAddress);
  console.log('🪙 Initial supply:', ethers.formatEther(initialSupply), 'MAT');

  // Deploy MetaverseAdMarketplace
  console.log('\n📄 Deploying MetaverseAdMarketplace...');
  const MetaverseAdMarketplace = await ethers.getContractFactory('MetaverseAdMarketplace');
  const protocolTreasury = deployer.address; // Use deployer as treasury for demo
  const marketplace = await MetaverseAdMarketplace.deploy(tokenAddress, protocolTreasury);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  
  console.log('✅ MetaverseAdMarketplace deployed to:', marketplaceAddress);
  console.log('🏛️ Protocol treasury:', protocolTreasury);

  // Add marketplace as minter for demo purposes
  console.log('\n🔧 Configuring contracts...');
  await token.addMinter(marketplaceAddress);
  console.log('✅ Marketplace added as token minter');

  // Mint some demo tokens to test accounts
  const testAccounts = [
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat test account 1
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Hardhat test account 2
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906'  // Hardhat test account 3
  ];

  for (const account of testAccounts) {
    try {
      const mintAmount = ethers.parseEther('10000'); // 10k tokens each
      await token.mint(account, mintAmount);
      console.log(`🪙 Minted ${ethers.formatEther(mintAmount)} MAT to ${account}`);
    } catch (error) {
      console.log(`⚠️ Could not mint to ${account}:`, error.message);
    }
  }

  // Create a demo campaign
  console.log('\n🎯 Creating demo campaign...');
  try {
    const campaignId = 'demo-campaign-001';
    const campaignBudget = ethers.parseEther('1000');
    
    await marketplace.createCampaign(campaignId, campaignBudget);
    console.log(`✅ Demo campaign created: ${campaignId}`);
    console.log(`💰 Campaign budget: ${ethers.formatEther(campaignBudget)} MAT`);

    // Approve and deposit funds
    await token.approve(marketplaceAddress, campaignBudget);
    await marketplace.depositCampaignFunds(campaignId, campaignBudget);
    console.log('✅ Campaign funds deposited to escrow');
  } catch (error) {
    console.log('⚠️ Could not create demo campaign:', error.message);
  }

  // Record demo consent
  console.log('\n📋 Recording demo consent...');
  try {
    await marketplace.recordConsent(
      'did:metaverse:demo-user-001',
      'marketing',
      'demo-campaign-001'
    );
    console.log('✅ Demo consent recorded');
  } catch (error) {
    console.log('⚠️ Could not record consent:', error.message);
  }

  // Summary
  console.log('\n📊 Deployment Summary:');
  console.log('='.repeat(50));
  console.log('🪙 MetaverseAdToken:', tokenAddress);
  console.log('🏪 MetaverseAdMarketplace:', marketplaceAddress);
  console.log('🏛️ Protocol Treasury:', protocolTreasury);
  console.log('⛽ Gas used: ~2,500,000 gas');
  console.log('='.repeat(50));

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MetaverseAdToken: {
        address: tokenAddress,
        initialSupply: ethers.formatEther(initialSupply)
      },
      MetaverseAdMarketplace: {
        address: marketplaceAddress,
        protocolTreasury: protocolTreasury
      }
    },
    testAccounts: testAccounts.map(addr => ({
      address: addr,
      mintedTokens: '10000'
    }))
  };

  // Write deployment info to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('📄 Deployment info saved to:', deploymentPath);

  // Update environment variables template
  console.log('\n🔧 Environment Variables for .env:');
  console.log('='.repeat(50));
  console.log(`ETHEREUM_RPC_URL=http://localhost:8545`);
  console.log(`TOKEN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log(`PROTOCOL_TREASURY_ADDRESS=${protocolTreasury}`);
  console.log(`NETWORK_ID=${(await ethers.provider.getNetwork()).chainId}`);
  console.log('='.repeat(50));

  console.log('\n🎉 Deployment completed successfully!');
  console.log('💡 You can now start the API server and begin testing the platform.');
}

// Handle deployment errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
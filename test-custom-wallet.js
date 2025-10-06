/**
 * Test script for custom wallet functionality
 */

const { validateDeploymentRequest } = require('./src/utils/validators');
const { setupWallet } = require('./src/services/walletManager');

async function testCustomWallet() {
  console.log('🧪 Testing Custom Wallet Functionality\n');

  // Test 1: Validate custom wallet address
  console.log('1. Testing wallet address validation...');
  try {
    const result1 = validateDeploymentRequest({
      repo_url: 'https://github.com/Sharma-20/kid-sol-compiler',
      network: 'devnet',
      wallet_address: '4uLFQVh7cdWaBDchrx5bzMMcXCxJ5eJYm7Wg7GfgVfxC'
    });
    console.log('✅ Wallet address validation passed');
    console.log('   Result:', result1);
  } catch (error) {
    console.log('❌ Wallet address validation failed:', error.message);
  }

  // Test 2: Validate keypair array
  console.log('\n2. Testing keypair array validation...');
  try {
    const keypairArray = Array.from({length: 64}, (_, i) => i + 1);
    const result2 = validateDeploymentRequest({
      repo_url: 'https://github.com/Sharma-20/kid-sol-compiler',
      network: 'devnet',
      wallet_keypair: keypairArray
    });
    console.log('✅ Keypair array validation passed');
    console.log('   Result:', result2);
  } catch (error) {
    console.log('❌ Keypair array validation failed:', error.message);
  }

  // Test 3: Validate wallet path
  console.log('\n3. Testing wallet path validation...');
  try {
    const result3 = validateDeploymentRequest({
      repo_url: 'https://github.com/Sharma-20/kid-sol-compiler',
      network: 'devnet',
      wallet_path: './test-keypair.json'
    });
    console.log('✅ Wallet path validation passed');
    console.log('   Result:', result3);
  } catch (error) {
    console.log('❌ Wallet path validation failed:', error.message);
  }

  // Test 4: Test multiple wallet options (should fail)
  console.log('\n4. Testing multiple wallet options (should fail)...');
  try {
    const result4 = validateDeploymentRequest({
      repo_url: 'https://github.com/Sharma-20/kid-sol-compiler',
      network: 'devnet',
      wallet_address: '4uLFQVh7cdWaBDchrx5bzMMcXCxJ5eJYm7Wg7GfgVfxC',
      wallet_keypair: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]
    });
    console.log('❌ Multiple wallet options should have failed but passed');
  } catch (error) {
    console.log('✅ Multiple wallet options correctly rejected:', error.message);
  }

  console.log('\n🎉 Custom wallet functionality tests completed!');
}

// Run tests
testCustomWallet().catch(console.error);


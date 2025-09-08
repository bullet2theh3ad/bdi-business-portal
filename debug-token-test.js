// Quick test to verify our token detection logic
const token = "BDI-1757355137737-nmkhxvzn8";

console.log("Token:", token);
console.log("Starts with BDI-:", token.startsWith('BDI-'));
console.log("Includes dash:", token.includes('-'));
console.log("Should be detected as legacy:", token.startsWith('BDI-') && token.includes('-'));

// Test the logic we have in the code
if (token.startsWith('BDI-') && token.includes('-')) {
  console.log('✅ DETECTED as legacy BDI invitation token');
  const tokenData = {
    organizationName: 'Boundless Devices Inc',
    organizationId: null,
    adminEmail: 'test@example.com',
    role: 'member',
    timestamp: Date.now(),
    isLegacyToken: true,
    legacyToken: token
  };
  console.log('Token data created:', tokenData);
} else {
  console.log('❌ NOT detected as legacy token');
}

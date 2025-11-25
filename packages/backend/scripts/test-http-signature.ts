/**
 * HTTP Signature Test Script
 *
 * Tests HTTP Signature generation and verification functionality.
 * Verifies that signatures can be created and validated correctly.
 *
 * Usage:
 *   bun run scripts/test-http-signature.ts
 */

import { signRequest, generateKeyPair } from '../src/utils/crypto.js';
import {
  parseSignatureHeader,
  reconstructSignatureString,
  verifySignature,
  verifyDigest,
  verifyDateHeader,
} from '../src/utils/httpSignature.js';

console.log('🔐 Testing HTTP Signature implementation...\n');

// Generate test key pair
console.log('1️⃣  Generating test key pair...');
const { publicKey, privateKey } = generateKeyPair();
console.log('✅ Key pair generated\n');

// Test data
const testUrl = 'https://remote.example.com/users/bob/inbox';
const testBody = JSON.stringify({
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Follow',
  actor: 'https://example.com/users/alice',
  object: 'https://remote.example.com/users/bob',
});
const keyId = 'https://example.com/users/alice#main-key';
const method = 'POST';

// Test 1: Sign request
console.log('2️⃣  Testing signature generation...');
try {
  const signature = signRequest(privateKey, keyId, method, testUrl, testBody);
  console.log('✅ Signature generated successfully');
  console.log(`   Signature: ${signature.substring(0, 80)}...\n`);

  // Test 2: Parse signature header
  console.log('3️⃣  Testing signature header parsing...');
  const params = parseSignatureHeader(signature);
  console.log('✅ Signature header parsed successfully');
  console.log(`   Key ID: ${params.keyId}`);
  console.log(`   Algorithm: ${params.algorithm}`);
  console.log(`   Headers: ${params.headers.join(', ')}\n`);

  // Test 3: Reconstruct signature string
  console.log('4️⃣  Testing signature string reconstruction...');
  const urlObj = new URL(testUrl);
  const headers: Record<string, string | undefined> = {
    host: urlObj.hostname,
    date: new Date().toUTCString(),
    digest: `SHA-256=${Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testBody))
    ).toString('base64')}`,
  };

  const signatureString = reconstructSignatureString(
    method,
    testUrl,
    headers,
    params.headers
  );
  console.log('✅ Signature string reconstructed successfully');
  console.log(`   String: ${signatureString.split('\n').join(' | ')}\n`);

  // Test 4: Verify signature
  console.log('5️⃣  Testing signature verification...');
  const isValid = verifySignature(publicKey, signatureString, params.signature, params.algorithm);
  if (isValid) {
    console.log('✅ Signature verification PASSED\n');
  } else {
    console.log('❌ Signature verification FAILED\n');
    process.exit(1);
  }

  // Test 5: Verify digest
  console.log('6️⃣  Testing digest verification...');
  const digestValid = verifyDigest(testBody, headers.digest!);
  if (digestValid) {
    console.log('✅ Digest verification PASSED\n');
  } else {
    console.log('❌ Digest verification FAILED\n');
    process.exit(1);
  }

  // Test 6: Verify date header
  console.log('7️⃣  Testing date header verification...');
  const dateValid = verifyDateHeader(headers.date!);
  if (dateValid) {
    console.log('✅ Date verification PASSED\n');
  } else {
    console.log('❌ Date verification FAILED\n');
    process.exit(1);
  }

  // Test 7: Test with GET request (no body)
  console.log('8️⃣  Testing GET request signature (no body)...');
  const getUrl = 'https://remote.example.com/users/bob/outbox';
  const getSignature = signRequest(privateKey, keyId, 'GET', getUrl, null);
  const getParams = parseSignatureHeader(getSignature);

  const getHeaders: Record<string, string | undefined> = {
    host: new URL(getUrl).hostname,
    date: new Date().toUTCString(),
  };

  const getSignatureString = reconstructSignatureString(
    'GET',
    getUrl,
    getHeaders,
    getParams.headers
  );

  const getValid = verifySignature(publicKey, getSignatureString, getParams.signature);
  if (getValid) {
    console.log('✅ GET request signature verification PASSED\n');
  } else {
    console.log('❌ GET request signature verification FAILED\n');
    process.exit(1);
  }

  // Test 8: Test invalid signature detection
  console.log('9️⃣  Testing invalid signature detection...');
  const tamperedBody = JSON.stringify({ ...JSON.parse(testBody), type: 'Like' });
  const tamperedDigest = `SHA-256=${Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tamperedBody))
  ).toString('base64')}`;

  const tamperedValid = verifyDigest(testBody, tamperedDigest);
  if (!tamperedValid) {
    console.log('✅ Invalid signature correctly detected\n');
  } else {
    console.log('❌ Invalid signature NOT detected (security issue!)\n');
    process.exit(1);
  }

  // Test 9: Test old date header rejection
  console.log('🔟 Testing old date header rejection...');
  const oldDate = new Date(Date.now() - 60 * 1000).toUTCString(); // 60 seconds ago
  const oldDateValid = verifyDateHeader(oldDate, 30); // 30 second threshold
  if (!oldDateValid) {
    console.log('✅ Old date header correctly rejected\n');
  } else {
    console.log('❌ Old date header NOT rejected (replay attack risk!)\n');
    process.exit(1);
  }

  console.log('✅ All tests PASSED! HTTP Signature implementation is working correctly.\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
}

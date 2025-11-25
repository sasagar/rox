# Week 4: Real-Server Federation Test Plan

**Task:** 4.1 - Test Environment Setup
**Date:** 2025-11-25
**Status:** In Progress
**Estimated Duration:** 1 day

---

## Overview

This document outlines the comprehensive testing strategy for validating Rox's ActivityPub federation implementation against real-world ActivityPub servers (Mastodon and Misskey). The goal is to identify and fix any compatibility issues before production deployment.

## Test Environment Requirements

### 1. Local Rox Instance

**Prerequisites:**
- ✅ PostgreSQL database running
- ✅ Publicly accessible domain or ngrok tunnel
- ✅ SSL/TLS certificate (required for federation)
- ✅ Environment variables configured

**Required Configuration:**
```bash
# .env
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:rox_dev_password@localhost:5432/rox
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
PORT=3000
NODE_ENV=production
URL=https://your-domain.example  # Must be publicly accessible
ENABLE_REGISTRATION=true
SESSION_EXPIRY_DAYS=30
```

**Public Access Setup:**

Option A: ngrok (for testing)
```bash
ngrok http 3000
# Update URL in .env to ngrok URL (https://xxxxx.ngrok.io)
```

Option B: Production domain
```bash
# Setup SSL with Let's Encrypt or similar
# Configure reverse proxy (nginx/caddy)
# Point domain to server
```

### 2. Test Mastodon Instance

**Option A: Use Public Test Server**
- mastodon.social (requires account)
- mastodon.online
- fosstodon.org

**Option B: Local Mastodon Instance (Docker)**
```bash
git clone https://github.com/mastodon/mastodon
cd mastodon
docker-compose up -d
```

**Requirements:**
- Public access (ngrok or domain)
- Valid SSL certificate
- Test user account created

### 3. Test Misskey Instance

**Option A: Use Public Test Server**
- misskey.io (requires account)
- misskey.dev

**Option B: Local Misskey Instance (Docker)**
```bash
git clone https://github.com/misskey-dev/misskey
cd misskey
docker-compose up -d
```

**Requirements:**
- Public access (ngrok or domain)
- Valid SSL certificate
- Test user account created

---

## Test Categories

### Category 1: Discovery & Profile

Test that remote servers can discover and view Rox user profiles.

**Tests:**
1. WebFinger discovery from Mastodon
2. WebFinger discovery from Misskey
3. Actor document retrieval
4. Profile information display on remote servers

### Category 2: Following/Followers

Test bidirectional following relationships.

**Tests:**
1. Mastodon user follows Rox user
2. Rox user follows Mastodon user
3. Misskey user follows Rox user
4. Rox user follows Misskey user
5. Unfollow from both directions
6. Follower/Following counts accuracy

### Category 3: Note Creation & Delivery

Test that notes are properly created and delivered to followers.

**Tests:**
1. Rox user creates public note → visible on Mastodon timeline
2. Rox user creates public note → visible on Misskey timeline
3. Note with mentions (@username@domain)
4. Note with hashtags (#test)
5. Note with media attachments (images)
6. Note with CW (Content Warning)
7. Different visibility levels (public, unlisted, followers-only)

### Category 4: Interactions (Incoming)

Test processing of activities from remote servers.

**Tests:**
1. Mastodon user likes Rox note
2. Misskey user likes Rox note
3. Mastodon user boosts/renotes Rox note
4. Misskey user renotes Rox note
5. Mastodon user replies to Rox note
6. Misskey user replies to Rox note
7. Mastodon user deletes their note
8. Misskey user updates their profile

### Category 5: Interactions (Outgoing)

Test delivery of Rox user actions to remote servers.

**Tests:**
1. Rox user likes Mastodon note
2. Rox user likes Misskey note
3. Rox user renotes Mastodon note
4. Rox user renotes Misskey note
5. Rox user replies to Mastodon note
6. Rox user replies to Misskey note
7. Rox user deletes their note
8. Rox user updates their note
9. Rox user unlikes a note (Undo Like)
10. Rox user un-renotes (Undo Announce)

### Category 6: Error Handling & Edge Cases

Test robustness and error recovery.

**Tests:**
1. Invalid HTTP Signature rejection
2. Expired signature rejection (date header > 5 minutes old)
3. Malformed Activity JSON rejection
4. Missing required fields rejection
5. Unknown activity type handling
6. Duplicate activity detection (deduplication)
7. Rate limiting behavior
8. Network timeout handling
9. Remote server unavailable (retry logic)
10. Large note content (character limits)

### Category 7: Security

Test security measures.

**Tests:**
1. HTTP Signature verification (RSA-SHA256)
2. Actor/keyId mismatch rejection
3. Replay attack prevention (timestamp validation)
4. SSRF protection (remote fetch)
5. Content sanitization (XSS prevention)

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Start Rox server with production configuration
- [ ] Verify server is publicly accessible
- [ ] Verify SSL certificate is valid
- [ ] Create test user accounts on Rox
- [ ] Create test user accounts on Mastodon
- [ ] Create test user accounts on Misskey
- [ ] Enable detailed logging for debugging
- [ ] Prepare monitoring dashboard (server logs)

### Test Execution

#### Phase 1: Discovery (30 minutes)

- [ ] Test 1.1: Mastodon searches for `@username@rox.domain`
- [ ] Test 1.2: Misskey searches for `@username@rox.domain`
- [ ] Test 1.3: Verify profile information displays correctly
- [ ] Test 1.4: Check avatar and header images load

**Success Criteria:**
- WebFinger returns valid JRD
- Actor document returns valid Person
- Profile displays on remote servers
- No 404 or 500 errors

#### Phase 2: Following (1 hour)

- [ ] Test 2.1: Mastodon → Rox follow
- [ ] Test 2.2: Verify Follow activity received in Rox inbox
- [ ] Test 2.3: Verify Accept activity sent from Rox
- [ ] Test 2.4: Check follower count increments
- [ ] Test 2.5: Rox → Mastodon follow
- [ ] Test 2.6: Verify Follow activity delivered to Mastodon
- [ ] Test 2.7: Verify Accept activity received by Rox
- [ ] Test 2.8: Check following count increments
- [ ] Test 2.9-2.12: Repeat for Misskey
- [ ] Test 2.13: Unfollow from both directions

**Success Criteria:**
- Follow activities are delivered and processed
- Accept activities are sent/received
- Database records created correctly
- Follower/following counts accurate
- No duplicate follow relationships

#### Phase 3: Note Delivery (2 hours)

- [ ] Test 3.1: Create public note on Rox
- [ ] Test 3.2: Verify note appears on Mastodon follower timeline (within 30 seconds)
- [ ] Test 3.3: Verify note appears on Misskey follower timeline (within 30 seconds)
- [ ] Test 3.4: Create note with mention `@mastodon_user@mastodon.social`
- [ ] Test 3.5: Verify mentioned user receives notification
- [ ] Test 3.6: Create note with hashtag `#test`
- [ ] Test 3.7: Verify hashtag is clickable on remote servers
- [ ] Test 3.8: Create note with image attachment
- [ ] Test 3.9: Verify image displays on remote servers
- [ ] Test 3.10: Create note with CW (Content Warning)
- [ ] Test 3.11: Verify CW is respected on remote servers
- [ ] Test 3.12: Create unlisted note
- [ ] Test 3.13: Create followers-only note
- [ ] Test 3.14: Verify visibility restrictions work

**Success Criteria:**
- Notes appear on follower timelines within acceptable latency (< 1 minute)
- Media attachments display correctly
- Mentions trigger notifications
- Hashtags are functional
- CW is properly handled
- Visibility levels respected

#### Phase 4: Incoming Interactions (2 hours)

- [ ] Test 4.1: Mastodon user likes Rox note
- [ ] Test 4.2: Verify Like activity received in Rox inbox
- [ ] Test 4.3: Verify like count increments in Rox database
- [ ] Test 4.4: Verify like displays in Rox UI (if applicable)
- [ ] Test 4.5: Misskey user likes Rox note
- [ ] Test 4.6: Verify reaction/like processed correctly
- [ ] Test 4.7: Mastodon user boosts Rox note
- [ ] Test 4.8: Verify Announce activity received
- [ ] Test 4.9: Verify boost count increments
- [ ] Test 4.10: Misskey user renotes Rox note
- [ ] Test 4.11: Verify Announce activity processed
- [ ] Test 4.12: Mastodon user replies to Rox note
- [ ] Test 4.13: Verify Create activity with inReplyTo received
- [ ] Test 4.14: Verify reply stored in database
- [ ] Test 4.15: Misskey user replies to Rox note
- [ ] Test 4.16: Verify reply processed correctly

**Success Criteria:**
- All incoming activities are received
- HTTP Signatures verified successfully
- Database records created/updated
- Counts (likes, boosts, replies) accurate
- No duplicate processing

#### Phase 5: Outgoing Interactions (2 hours)

- [ ] Test 5.1: Rox user likes Mastodon note
- [ ] Test 5.2: Verify Like activity delivered to Mastodon inbox
- [ ] Test 5.3: Verify like appears on Mastodon UI
- [ ] Test 5.4: Rox user likes Misskey note
- [ ] Test 5.5: Verify Like activity delivered to Misskey inbox
- [ ] Test 5.6: Verify reaction appears on Misskey UI
- [ ] Test 5.7: Rox user renotes Mastodon note
- [ ] Test 5.8: Verify Announce activity delivered
- [ ] Test 5.9: Verify boost appears on Mastodon
- [ ] Test 5.10: Rox user renotes Misskey note
- [ ] Test 5.11: Verify Announce activity delivered to Misskey
- [ ] Test 5.12: Rox user replies to Mastodon note
- [ ] Test 5.13: Verify Create activity with inReplyTo delivered
- [ ] Test 5.14: Verify reply appears on Mastodon thread
- [ ] Test 5.15: Rox user replies to Misskey note
- [ ] Test 5.16: Verify reply appears on Misskey thread
- [ ] Test 5.17: Rox user deletes their note
- [ ] Test 5.18: Verify Delete activity delivered
- [ ] Test 5.19: Verify note disappears from remote servers
- [ ] Test 5.20: Rox user unlikes a note
- [ ] Test 5.21: Verify Undo Like activity delivered
- [ ] Test 5.22: Verify like count decrements on remote server

**Success Criteria:**
- All outgoing activities delivered successfully
- HTTP Signatures valid (verified by remote servers)
- Activities processed by remote servers
- UI updates reflect on remote servers
- Retry logic works for failed deliveries

#### Phase 6: Error Handling (1 hour)

- [ ] Test 6.1: Send activity with invalid signature
- [ ] Test 6.2: Verify 401 Unauthorized returned
- [ ] Test 6.3: Send activity with expired date header (> 5 minutes)
- [ ] Test 6.4: Verify signature validation fails
- [ ] Test 6.5: Send malformed JSON activity
- [ ] Test 6.6: Verify 400 Bad Request returned
- [ ] Test 6.7: Send activity with missing required fields
- [ ] Test 6.8: Verify 422 Unprocessable Entity returned
- [ ] Test 6.9: Send duplicate activity (same ID)
- [ ] Test 6.10: Verify 202 Accepted but not processed again
- [ ] Test 6.11: Simulate remote server unavailable (timeout)
- [ ] Test 6.12: Verify retry logic triggers
- [ ] Test 6.13: Verify exponential backoff works
- [ ] Test 6.14: Test large note (> 500 characters)
- [ ] Test 6.15: Verify content is not truncated

**Success Criteria:**
- Invalid requests rejected with appropriate status codes
- Duplicate activities not processed twice
- Retry logic handles transient failures
- No server crashes or unhandled exceptions
- Detailed error logs for debugging

#### Phase 7: Security (1 hour)

- [ ] Test 7.1: Send activity where actor ≠ signature keyId
- [ ] Test 7.2: Verify 401 Actor Mismatch returned
- [ ] Test 7.3: Attempt replay attack (reuse old signature)
- [ ] Test 7.4: Verify timestamp validation rejects old requests
- [ ] Test 7.5: Send activity with SSRF attempt (internal IP in URL)
- [ ] Test 7.6: Verify remote fetch rejects private IPs
- [ ] Test 7.7: Send note with XSS payload (`<script>alert(1)</script>`)
- [ ] Test 7.8: Verify content is sanitized/escaped
- [ ] Test 7.9: Verify public key caching works (1-hour TTL)
- [ ] Test 7.10: Verify public key re-fetching after cache expiry

**Success Criteria:**
- Actor/keyId mismatches rejected
- Old signatures rejected (> 5 minutes)
- SSRF attempts blocked
- XSS payloads sanitized
- Public key caching reduces remote fetches

---

## Test Data Management

### Test User Accounts

**Rox Server:**
- `alice@rox.domain` - Primary test user
- `bob@rox.domain` - Secondary test user (for interactions)
- `charlie@rox.domain` - Tertiary test user (for edge cases)

**Mastodon:**
- `mastodon_alice@mastodon.social` - Primary test user
- `mastodon_bob@mastodon.social` - Secondary test user

**Misskey:**
- `misskey_alice@misskey.io` - Primary test user
- `misskey_bob@misskey.io` - Secondary test user

### Test Notes

Prepare sample notes with various formats:
- Plain text note (short)
- Long text note (> 500 characters)
- Note with mentions (@username@domain)
- Note with hashtags (#test #activitypub)
- Note with image attachment
- Note with CW (Content Warning: "Spoiler")
- Note with link (https://example.com)
- Note with emoji (Unicode and custom)

---

## Logging and Debugging

### Enable Detailed Logging

**Rox Server:**
```typescript
// In inbox.ts, add detailed logging
console.log('📥 Received activity:', JSON.stringify(activity, null, 2));
console.log('🔐 Signature verification:', { keyId, verified: true });
console.log('💾 Database operation:', { operation: 'insert', table: 'follows' });
```

**Delivery Queue:**
```typescript
// In ActivityDeliveryQueue.ts
console.log('📤 Enqueuing delivery:', { inbox, activityType });
console.log('✅ Delivery successful:', { inbox, statusCode });
console.log('❌ Delivery failed:', { inbox, error, attempt });
```

### Monitor Server Logs

```bash
# Terminal 1: Rox server logs
cd packages/backend
bun run dev | tee /tmp/rox-federation-test.log

# Terminal 2: Database queries (optional)
PGPASSWORD=rox_dev_password psql -h localhost -U rox -d rox
# Run queries to inspect data during tests
```

### Key Metrics to Track

- **Latency**: Time from note creation to appearance on remote timeline
- **Success Rate**: Percentage of successful deliveries
- **Retry Count**: Number of retries needed for transient failures
- **Error Rate**: Percentage of failed activities
- **Signature Verification Rate**: Percentage of valid signatures

---

## Expected Outcomes

### Minimum Acceptance Criteria (MVP)

- ✅ WebFinger discovery works from Mastodon and Misskey
- ✅ Actor documents are valid and displayable
- ✅ Follow/Accept flow works bidirectionally
- ✅ Public notes are delivered to followers (< 2 minute latency)
- ✅ Incoming Like activities are processed
- ✅ Outgoing Like activities are delivered
- ✅ HTTP Signatures are validated correctly
- ✅ Duplicate activities are rejected
- ✅ Invalid signatures are rejected with 401
- ✅ Basic error handling works (no crashes)

### Stretch Goals

- ✅ Note updates (Update activity) work
- ✅ Note deletes (Delete activity) work
- ✅ Boost/Renote (Announce activity) works bidirectionally
- ✅ Replies (Create with inReplyTo) work
- ✅ Mentions trigger notifications
- ✅ CW (Content Warning) is respected
- ✅ Media attachments display correctly
- ✅ Visibility levels (unlisted, followers-only) work
- ✅ Rate limiting prevents abuse
- ✅ Retry logic handles all transient failures

---

## Issue Tracking

### Bug Report Template

```markdown
## Bug: [Short Description]

**Category:** Discovery / Following / Delivery / Interaction / Error Handling / Security

**Severity:** Critical / High / Medium / Low

**Test Case:** Test X.Y - [Test Name]

**Environment:**
- Rox Version: [commit hash]
- Remote Server: Mastodon X.Y.Z / Misskey X.Y.Z
- URL: https://...

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Server Logs:**
```
[Paste relevant logs]
```

**HTTP Request/Response:**
```
[Paste HTTP details if applicable]
```

**Database State:**
```sql
[Paste relevant database queries/results]
```

**Proposed Fix:**
[Optional: Suggest a solution]
```

### Known Issues from Previous Testing

(To be filled during test execution)

---

## Success Criteria Summary

**Phase 1 (Discovery):** 100% pass rate (4/4 tests)
**Phase 2 (Following):** 100% pass rate (13/13 tests)
**Phase 3 (Note Delivery):** ≥ 90% pass rate (12/14 tests minimum)
**Phase 4 (Incoming Interactions):** ≥ 85% pass rate (14/16 tests minimum)
**Phase 5 (Outgoing Interactions):** ≥ 85% pass rate (19/22 tests minimum)
**Phase 6 (Error Handling):** 100% pass rate (15/15 tests)
**Phase 7 (Security):** 100% pass rate (10/10 tests)

**Overall:** ≥ 90% pass rate (87/94 tests minimum)

---

## Timeline

**Day 1 (Today):**
- Setup test environment
- Configure ngrok/SSL
- Create test user accounts
- Verify public access

**Day 2-3:**
- Execute Phases 1-3 (Discovery, Following, Delivery)
- Document any issues found
- Fix critical blockers

**Day 4-5:**
- Execute Phases 4-5 (Interactions)
- Document issues
- Fix high-priority bugs

**Day 6:**
- Execute Phases 6-7 (Error Handling, Security)
- Document remaining issues
- Triage bug fixes

**Day 7:**
- Bug fixes and retesting
- Update documentation
- Final verification

---

## Next Steps

1. **Immediate (Today):**
   - [ ] Setup ngrok or configure production domain
   - [ ] Obtain SSL certificate
   - [ ] Update Rox .env with public URL
   - [ ] Restart Rox server in production mode
   - [ ] Verify public access to WebFinger endpoint

2. **Tomorrow:**
   - [ ] Create test accounts on Mastodon and Misskey
   - [ ] Execute Phase 1: Discovery tests
   - [ ] Execute Phase 2: Following tests
   - [ ] Document results

3. **This Week:**
   - [ ] Complete all test phases
   - [ ] Create bug tracking document
   - [ ] Fix critical and high-priority issues
   - [ ] Re-test fixed issues
   - [ ] Update phase-3-remaining-tasks.md with results

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Author:** Claude (Task 4.1)
**Status:** Ready for execution

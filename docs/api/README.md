# Rox API Documentation

Complete API reference for the Rox ActivityPub server.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-session-token>
```

---

## Authentication Endpoints

### POST /auth/register

Creates a new user account and automatically logs in.

**Request Body:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securePassword123",
  "name": "Alice Smith"  // optional
}
```

**Validation Rules:**
- `username`: 3-20 characters, alphanumeric and underscores only
- `email`: Valid email format
- `password`: Minimum 8 characters

**Response (201 Created):**
```json
{
  "user": {
    "id": "abc123",
    "username": "alice",
    "displayName": "Alice Smith",
    "host": null,
    "avatarUrl": null,
    "bannerUrl": null,
    "bio": null
  },
  "token": "session-token-here"
}
```

**Errors:**
- `400 Bad Request`: Missing or invalid fields
- `409 Conflict`: Username or email already exists

---

### POST /auth/session

Logs in with username and password.

**Request Body:**
```json
{
  "username": "alice",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "abc123",
    "username": "alice",
    "displayName": "Alice Smith"
  },
  "token": "session-token-here"
}
```

**Errors:**
- `400 Bad Request`: Missing credentials
- `401 Unauthorized`: Invalid username or password
- `403 Forbidden`: Account is suspended

---

### GET /auth/session

Validates current session and returns user information.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "user": {
    "id": "abc123",
    "username": "alice",
    "displayName": "Alice Smith"
  },
  "session": {
    "id": "session123",
    "expiresAt": "2025-12-18T15:00:00.000Z"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid or expired session

---

### DELETE /auth/session

Logs out by deleting the current session.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

## Notes Endpoints

### POST /notes/create

Creates a new note (post).

**Authentication:** Required

**Request Body:**
```json
{
  "text": "Hello, world!",
  "visibility": "public",  // "public", "home", "followers", "direct"
  "cw": "Content warning text",  // optional
  "replyId": "note-id-to-reply-to",  // optional
  "fileIds": ["file1", "file2"]  // optional
}
```

**Response (201 Created):**
```json
{
  "id": "note123",
  "userId": "abc123",
  "text": "Hello, world!",
  "visibility": "public",
  "cw": null,
  "replyId": null,
  "createdAt": "2025-11-25T10:00:00.000Z"
}
```

---

### GET /notes/show

Retrieves a single note by ID.

**Query Parameters:**
- `noteId` (required): Note ID to retrieve

**Response (200 OK):**
```json
{
  "id": "note123",
  "userId": "abc123",
  "user": {
    "id": "abc123",
    "username": "alice",
    "displayName": "Alice Smith"
  },
  "text": "Hello, world!",
  "visibility": "public",
  "createdAt": "2025-11-25T10:00:00.000Z"
}
```

**Errors:**
- `400 Bad Request`: Missing noteId
- `404 Not Found`: Note not found

---

### POST /notes/delete

Deletes a note (own notes only).

**Authentication:** Required

**Request Body:**
```json
{
  "noteId": "note123"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Errors:**
- `403 Forbidden`: Not authorized to delete this note

---

### GET /notes/local-timeline

Retrieves the local timeline (all public posts from local users).

**Query Parameters:**
- `limit` (optional, default: 20): Number of notes to retrieve
- `sinceId` (optional): Return notes created after this ID
- `untilId` (optional): Return notes created before this ID

**Response (200 OK):**
```json
[
  {
    "id": "note123",
    "userId": "abc123",
    "user": { ... },
    "text": "Hello, world!",
    "visibility": "public",
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

### GET /notes/timeline

Retrieves the home timeline (posts from followed users + own posts).

**Authentication:** Required

**Query Parameters:**
- `limit` (optional, default: 20)
- `sinceId` (optional)
- `untilId` (optional)

**Response (200 OK):**
```json
[
  {
    "id": "note123",
    "userId": "abc123",
    "user": { ... },
    "text": "Hello from a followed user!",
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

### GET /notes/social-timeline

Retrieves the social timeline (local + followed remote users).

**Authentication:** Optional (different results when authenticated)

**Query Parameters:**
- `limit` (optional, default: 20)
- `sinceId` (optional)
- `untilId` (optional)

**Response (200 OK):**
```json
[
  {
    "id": "note123",
    "userId": "abc123",
    "user": { ... },
    "text": "Post from local or followed remote user",
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

## Reactions Endpoints

### POST /notes/reactions/create

Adds a reaction (emoji) to a note.

**Authentication:** Required

**Request Body:**
```json
{
  "noteId": "note123",
  "reaction": "👍"
}
```

**Validation:**
- `reaction`: 1-100 characters, cannot be empty

**Response (201 Created):**
```json
{
  "id": "reaction123",
  "userId": "abc123",
  "noteId": "note123",
  "reaction": "👍",
  "createdAt": "2025-11-25T10:00:00.000Z"
}
```

**Note:** Creating the same reaction twice is idempotent (returns existing reaction).

---

### POST /notes/reactions/delete

Removes a reaction from a note.

**Authentication:** Required

**Request Body:**
```json
{
  "noteId": "note123",
  "reaction": "👍"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### GET /notes/reactions

Retrieves all reactions for a note.

**Query Parameters:**
- `noteId` (required): Note ID
- `limit` (optional, default: 100)

**Response (200 OK):**
```json
[
  {
    "id": "reaction123",
    "userId": "abc123",
    "user": {
      "id": "abc123",
      "username": "alice",
      "displayName": "Alice"
    },
    "reaction": "👍",
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

### GET /notes/reactions/counts

Retrieves reaction counts grouped by emoji.

**Query Parameters:**
- `noteId` (required)

**Response (200 OK):**
```json
{
  "👍": 5,
  "❤️": 3,
  "😂": 2
}
```

---

### GET /notes/reactions/my-reactions

Retrieves the current user's reactions for a specific note.

**Authentication:** Required

**Query Parameters:**
- `noteId` (required)

**Response (200 OK):**
```json
[
  {
    "id": "reaction123",
    "userId": "abc123",
    "noteId": "note123",
    "reaction": "👍",
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

## Following Endpoints

### POST /following/create

Follows a user.

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "user-id-to-follow"
}
```

**Response (201 Created):**
```json
{
  "id": "follow123",
  "followerId": "abc123",
  "followeeId": "user-id-to-follow",
  "createdAt": "2025-11-25T10:00:00.000Z"
}
```

**Errors:**
- `400 Bad Request`: Cannot follow yourself
- `404 Not Found`: User not found

---

### POST /following/delete

Unfollows a user.

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "user-id-to-unfollow"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### GET /following/exists

Checks if the current user is following a specific user.

**Authentication:** Required

**Query Parameters:**
- `userId` (required): User ID to check

**Response (200 OK):**
```json
{
  "exists": true
}
```

---

### GET /users/followers

Retrieves a user's followers list.

**Query Parameters:**
- `userId` (required): User ID
- `limit` (optional, default: 100)

**Response (200 OK):**
```json
[
  {
    "id": "follow123",
    "followerId": "follower-user-id",
    "follower": {
      "id": "follower-user-id",
      "username": "bob",
      "displayName": "Bob"
    },
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

### GET /users/following

Retrieves a user's following list.

**Query Parameters:**
- `userId` (required): User ID
- `limit` (optional, default: 100)

**Response (200 OK):**
```json
[
  {
    "id": "follow123",
    "followeeId": "followed-user-id",
    "followee": {
      "id": "followed-user-id",
      "username": "alice",
      "displayName": "Alice"
    },
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
]
```

---

## Users Endpoints

### GET /users/@me

Retrieves the current user's full profile.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "id": "abc123",
  "username": "alice",
  "email": "alice@example.com",
  "displayName": "Alice Smith",
  "host": null,
  "avatarUrl": null,
  "bannerUrl": null,
  "bio": null,
  "isAdmin": false,
  "isSuspended": false,
  "createdAt": "2025-11-01T10:00:00.000Z"
}
```

---

### PATCH /users/@me

Updates the current user's profile.

**Authentication:** Required

**Request Body (all fields optional):**
```json
{
  "name": "New Display Name",
  "description": "New bio text"
}
```

**Response (200 OK):**
```json
{
  "id": "abc123",
  "username": "alice",
  "displayName": "New Display Name",
  "bio": "New bio text"
}
```

---

### GET /users/show

Retrieves a user's public profile.

**Query Parameters:**
- `userId` OR `username` (one required)

**Response (200 OK):**
```json
{
  "id": "abc123",
  "username": "alice",
  "displayName": "Alice Smith",
  "host": null,
  "avatarUrl": null,
  "bannerUrl": null,
  "bio": "My bio"
}
```

**Errors:**
- `400 Bad Request`: Missing userId or username
- `404 Not Found`: User not found

---

## Drive Endpoints

### POST /drive/files/create

Uploads a file.

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File to upload

**Response (201 Created):**
```json
{
  "id": "file123",
  "userId": "abc123",
  "name": "image.png",
  "type": "image/png",
  "size": 12345,
  "url": "http://localhost:3000/files/file123.png",
  "createdAt": "2025-11-25T10:00:00.000Z"
}
```

---

### POST /drive/files/delete

Deletes a file.

**Authentication:** Required

**Request Body:**
```json
{
  "fileId": "file123"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server-side error

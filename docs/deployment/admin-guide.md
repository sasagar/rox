# Rox Administrator Guide

This guide covers configuration and management tasks for Rox instance administrators.

## Table of Contents

- [Custom Emoji Management](#custom-emoji-management)
- [Instance Settings](#instance-settings)
- [User Management](#user-management)

---

## Custom Emoji Management

Rox supports custom emojis that can be used in notes and reactions. Administrators can manage emojis through the Admin Panel at `/admin/emojis`.

### Accessing Emoji Management

1. Log in with an administrator account
2. Navigate to **Admin** → **Custom Emojis** (or go to `/admin/emojis`)

### Adding Individual Emojis

1. Click **Add Emoji**
2. Fill in the required fields:
   - **Name**: Lowercase letters, numbers, and underscores only (e.g., `happy_cat`)
   - **Image**: Upload PNG, GIF, WebP, or APNG (max 256KB)
3. Optional fields:
   - **Category**: Group emojis by category (e.g., `reactions`, `animals`)
   - **Aliases**: Comma-separated alternative names
   - **License**: License information (e.g., `CC BY 4.0`)
   - **Sensitive**: Mark as NSFW content
4. Click **Add Emoji**

### Bulk Import from ZIP

For importing many emojis at once:

1. Go to the **Bulk Import** tab
2. Prepare a ZIP file with your emoji images
3. Optionally include a `meta.json` file for detailed configuration
4. Click to upload or drag and drop the ZIP file

#### ZIP File Structure

```
emojis.zip
├── meta.json (optional)
├── happy.png
├── sad.gif
├── party.webp
└── category/
    └── subcategory_emoji.png
```

#### meta.json Format

```json
[
  {
    "name": "happy",
    "file": "happy.png",
    "category": "reactions",
    "aliases": ["joy", "smile"],
    "license": "CC BY 4.0",
    "isSensitive": false
  },
  {
    "name": "party",
    "file": "party.webp",
    "category": "celebrations"
  }
]
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Emoji name (lowercase, alphanumeric + underscore) |
| `file` | Yes | Path to image file within ZIP |
| `category` | No | Category for grouping |
| `aliases` | No | Alternative names (array) |
| `license` | No | License information |
| `isSensitive` | No | NSFW flag (default: false) |

**Without meta.json:**

If no `meta.json` is provided, emoji names are derived from filenames:
- `happy_cat.png` → `:happy_cat:`
- `Cool-Emoji.gif` → `:cool_emoji:` (normalized)

#### Import Limits

- Maximum ZIP size: **50MB**
- Maximum file size per emoji: **256KB**
- Supported formats: PNG, GIF, WebP, APNG

### Remote Emoji Adoption

When users from other ActivityPub servers react with custom emojis, Rox automatically saves those emojis. Administrators can adopt them as local emojis:

1. Go to the **Remote Emojis** tab
2. Browse emojis collected from other servers
3. Filter by server using the dropdown
4. Click **Adopt** to download and save as a local emoji

**Note:** Adopting creates a local copy of the image, so the emoji remains available even if the remote server becomes unavailable.

### Managing Existing Emojis

- **Edit**: Hover over an emoji and click the pencil icon
- **Delete**: Hover over an emoji and click the trash icon
- **Search**: Use the search box to find emojis by name or alias
- **Filter**: Use the category dropdown to filter by category

---

## Instance Settings

### Basic Configuration

Access instance settings at `/admin/settings`:

- **Instance Name**: Display name for your Rox instance
- **Instance Description**: Short description shown on the landing page
- **Admin Contact**: Administrator email address
- **Registration**: Enable/disable new user registration

### Instance Icons

Rox supports separate icons for light and dark themes:

- **Light Mode Icon**: Displayed when users have light theme enabled
- **Dark Mode Icon**: Displayed when users have dark theme enabled
- If only light mode icon is set, it will be used for both themes

Recommended specifications:
- Format: PNG or SVG
- Size: 512x512 pixels (or square aspect ratio)
- Transparent background recommended

---

## User Management

### Roles and Permissions

Rox uses a role-based permission system. Administrators can:

1. Create custom roles with specific permissions
2. Assign roles to users
3. Set default roles for new users

### Available Permissions

| Permission | Description |
|------------|-------------|
| `canManageCustomEmojis` | Add, edit, delete custom emojis |
| `canManageUsers` | Manage user accounts |
| `canManageRoles` | Create and modify roles |
| `canViewAdminDashboard` | Access admin dashboard |
| `canManageInstance` | Modify instance settings |

### Moderating Users

From the Admin Panel, administrators can:

- **Suspend**: Temporarily disable a user account
- **Silence**: Limit visibility of a user's posts
- **Delete**: Permanently remove a user account

---

## Troubleshooting

### Emoji Import Issues

**"File too large" error:**
- Ensure each emoji image is under 256KB
- Consider compressing images before import

**"Invalid emoji name" error:**
- Names must contain only lowercase letters, numbers, and underscores
- Avoid spaces, hyphens, and special characters

**"Already exists" warning:**
- An emoji with the same name already exists
- Either rename the new emoji or delete the existing one

### Remote Emoji Issues

**Emojis not appearing from other servers:**
- Ensure your instance can reach the remote server
- Check that the remote emoji URL is accessible
- The emoji will be collected when a remote user reacts with it

---

## API Reference

For programmatic emoji management, see the [API Documentation](/docs/api/).

### Emoji Endpoints

- `GET /api/emojis` - List all local emojis
- `POST /api/emojis/create` - Create new emoji
- `PATCH /api/emojis/:id` - Update emoji
- `DELETE /api/emojis/:id` - Delete emoji
- `GET /api/emojis/remote` - List remote emojis (admin)
- `POST /api/emojis/adopt` - Adopt remote emoji (admin)
- `POST /api/emojis/import` - Bulk import from ZIP (admin)

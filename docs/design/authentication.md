# Authentication Design

linproj supports two authentication methods. OAuth is the recommended default for interactive use; API keys are supported for scripts/automation and as a simpler fallback.

## Authentication Methods

### 1. OAuth 2.0 + PKCE (Recommended, Not Yet Implemented)

Browser-based OAuth flow using PKCE (Proof Key for Code Exchange). PKCE allows CLIs to use OAuth securely without embedding a client_secret.

**Flow:**
```
$ linproj auth login

Opening browser to authenticate with Linear...
Waiting for authorization...

✓ Authenticated as Jane Doe (jane@example.com)
```

**Technical Details:**

1. CLI generates a random `code_verifier` and derives `code_challenge` (SHA256)
2. Opens browser to:
   ```
   https://linear.app/oauth/authorize?
     client_id=<LINPROJ_CLIENT_ID>&
     redirect_uri=http://localhost:PORT/callback&
     response_type=code&
     scope=read,write&
     state=<random>&
     code_challenge=<challenge>&
     code_challenge_method=S256
   ```
3. CLI starts temporary HTTP server on localhost (finds available port)
4. User approves in browser → Linear redirects to `http://localhost:PORT/callback?code=XXX&state=YYY`
5. CLI validates `state`, exchanges code for token:
   ```
   POST https://api.linear.app/oauth/token
   Content-Type: application/x-www-form-urlencoded

   client_id=<LINPROJ_CLIENT_ID>&
   code=<code>&
   redirect_uri=http://localhost:PORT/callback&
   grant_type=authorization_code&
   code_verifier=<verifier>
   ```
6. Linear returns access token (and refresh token for apps created after Oct 2025)
7. CLI stores tokens in config

**Why localhost is safe:**
- Only the local machine can receive the callback
- PKCE ensures the authorization code can only be exchanged by the original requester
- State parameter prevents CSRF

**Required Setup:**
- Register OAuth app at Linear: Settings > API > OAuth applications
- Embed `client_id` in binary (safe with PKCE - no secret needed)
- Requested scopes: `read`, `write` (can be refined later)

**Token Storage:**
```json
{
  "auth": {
    "type": "oauth",
    "accessToken": "lin_oauth_xxx",
    "refreshToken": "lin_refresh_xxx",
    "expiresAt": "2025-01-24T12:00:00Z"
  }
}
```

**Token Refresh:**
- Access tokens expire in 24 hours
- Automatically refresh using refresh token before expiry
- If refresh fails, prompt user to re-authenticate

---

### 2. Personal API Key (Implemented)

Manual authentication using a user-generated API key. Simpler but requires user to copy/paste.

**Flow:**
```
$ linproj auth login --method api-key

To create an API key:
1. Go to Linear Settings > Account > Security & Access
2. Under "API keys", click "Create key"
3. Give it a label (e.g., "linproj") and select permissions

Paste your API key: <user pastes, input hidden>

✓ Authenticated as Jane Doe (jane@example.com)
```

For non-interactive use (CI/scripts), pipe via stdin:
```
$ echo "$LINEAR_API_KEY" | linproj auth login --method api-key
```

**Security Note:** API keys are never accepted as CLI arguments (they would appear in shell history and process listings).

**Technical Details:**
- User creates key at: Linear Settings > Account > Security & Access
- Key permissions: Read, Write, Admin, Create issues, Create comments
- Auth header format: `Authorization: <API_KEY>` (no "Bearer" prefix)
- Rate limit: 1,500 requests/hour per user

**Token Storage:**
```json
{
  "auth": {
    "type": "api-key",
    "apiKey": "lin_api_xxxxx"
  }
}
```

**Validation:**
Query the `viewer` endpoint to verify the key works:
```graphql
query {
  viewer {
    id
    name
    email
  }
}
```

---

## Config File Location

Following XDG Base Directory Specification:

| Platform | Path |
|----------|------|
| Linux | `$XDG_CONFIG_HOME/linproj/config.json` or `~/.config/linproj/config.json` |
| macOS | `~/.config/linproj/config.json` |
| Windows | `%APPDATA%\linproj\config.json` |

---

## Command Interface

```bash
# Default: OAuth (when implemented)
linproj auth login

# Explicit method selection
linproj auth login --method oauth      # Browser-based OAuth (not yet implemented)
linproj auth login --method api-key    # Interactive API key prompt

# Non-interactive API key (for scripts) - via stdin
echo "$LINEAR_API_KEY" | linproj auth login --method api-key

# Check auth status
linproj auth status

# Logout (remove stored credentials)
linproj auth logout
```

---

## Implementation Priority

1. **Phase 1 (Initial):** API key authentication only
   - `linproj auth login --method api-key` (default when OAuth not implemented)
   - `linproj auth login --method oauth` → "Not yet implemented"

2. **Phase 2:** OAuth + PKCE
   - Register OAuth app with Linear
   - Implement PKCE flow with localhost callback
   - Make OAuth the default method

---

## Security Considerations

- **No tokens as CLI arguments** - tokens are never accepted via `--token` flag (visible in shell history, `ps`, `/proc`)
- Config file permissions: `0600` (owner read/write only)
- Never log or display tokens after initial input
- Hide input when prompting for API key (no echo)
- API keys don't expire (user must revoke manually)
- OAuth tokens expire in 24h (auto-refresh)

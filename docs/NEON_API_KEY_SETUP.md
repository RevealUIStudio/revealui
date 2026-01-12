# How to Get Your Neon API Key

## Step-by-Step Instructions

### 1. Go to Neon Console
Visit: **https://console.neon.tech**

### 2. Sign In
- Sign in with your Neon account
- If you don't have an account, create one (it's free)

### 3. Navigate to API Keys
- Once logged in, click on your **profile/account icon** (usually top right)
- Go to **Settings** or **Account Settings**
- Look for **API Keys** section
- Or go directly to: **https://console.neon.tech/app/settings/api-keys**

### 4. Create a New API Key
- Click **"Create API Key"** or **"New API Key"** button
- Give it a name (e.g., "RevealUI MCP Server")
- Click **"Create"** or **"Generate"**

### 5. Copy the API Key
- **⚠️ IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
- The key will start with `neon_` followed by a long string
- Format: `neon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 6. Add to Your .env File
Add the key to your `.env` file in the project root:

```env
NEON_API_KEY=neon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 7. Restart MCP Servers
After adding the key, restart your MCP servers:

```bash
pnpm mcp:all
```

## Direct Links

- **Neon Console**: https://console.neon.tech
- **API Keys Settings**: https://console.neon.tech/app/settings/api-keys
- **Neon Documentation**: https://neon.tech/docs

## Security Notes

- ⚠️ **Never commit your API key to git** (it should be in `.gitignore`)
- ⚠️ **Keep your API key secret** - treat it like a password
- ✅ You can create multiple API keys for different purposes
- ✅ You can revoke/delete API keys if needed

## Troubleshooting

**Can't find API Keys section?**
- Make sure you're logged into the correct Neon account
- Try the direct link: https://console.neon.tech/app/settings/api-keys
- Check if you need to verify your email first

**Key not working?**
- Make sure you copied the entire key (including `neon_` prefix)
- Check for any extra spaces in your `.env` file
- Verify the key hasn't been revoked in the Neon console

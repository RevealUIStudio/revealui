# How to Use Next.js DevTools MCP

## Quick Start: Just Ask Cursor!

MCP doesn't show visible output - **you use it by asking Cursor questions in chat**.

---

## ✅ Real Examples - Copy and Paste These in Cursor Chat:

### 1. Check for Errors

```
Use Next.js DevTools MCP to check what errors are in my Next.js app right now
```

**What this does:**
- Cursor connects to your dev server via MCP
- Gets real-time build/runtime errors
- Shows you what's broken without checking terminal

---

### 2. List All Routes

```
Use Next.js DevTools MCP to show me all the routes in my CMS app
```

**What this does:**
- Discovers all your routes (pages, API routes, dynamic routes)
- Shows file locations and route structure
- Helps understand your app architecture

---

### 3. Check Dev Server Status

```
Use Next.js DevTools MCP to verify my dev server is working correctly
```

**What this does:**
- Checks if server is running
- Verifies MCP endpoint is accessible
- Tests connection to your Next.js app

---

### 4. Analyze Configuration

```
Use Next.js DevTools MCP to analyze my Next.js configuration and identify any issues
```

**What this does:**
- Checks Next.js config for problems
- Verifies Turbopack settings
- Identifies potential performance issues

---

### 5. View Build Information

```
Use Next.js DevTools MCP to get build information about my CMS app
```

**What this does:**
- Shows build configuration
- Displays compilation settings
- Lists enabled features

---

## 🎯 Key Points

1. **MCP is invisible** - You won't see it running separately
2. **Ask Cursor directly** - Just ask questions like above
3. **Cursor uses MCP automatically** - When you ask about Next.js, Cursor connects via MCP
4. **No manual setup needed** - Cursor handles everything

---

## ❓ Why You Might Think It's Not Working

### Common Misconceptions:

❌ **"I don't see MCP output"** 
✅ That's normal! MCP works behind the scenes

❌ **"I ran `pnpm mcp:next-devtools` but nothing happened"
✅ That's for testing. Cursor manages it automatically

❌ **"I don't see it helping"
✅ You need to ASK Cursor to use it - try the examples above!

---

## 🔍 How to Verify It's Working

1. **Make sure dev server is running:**
   ```bash
   pnpm --filter cms dev
   ```

2. **Ask Cursor this exact question:**
   ```
   Use Next.js DevTools MCP to check what errors are currently in my Next.js app
   ```

3. **If it works:** Cursor will list all your errors
4. **If it doesn't:** Cursor will tell you what's wrong

---

## 💡 Best Use Cases

- **Debugging:** "Use MCP to find errors in my app"
- **Understanding:** "Show me all my routes using Next.js DevTools MCP"
- **Performance:** "Use MCP to analyze my Next.js build configuration"
- **Discovery:** "What tools are available from the Next.js DevTools MCP?"

---

**Remember:** MCP is a tool for Cursor AI, not something you interact with directly. Just ask Cursor questions and it will use MCP automatically!

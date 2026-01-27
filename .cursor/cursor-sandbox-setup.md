# Cursor Sandbox Environment Setup

## Node Version Configuration for Cursor Agent

The RevealUI project requires Node.js >=24.12.0. This guide helps configure Cursor's agent sandbox to use the correct Node version.

### Current Status

- ✅ Node 24.12.0 is installed via nvm
- ✅ `.nvmrc` file created specifying version `24.12.0`
- ✅ `.envrc` updated to load Node version with direnv
- ✅ Setup script created: `pnpm setup:node`

### Cursor Sandbox Configuration

To ensure Cursor's agent sandbox uses the correct Node version:

1. **Install direnv** (if not already installed):
   ```bash
   # macOS
   brew install direnv

   # Ubuntu/Debian
   sudo apt install direnv

   # Add to your shell config (~/.bashrc or ~/.zshrc):
   eval "$(direnv hook bash)"  # or zsh
   ```

2. **Allow direnv in project directory**:
   ```bash
   cd /path/to/RevealUI
   direnv allow
   ```

3. **Verify Node version in Cursor**:
   - Open Cursor in the project directory
   - The `.envrc` should automatically load the correct Node version
   - If not working, run: `pnpm setup:node` in Cursor's terminal

### Troubleshooting

If Cursor still shows the wrong Node version:

1. **Check nvm configuration**:
   ```bash
   nvm list
   nvm use 24.12.0
   ```

2. **Verify direnv is working**:
   ```bash
   direnv status
   ```

3. **Manual Node version switch**:
   ```bash
   cd /home/joshua-v-dev/projects/RevealUI
   nvm use
   node --version  # Should show v24.12.0
   ```

4. **Restart Cursor** after making changes to environment configuration.

### For Cursor IDE Users

If you're using Cursor IDE, you may need to:

1. Open Cursor's integrated terminal
2. Run: `nvm use 24.12.0`
3. Restart any running processes

The `.nvmrc` file ensures that anyone entering the project directory will automatically use the correct Node version if they have direnv configured.
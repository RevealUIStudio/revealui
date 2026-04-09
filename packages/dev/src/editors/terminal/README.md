# RevealUI Terminal Profiles

Terminal emulator configurations with the RevealUI brand color scheme.

| Property | Value |
|----------|-------|
| Background | `#0A0A0F` (near-black) |
| Foreground | `#E4E4E7` (zinc-200) |
| Cursor | `#7C3AED` (violet-600) |
| Font | JetBrains Mono, 14pt |

## Installation

### iTerm2 (macOS)

Copy the dynamic profile to iTerm2's config directory:

```bash
cp iterm2-revealui.json ~/Library/Application\ Support/iTerm2/DynamicProfiles/
```

The "RevealUI" profile will appear automatically in iTerm2 > Profiles.

### Terminal.app (macOS)

Double-click the file or import via Terminal > Settings > Profiles > Import:

```bash
open Terminal.app-RevealUI.terminal
```

The profile sets font, scrollback, and window size. Terminal.app stores colors as binary
`NSArchiver` blobs that cannot be hand-authored in XML, so you must set the colors
manually after import: open Terminal > Settings > Profiles > RevealUI and apply the hex
values listed in the comment block at the top of the `.terminal` file.

### Alacritty (cross-platform)

Copy as your main config or import it:

```bash
# Replace existing config
cp alacritty-revealui.toml ~/.config/alacritty/alacritty.toml

# Or import into an existing config by adding to your alacritty.toml:
# [general]
# import = ["/path/to/alacritty-revealui.toml"]
```

### Kitty (cross-platform)

Copy as your main config or include it:

```bash
# Replace existing config
cp kitty-revealui.conf ~/.config/kitty/kitty.conf

# Or include in an existing config by adding to your kitty.conf:
# include /path/to/kitty-revealui.conf
```

### GNOME Terminal (Linux)

Load the dconf profile, then add it to the profile list:

```bash
# Create a profile with a known ID
PROFILE_ID=$(uuidgen)

# Load the color settings
dconf load "/org/gnome/terminal/legacy/profiles:/:${PROFILE_ID}/" < gnome-terminal-revealui.dconf

# Add to profile list
EXISTING=$(dconf read /org/gnome/terminal/legacy/profiles:/list)
if [ -z "$EXISTING" ]; then
  dconf write /org/gnome/terminal/legacy/profiles:/list "['${PROFILE_ID}']"
else
  dconf write /org/gnome/terminal/legacy/profiles:/list "${EXISTING%]*}, '${PROFILE_ID}']"
fi
```

Then select "RevealUI" from the GNOME Terminal profile menu.

## Font Installation

All profiles use JetBrains Mono. Install it before applying the profiles:

```bash
# macOS (Homebrew)
brew install --cask font-jetbrains-mono

# Ubuntu/Debian
sudo apt install fonts-jetbrains-mono

# Fedora
sudo dnf install jetbrains-mono-fonts

# Arch
sudo pacman -S ttf-jetbrains-mono

# Manual (any OS)
# Download from https://www.jetbrains.com/lp/mono/
```

If JetBrains Mono is unavailable, the profiles fall back to the system monospace font. For best results, also install Fira Code and Cascadia Code as secondary fallbacks.

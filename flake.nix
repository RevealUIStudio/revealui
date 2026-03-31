{
  description = "RevealUI - Business Operating System Software Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Use Node.js 24 LTS (Krypton)
        nodejs = pkgs.nodejs_24;

      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            pkg-config
          ];

          # Tauri needs system libs on LD_LIBRARY_PATH for linking + runtime
          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
            pkgs.openssl
            pkgs.gtk3
            pkgs.glib
            pkgs.gdk-pixbuf
            pkgs.pango
            pkgs.cairo
            pkgs.atk
            pkgs.libsoup_3
            pkgs.webkitgtk_4_1
            pkgs.librsvg
            pkgs.xz  # liblzma (needed by cargo-tauri)
            pkgs.libayatana-appindicator  # system tray (Tauri)
            pkgs.libgit2  # git2 crate (Studio git panel)
          ];

          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs
            nodePackages.pnpm
            # Note: Corepack removed - pnpm 10+ has built-in version management

            # Security
            gitleaks

            # Database
            (postgresql_16.withPackages (ps: [ ps.pgvector ]))

            # Rust / Tauri (Studio desktop app)
            rustc
            cargo
            cargo-tauri
            openssl
            libgit2  # git2 crate system library (Studio git panel)

            # Tauri system dependencies (Linux/GTK)
            gtk3
            glib
            gdk-pixbuf
            pango
            cairo
            atk
            libsoup_3
            webkitgtk_4_1
            librsvg
            libayatana-appindicator  # system tray

            # Go (Terminal TUI app)
            go

            # BitNet local inference (pnpm bitnet:install / pnpm bitnet:serve)
            # Provides clang 18, cmake, ninja, python3, and huggingface-cli for
            # building and running microsoft/BitNet from source.
            clang_18
            cmake
            ninja
            python3
            python3Packages.huggingface-hub

            # Services & APIs
            stripe-cli

            # Development tools
            git
            gh
            curl
            wget
            jq
            # Note: opensrc (npm install -g opensrc) provides package source for AI agents
            # Not in nixpkgs — installed globally via npm. Re-install after fnm node switch.

            # File utilities
            ripgrep
            fd
            tree

            # Shell utilities
            direnv
            nix-direnv

            # Workboard live viewer: `wb` alias renders workboard.md every 3s
            glow
            figlet
            toilet
            chafa
          ];

          shellHook = ''
            # Database helper functions — defined directly in shellHook so they
            # are shell functions, not subprocesses. Available in any interactive
            # session that enters this dev environment.
            db-start() {
              if [ ! -d "$PGDATA" ]; then
                echo "❌ PostgreSQL not initialized. Run 'revealui db init' first."
                return 1
              fi
              if pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "ℹ️  PostgreSQL is already running"
                return 0
              fi
              pg_ctl start -D "$PGDATA" -l "$PGDATA/logfile" -o "-k $PGDATA"
              echo "✅ PostgreSQL started (data: $PGDATA)"
              echo "   Connect: psql -h $PGHOST -d postgres"
            }

            db-stop() {
              if ! pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "ℹ️  PostgreSQL is not running"
                return 0
              fi
              pg_ctl stop -D "$PGDATA"
              echo "✅ PostgreSQL stopped"
            }

            db-status() {
              if pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "✅ PostgreSQL is running"
                pg_ctl status -D "$PGDATA"
              else
                echo "❌ PostgreSQL is not running"
              fi
            }

            db-init() {
              if [ -d "$PGDATA" ]; then
                echo "⚠️  PostgreSQL already initialized at $PGDATA"
                read -p "Delete and reinitialize? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                  return 1
                fi
                rm -rf "$PGDATA"
              fi
              echo "Initializing PostgreSQL..."
              initdb --locale=C.UTF-8 --encoding=UTF8 -D "$PGDATA" --username=postgres
              cat >> "$PGDATA/postgresql.conf" << 'PGCONF'

# RevealUI Development Settings
listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
PGCONF
              echo "unix_socket_directories = '$PGDATA'" >> "$PGDATA/postgresql.conf"
              cat > "$PGDATA/pg_hba.conf" << 'PGHBA'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
PGHBA
              echo "✅ PostgreSQL initialized at $PGDATA"
              echo "   Run 'revealui db start' to start the server"
            }

            db-reset() {
              db-stop
              rm -rf "$PGDATA"
              db-init
              echo "✅ Database reset complete"
            }

            db-psql() {
              if ! pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "❌ PostgreSQL is not running. Run 'revealui db start' first."
                return 1
              fi
              psql -h "$PGHOST" -U postgres -d postgres "$@"
            }

            # Set up PostgreSQL environment early so banner can reference $PGDATA
            export PGDATA="$PWD/.pgdata"
            export PGHOST="$PWD/.pgdata"
            export PGDATABASE="postgres"
            export PGUSER="postgres"
            export POSTGRES_URL="postgresql://postgres@localhost:5432/postgres"
            export DATABASE_URL="postgresql://postgres@localhost:5432/postgres"

            # Silence NPM_TOKEN expansion warning
            export NPM_TOKEN="''${NPM_TOKEN:-}"

            # Add node_modules/.bin to PATH for project scripts
            export PATH="$PWD/node_modules/.bin:$PATH"

            # Set development environment
            export NODE_ENV="''${NODE_ENV:-development}"

            # Turborepo cache directory
            export TURBO_CACHE_DIR="$PWD/.turbo"

            # ── Dev Environment Banner ────────────────────────────────────────

            _B='\033[1m'
            _AMBER='\033[1;38;2;251;191;36m'
            _GREEN='\033[1;38;2;52;211;153m'
            _CYAN='\033[1;38;2;34;211;238m'
            _DIM='\033[2m'
            _NC='\033[0m'

            _BRANCH=$(git -C "$PWD" branch --show-current 2>/dev/null || echo "detached")
            _DIRTY=$(git -C "$PWD" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            _NODE=$(node --version 2>/dev/null | tr -d 'v')
            _PNPM=$(pnpm --version 2>/dev/null)
            _DOCK=$(docker --version 2>/dev/null | sed 's/Docker version //' | cut -d, -f1)
            _ENV=''${NODE_ENV:-development}
            [ "$_ENV" = "development" ] && _ENV="dev"
            [ "$_ENV" = "production"  ] && _ENV="prod"

            # ── Boxed header ───────────────────────────────────────────────────
            _TITLE="  RevealUI  ·  Business OS  ·  $_ENV  "
            _W=''${#_TITLE}
            _LINE=$(printf '─%.0s' $(seq 1 "$_W"))
            echo ""
            echo -e "  ''${_DIM}╭''${_LINE}╮''${_NC}"
            echo -e "  ''${_DIM}│''${_NC}''${_B}$_TITLE''${_NC}''${_DIM}│''${_NC}"
            echo -e "  ''${_DIM}╰''${_LINE}╯''${_NC}"

            # ── Env context line ───────────────────────────────────────────────
            _CTXLINE="node $_NODE  ·  pnpm $_PNPM"
            [ -n "$_DOCK" ] && _CTXLINE="$_CTXLINE  ·  docker $_DOCK"
            if [ "$_DIRTY" = "0" ]; then
              _GIT="''${_GREEN}$_BRANCH  ·  clean''${_NC}"
            else
              _GIT="''${_AMBER}$_BRANCH  ·  $_DIRTY uncommitted''${_NC}"
            fi
            echo -e "\n   ''${_DIM}$_CTXLINE  ·  ''${_NC}$_GIT"

            # ── Service status (OK items inline · warnings per-line) ───────────
            _OK="" _WARNS="" _PG_READY=0 _DEPS_READY=0
            _ok()   { [ -n "$_OK" ] && _OK="$_OK  ''${_DIM}·''${_NC}  $1" || _OK="$1"; }
            _warn() { _WARNS="$_WARNS   ''${_AMBER}⚠  $1''${_NC}\n"; }

            if [ ! -d "$PGDATA" ]; then
              _warn "postgres  ''${_DIM}→''${_NC}  ''${_CYAN}revealui db init''${_NC}"
            elif pg_ctl status -D "$PGDATA" &>/dev/null; then
              _ok "''${_GREEN}✓ postgres''${_NC}"; _PG_READY=1
            else
              _warn "postgres  ''${_DIM}→''${_NC}  ''${_CYAN}revealui db start''${_NC}"
            fi

            if [ -d "node_modules" ]; then
              _ok "''${_GREEN}✓ deps''${_NC}"; _DEPS_READY=1
            else
              _warn "deps  ''${_DIM}→''${_NC}  ''${_CYAN}pnpm install''${_NC}"
            fi

            docker info &>/dev/null 2>&1 \
              && _ok "''${_GREEN}✓ docker''${_NC}" \
              || _warn "docker  ''${_DIM}→''${_NC}  start Docker Desktop"

            { [ -n "''${VERCEL_API_KEY:-}" ] || [ -n "''${STRIPE_SECRET_KEY:-}" ]; } \
              && _ok "''${_GREEN}✓ mcp''${_NC}" \
              || _warn "mcp  ''${_DIM}→''${_NC}  ''${_CYAN}dev up --include mcp''${_NC}"

            [ "''${TERM_PROGRAM:-}" = "zed" ] \
              && _ok "''${_GREEN}✓ acp''${_NC}" \
              || _warn "acp  ''${_DIM}→''${_NC}  open Zed + connect"

            echo ""
            [ -n "$_OK"    ] && echo -e "   $_OK"
            [ -n "$_WARNS" ] && printf "\n%b" "$_WARNS"

            # ── Quick commands ─────────────────────────────────────────────────
            _CMDS="''${_CYAN}dev''${_NC}  ''${_DIM}·''${_NC}  ''${_CYAN}wb''${_NC}"
            [ "$_PG_READY"   = 1 ] && _CMDS="$_CMDS  ''${_DIM}·''${_NC}  ''${_CYAN}db-psql''${_NC}"
            [ "$_DEPS_READY" = 1 ] && _CMDS="$_CMDS  ''${_DIM}·''${_NC}  ''${_CYAN}gate:quick''${_NC}"
            echo -e "\n   $_CMDS\n"

            unset _B _AMBER _GREEN _CYAN _DIM _NC
            unset _BRANCH _DIRTY _NODE _PNPM _DOCK _ENV _TITLE _W _LINE _CTXLINE _GIT
            unset _OK _WARNS _PG_READY _DEPS_READY _CMDS
            unset -f _ok _warn

            # Live workboard watcher — renders .claude/workboard.md every 3 s
            # Usage: wb
            wb() { watch -n3 "glow '$PWD/.claude/workboard.md' 2>/dev/null || cat '$PWD/.claude/workboard.md'"; }
            export -f wb

            # opensrc — fetch package source for agent context
            osrc() { opensrc "$@" --cwd "$PWD" --modify false; }
            export -f osrc
          '';

          # Environment variables
          NODE_ENV = "development";
          NPM_CONFIG_COLOR = "always";

          # Inform Node.js about available memory
          NODE_OPTIONS = "--max-old-space-size=4096";
        };

        # Additional shells for specific purposes
        devShells.ci = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            nodePackages.pnpm
            git
          ];

          shellHook = ''
            echo "CI Environment - Minimal dependencies"
            # Note: corepack enable removed - pnpm 10+ manages its own version
            export NODE_ENV="test"
          '';
        };

        # Shell for database operations only
        devShells.db = pkgs.mkShell {
          buildInputs = with pkgs; [
            (postgresql_16.withPackages (ps: [ ps.pgvector ]))
          ];

          shellHook = ''
            db-start() {
              pg_ctl start -D "$PGDATA" -l "$PGDATA/logfile" -o "-k $PGDATA"
            }
            db-stop() {
              pg_ctl stop -D "$PGDATA"
            }
            db-status() {
              pg_ctl status -D "$PGDATA"
            }
            export PGDATA="$PWD/.pgdata"
            export PGHOST="$PWD/.pgdata"
            echo "Database shell - PostgreSQL tools available"
          '';
        };
      }
    );
}

{
  description = "RevealUI - Headless CMS Framework Development Environment";

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

        # revealui developer CLI
        revealuiCLI = pkgs.buildGoModule {
          pname = "revealui";
          version = "0.1.0";
          src = ./cmd/revealui;
          vendorHash = "sha256-hocnLCzWN8srQcO3BMNkd2lt0m54Qe7sqAhUxVZlz1k=";
          meta = {
            description = "RevealUI developer CLI";
            mainProgram = "revealui";
          };
        };

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

            # Add project bin to PATH for custom scripts
            export PATH="$PWD/bin:$PWD/node_modules/.bin:$PATH"

            # Set development environment
            export NODE_ENV="''${NODE_ENV:-development}"

            # Turborepo cache directory
            export TURBO_CACHE_DIR="$PWD/.turbo"

            # ── Dev Environment Banner ────────────────────────────────────────

            # Colors — bold for contrast
            _AMBER='\033[1;38;2;251;191;36m'    # amber-400 bold
            _GREEN='\033[1;38;2;52;211;153m'    # emerald-400 bold
            _CYAN='\033[1;38;2;34;211;238m'     # cyan-400 bold
            _DIM='\033[2m'
            _NC='\033[0m'

            # Git + env context
            _BRANCH=$(git -C "$PWD" branch --show-current 2>/dev/null || echo "detached")
            _DIRTY=$(git -C "$PWD" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            _NODE=$(node --version 2>/dev/null | tr -d 'v')
            _PNPM=$(pnpm --version 2>/dev/null)
            _DOCK=$(docker --version 2>/dev/null | sed 's/Docker version //' | cut -d, -f1)
            _ENV=''${NODE_ENV:-development}
            [ "$_ENV" = "development" ] && _ENV="dev"
            [ "$_ENV" = "production"  ] && _ENV="prod"

            # ── Logo ──────────────────────────────────────────────────────────
            echo ""
            if [ -f "$PWD/assets/revealui-logo.png" ] && command -v chafa &>/dev/null; then
              chafa --size 60x8 --colors full "$PWD/assets/revealui-logo.png" | sed "s/^/  /"
            else
              _LOGO=$(figlet -f slant "RevealUI" 2>/dev/null)
              [ -n "$_LOGO" ] && echo "$_LOGO" | sed "s/^/  /" | while IFS= read -r _line; do
                echo -e "''${_CYAN}$_line''${_NC}"
              done
              unset _LOGO
            fi

            # ── Context box (padded) ───────────────────────────────────────────
            _PLAIN="  $_BRANCH"
            if [ "$_DIRTY" -gt 0 ] 2>/dev/null; then
              _HDR="  $_BRANCH  ''${_DIM}·''${_NC}  ''${_AMBER}$_DIRTY uncommitted''${_NC}"
              _PLAIN="$_PLAIN  ·  $_DIRTY uncommitted"
            else
              _HDR="  $_BRANCH  ''${_DIM}·''${_NC}  ''${_GREEN}clean''${_NC}"
              _PLAIN="$_PLAIN  ·  clean"
            fi
            _PLAIN="$_PLAIN  ·  $_ENV  "
            _HDR="$_HDR  ''${_DIM}·''${_NC}  $_ENV  "

            _W=''${#_PLAIN}
            _LINE=$(printf '─%.0s' $(seq 1 "$_W"))
            _PAD=$(printf ' %.0s' $(seq 1 "$_W"))

            echo ""
            echo -e "  ''${_DIM}╭''${_LINE}╮''${_NC}"
            echo -e "  ''${_DIM}│''${_NC}$_PAD''${_DIM}│''${_NC}"
            echo -e "  ''${_DIM}│''${_NC}$_HDR''${_DIM}│''${_NC}"
            echo -e "  ''${_DIM}│''${_NC}$_PAD''${_DIM}│''${_NC}"
            echo -e "  ''${_DIM}╰''${_LINE}╯''${_NC}"

            echo ""
            _ENV_LINE="node $_NODE  ·  pnpm $_PNPM"
            [ -n "$_DOCK" ] && _ENV_LINE="$_ENV_LINE  ·  docker $_DOCK"
            echo -e "   ''${_DIM}$_ENV_LINE''${_NC}"

            # ── Service status — one line per item ────────────────────────────
            _OK=""
            _add_ok() { [ -n "$_OK" ] && _OK="$_OK    $1" || _OK="$1"; }
            _PG_READY=0 _DEPS_READY=0
            _PGWARN="" _DEPWARN="" _DKWARN="" _MCPWARN=""

            if [ ! -d "$PGDATA" ]; then
              _PGWARN="  ''${_AMBER}⚠  postgres''${_NC}   ''${_DIM}—''${_NC}   ''${_CYAN}db init''${_NC}"
            elif pg_ctl status -D "$PGDATA" &>/dev/null; then
              _add_ok "''${_GREEN}✓ postgres''${_NC}  ''${_DIM}·  db-psql''${_NC}"
              _PG_READY=1
            else
              _PGWARN="  ''${_AMBER}⚠  postgres''${_NC}   ''${_DIM}—''${_NC}   ''${_CYAN}db start''${_NC}"
            fi

            if [ -d "node_modules" ]; then
              _add_ok "''${_GREEN}✓ deps''${_NC}"
              _DEPS_READY=1
            else
              _DEPWARN="  ''${_AMBER}⚠  deps''${_NC}       ''${_DIM}—''${_NC}   ''${_CYAN}pnpm install''${_NC}"
            fi

            if docker info &>/dev/null 2>&1; then
              _add_ok "''${_GREEN}✓ docker''${_NC}"
            else
              _DKWARN="  ''${_AMBER}⚠  docker''${_NC}     ''${_DIM}—''${_NC}   start Docker Desktop"
            fi

            if [ -n "''${VERCEL_API_KEY:-}" ] || [ -n "''${STRIPE_SECRET_KEY:-}" ]; then
              _add_ok "''${_GREEN}✓ mcp''${_NC}"
            else
              _MCPWARN="  ''${_AMBER}⚠  mcp''${_NC}        ''${_DIM}—''${_NC}   ''${_CYAN}dev up --include mcp''${_NC}"
            fi

            _ACPWARN=""
            if [ "''${TERM_PROGRAM:-}" = "zed" ]; then
              _add_ok "''${_GREEN}✓ acp''${_NC}"
            else
              _ACPWARN="  ''${_AMBER}⚠  acp''${_NC}        ''${_DIM}—''${_NC}   open Zed + connect"
            fi

            echo ""
            [ -n "$_OK" ] && echo -e "   $_OK"
            [ -n "$_PGWARN$_DEPWARN$_DKWARN$_MCPWARN$_ACPWARN" ] && echo ""
            [ -n "$_PGWARN"  ] && echo -e "$_PGWARN"
            [ -n "$_DEPWARN" ] && echo -e "$_DEPWARN"
            [ -n "$_DKWARN"  ] && echo -e "$_DKWARN"
            [ -n "$_MCPWARN" ] && echo -e "$_MCPWARN"
            [ -n "$_ACPWARN" ] && echo -e "$_ACPWARN"

            echo ""
            [ "$_DEPS_READY" = 1 ] && echo -e "   ''${_CYAN}gate:quick''${_NC}  ''${_DIM}—  CI gate''${_NC}"
            [ "$_DEPS_READY" = 1 ] && echo -e "   ''${_CYAN}dev''${_NC}         ''${_DIM}—  all services''${_NC}"
            echo -e "   ''${_CYAN}wb''${_NC}          ''${_DIM}—  workboard''${_NC}"
            [ "$_PG_READY" = 1 ] && echo -e "   ''${_CYAN}db-psql''${_NC}     ''${_DIM}—  pg shell''${_NC}"
            echo ""

            unset _BRANCH _DIRTY _NODE _PNPM _DOCK _ENV _ENV_LINE _HDR _PLAIN _W _LINE _PAD _line
            unset _OK _PGWARN _DEPWARN _DKWARN _MCPWARN _ACPWARN _PG_READY _DEPS_READY
            unset _AMBER _GREEN _CYAN _DIM _NC
            unset -f _add_ok

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

        # revealui CLI — install with: nix profile install .#revealui
        packages.revealui = revealuiCLI;
        packages.default = revealuiCLI;

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

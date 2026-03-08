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
          ];

          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs
            nodePackages.pnpm
            # Note: Corepack removed - pnpm 10+ has built-in version management

            # Database
            (postgresql_16.withPackages (ps: [ ps.pgvector ]))

            # Rust / Tauri (Studio desktop app)
            rustc
            cargo
            cargo-tauri
            openssl

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

            # Services & APIs
            stripe-cli

            # Development tools
            git
            gh
            curl
            wget
            jq

            # File utilities
            ripgrep
            fd
            tree

            # Shell utilities
            direnv
            nix-direnv

            # Workboard live viewer: `wb` alias renders workboard.md every 3s
            glow
          ];

          shellHook = ''
            # Database helper functions — defined directly in shellHook so they
            # are shell functions, not subprocesses. Available in any interactive
            # session that enters this dev environment.
            db-start() {
              if [ ! -d "$PGDATA" ]; then
                echo "❌ PostgreSQL not initialized. Run 'db-init' first."
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
              echo "   Run 'db-start' to start the server"
            }

            db-reset() {
              db-stop
              rm -rf "$PGDATA"
              db-init
              echo "✅ Database reset complete"
            }

            db-psql() {
              if ! pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "❌ PostgreSQL is not running. Run 'db-start' first."
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
            export PATH="$PWD/node_modules/.bin:$PATH"

            # Set development environment
            export NODE_ENV="''${NODE_ENV:-development}"

            # Turborepo cache directory
            export TURBO_CACHE_DIR="$PWD/.turbo"

            # Git context
            _BRANCH=$(git -C "$PWD" branch --show-current 2>/dev/null || echo "detached")
            _DIRTY=$(git -C "$PWD" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

            # Colors
            GREEN='\033[0;32m'
            YELLOW='\033[1;33m'
            CYAN='\033[0;36m'
            BOLD='\033[1m'
            DIM='\033[2m'
            NC='\033[0m'

            # Header: bold name, dim separators, yellow when dirty
            _SEP="''${DIM}  ·  ''${NC}"
            _HEADER="  ''${BOLD}RevealUI''${NC}''${_SEP}''${_BRANCH}"
            [ "$_DIRTY" -gt 0 ] 2>/dev/null && _HEADER="''${_HEADER}''${_SEP}''${YELLOW}''${_DIRTY} uncommitted''${NC}"

            echo ""
            echo -e "$_HEADER"
            echo ""

            # Status checks — no leading-space bug when first item is a warning
            _STATUS=""
            _WARN=""

            if [ ! -d "$PGDATA" ]; then
              _WARN="''${_WARN}  ''${YELLOW}⚠  postgres not initialized''${NC}  ''${DIM}—''${NC}  run ''${BOLD}''${CYAN}db-init''${NC}\n"
            elif pg_ctl status -D "$PGDATA" &>/dev/null; then
              _STATUS="  ''${GREEN}✅ postgres running''${NC}"
            else
              _WARN="''${_WARN}  ''${YELLOW}⚠  postgres not running''${NC}  ''${DIM}—''${NC}  run ''${BOLD}''${CYAN}db-start''${NC}\n"
            fi

            if [ -d "node_modules" ]; then
              if [ -n "$_STATUS" ]; then
                _STATUS="''${_STATUS}   ''${GREEN}✅ deps installed''${NC}"
              else
                _STATUS="  ''${GREEN}✅ deps installed''${NC}"
              fi
            else
              _WARN="''${_WARN}  ''${YELLOW}⚠  deps not installed''${NC}  ''${DIM}—''${NC}  run ''${BOLD}''${CYAN}pnpm install''${NC}\n"
            fi

            if docker info &>/dev/null; then
              _STATUS="''${_STATUS}   ''${GREEN}✅ docker''${NC}"
            else
              _WARN="''${_WARN}  ''${YELLOW}⚠  docker not running''${NC}  ''${DIM}—''${NC}  start Docker Desktop\n"
            fi

            if pgrep -f mcp &>/dev/null; then
              _STATUS="''${_STATUS}   ''${GREEN}✅ mcp''${NC}"
            else
              _WARN="''${_WARN}  ''${YELLOW}⚠  mcp not running''${NC}  ''${DIM}—''${NC}  run ''${BOLD}''${CYAN}pnpm mcp''${NC}\n"
            fi

            [ -n "$_STATUS" ] && echo -e "$_STATUS"
            [ -n "$_WARN" ]   && printf '%b' "$_WARN"

            echo ""
            echo -e "  ''${BOLD}''${CYAN}gate:quick''${NC}''${DIM}  ·  ''${NC}''${BOLD}''${CYAN}dev''${NC}''${DIM}  ·  ''${NC}''${BOLD}''${CYAN}wb''${NC}''${DIM}  ·  ''${NC}''${BOLD}''${CYAN}db-psql''${NC}"
            echo ""

            unset _BRANCH _DIRTY _HEADER _SEP _STATUS _WARN

            # Live workboard watcher — renders .claude/workboard.md every 3 s
            # Usage: wb
            wb() { watch -n3 "glow '$PWD/.claude/workboard.md' 2>/dev/null || cat '$PWD/.claude/workboard.md'"; }
            export -f wb
          '';

          # Environment variables
          NODE_ENV = "development";
          FORCE_COLOR = "1";  # Enable colors in terminals
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

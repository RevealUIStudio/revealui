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
          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs
            nodePackages.pnpm
            # Note: Corepack removed - pnpm 10+ has built-in version management

            # Database
            postgresql_16

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
              pg_ctl start -D "$PGDATA" -l "$PGDATA/logfile"
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

            # Color definitions
            RED='\033[0;31m'
            GREEN='\033[0;32m'
            YELLOW='\033[1;33m'
            BLUE='\033[0;34m'
            PURPLE='\033[0;35m'
            CYAN='\033[0;36m'
            NC='\033[0m' # No Color

            echo ""
            echo -e "''${PURPLE}╔════════════════════════════════════════════════════════════╗''${NC}"
            echo -e "''${PURPLE}║''${NC}  ''${CYAN}🚀 RevealUI Development Environment''${NC}                    ''${PURPLE}║''${NC}"
            echo -e "''${PURPLE}╚════════════════════════════════════════════════════════════╝''${NC}"
            echo ""
            echo -e "''${BLUE}📦 Versions:''${NC}"
            echo -e "  Node.js:    ''${GREEN}$(node --version)''${NC}"
            echo -e "  pnpm:       ''${GREEN}$(pnpm --version)''${NC}"
            echo -e "  PostgreSQL: ''${GREEN}$(postgres --version | head -n 1 | awk '{print $NF}')''${NC}"
            echo -e "  Stripe CLI: ''${GREEN}$(stripe --version 2>/dev/null || echo 'installed')''${NC}"
            echo ""
            echo -e "''${BLUE}📂 Project:''${NC}"
            echo -e "  Location:   ''${GREEN}$PWD''${NC}"
            echo -e "  PGDATA:     ''${GREEN}$PGDATA''${NC}"
            echo ""
            echo -e "''${BLUE}🛠️  Commands:''${NC}"
            echo -e "  ''${CYAN}pnpm install''${NC}       Install dependencies"
            echo -e "  ''${CYAN}pnpm dev''${NC}           Start development servers"
            echo -e "  ''${CYAN}pnpm test''${NC}          Run tests"
            echo -e "  ''${CYAN}pnpm build''${NC}         Build for production"
            echo ""
            echo -e "''${BLUE}🗄️  Database Commands:''${NC}"
            echo -e "  ''${CYAN}db-init''${NC}            Initialize PostgreSQL"
            echo -e "  ''${CYAN}db-start''${NC}           Start PostgreSQL server"
            echo -e "  ''${CYAN}db-stop''${NC}            Stop PostgreSQL server"
            echo -e "  ''${CYAN}db-status''${NC}          Check PostgreSQL status"
            echo -e "  ''${CYAN}db-reset''${NC}           Reset database (delete & reinit)"
            echo -e "  ''${CYAN}db-psql''${NC}            Connect with psql client"
            echo ""

            # Note: pnpm is already provided via nodePackages.pnpm in buildInputs
            # Nix manages versions, so corepack is not needed

            # Check PostgreSQL initialization
            if [ ! -d "$PGDATA" ]; then
              echo -e "''${YELLOW}⚠️  PostgreSQL not initialized''${NC}"
              echo -e "   Run ''${CYAN}db-init''${NC} to initialize, then ''${CYAN}db-start''${NC} to start"
              echo ""
            else
              # Check if PostgreSQL is running
              if pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo -e "''${GREEN}✅ PostgreSQL is running''${NC}"
              else
                echo -e "''${YELLOW}⚠️  PostgreSQL is initialized but not running''${NC}"
                echo -e "   Run ''${CYAN}db-start''${NC} to start the server"
              fi
              echo ""
            fi

            # Check if node_modules exists
            if [ ! -d "node_modules" ]; then
              echo -e "''${YELLOW}⚠️  Dependencies not installed''${NC}"
              echo -e "   Run ''${CYAN}pnpm install''${NC} to install dependencies"
              echo ""
            fi

            # Add project bin to PATH for custom scripts
            export PATH="$PWD/node_modules/.bin:$PATH"

            # Set development environment
            export NODE_ENV="''${NODE_ENV:-development}"

            # Turborepo cache directory
            export TURBO_CACHE_DIR="$PWD/.turbo"

            echo -e "''${GREEN}✨ Environment ready!''${NC} Happy coding! 🎉"
            echo ""
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
            postgresql_16
          ];

          shellHook = ''
            db-start() {
              pg_ctl start -D "$PGDATA" -l "$PGDATA/logfile"
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

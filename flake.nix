{
  description = "RevealUI — Agentic Business Runtime (Nix dev environment)";

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

            # Charm terminal tools
            gum           # Shell script TUI toolkit (interactive prompts, spinners, filters)
            vhs           # Terminal recording as code (.tape → GIF/MP4)
            charm-freeze  # Terminal screenshots (PNG/SVG)

            # Shell utilities
            direnv
            nix-direnv

            # glow: TRACKER / workboard viewers (`tracker`, `wb`)
            glow
            figlet
            toilet
            chafa
          ];

          shellHook = ''
            # Database helper functions — defined directly in shellHook so they
            # are shell functions, not subprocesses. Available in any interactive
            # session that enters this dev environment.
            #
            # Two local Postgres surfaces (do not conflate):
            #   1) App/dev DB on 127.0.0.1:5432 (Docker/system) — what seed/dev
            #      use via POSTGRES_URL from dotenv/revvault.
            #   2) Optional Nix PGDATA at $PWD/.pgdata — db-init/db-start only.
            db-start() {
              if [ ! -d "$PGDATA" ]; then
                echo "Nix PostgreSQL not initialized. Run 'db-init' first (optional .pgdata)."
                echo "App DB: ensure something is listening on 127.0.0.1:5432 (Docker/system)."
                return 1
              fi
              if pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "Nix PostgreSQL is already running ($PGDATA)"
                return 0
              fi
              pg_ctl start -D "$PGDATA" -l "$PGDATA/logfile" -o "-k $PGDATA"
              echo "Nix PostgreSQL started (data: $PGDATA)"
              echo "   Connect: psql -h $PGHOST -d postgres"
            }

            db-stop() {
              if ! pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "Nix PostgreSQL is not running"
                return 0
              fi
              pg_ctl stop -D "$PGDATA"
              echo "Nix PostgreSQL stopped"
            }

            db-status() {
              if command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
                echo "App Postgres: accepting connections on 127.0.0.1:5432"
              else
                echo "App Postgres: nothing accepting on 127.0.0.1:5432"
              fi
              if [ -d "$PGDATA" ] && pg_ctl status -D "$PGDATA" &>/dev/null; then
                echo "Nix .pgdata: running"
                pg_ctl status -D "$PGDATA"
              elif [ -d "$PGDATA" ]; then
                echo "Nix .pgdata: present, not running (db-start)"
              else
                echo "Nix .pgdata: not initialized (db-init, optional)"
              fi
            }

            db-init() {
              if [ -d "$PGDATA" ]; then
                echo "Nix PostgreSQL already initialized at $PGDATA"
                read -p "Delete and reinitialize? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                  return 1
                fi
                rm -rf "$PGDATA"
              fi
              echo "Initializing Nix PostgreSQL..."
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
              echo "Nix PostgreSQL initialized at $PGDATA"
              echo "   Run 'db-start' to start the server"
            }

            db-reset() {
              db-stop
              rm -rf "$PGDATA"
              db-init
              echo "Nix database reset complete"
            }

            db-psql() {
              if command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
                psql -h 127.0.0.1 -p 5432 -U "''${PGUSER:-postgres}" "''${PGDATABASE:-postgres}" "$@"
                return
              fi
              if [ -d "$PGDATA" ] && pg_ctl status -D "$PGDATA" &>/dev/null; then
                psql -h "$PGHOST" -U postgres -d postgres "$@"
                return
              fi
              echo "No Postgres accepting connections. Start app DB on :5432 or Nix .pgdata via db-start."
              return 1
            }

            # Optional Nix PGDATA (not the same as app POSTGRES_URL / Docker PG)
            export PGDATA="$PWD/.pgdata"
            export PGHOST="$PWD/.pgdata"
            export PGDATABASE="postgres"
            export PGUSER="postgres"
            # DB connection defaults — only set if not already provided by .env.local or revvault.
            # This allows probe, test, and custom DB setups to override without direnv shadowing.
            export POSTGRES_URL="''${POSTGRES_URL:-postgresql://postgres@localhost:5432/postgres}"
            export DATABASE_URL="''${DATABASE_URL:-postgresql://postgres@localhost:5432/postgres}"

            # Silence NPM_TOKEN expansion warning
            export NPM_TOKEN="''${NPM_TOKEN:-}"

            # Add node_modules/.bin to PATH for project scripts
            export PATH="$PWD/node_modules/.bin:$PATH"

            # Set development environment
            export NODE_ENV="''${NODE_ENV:-development}"

            # Turborepo cache directory
            export TURBO_CACHE_DIR="$PWD/.turbo"

            # ── Dev Environment Banner ────────────────────────────────────────
            # Methodology (RevealUI + Studio fleet): TRACKER free surfaces,
            # cut work from origin/test, PR→test, revvault secrets, agents propose
            # / owner disposes. Marketing CMS: page-blocks/pages/<slug>.ts +
            # pnpm db:seed:fleet-marketing.

            _B='\033[1m'
            _AMBER='\033[1;38;2;251;191;36m'
            _GREEN='\033[1;38;2;52;211;153m'
            _CYAN='\033[1;38;2;34;211;238m'
            _DIM='\033[2m'
            _NC='\033[0m'

            _BRANCH=$(git -C "$PWD" branch --show-current 2>/dev/null || echo "detached")
            _DIRTY=$(git -C "$PWD" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            _BEHIND=$(git -C "$PWD" rev-list --count HEAD..origin/test 2>/dev/null || echo 0)
            _NODE=$(node --version 2>/dev/null | tr -d 'v')
            _PNPM=$(pnpm --version 2>/dev/null)
            _DOCK=$(docker --version 2>/dev/null | sed 's/Docker version //' | cut -d, -f1)
            _ENV=''${NODE_ENV:-development}
            [ "$_ENV" = "development" ] && _ENV="dev"
            [ "$_ENV" = "production"  ] && _ENV="prod"

            # ── Boxed header ───────────────────────────────────────────────────
            _TITLE="  RevealUI  ·  Agentic Business Runtime  ·  $_ENV  "
            _W=''${#_TITLE}
            _LINE=$(printf '─%.0s' $(seq 1 "$_W"))
            echo ""
            echo -e "  ''${_DIM}╭''${_LINE}╮''${_NC}"
            echo -e "  ''${_DIM}│''${_NC}''${_B}$_TITLE''${_NC}''${_DIM}│''${_NC}"
            echo -e "  ''${_DIM}╰''${_LINE}╯''${_NC}"
            echo -e "   ''${_DIM}fleet: base origin/test · PR→test · TRACKER free surfaces · revvault secrets''${_NC}"

            # ── Env context line ───────────────────────────────────────────────
            _CTXLINE="node $_NODE  ·  pnpm $_PNPM"
            [ -n "$_DOCK" ] && _CTXLINE="$_CTXLINE  ·  docker $_DOCK"
            if [ "$_BEHIND" != "0" ] && [ -n "$_BEHIND" ]; then
              _GIT="''${_AMBER}$_BRANCH  ·  $_BEHIND behind origin/test''${_NC}"
            elif [ "$_DIRTY" = "0" ]; then
              _GIT="''${_GREEN}$_BRANCH  ·  clean''${_NC}"
            else
              _GIT="''${_AMBER}$_BRANCH  ·  $_DIRTY uncommitted''${_NC}"
            fi
            echo -e "\n   ''${_DIM}$_CTXLINE  ·  ''${_NC}$_GIT"

            # ── Service status (OK items inline · warnings per-line) ───────────
            _OK="" _WARNS="" _PG_READY=0 _DEPS_READY=0
            _ok()   { [ -n "$_OK" ] && _OK="$_OK  ''${_DIM}·''${_NC}  $1" || _OK="$1"; }
            _warn() { _WARNS="$_WARNS   ''${_AMBER}⚠  $1''${_NC}\n"; }

            # Prefer app Postgres on :5432 (seed/dev). Nix .pgdata is optional.
            if command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
              _ok "''${_GREEN}✓ postgres :5432''${_NC}"; _PG_READY=1
            elif [ -d "$PGDATA" ] && pg_ctl status -D "$PGDATA" &>/dev/null; then
              _ok "''${_GREEN}✓ postgres (nix .pgdata)''${_NC}"; _PG_READY=1
            elif [ ! -d "$PGDATA" ]; then
              _warn "postgres  ''${_DIM}→''${_NC}  start app DB on :5432  ''${_DIM}or''${_NC}  ''${_CYAN}db-init''${_NC} (optional nix .pgdata)"
            else
              _warn "postgres  ''${_DIM}→''${_NC}  start app DB on :5432  ''${_DIM}or''${_NC}  ''${_CYAN}db-start''${_NC} (nix .pgdata)"
            fi

            if [ -d "node_modules" ]; then
              _ok "''${_GREEN}✓ deps''${_NC}"; _DEPS_READY=1
            else
              _warn "deps  ''${_DIM}→''${_NC}  ''${_CYAN}pnpm install''${_NC}"
            fi

            docker info &>/dev/null 2>&1 \
              && _ok "''${_GREEN}✓ docker''${_NC}" \
              || _warn "docker  ''${_DIM}→''${_NC}  start Docker Desktop"

            # Secrets are revvault-first: check the vault store, not env vars.
            [ -d "''${REVVAULT_STORE:-$HOME/.revealui/passage-store}" ] \
              && _ok "''${_GREEN}✓ vault''${_NC}" \
              || _warn "vault  ''${_DIM}→''${_NC}  ''${_CYAN}revvault init''${_NC}"

            # ACP only applies inside Zed — a plain terminal is not degraded.
            [ "''${TERM_PROGRAM:-}" = "zed" ] && _ok "''${_GREEN}✓ acp''${_NC}"

            # Fleet TRACKER present (coordination authority for free surfaces)
            if [ -f "''${REVEALUI_TRACKER:-$HOME/revfleet/.jv/docs/TRACKER.md}" ]; then
              _ok "''${_GREEN}✓ tracker''${_NC}"
            else
              _warn "tracker  ''${_DIM}→''${_NC}  missing ~/revfleet/.jv/docs/TRACKER.md"
            fi

            echo ""
            [ -n "$_OK"    ] && echo -e "   $_OK"
            [ -n "$_WARNS" ] && printf "\n%b" "$_WARNS"

            # ── Quick commands (methodology-aligned) ───────────────────────────
            _CMDS="''${_CYAN}pnpm dev''${_NC}  ''${_DIM}·''${_NC}  ''${_CYAN}pnpm gate:quick''${_NC}  ''${_DIM}·''${_NC}  ''${_CYAN}tracker''${_NC}"
            [ "$_PG_READY"   = 1 ] && _CMDS="$_CMDS  ''${_DIM}·''${_NC}  ''${_CYAN}pnpm db:seed:fleet-marketing''${_NC}"
            [ "$_DEPS_READY" = 1 ] && _CMDS="$_CMDS  ''${_DIM}·''${_NC}  ''${_CYAN}rfg''${_NC}"
            echo -e "\n   $_CMDS\n"

            unset _B _AMBER _GREEN _CYAN _DIM _NC
            unset _BRANCH _DIRTY _BEHIND _NODE _PNPM _DOCK _ENV _TITLE _W _LINE _CTXLINE _GIT
            unset _OK _WARNS _PG_READY _DEPS_READY _CMDS
            unset -f _ok _warn

            # TRACKER — day-to-day free surfaces for all harnesses (fleet methodology).
            # Override path: REVEALUI_TRACKER
            tracker() {
              local t="''${REVEALUI_TRACKER:-$HOME/revfleet/.jv/docs/TRACKER.md}"
              if [ ! -f "$t" ]; then
                echo "tracker: not found at $t" >&2
                return 1
              fi
              if [ "''${1:-}" = "watch" ]; then
                watch -n5 "glow '$t' 2>/dev/null || cat '$t'"
              else
                glow "$t" 2>/dev/null || less -R "$t"
              fi
            }
            export -f tracker

            # Workboard watcher — canonical fleet workboard under .jv (not the
            # in-repo stub at apps/.claude/workboard.md). Override: REVEALUI_WORKBOARD
            wb() {
              local _wb="''${REVEALUI_WORKBOARD:-$HOME/revfleet/.jv/.claude/workboard.md}"
              if [ ! -f "$_wb" ]; then
                echo "wb: workboard not found at $_wb" >&2
                return 1
              fi
              watch -n3 "glow '$_wb' 2>/dev/null || cat '$_wb'"
            }
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

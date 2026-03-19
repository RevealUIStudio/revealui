package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var dbCmd = &cobra.Command{
	Use:   "db",
	Short: "Database management",
}

func init() {
	dbCmd.AddCommand(
		dbStartCmd,
		dbStopCmd,
		dbStatusCmd,
		dbInitCmd,
		dbResetCmd,
		dbPsqlCmd,
	)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func pgdata() string {
	if d := os.Getenv("PGDATA"); d != "" {
		return d
	}
	wd, _ := os.Getwd()
	return filepath.Join(wd, ".pgdata")
}

func pghost() string {
	if h := os.Getenv("PGHOST"); h != "" {
		return h
	}
	return pgdata()
}

func requirePgCtl() error {
	if _, err := exec.LookPath("pg_ctl"); err != nil {
		return fmt.Errorf("pg_ctl not found — enter the dev environment first (direnv allow, or nix develop)")
	}
	return nil
}

func run(name string, args ...string) error {
	c := exec.Command(name, args...)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return c.Run()
}

// ── Commands ──────────────────────────────────────────────────────────────────

var dbStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start postgres",
	RunE: func(_ *cobra.Command, _ []string) error {
		if err := requirePgCtl(); err != nil {
			return err
		}
		data := pgdata()
		if _, err := os.Stat(data); os.IsNotExist(err) {
			return fmt.Errorf("postgres not initialized — run 'reveal db init' first")
		}
		return run("pg_ctl", "start", "-D", data, "-l", filepath.Join(data, "logfile"), "-o", "-k "+data)
	},
}

var dbStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop postgres",
	RunE: func(_ *cobra.Command, _ []string) error {
		if err := requirePgCtl(); err != nil {
			return err
		}
		return run("pg_ctl", "stop", "-D", pgdata())
	},
}

var dbStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check postgres status",
	RunE: func(_ *cobra.Command, _ []string) error {
		if err := requirePgCtl(); err != nil {
			return err
		}
		return run("pg_ctl", "status", "-D", pgdata())
	},
}

var dbInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize postgres",
	RunE:  runDbInit,
}

func runDbInit(_ *cobra.Command, _ []string) error {
	if err := requirePgCtl(); err != nil {
		return err
	}
	data := pgdata()
	if _, err := os.Stat(data); !os.IsNotExist(err) {
		return fmt.Errorf("postgres already initialized at %s — use 'reveal db reset' to wipe and reinitialize", data)
	}

	if err := run("initdb", "--locale=C.UTF-8", "--encoding=UTF8", "-D", data, "--username=postgres"); err != nil {
		return err
	}

	// Append connection settings to postgresql.conf
	conf := filepath.Join(data, "postgresql.conf")
	f, err := os.OpenFile(conf, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "\n# RevealUI Development Settings\nlisten_addresses = 'localhost'\nport = 5432\nmax_connections = 100\nshared_buffers = 128MB\nunix_socket_directories = '%s'\n", data)
	if err != nil {
		return err
	}

	// Write pg_hba.conf
	hba := filepath.Join(data, "pg_hba.conf")
	hbaContent := "# TYPE  DATABASE  USER  ADDRESS      METHOD\nlocal   all       all               trust\nhost    all       all   127.0.0.1/32 trust\nhost    all       all   ::1/128      trust\n"
	if err := os.WriteFile(hba, []byte(hbaContent), 0600); err != nil {
		return err
	}

	fmt.Printf("✓ postgres initialized at %s\n  run 'reveal db start' to start the server\n", data)
	return nil
}

var dbResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Wipe and reinitialize postgres",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := requirePgCtl(); err != nil {
			return err
		}
		_ = run("pg_ctl", "stop", "-D", pgdata())
		if err := os.RemoveAll(pgdata()); err != nil {
			return err
		}
		return runDbInit(cmd, args)
	},
}

var dbPsqlCmd = &cobra.Command{
	Use:                "psql",
	Short:              "Open postgres shell",
	DisableFlagParsing: true,
	RunE: func(_ *cobra.Command, args []string) error {
		if err := requirePgCtl(); err != nil {
			return err
		}
		psqlArgs := append([]string{"-h", pghost(), "-U", "postgres", "-d", "postgres"}, args...)
		c := exec.Command("psql", psqlArgs...)
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		return c.Run()
	},
}

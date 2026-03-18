package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Enter the nix development environment",
	RunE:  runDev,
}

func runDev(_ *cobra.Command, _ []string) error {
	if os.Getenv("IN_NIX_SHELL") != "" {
		fmt.Println("already in dev environment")
		return nil
	}

	nix, err := exec.LookPath("nix")
	if err != nil {
		return fmt.Errorf("nix is not installed — see https://nixos.org/download")
	}

	c := exec.Command(nix, "develop")
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return c.Run()
}

package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "revealui",
	Short: "RevealUI developer CLI",
	Long:  "revealui — developer tooling for the RevealUI monorepo.",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(devCmd)
	rootCmd.AddCommand(dbCmd)
}

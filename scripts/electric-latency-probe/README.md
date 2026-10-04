# Electric latency probe

This isolated stack measures ElectricSQL shape-sync latency against a throwaway
Postgres database. Its database identity is port `5434` or database
`revealui_probe`. Fleet and admin seed commands always refuse either identity
before connecting or writing.

The probe has a Compose stack and measurement script, but it does not yet have
a maintained launcher that binds the admin app, migration, and measurement to
one verified disposable target. The old shell environment and `.env.probe.local`
runbook could silently leave the admin app or a seed command pointed at the
wrong database. A supported launcher must own target selection, verify the
stack identity, pass it directly to each child, and tear down the isolated
stack. Until that owner exists, this directory is source for the probe and its
Compose fixture, not an operating procedure.

The measurement script also needs an explicit identity contract for its admin
session. Its existing credential and founder fallback paths must be reviewed
with that launcher; they are not authorization for seed commands to accept the
probe target.

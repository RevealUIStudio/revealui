#!/usr/bin/env node
/*
  Backfill script to populate `_electric_meta` columns where NULL.
  Usage: ELECTRIC_DATABASE_URL=postgres://... node backfill_crdt_meta.js
*/

const { Client } = require('pg')

async function main() {
  const url = process.env.ELECTRIC_DATABASE_URL || process.env.DATABASE_URL
  if (!url) {
    console.error('Set ELECTRIC_DATABASE_URL or DATABASE_URL before running.')
    process.exit(1)
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    console.log('Backfilling documents._electric_meta where null...')
    await client.query(
      "UPDATE documents SET _electric_meta = '{}'::jsonb WHERE _electric_meta IS NULL",
    )

    console.log('Backfilling subscription_state._electric_meta where null...')
    await client.query(
      "UPDATE subscription_state SET _electric_meta = '{}'::jsonb WHERE _electric_meta IS NULL",
    )

    console.log('Backfill complete.')
  } catch (err) {
    console.error('Backfill failed:', err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

if (require.main === module) {
  main()
}

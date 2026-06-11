# Superseded — do NOT run

These files were the earlier **standalone CRM schema** (parallel `Agent`/`Unit`/
`Client`… tables). That approach was rejected in favour of **reusing the existing
`alwalaa-os` listing-app tables** (profiles, units, projects, files) and adding
only the missing CRM/HR/Finance tables. The live migrations are
`supabase/migrations/0001…0004`. Kept here only for history.

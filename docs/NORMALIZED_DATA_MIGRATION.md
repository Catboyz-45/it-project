# Relational data cutover

All business modules now read and write normalized PostgreSQL tables. The
owner dashboard is a read-only projection assembled from rooms, occupancies,
leases, invoices, meters, tickets, parcels, announcements, settings, and
catalog tables. It is not persisted as a JSON document.

Migration `20260728230000_remove_property_dataset` removes the obsolete JSON
table. Before applying it to an existing installation:

1. Back up PostgreSQL and verify the restore procedure.
2. Confirm the previous normalized-data migration completed successfully.
3. Compare expected property, room, occupancy, lease, and invoice totals.
4. Apply migrations in staging with `npm run db:deploy`.
5. Exercise owner and tenant critical workflows and inspect audit logs.
6. Schedule the production migration with an approved rollback window.

The removal migration is intentionally not run automatically by application
startup. An installation that still has business records only in the obsolete
JSON table must first deploy the previous release and complete its documented
normalization procedure.

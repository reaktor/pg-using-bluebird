# pg-resource-management

Utility library for handling PostgreSQL operations using Bluebird promises. Takes the URL to the DB as a 
parameter object (```{dbUrl: "myUrl"}``` and exports the following functions:

```getConnection()``` returns a DB connection

```getTransaction([tablesToLock])``` returns a DB transaction, 1st argument is an optional list of tables to lock

```queryAsync(query, [args])``` performs a query with the optional argument list inserted into the query. Returns the resulting rows.

```createMultipleInsertCTE(insert)``` creates a common table expression (CTE) for multiple inserts, returns an object 
with ```text``` for the query and ```values``` for the arguments.

```createUpsertCTE(table, idField, args)``` creates an upsert query, returns an object 
with ```text``` for the query and ```values``` for the arguments.

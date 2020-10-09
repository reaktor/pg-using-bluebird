# pg-using-bluebird

Utility library for promisifying
[node-postgres](https://github.com/brianc/node-postgres) using
[Bluebird](https://github.com/petkaantonov/bluebird/) promises with
Bluebird's resource management functionality.

Why use pg-using-bluebird instead of just using node-postgres directly? 
pg-using-bluebird provides a convenient interface with Bluebird promises and
resource cleanup with the using syntax, making DB querying in app code very concise
and easy to read.

This project is based on the postgres example in [Bluebird's documentation](https://github.com/petkaantonov/bluebird/blob/master/API.md#resource-management).

# Install

    npm install pg-using-bluebird

# Usage

```javascript
const Promise = require('bluebird'),
  pgUsingBluebird = require('pg-using-bluebird'),
  db = pgUsingBluebird({dbUrl: "postgres://localhost/pgrm-tests"}),
  using = Promise.using

using(db.getConnection(), connection =>
  connection.queryAsync("select 1").then(res => {
    console.log(res.rows)
  })
).finally(() => {
  db.end()
})
```

See [connection-test.js](test/connection-test.js) for more complete examples. Note
that Bluebird's using will handle cleanup of a connection and db.end() needs to be
called only when closing the entire pool.

# API Documentation

Requiring this module returns a function takes a single parameter
object with at least the URL to the DB (```{dbUrl: "myUrl"}```) and initializes a
connection pool with 20 connections. Parameters are passed directly to node-postgres,
refer to [node-postgres documentation](https://node-postgres.com/api/pool) for
configuration options.

The initializer returns an object with the following functions:

```getConnection()``` returns a DB connection

```getTransaction([tablesToLock])``` returns a DB transaction, 1st argument is an optional list of tables to lock

```queryRowsAsync(query, [args])``` performs a query with the optional argument list inserted into the query. Returns the resulting rows.

```createMultipleInsertCTE(insert)``` creates a common table expression (CTE) for multiple inserts, returns an object 
with ```text``` for the query and ```values``` for the arguments.

```createUpsertCTE(table, idField, args)``` creates an upsert query, returns an object 
with ```text``` for the query and ```values``` for the arguments.

```on(event, fn)``` attach and event handler fn to the pool event event, see node-postgres documentation for event types

```end()``` shut down the connection pool, returns a promise

Both connection and transaction objects have the methods ```queryAsync(query, [args])```
for executing a query and returning the result object and ```queryRowsAsync(query, [args])```
for executing a query and returning the resulting rows. The query can be a string
or a query object, refer to node-postgres' documentation for the various options
for query objects.

# Alternatives

* [pg-promise](https://www.npmjs.com/package/pg-promise), a more generic Promises/A+ promisification of node-postgres with more features and more code.
* [dbh-pg](https://www.npmjs.com/package/dbh-pg), a node-postgres and bluebird specific library with it's own api for querying.

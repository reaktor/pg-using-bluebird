# pg-using-bluebird

Utility library for promisifying
[node-postgres](https://github.com/brianc/node-postgres) using
[Bluebird](https://github.com/petkaantonov/bluebird/) promises with
Bluebird's resource management model.

This is based on the postgres example in Bluebird's documentation.

# Install

    npm install pg-using-bluebird

# Usage

```javascript
var Promise = require('bluebird'),
  pgUsingBluebird = require('pg-using-bluebird'),
  db = pgUsingBluebird({dbUrl: "postgres://localhost/pgrm-tests"}),
  using = Promise.using

using(db.getConnection(), function (connection) {
  return connection.queryAsync("select 1").then(function (res) {
    console.log(res.rows)
  })
}).finally(function() {
  db.end()
})
```

See [connection-test.js](test/connection-test.js) for more complete examples.

# Documentation

Requiring this module returns a function takes a single parameter
object with at least the URL to the DB (```{dbUrl: "myUrl"}```) and
returns an object with the following functions:

```getConnection()``` returns a DB connection

```getTransaction([tablesToLock])``` returns a DB transaction, 1st argument is an optional list of tables to lock

```queryAsync(query, [args])``` performs a query with the optional argument list inserted into the query. Returns the resulting rows.

```createMultipleInsertCTE(insert)``` creates a common table expression (CTE) for multiple inserts, returns an object 
with ```text``` for the query and ```values``` for the arguments.

```createUpsertCTE(table, idField, args)``` creates an upsert query, returns an object 
with ```text``` for the query and ```values``` for the arguments.

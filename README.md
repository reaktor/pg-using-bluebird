# pg-using-bluebird

Utility library for promisifying
[node-postgres](https://github.com/brianc/node-postgres) using
[Bluebird](https://github.com/petkaantonov/bluebird/) promises with
Bluebird's resource management functionality.

This project is based on the postgres example in [Bluebird's documentation](https://github.com/petkaantonov/bluebird/blob/master/API.md#resource-management).

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

# Alternatives

* [pg-promise](https://www.npmjs.com/package/pg-promise), a more generic Promises/A+ promisification of node-postgres with more features and more code. Does not leverage `using()` for resource management.
* [dbh-pg](https://www.npmjs.com/package/dbh-pg), a node-postgres and bluebird specific library with it's own api for querying. Does not leverage `using()` for resource management.

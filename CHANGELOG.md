
## 4.0.0

### Breaking changes

- Changed: updated required node.js version to >=8.0
- Changed: queryAsync now returns the whole result object instead of just the rows; queryRowsAsync remains unchanged
  and should be used when only the result rows are wanted
- Removed: createUpsertCTE, as the ON CONFLICT syntax has been present in PostgreSQL for several versions now and it's
  clearer than using a CTE, so there's little incentive to keep the old query builder around
- Removed: custom query object keys as no need for these had come up

### Improvements

- Changed: updated README

## 3.3.1

- Add withConnection and withTransaction convenience methods
- Expose the pool object through the API

## 3.2.1

- Update dependencies

## 3.2.0

- Support node-postgres 7.4.x, .end() now returns a promise


## [3.0.4] - 2020-10-11

### Task
    - Ignore dist folder.

## [3.0.3] - 2020-09-26

### Fix
    - Set version on conflict.

## [3.0.1] - 2020-05-31

### Fix
    - Export Connector as default

## [3.0.0] - 2020-05-24

### Breaking Changes

The database structure has changed to support V4 syntax fully.
This means instead of storing data like `{ _ds: {}, _value: {} }` in the database
we now instead have three columns. id, version and val. This will make life alot
easier when quering and storing data deepstream agnostic.

The APIs for schema listening have also changed to support promises.

Removed prefixing record names.

## [2.0.1] - 2020-04-24

### Misc
    - Updating dependencies

## [2.0.0] - 2019-07-23

### Update
    - Update to latest version to be in sync with deepstream server v4 and v5

## [1.1.5] - 2019-04-07

### Fix
    - Correctly extract version with postgres version 10 and 11

## [1.1.4] - 2017-10-12

### Added
	- ability to prefix table names configured by config file (Vojta Bartoš)
	- ability to set default table name from config (Vojta Bartoš)

## [1.1.3] - 2017-09-30

### Fixed
    - Build scripts to allow releases properly.

## [1.1.1] - 2017-08-09

### Fixed
    - Escape single quotes in values of query

## [1.1.0] - 2017-05-30

### Performance Improvements
    - Disabled notifications by default
    - Changed default column type for value to text
    - Introduced `useJsonb` option to enable storage as binary json

## [1.0.1] - 2017-02-12

### Miscellaneous
    - Reconnect on initialization error (Phillipp Ohlandt)
    - If an error occurs in query, immediately call callback (Lars-Magnus Skog)

## [1.0.0] 2016-11-15

## [2.0.0-] - 2020-04-22

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

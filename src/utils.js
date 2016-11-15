/**
 * Basic RegExp to check for SQL injection. TODO Improve
 *
 * @type {RegExp}
 */
const KEY_REGEXP = /[\"\;]/g

/**
 * Takes a key in the format <app-id><table>/<id>
 * and splits it into its parts. Also does some basic SQL injection checking
 *
 * @param   {String} key
 *
 * @public
 * @returns {Object} parsedKey { schema: <String>, table: <String>, key: <String> }
 */
exports.parseKey = function( key, options ) {

  var params = {}
  var splitCharIndex = key.indexOf( '/' )

  params.schema = options.schema

  if( splitCharIndex === -1 ) {
    params.table = 'default'
    params.key = key.replace( KEY_REGEXP, '' )
  } else {
    params.table = key.substring( 0, splitCharIndex ).replace( KEY_REGEXP, '' )
    params.key = key.substr( splitCharIndex + 1 ).replace( KEY_REGEXP, '' )
  }

  return params
}

/**
 * Parses a postgres version string, e.g.
 *
 * PostgreSQL 9.5.4 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 4.8.2 20140120 (Red Hat 4.8.2-16), 64-bit
 *
 * extracts the version number and throws an error if it is < 9.5 (first version to support ON CONFLICT
 * statements for UPSERTS)
 *
 * @param   {String} versionString postgres version string
 *
 * @public
 * @returns {void}
 */
exports.checkVersion = function( versionString ) {
  var v = versionString
    .match(/PostgreSQL (\d*)\.(\d*)\.(\d*)/)
    .splice( 1 )
    .map(v => parseInt( v, 10 ))

  if( v[ 0 ] < 9 || v[ 0 ] === 9 && v[ 1 ] < 5 ) {
    throw new Error( 'postgres version is ' + v.join('.') + 'but minimum version is 9.5')
  }
}
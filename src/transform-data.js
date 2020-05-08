'use strict'

/**
 * This method is for the storage connector, to allow queries to happen more naturally
 * do not use in cache connectors
 *
 * Inverts the data from the deepstream structure to reduce nesting.
 *
 * { _v: 1, _d: { name: 'elasticsearch' } } -> { name: 'elasticsearch', __ds = { _v: 1 } }
 * { _v: 1, _d: ['list'] } -> { __dsList: ['list'], __ds = { _v: 1 } }
 *
 * @param  {Number} version The data version
 * @param  {Object} value The data to save
 * @private
 * @returns {Object} data
 */
module.exports.transformValueForStorage = function (version, value) {
  let data
  if (value instanceof Array) {
    data = { __dsList: value, __ds: { _v: version } }
  } else {
    data = { ...value, __ds: { _v: version } }
  }

  return data
}

/**
 * This method is for the storage connector, to allow queries to happen more naturally
 * do not use in cache connectors
 *
 * Inverts the data from the stored structure back to the deepstream structure
 *
 * { name: 'elasticsearch', __ds = { _v: 1 } } -> { _v: 1, _d: { name: 'elasticsearch' } }
 * { __dsList: ['list'], __ds = { _v: 1 } } -> { _v: 1, _d: ['list'] }
 *
 * @param  {String|Object} value The data to transform
 *
 * @private
 * @returns {Object} data
 */
module.exports.transformValueFromStorage = function (value) {
  if (typeof value === 'string') {
    value = JSON.parse(value)
  }

  let data = value.__ds
  delete value.__ds

  if (value.__dsList instanceof Array) {
    data._d = value.__dsList
  } else {
    data._d = value
  }

  return data
}

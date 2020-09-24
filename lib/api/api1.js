/*
 * Copyright 2020 John Coker for ThrustCurve.org
 * Licensed under the ISC License, https://opensource.org/licenses/ISC
 */
'use strict';

const metadata = require('../metadata'),
      errors = require('../errors'),
      schema = require('../../database/schema'),
      data = require('../../render/data'),
      parseNumber = require('../number').parseNumber;

function hasOwnProperty(object, name) {
  if (object == null || typeof object !== 'object' || typeof name !== 'string')
    return false;
  return Object.hasOwnProperty.call(object, name);
}

function getElement(parent, name, parse, error) {
  var name2;

  if (parent && typeof parent == 'object') {
    if (hasOwnProperty(parent, name)) {
      let v = trimValue(parent[name]);
      if (v != null && parse != null) {
        let d = parse(v);
        if (d == null) {
          if (error)
            error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', name, v);
          return;
        }
        return d;
      } else
        return v;
    }

    if (/-[a-z]/.test(name)) {
      name2 = data.JSONFormat.camelCase(name);
      if (hasOwnProperty(parent, name2)) {
        let v = trimValue(parent[name2]);
        if (v != null && parse != null) {
          let d = parse(v);
          if (d == null) {
            if (error)
              error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', name2, v);
            return;
          }
          return d;
        } else
          return v;
      }
    }
  }
}

function getElementName(parent, name) {
  var name2;

  if (parent && typeof parent == 'object') {
    if (hasOwnProperty(parent, name))
      return name;

    if (/-[a-z]/.test(name)) {
      name2 = data.JSONFormat.camelCase(name);
      if (hasOwnProperty(parent, name2))
        return name2;
    }
  }

  return name;
}

function trimValue(v) {
  if (v == null)
    return;

  if (typeof v === 'string') {
    v = v.trim();
    if (v == '*' || v == 'all')
      return;
  }
  if (Array.isArray(v)) {
    if (v.length === 0)
      return;
    if (v.length === 1)
      return trimValue(v[0]);
  }

  return v;
}

function intValue(v) {
  if (v == null)
    return;
  if (typeof v === 'number')
    return isFinite(v) ? Math.round(v) : undefined;

  if (/^-?\d+$/.test(v)) {
    v = parseNumber(v);
    if (isFinite(v))
      return v;
  }
}

function numberValue(v) {
  if (v == null)
    return;
  if (typeof v === 'number')
    return isFinite(v) ? v : undefined;

  v = parseNumber(v);
  return isFinite(v) ? v : undefined;
}

function booleanValue(v) {
  if (v == null)
    return;
  if (typeof v === 'boolean')
    return v;
  if (typeof v === 'number') {
    if (v === 1)
      return true;
    if (v === 0)
      return false;
    return;
  }
  if (typeof v !== 'string' || v === '')
    return;

  v = v.toLowerCase();
  if (v === 'true' || v === 'yes' || v === 'on' || v === '1')
    return true;
  if (v === 'false' || v === 'no' || v === 'off' || v === '0')
    return false;
}

function dateValue(v) {
  if (v == null || typeof v !== 'string' || v === '')
    return;

  let parsed = /^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/.exec(v);
  if (parsed == null)
    return;
  let y = parseInt(parsed[1]), m = parseInt(parsed[2]), d = parseInt(parsed[3]);
  if (isNaN(y) || y < 1900 || y > 9999 ||
      isNaN(m) || m < 1 || m > 12 ||
      isNaN(d) || d < 1 || d > 31)
    return;
  if (m < 10)
    m = '0' + String(m);
  if (d < 10)
    d = '0' + String(d);
  return new Date(y, m - 1, d);
}

/*
 * The search syntax is supported for both the metadata and search endpoints.
 */
const MANUFACTURER = 'manufacturer';
const DESIGNATION = 'designation';
const COMMON_NAME = 'common-name';
const IMPULSE_CLASS = 'impulse-class';
const DIAMETER = 'diameter';
const TYPE = 'type';
const CERT_ORG = 'cert-org';
const SPARKY = 'sparky';
const INFO_UPDATED_SINCE = 'info-updated-since';
const HAS_DATA_FILES = 'has-data-files';
const DATA_UPDATED_SINCE = 'data-updated-since';
const AVAILABILITY = 'availability';

const SearchCriteria = [
  MANUFACTURER,
  DESIGNATION,
  COMMON_NAME,
  IMPULSE_CLASS,
  DIAMETER,
  TYPE,
  CERT_ORG,
  SPARKY,
  INFO_UPDATED_SINCE,
  HAS_DATA_FILES,
  DATA_UPDATED_SINCE,
  AVAILABILITY,
];

function searchQuery(request, cache, error) {
  var query = {}, ors = [],
      v;

  // manufacturer
  v = getElement(request, MANUFACTURER);
  if (v != null) {
    let m = cache.manufacturers.byName(v);
    if (m == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', MANUFACTURER, v);
      query._manufacturer = null;
    } else
      query._manufacturer = m._id;
  }

  // designation
  v = getElement(request, DESIGNATION);
  if (v != null) {
    let d = metadata.toDesignation(v);
    if (d == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', DESIGNATION, v);
      query.designation = null;
    } else {
      ors.push([
        { designation: d },
        { altDesignation: d },
      ]);
    }
  }

  // common name
  v = getElement(request, COMMON_NAME);
  if (v != null) {
    let cn = metadata.toCommonName(v);
    if (cn == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".',
            getElementName(request, COMMON_NAME), v);
      query.commonName = null;
    } else {
      ors.push([
        { commonName: cn },
        { altName: cn },
      ]);
    }
  }

  // impulse class
  v = getElement(request, 'impulse-class');
  if (v != null) {
    let ic = metadata.toImpulseClass(v);
    if (ic == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".',
            getElementName(request, 'impulse-class'), v);
      query.impulseClass = null;
    } else
      query.impulseClass = v;
  }

  // diameter, mm
  v = getElement(request, DIAMETER);
  if (v != null) {
    let d = parseNumber(v);
    if (d > 0) {
      d /= 1000;
      query.diameter = {
        $gt: d - metadata.MotorDiameterTolerance,
        $lt: d + metadata.MotorDiameterTolerance
      };
    } else {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}"; expected millimeters.', DIAMETER, v);
      query.diameter = 0;
    }
  }

  // motor type
  v = getElement(request, TYPE);
  if (v != null) {
    if (cache.allMotors.types.indexOf(v) < 0) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', TYPE, v);
      query.type = null;
    } else
      query.type = v;
  }

  // cert. org.
  v = getElement(request, CERT_ORG);
  if (v != null) {
    let o = cache.certOrgs.byName(v);
    if (o == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".',
            getElementName(request, CERT_ORG), v);
      query._certOrg = null;
    } else
      query._certOrg = o._id;
  }

  // sparky
  v = getElement(request, SPARKY);
  if (v != null) {
    let b = booleanValue(v);
    if (b == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}"; expected true/false.', SPARKY, v);
      query.sparky = null;
    } else
      query.sparky = b;
  }

  // info-updated-since
  v = getElement(request, INFO_UPDATED_SINCE);
  if (v != null) {
    let d = dateValue(v);
    if (d == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}"; expected ISO date.',
            getElementName(request, INFO_UPDATED_SINCE), v);
      query.updatedAt = null;
    } else
      query.updatedAt = { $gte: d };
  }

  // has-data-files
  v = getElement(request, HAS_DATA_FILES);
  if (v != null) {
    let b = booleanValue(v);
    if (b == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}"; expected true/false.',
            getElementName(request, HAS_DATA_FILES), v);
    } else {
      query.simfiles = { $exists: b };
    }
  }

  // data-updated-since
  v = getElement(request, DATA_UPDATED_SINCE);
  if (v != null) {
    let d = dateValue(v);
    if (d == null) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}"; expected ISO date.',
            getElementName(request, DATA_UPDATED_SINCE), v);
    } else {
      query.simfiles = { updatedAt: { $gte: d } };
    }
  }

  // availability
  v = getElement(request, AVAILABILITY);
  if (v != null) {
    if (v == 'available')
      query.availability = { $in: schema.MotorAvailableEnum };
    else if (schema.MotorAvailabilityEnum.indexOf(v)) {
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', AVAILABILITY, v);
      query.availability = null;
    } else
      query.availability = v;
  }

  if (ors.length == 1) {
    query.$or = ors[0];
  } else if (ors.length > 1) {
    query.$and = [];
    ors.forEach(o => query.$and.push({ $or: o }));
  }

  return query;
}

function searchCriteria(request) {
  let found = {};
  SearchCriteria.forEach(crit => {
    let v = getElement(request, crit);
    if (v != null) {
      let en = getElementName(request, crit);
      found[en] = v;
    }
  });
  return found;
}

/*
 * The download syntax is supported for both the metadata and download endpoints.
 */
const MOTOR_ID = 'motor-id';
const MOTOR_IDS = 'motor-ids';
const FORMAT = 'format';
const LICENSE = 'license';

function downloadQuery(request, cache, error) {
  var query = {};

  // single motor id or array of ids
  let motorIds = [];
  let motorErrors = false;
  function extractIds(value, prop) {
    if (Array.isArray(value)) {
      value.forEach(id => {
        if (id == null || id === '') {
          if (!motorErrors) {
            error(errors.INVALID_QUERY, 'Invalid {1} value; expected an array of IDs.',
                  getElementName(request, prop));
          }
          return;
        }
        id = String(id);
        if (motorIds.indexOf(id) < 0)
          motorIds.push(id);
      });
    } else {
      let id = String(value);
      if (motorIds.indexOf(id) < 0)
        motorIds.push(id);
    }
  }
  let id = getElement(request, MOTOR_ID);
  if (id != null) {
    if (Array.isArray(id)) {
      extractIds(id, MOTOR_ID);
    } else if (id === '') {
      error(errors.INVALID_QUERY, 'Invalid {1} value; expected an ID.',
            getElementName(request, MOTOR_ID));
      motorErrors = true;
    } else
      motorIds.push(String(id));
  }
  let ids = getElement(request, MOTOR_IDS);
  if (ids != null) {
    if (Array.isArray(ids)) {
      extractIds(ids, MOTOR_IDS);
    } else if (typeof ids === 'object' && Array.isArray(ids.id)) {
      extractIds(ids.id, MOTOR_IDS);
    } else if (typeof ids === 'string') {
      extractIds(ids, MOTOR_IDS);
    } else {
      error(errors.INVALID_QUERY, 'Invalid {1} value; expected an array.',
            getElementName(request, MOTOR_IDS));
      motorErrors = true;
    }
  }
  if (!motorErrors && motorIds.length < 1) {
    error(errors.INVALID_QUERY, 'No motor IDs specified to download files for.');
    motorErrors = true;
  }
  if (id != null && ids != null) {
    error(errors.INVALID_QUERY, 'Both {1} and {2} specified.',
          getElementName(request, MOTOR_ID), getElementName(request, MOTOR_IDS));
    motorErrors = true;
  }
  if (motorErrors)
    query._motor = "0";
  else
    query._motor = { $in: motorIds };

  // format
  let format = getElement(request, FORMAT);
  if (format != null) {
    format = String(format);
    if (schema.SimFileFormatEnum.indexOf(format) < 0)
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', FORMAT, format);
    query.format = format;
  }

  // license
  let license = getElement(request, LICENSE);
  if (license != null) {
    license = String(license);
    if (schema.SimFileLicenseEnum.indexOf(license) < 0)
      error(errors.INVALID_QUERY, 'Invalid {1} value "{2}".', LICENSE, license);
    query.license = license;
  }

  return query;
}

/**
 * <p>The api1 module contains utility methods used to implement the <code>/api/v1</code> endpoints.
 *
 * @module api1
 */
module.exports = {
  /**
   * Checks whether the property is defined on the object directly. This is safe to call or null or
   * objects without the normal prototype chain.
   * @param {object} object to inspect
   * @param {string} name property name
   * @return {boolean}
   */
  hasOwnProperty,

  /**
   * <p>Gets a child element from the parent object, using either XML or JSON style names.
   * @function
   * @param {object} parent object
   * @param {string} name in XML style
   * @return {object} value if any
   */
  getElement,

  /**
   * <p>Gets the child element name in the parent object, using either XML or JSON style names.
   * @function
   * @param {object} parent object
   * @return {string} name as present/expected
   */
  getElementName,

  /**
   * <p>Cleans up a value from an input object. This trims strings and turns wildcards into undefined.
   * @function
   * @param {object} v value
   * @param {object} cleaned-up value
   */
  trimValue,

  /**
   * <p>Parse an integer value from an input object.
   * @function
   * @param {string} v value
   * @return {number} parsed or undefined
   */
  intValue,

  /**
   * <p>Parse a numeric value from an input object.
   * @function
   * @param {string} v value
   * @return {number} parsed or undefined
   */
  numberValue,

  /**
   * <p>Parse a boolean value from an input object.
   * @function
   * @param {string} v value
   * @return {boolean} parsed or undefined
   */
  booleanValue,

  /**
   * <p>Parse a boolean value from an input object.
   * @function
   * @param {string} v value
   * @return {string} MongoDB ISODate expression
   */
  dateValue,

  /**
   * <p>Produce a query against the Motor model that matches the values specified in the request object.
   * @function
   * @param {object} request the request input object
   * @param {object} metadata cache
   * @param {object} error error collector
   * @return {object} MongoDB query object
   */
  searchQuery,

  /**
   * <p>Extract the names and values of the search criteria specified,
   * @function
   * @param {object} request the request input object
   * @return {object} criteria specified
   */
  searchCriteria,

  /**
   * <p>Produce a query against the SimFile model that matches the values specified in the request object.
   * @function
   * @param {object} request the request input object
   * @param {object} metadata cache
   * @param {object} error error collector
   * @return {object} MongoDB query object
   */
  downloadQuery,
};
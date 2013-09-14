/**
 * @name jsondir
 * @description Convert JSON objects to directories and back again.
 *
 * @author Daniel Imhoff
 */

'use strict';

var ASYNC = require('async');
var FS = require('fs');

var File = require('./File').File;

var knownAttributes = Object.freeze([
  '-name',
  '-type',
  '-path',
  '-mode',
  '-owner',
  '-group',
  '-dest',
  '-content'
]);

var inheritableAttributes = Object.freeze([
  '-mode',
  '-owner',
  '-group'
]);

/**
 * Split up given object into children and valid attributes that are ready for
 * the File constructor.
 *
 * @param  {object} options
 * @param  {object} parentAttributes Normalized attributes of the parent.
 * @return {object}
 */
var normalizeOptions = function(options, parentAttributes) {
  var opts = {
    attributes: {},
    inheritedAttributes: [],
    children: {}
  };

  if (typeof options === 'object') {
    for (var i in options) {
      // If the starting character is a hyphen, the option is an attribute,
      // because having files prepended with a hyphen in Unix is a terrible
      // idea: http://www.dwheeler.com/essays/fixing-unix-linux-filenames.html#dashes
      if (i.indexOf('-') === 0) {
        if (knownAttributes.indexOf(i) === -1) {
          throw new Error("Unknown attribute '" + i + "' in object.");
        }

        // Attributes can have objects as values, for attributes of the attributes,
        // such as inherit. In that case, the value attribute is taken as the value.
        if (typeof options[i] === 'object') {
          if (!('value' in options[i])) {
            throw new Error("Attribute object '" + i + "' needs 'value'.");
          }

          if ('inherit' in options[i] && options[i].inherit) {
            if (inheritableAttributes.indexOf(i) === -1) {
              throw new Error("Unknown inheritable attribute '" + i + "' in object.");
            }

            opts.inheritedAttributes.push(i);
          }

          opts.attributes[i.substring(1)] = options[i].value;
        }
        else {
          opts.attributes[i.substring(1)] = options[i];
        }
      }
      else {
        opts.children[i] = options[i];
      }
    }

    if ('owner' in opts.attributes && opts.attributes.owner !== process.env.USER && opts.attributes.owner !== 'root') {
      throw new Error("Must be run as root if owner differs from you.");
    }

    if (!('path' in opts.attributes)) {
      if (typeof parentAttributes === 'object') {
        opts.attributes.path = parentAttributes.path + File.DIRECTORY_SEPARATOR + opts.attributes.name;
      }
      else {
        opts.attributes.path = '.';
      }
    }

    if (!('type' in opts.attributes)) {
      if ('dest' in opts.attributes) {
        opts.attributes.type = 'l';
      }
      else if (Object.keys(opts.children).length > 0) {
        opts.attributes.type = 'd';
      }
      else {
        opts.attributes.type = '-';
      }
    }
  }

  return opts;
};

/**
 * Converts a formatted, structured object to a directory structure.
 *
 * @param  {object} json
 * @param  {object} options
 * @param  {Function} callback
 */
var json2dir = function(json, options, callback) {
  options = options || {};

  // Keeps track of the number of child keys in the object. When count
  // returns to 0, we know the object has been exhausted.
  var count = 0;

  /**
   * The handler for determining when everything is finished.
   *
   * @param  {Error} err
   */
  var done = function(err) {
    if (err) return callback(err);

    if (count === 0) {
      return callback();
    }
  };

  /**
   * Recursive function which recurses through the object and asynchronously
   * creates the directory structure based upon normalized options.
   *
   * @param  {object} json
   * @param  {object} parentAttributes
   */
  var _json2dir = function(json, parentAttributes) {
    if (typeof json === 'object') {
      // Validate and normalize the options into children and attributes.
      var options = normalizeOptions(json, parentAttributes),
          childKeys = Object.keys(options.children);

      // First count the number of children.
      count += childKeys.length;

      // Create the File object given the set of attributes parsed which
      // represents the file in question.
      var f = new File(options.attributes);

      f.create(function(err) {
        if (err) return done(err);

        // When IO is finished for this file, we mark it as done.
        --count;

        // For each of the children parsed, call this function in parallel.
        ASYNC.each(childKeys, function(name, callback) {
          // normalizeOptions() needs the key of the child object, which is the name.
          options.children[name]['-name'] = name;

          // If there are any inherited attributes of the parent, we need to add
          // them to the child object.
          if (options.inheritedAttributes.length > 0) {
            for (var i in options.inheritedAttributes) {
              options.children[name][options.inheritedAttributes[i]] = { value: options.attributes[options.inheritedAttributes[i].substring(1)], inherit: true };
            }
          }

          // Recurse, given the unnormalized options of the child and normalized
          // attributes of the parent.
          _json2dir(options.children[name], options.attributes);

          // Async has us call callback() to know when this function is done.
          callback();
        }, function(err) {
          if (err) return done(err);
          done();
        });
      });
    }
  };

  _json2dir(json);
};

/**
 * Converts a given directory structure to a formatted, structured object.
 *
 * @param  {string} path
 * @param  {object} options
 * @param  {Function} callback
 */
var dir2json = function(path, options, callback) {
  options = options || {};

  var json = {
    "-path": path
  };

  var _dir2json = function(jsonPart, done) {
    FS.readdir(jsonPart['-path'], function(err, results) {
      if (err) return done(err);

      var pending = results.length;

      if (pending === 0) return done(null, json);

      results.forEach(function(file) {
        jsonPart[file] = {
          "-path": jsonPart['-path'] + File.DIRECTORY_SEPARATOR + file
        };

        var options = normalizeOptions(jsonPart[file]);
        var f = new File(options.attributes);

        if (f.type === File.Types.directory) {
          _dir2json(jsonPart[file], function(err) {
            if (--pending === 0) return done(null, json);
          });
        }
        else {
          if (--pending === 0) return done(null, json);
        }
      });
    });
  };

  _dir2json(json, function(err, results) {
    if (err) return callback(err);
    callback(null, results);
  });
};

dir2json("output", {}, function(err, results) {
  if (err) throw err;
  console.log(results);
});

module.exports = {
  json2dir: json2dir,
  dir2json: dir2json
};

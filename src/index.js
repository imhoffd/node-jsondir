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
  '-umask',
  '-owner',
  '-group',
  '-dest',
  '-content',
  '-inherit'
]);

var inheritableAttributes = Object.freeze([
  'inherit',
  'mode',
  'umask',
  'owner',
  'group'
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

        opts.attributes[i.substring(1)] = options[i];
      }
      else {
        opts.children[i] = options[i];
      }
    }

    if ('owner' in opts.attributes && opts.attributes.owner !== process.env.USER && opts.attributes.owner !== 'root') {
      throw new Error("Must be run as root if owner differs from you.");
    }

    if ('inherit' in opts.attributes) {
      opts.attributes.inherit.forEach(function(inheritedAttribute) {
        if (inheritableAttributes.indexOf(inheritedAttribute) === -1) {
          throw new Error("Unknown inheritable attribute '" + inheritedAttribute + "' in object.");
        }
      });
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
 * Construct a readable object from a File.
 *
 * @param  {File} file
 * @param  {object} options
 * @return {object}
 */
var createFileNode = function(file, options) {
  options = options || {};

  var node = {
    "-path": file.getPath()
  };

  switch (file.getType()) {
  case File.Types.file:
    node['-type'] = '-';

    if (!('content' in options) || options.content) {
      node['-content'] = file.getContent();
    }

    break;
  case File.Types.directory:
    node['-type'] = 'd';

    break;
  case File.Types.symlink:
    node['-type'] = 'l';
    node['-dest'] = file.getDest();

    break;
  }

  return node;
};

/**
 * Converts a formatted, structured object to a directory structure.
 *
 * @param  {object} json
 * @param  {object} options
 * @param  {Function} callback
 */
var json2dir = function(json, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Keeps track of the number of child keys in the object. When count
  // returns to 0, we know the object has been exhausted.
  var count = 1;

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
      var normalizedOptions = normalizeOptions(json, parentAttributes),
          childKeys = Object.keys(normalizedOptions.children);

      // First count the number of children.
      count += childKeys.length;

      try {
        // Create the File object given the set of attributes parsed which
        // represents the file in question.
        var f = new File(normalizedOptions.attributes);
        f.create(function(err) {
          if (err && (!(err instanceof File.FileExistsException) || !('ignoreExists' in options) || !options.ignoreExists)) throw err;

          // When IO is finished for this file, we mark it as done.
          --count;

          // For each of the children parsed, call this function in parallel.
          ASYNC.each(childKeys, function(name, callback) {
            // normalizeOptions() needs the key of the child object, which is the name.
            normalizedOptions.children[name]['-name'] = name;

            // If there are any inherited attributes of the parent, we need to add
            // them to the child object.
            if ('inherit' in normalizedOptions.attributes && normalizedOptions.attributes.inherit.length > 0) {
              if (normalizedOptions.attributes.inherit.indexOf('inherit') === -1) {
                normalizedOptions.attributes.inherit.push('inherit');
              }

              normalizedOptions.attributes.inherit.forEach(function(inheritedAttribute) {
                normalizedOptions.children[name]['-' + inheritedAttribute] = normalizedOptions.attributes[inheritedAttribute];
              });
            }

            // Recurse, given the unnormalized options of the child and normalized
            // attributes of the parent.
            _json2dir(normalizedOptions.children[name], normalizedOptions.attributes);

            // Async has us call callback() to know when this function is done.
            callback();
          }, function(err) {
            if (err) throw err;
            done();
          });
        });
      }
      catch (err) {
        return done(err);
      }
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
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var json;

  try {
    // Construction of new origin object.
    json = createFileNode(new File({ "path": path }));
  }
  catch (err) {
    return callback(err);
  }

  /**
   * Recursive function which recurses through the directory structure and
   * creates the object.
   *
   * @param  {object} jsonPart
   * @param  {Function} done
   */
  var _dir2json = function(jsonPart, done) {
    FS.readdir(jsonPart['-path'], function(err, results) {
      if (err) return done(err);

      // Keeps a total of files pending appendation to the object.
      var pending = results.length;

      // If there are no files in this directory, we're done on this path.
      if (pending === 0) return done(null, json);

      // For each of the files/directories in this directory, call this function.
      results.forEach(function(file) {
        try {
          var f = new File({ "path": jsonPart['-path'] + File.DIRECTORY_SEPARATOR + file });

          // Insert the file as a readable file node into the object.
          jsonPart[file] = createFileNode(f, options);

          // If the file is a directory, we have more work to do.
          if (f.getType() === File.Types.directory) {
            // Recurse, creating a new callback for the next level of files.
            _dir2json(jsonPart[file], function(err) {
              if (err) throw err;
              if (--pending === 0) return done(null, json);
            });
          }
          else {
            if (--pending === 0) return done(null, json);
          }
        }
        catch (err) {
          return done(err);
        }
      });
    });
  };

  _dir2json(json, callback);
};

json2dir({
  "-path": "output",
  "-inherit": ['mode'],
  "-mode": 511,
  "a": {
    "a1": {
      "a11": {}
    }
  },
  "b": {}
}, function(err) {
  if (err) throw err;
  console.log(":D");
});

// dir2json("output", { content: false }, function(err, results) {
//   if (err) throw err;
//   console.log(results);
// });

module.exports = {
  json2dir: json2dir,
  dir2json: dir2json,
  File: File
};

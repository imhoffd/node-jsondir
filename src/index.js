/**
 * @name jsondir
 * @description Convert JSON objects to directories and back again.
 *
 * @author Daniel Imhoff
 */

'use strict';

var PATH = require('path');
var FS = require('graceful-fs');
var xtend = require('xtend');
var rimraf = require('rimraf');

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
  '-inherit',
  '-dynamic'
]);

var inheritableAttributes = Object.freeze([
  'inherit',
  'dynamic',
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
    attributes: {
      dynamic: {}
    },
    children: {}
  };

  if (typeof options === 'object') {
    for (var i in options) {
      // If the starting character is a hyphen, the option is an attribute,
      // because having files prepended with a hyphen in Unix is a terrible
      // idea: http://www.dwheeler.com/essays/fixing-unix-linux-filenames.html#dashes
      if (i.indexOf('-') === 0) {
        var a = i.substring(1);

        if (knownAttributes.indexOf(i) === -1) {
          throw new Error("Unknown attribute '" + a + "' in object.");
        }

        if (typeof options[i] === 'function') {
          opts.attributes.dynamic[a] = options[i];
        }

        opts.attributes[a] = options[i];
      }
      else {
        opts.children[i] = options[i];
      }
    }

    if ('owner' in opts.attributes && opts.attributes.owner !== process.env.USER && process.env.USER !== 'root') {
      throw new Error("Must be run as root if owner differs from you.");
    }

    if ('inherit' in opts.attributes) {
      if (typeof opts.attributes.inherit === 'string') {
        opts.attributes.inherit = [opts.attributes.inherit, 'inherit'];
      }

      opts.attributes.inherit.forEach(function(inheritedAttribute) {
        if (inheritableAttributes.indexOf(inheritedAttribute) === -1) {
          throw new Error("Unknown inheritable attribute '" + inheritedAttribute + "' in object.");
        }

        if (typeof opts.attributes[inheritedAttribute] === 'function' && opts.attributes.inherit.indexOf('dynamic') === -1) {
          opts.attributes.inherit.push('dynamic');
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

    if (options.content) {
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
  if (typeof callback !== 'function') {
    callback = typeof options === 'function' ? options : function() {};
    options = {};
  }

  options = xtend({
    ignoreExists: false,
    overwrite: false,
    nuke: false
  }, options);

  if (options.overwrite || options.nuke) {
    options.ignoreExists = true;
  }

  // Keeps track of the number of child keys in the object. When pending
  // is 0, we know the object has been exhausted.
  var pending = 1;

  /**
   * Recursive function which recurses through the object and asynchronously
   * creates the directory structure based upon normalized options.
   *
   * @param  {object} json
   * @param  {object} parentAttributes
   */
  var _json2dir = function(json, parentAttributes) {
    if (pending === 0) return callback();

    if (typeof json === 'object') {
      // Validate and normalize the options into children and attributes.
      var normalizedOptions = normalizeOptions(json, parentAttributes),
          childKeys = Object.keys(normalizedOptions.children);

      var afterCreate = function(err) {
        if (err && (!(err instanceof File.FileExistsException) || !options.ignoreExists)) throw err;

        // When IO is finished for this file, we mark it as done and check to
        // see if there are no pending files.
        if (--pending === 0) return callback();

        // For each of the children parsed, call this function.
        childKeys.forEach(function(name) {
          // normalizeOptions() needs the key of the child object, which is the name.
          if (!('-name' in normalizedOptions.children[name])) {
            normalizedOptions.children[name]['-name'] = name;
          }

          // If there are any inherited attributes of the parent, we need to add
          // them to the child object.
          if ('inherit' in normalizedOptions.attributes && normalizedOptions.attributes.inherit.length > 0) {
            if (normalizedOptions.attributes.inherit.indexOf('inherit') === -1) {
              normalizedOptions.attributes.inherit.push('inherit');
            }

            var removeLater = [];

            normalizedOptions.attributes.inherit.forEach(function(inheritedAttribute) {
              // Allow child to override inherited attribute.
              if ('-' + inheritedAttribute in normalizedOptions.children[name]) {
                // Remember to take these attributes out.
                if (inheritedAttribute in normalizedOptions.attributes.dynamic) {
                  removeLater.push(inheritedAttribute);
                }
              }
              else {
                // I should really use Underscore.
                if (Array.isArray(normalizedOptions.attributes[inheritedAttribute])) {
                  normalizedOptions.children[name]['-' + inheritedAttribute] = normalizedOptions.attributes[inheritedAttribute].slice();
                }
                else if (typeof normalizedOptions.attributes[inheritedAttribute] === 'object') {
                  normalizedOptions.children[name]['-' + inheritedAttribute] = xtend(normalizedOptions.attributes[inheritedAttribute]);
                }
                else {
                  normalizedOptions.children[name]['-' + inheritedAttribute] = normalizedOptions.attributes[inheritedAttribute];
                }
              }
            });

            removeLater.forEach(function(attribute) {
              delete normalizedOptions.children[name]['-dynamic'][attribute];
              normalizedOptions.children[name]['-inherit'].splice(normalizedOptions.children[name]['-inherit'].indexOf(attribute), 1);
            });
          }

          // Recurse, given the unnormalized options of the child and normalized
          // attributes of the parent.
          _json2dir(normalizedOptions.children[name], normalizedOptions.attributes);
        });
      };

      // First count the number of children.
      pending += childKeys.length;

      try {
        for (var i in normalizedOptions.attributes) {
          if (i in normalizedOptions.attributes.dynamic) {
            normalizedOptions.attributes[i] = normalizedOptions.attributes.dynamic[i](normalizedOptions.attributes);
          }
        }

        // Create the File object given the set of attributes parsed which
        // represents the file in question.
        var f = new File(normalizedOptions.attributes);

        if (f.doesExist()) {
          if (options.overwrite && f.getType() !== File.Types.directory) {
            f.remove(function(err) {
              if (err) return callback(err);
              // Need to refresh object after its removal.
              f = new File(normalizedOptions.attributes);
              f.create(afterCreate);
            });
          }
          else {
            afterCreate();
          }
        }
        else {
          f.create(afterCreate);
        }
      }
      catch (err) {
        return callback(err);
      }
    }
  };

  // Scary stuff.
  if (options.nuke) {
    if (!('-path' in json)) {
      return callback(new Error("'-path' attribute required for 'nuke' option."));
    }

    if (PATH.resolve(json['-path']) === process.env.PWD) {
      return callback(new Error("'-path' must differ from current working directory."));
    }
    else {
      rimraf(PATH.resolve(json['-path']), function(err) {
        if (err) return callback(err);
        _json2dir(json);
      });
    }
  }
  else {
    _json2dir(json);
  }
};

/**
 * Converts a given directory structure to a formatted, structured object.
 *
 * @param  {string} path
 * @param  {object} options
 * @param  {Function} callback
 */
var dir2json = function(path, options, callback) {
  if (typeof callback !== 'function') {
    callback = typeof options === 'function' ? options : function() {};
    options = {};
  }

  options = xtend({
    content: true
  }, options);

  var file, json;

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
          var f = new File({ "path": jsonPart['-path'] + File.DIRECTORY_SEPARATOR + file, "exists": true });

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

  try {
    // Construction of new origin object.
    file = new File({ "path": path, "exists": true });
    json = createFileNode(file, options);
  }
  catch (err) {
    return callback(err);
  }

  if (file.getType() === File.Types.directory) {
    _dir2json(json, callback);
  }
  else {
    return callback(null, json);
  }
};

module.exports = {
  json2dir: json2dir,
  dir2json: dir2json,
  File: File
};

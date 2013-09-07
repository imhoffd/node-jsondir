/**
 * @name jsondir
 * @description Convert JSON objects to directories and back again.
 *
 * @author Daniel Imhoff
 */

'use strict';

var ASYNC = require('async');

var File = require('./File').File;

var knownAttributes = Object.freeze([
  '-name',
  '-type',
  '-path',
  '-mode',
  '-dest',
  '-content'
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
      if (i.indexOf('-') === 0) {
        if (knownAttributes.indexOf(i) === -1) {
          throw new Error('Unknown attribute \'' + i + '\' in object.');
        }

        opts.attributes[i.substring(1)] = options[i];
      }
      else {
        opts.children[i] = options[i];
      }
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

var json2dir = function(json, parentAttributes) {
  if (typeof json === 'object') {
    var options = normalizeOptions(json, parentAttributes);
    var f = new File(options.attributes);
    f.create(function(err) {
      if (err) throw err;
      ASYNC.each(Object.keys(options.children), function(name, callback) {
        options.children[name]['-name'] = name;
        json2dir(options.children[name], options.attributes);
        callback(null);
      }, function(err) {
        if (err) throw err;
      });
    });
  }
};

json2dir({
  "example.txt": {
    "-content": "just an example =)",
    "-mode": "rwx---r-x"
  },
  "mydir": {
    "another.txt": {},
    "to_example": {
      "-dest": "../example.txt"
    }
  },
  "-path": "somedir"
});

module.exports = {
  json2dir: json2dir
};

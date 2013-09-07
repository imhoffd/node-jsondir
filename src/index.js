/**
 * @name jsondir
 * @description Convert JSON objects to directories and back again.
 *
 * @author Daniel Imhoff
 */

'use strict';

var File = require('./File').File;

var knownAttributes = Object.freeze([
  '-name',
  '-type',
  '-path',
  '-mode',
  '-dest',
  '-content'
]);

var normalizeOptions = function(options, parentOptions) {
  var opts = {
    attributes: {},
    children: {}
  };

  if (typeof options === 'object') {
    if (typeof parentOptions === 'object') {
      opts.attributes.location = parentOptions.location + '.' + opts.attributes.name;
    }
    else {
      opts.attributes.location = 'json';
    }

    for (var i in options) {
      if (i.indexOf('-') === 0) {
        if (knownAttributes.indexOf(i) === -1) {
          throw new Error('Unknown attribute ' + i + ' in ' + opts.attributes.location);
        }

        opts.attributes[i.substring(1)] = options[i];
      }
      else {
        opts.children[i] = options[i];
      }
    }

    if (!('path' in opts.attributes)) {
      if (typeof parentOptions === 'object') {
        opts.attributes.path = parentOptions.path + File.DIRECTORY_SEPARATOR + opts.attributes.name;
      }
      // If there is no parent, it must be the root level.
      else {
        opts.attributes.path = '.';
      }
    }

    if (!('type' in opts.attributes)) {
      if ('-dest' in options) {
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

var json2dir = function(json, parentOptions) {
  if (typeof json === 'object') {
    var options = normalizeOptions(json, parentOptions);
    var f = new File(options.attributes);
    f.create();

    for (var i in options.children) {
      options.children[i]['-name'] = i;
      json2dir(options.children[i], options.attributes);
    }
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

// module.exports = {

// };

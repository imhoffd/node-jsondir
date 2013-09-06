/**
 * @name jsondir
 * @description Convert JSON objects to directories and back again.
 *
 * @author Daniel Imhoff
 */

"use strict";

var FS = require('fs');
var PATH = require('path');
var UTIL = require('util');
var ASYNC = require('async');

var DIRECTORY_SEPARATOR = PATH.normalize('/');
var UMASK = 18; // 0022 in Octal

/**
 * A File represents any regular, directory, or symlink file.
 *
 * @param {object} options
 */
var File = function(options) {
  options = options || {};
  this.path = PATH.normalize(options.path);
  this.exists = FS.existsSync(this.path);

  if (this.exists) {
    this.stats = this.getStats();
    this.type = this.getType();
    this.mode = this.stats.mode & 511; // 511 == 0777
  }
  else {
    if (options.type in File.Types) {
      this.type = File.Types[options.type];
    }
    else {
      throw new Error('Unknown file type: ' + options.type + '.');
    }

    if (this.type === File.Types.file) {
      this.content = 'content' in options ? options.content : '';
    }

    this.mode = File.interpretMode(options.mode, this.type);
  }

  if (this.type === File.Types.symlink) {
    if ('dest' in options) {
      this.dest = options['dest'];
    }
    else {
      throw new Error('"dest" is a required option for symlink files.');
    }
  }
};

File.Types = Object.freeze({
  'file': 0,
  'f': 0,
  '-': 0,
  'directory': 1,
  'dir': 1,
  'd': 1,
  'symbolic link': 2,
  'symlink': 2,
  'l': 2
});

File.interpretMode = function(mode, type) {
  switch (typeof mode) {
    case 'undefined':
      if (typeof type !== 'undefined') {
        if (type === File.Types.symlink) {
          return 511; // 511 == 0777
        }

        return (type === File.Types.directory ? 511 : 438) - UMASK; // 511 == 0777, 438 == 0666
      }

      break;
    case 'string':
      switch (mode.length) {
        case 10:
          mode = mode.substring(1);
        case 9:
          var modeParts = [
            mode.substring(0, 3),
            mode.substring(3, 6),
            mode.substring(6, 9)
          ];

          var decMode = 0;

          for (var power = 0; power <= 2; ++power) {
            var modePartsChars = modeParts[2 - power].split(''),
                decModeAddition = 0;

            if (modePartsChars[0] === 'r') {
              decModeAddition += 4;
            }

            if (modePartsChars[1] === 'w') {
              decModeAddition += 2;
            }

            if (modePartsChars[2] === 'x') {
              decModeAddition += 1;
            }

            decMode += decModeAddition * Math.pow(8, power);
          }

          return decMode;
        case 3:
          var octal = parseInt(mode, 8);

          if (!isNaN(octal) && octal >= 0 && octal <= 511) {
            return octal;
          }

          break;
      }

      break;
    case 'number':
      if (mode >= 0 && mode <= 511) { // 511 == 0777
        return mode; // Seems good to me.
      }

      break;
  }

  return false;
};

File.prototype.getStats = function() {
  if (typeof this.stats === 'undefined') {
    if (!this.exists) {
      throw new Error('Cannot get stats of nonexistent file.');
    }

    this.stats = FS.lstatSync(this.path);
  }

  return this.stats;
};

File.prototype.getType = function() {
  if (typeof this.type === 'undefined') {
    if (typeof this.stats === 'undefined') {
      this.stats = this.getStats();
    }

    if (this.stats.isFile()) {
      this.type = File.Types.file;
    }
    else if (this.stats.isDirectory()) {
      this.type = File.Types.directory;
    }
    else if (this.stats.isSymbolicLink()) {
      this.type = File.Types.symlink;
    }
  }

  return this.type;
};

File.prototype.create = function() {
  if (this.exists) {
    return new Error('File already exists.');
  }

  switch (this.type) {
    case File.Types.file:
      FS.writeFileSync(this.path, this.content);
      FS.chmodSync(this.path, this.mode);
      break;
    case File.Types.directory:
      FS.mkdirSync(this.path, this.mode);
      break;
    case File.Types.symlink:
      FS.symlinkSync(this.dest, this.path);
      break;
  }
};

var normalizeJson = function(json) {
  if (typeof json === 'object') {
    if (!('-path' in json)) {
      json['-path'] = '.';
    }

    for (var i in json) {
      json[i]['-path'] = json['-path'] + '/' + i;
      json[i] = normalizeJson(json[i]);
    }
  }

  return json;
};

var normalizeOptions = function(options) {
  var opts = {
    'type': '-'
  };

  if (typeof options === 'object') {
    if ('-dest' in options) {
      opts.type = 'l';
    }

    for (var i in options) {
      // Attribute
      if (i.indexOf('-') === 0) {
        opts[i.substring(1)] = options[i];
      }
      // We know we have child nodes
      else {
        opts.type = 'd';
      }
    }

    // But the above is only a guess...
    if ('-type' in options) {
      opts.type = options['-type'];
    }
  }

  return opts;
};

var normalizeChildren = function(options) {
  var children = {};

  for (var i in options) {
    if (i.indexOf('-') !== 0) {
      children[i] = options[i];
    }
  }

  return children;
};

var json2dir = function(json) {
  _json2dir(normalizeJson(json));
};

var _json2dir = function(json) {
  for (var i in json) {
    if (i.indexOf('-') !== 0) {
      var f = new File(normalizeOptions(json[i]));
      f.create();
      _json2dir(normalizeChildren(json[i]));
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
  }
});

// module.exports = {

// };

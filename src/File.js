/**
 * @fileOverview Contains the File class.
 *
 * @author Daniel Imhoff
 */

'use strict';

// Imports
var PATH = require('path');
var FS = require('fs');

// var ASYNC = require('async');

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
      this.dest = options.dest;
    }
    else {
      throw new Error('"dest" is a required option for symlink files.');
    }
  }
};

File.UMASK = 18; // 18 == 0022
File.DIRECTORY_SEPARATOR = PATH.normalize('/');

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
    if (typeof type !== 'undefined' && type in File.Types) {
      type = File.Types[type];

      if (type === File.Types.symlink) {
        return 511; // 511 == 0777
      }

      return (type === File.Types.directory ? 511 : 438) - File.UMASK; // 511 == 0777, 438 == 0666
    }

    break;
  case 'string':
    switch (mode.length) {
    case 10:
      mode = mode.substring(1);
      /* falls through */
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

module.exports.File = File;

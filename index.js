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
 * @param {string} path
 */
var File = function(path, options) {
  options = options || {};
  this.path = PATH.normalize(path);
  this.followSymlink = 'followSymlink' in options ? options.followSymlink : false;
  this.exists = FS.existsSync(this.path);

  if (this.exists) {
    this.stats = this.getStats();
    this.type = this.getType();
    this.mode = this.stats.mode & 511; // 511 == 0777
  }
  else {
    if (!('type' in options)) {
      throw new Error('"type" is a required option for new nonexistent files.');
    }

    if (!(options.type in File.Types)) {
      throw new Error('Unknown file type: ' + options.type + '.');
    }

    this.type = File.Types[options.type];

    if ('content' in options) {
      if (this.type !== File.Types.file) {
        throw new Error('Non-regular files cannot have content.');
      }

      this.content = options.content;
    }

    this.mode = File.interpretMode(options.mode, this.type);
  }

  if (this.type === File.Types.symlink) {
    this.linkedFile = new File(this.path, UTIL._extend(options, { followSymlink: true }));
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
  's': 2
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
      // We want 'rwxrwxrwx', not '-rwxrwxrwx'
      if (mode.length === 10) {
        mode = mode.substring(1);
      }

      if (mode.length === 9) {
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

    this.stats = this.followSymlink ? FS.statSync(this.path) : FS.lstatSync(this.path);
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
      break;
  }
};

console.log(File.interpretMode('drw-rw-r--'));

// module.exports = {

// };

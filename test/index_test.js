/**
 * @fileOverview Tests for main file.
 */

var jsondir = require('../src/index');
var FS = require('fs');
var ASYNC = require('async');

exports.json2dir = function(test) {
  test.expect(2);

  ASYNC.parallel([
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output'
      }, function(err) {
        if (err) return callback(err);
        var stats = FS.statSync('test/output');
        test.ok(FS.existsSync('test/output'));
        test.ok(stats.isFile());
        FS.unlinkSync('test/output');
        callback();
      });
    }
  ], function(err) {
    if (err) throw err;
    test.done();
  });
};

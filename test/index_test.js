/**
 * @fileOverview Tests for main file.
 */

var jsondir = require('../src/index');
var PATH = require('path');
var FS = require('fs');
var ASYNC = require('async');
var File = jsondir.File;
// var uidNumber = require('uid-number');

exports.json2dir = function(test) {
  test.expect(42);

  ASYNC.series([
    function(callback) {
      jsondir.json2dir({}, function(err) {
        if (err instanceof File.FileExistsException) {
          test.ok(true);
          return callback();
        }

        return callback(err);
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output'
      }, function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/output'));
        test.ok(FS.statSync('test/output').isFile());
        FS.unlinkSync('test/output');
        callback();
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "a": {}
      }, function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/output'));
        test.ok(FS.statSync('test/output').isDirectory());
        test.ok(FS.existsSync('test/output/a'));
        test.ok(FS.statSync('test/output/a').isFile());
        FS.unlinkSync('test/output/a');
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      jsondir.json2dir({
        "a": {}
      }, { ignoreExists: true }, function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('a'));
        test.ok(FS.statSync('a').isFile());
        FS.unlinkSync('a');
        callback();
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "a": {
          "a1": {},
          "a2": {
            "a21": {}
          }
        },
        "b": {},
        "c": {
          "c1": {}
        }
      }, function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/output/a'));
        test.ok(FS.statSync('test/output/a').isDirectory());
        test.ok(FS.existsSync('test/output/b'));
        test.ok(FS.statSync('test/output/b').isFile());
        test.ok(FS.existsSync('test/output/c'));
        test.ok(FS.statSync('test/output/c').isDirectory());
        test.ok(FS.existsSync('test/output/a/a1'));
        test.ok(FS.statSync('test/output/a/a1').isFile());
        test.ok(FS.existsSync('test/output/a/a2'));
        test.ok(FS.statSync('test/output/a/a2').isDirectory());
        test.ok(FS.existsSync('test/output/a/a2/a21'));
        test.ok(FS.statSync('test/output/a/a2/a21').isFile());
        test.ok(FS.existsSync('test/output/c/c1'));
        test.ok(FS.statSync('test/output/c/c1').isFile());
        FS.unlinkSync('test/output/a/a2/a21');
        FS.rmdirSync('test/output/a/a2');
        FS.unlinkSync('test/output/a/a1');
        FS.rmdirSync('test/output/a');
        FS.unlinkSync('test/output/b');
        FS.unlinkSync('test/output/c/c1');
        FS.rmdirSync('test/output/c');
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "a": {
          "-type": 'z'
        }
      }, function(err) {
        if (err instanceof File.UnknownFileTypeException) {
          test.ok(true);
          FS.rmdirSync('test/output');
          return callback();
        }

        return callback(err);
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "a": {
          "-type": 'l'
        }
      }, function(err) {
        if (err instanceof File.MissingRequiredParameterException) {
          test.ok(true);
          FS.rmdirSync('test/output');
          return callback();
        }

        return callback(err);
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "a": {
          "-type": 'd',
          "-mode": 511
        },
        "b": {
          "-type": 'l',
          "-dest": 'a'
        },
        "c": {
          "-type": '-',
          "-content": 'something something something dark side',
          "-mode": 'rw-rw-rw-'
        },
        "d": {
          "-type": 'd',
          "-umask": 146
        },
        "e": {
          "-type": 'f',
          "-umask": 146
        }
      }, function(err) {
        if (err) return callback(err);
        var faStats = FS.statSync('test/output/a');
        var fbStats = FS.statSync('test/output/b');
        var fblStats = FS.lstatSync('test/output/b');
        var fcStats = FS.statSync('test/output/c');
        var fdStats = FS.statSync('test/output/d');
        var feStats = FS.statSync('test/output/e');
        test.ok(faStats.isDirectory());
        test.strictEqual(faStats.mode & 0777, 0777);
        test.ok(fbStats.isDirectory());
        test.ok(fblStats.isSymbolicLink());
        test.ok(fcStats.isFile());
        test.strictEqual(FS.readFileSync('test/output/c', { encoding: 'utf8' }), 'something something something dark side');
        test.strictEqual(fcStats.mode & 0777, 0666);
        test.ok(fdStats.isDirectory());
        test.strictEqual(fdStats.mode & 0777, 0555);
        test.ok(feStats.isFile());
        test.strictEqual(feStats.mode & 0777, 0444);
        FS.unlinkSync('test/output/e');
        FS.rmdirSync('test/output/d');
        FS.unlinkSync('test/output/c');
        FS.unlinkSync('test/output/b');
        FS.rmdirSync('test/output/a');
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      jsondir.json2dir({
        "-path": 'test/output',
        "-inherit": 'mode',
        "-mode": 511,
        "a": {
          "a1": {
            "a11": {}
          }
        },
        "b": {}
      }, function(err) {
        if (err) return callback(err);
        test.strictEqual(FS.statSync('test/output').mode & 0777, 0777);
        test.strictEqual(FS.statSync('test/output/a').mode & 0777, 0777);
        test.strictEqual(FS.statSync('test/output/b').mode & 0777, 0777);
        test.strictEqual(FS.statSync('test/output/a/a1').mode & 0777, 0777);
        test.strictEqual(FS.statSync('test/output/a/a1/a11').mode & 0777, 0777);
        FS.unlinkSync('test/output/a/a1/a11');
        FS.rmdirSync('test/output/a/a1');
        FS.rmdirSync('test/output/a');
        FS.unlinkSync('test/output/b');
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      FS.mkdirSync('test/output');
      FS.writeFileSync('test/output/a', 'something something something complete');

      test.doesNotThrow(function() {
        jsondir.json2dir({
          "-path": 'test/output',
          "a": {
            "-content": "something something something dark side"
          }
        }, { overwrite: true }, function(err) {
          test.strictEqual(FS.readFileSync('test/output/a', { encoding: 'utf8' }), 'something something something dark side');
          FS.unlinkSync('test/output/a');
          FS.rmdirSync('test/output');
          callback();
          if (err) throw err;
        });
      });
    },
    // This test doesn't work because owner/group attribute setting requires
    // super user, and grunt/nodeunit do something weird with that.
    //
    // function(callback) {
    //   jsondir.json2dir({
    //     "-path": 'test/output',
    //     "-inherit": ['owner', 'group'],
    //     "-owner": 'dwieeb',
    //     "-group": 'staff',
    //     "a": {
    //       "a1": {
    //         "a11": {}
    //       }
    //     },
    //     "b": {}
    //   }, function(err) {
    //     if (err) return callback(err);
    //     uidNumber('dwieeb', 'staff', function(uid, gid) {
    //       var outputStats = FS.statSync('test/output');
    //       var faStats = FS.statSync('test/output/a');
    //       var fbStats = FS.statSync('test/output/b');
    //       var fa1Stats = FS.statSync('test/output/a/a1');
    //       var fa11Stats = FS.statSync('test/output/a/a1/a11');
    //       test.strictEqual(outputStats.uid, uid);
    //       test.strictEqual(outputStats.gid, gid);
    //       test.strictEqual(faStats.uid, uid);
    //       test.strictEqual(faStats.gid, gid);
    //       test.strictEqual(fbStats.uid, uid);
    //       test.strictEqual(fbStats.gid, gid);
    //       test.strictEqual(fa1Stats.uid, uid);
    //       test.strictEqual(fa1Stats.gid, gid);
    //       test.strictEqual(fa11Stats.uid, uid);
    //       test.strictEqual(fa11Stats.gid, gid);
    //       callback();
    //     });
    //   });
    // }
  ], function(err) {
    if (err) throw err;
    test.done();
  });
};

exports.dir2json = function(test) {
  // test.expect();

  ASYNC.series([
    function(callback) {
      jsondir.dir2json('test/output', function(err) {
        if (err instanceof File.FileMissingException) {
          test.ok(true);
          return callback();
        }

        return callback(err);
      });
    },
    function(callback) {
      FS.writeFileSync('test/output', '');
      jsondir.dir2json('test/output', function(err, results) {
        if (err) return callback(err);
        test.deepEqual(results, {
          "-path": PATH.resolve('test/output'),
          "-type": '-',
          "-content": ''
        });
        FS.unlinkSync('test/output');
        callback();
      });
    },
    function(callback) {
      FS.mkdirSync('test/output');
      jsondir.dir2json('test/output', function(err, results) {
        if (err) return callback(err);
        test.deepEqual(results, {
          "-path": PATH.resolve('test/output'),
          "-type": 'd'
        });
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      FS.writeFileSync('test/output');
      FS.symlinkSync('output', 'test/to_output');
      jsondir.dir2json('test/to_output', function(err, results) {
        if (err) return callback(err);
        test.deepEqual(results, {
          "-path": PATH.resolve('test/to_output'),
          "-type": 'l',
          "-dest": 'output'
        });
        FS.unlinkSync('test/output');
        FS.unlinkSync('test/to_output');
        callback();
      });
    },
    function(callback) {
      FS.mkdirSync('test/output');
      FS.writeFileSync('test/output/a', 'something something something dark side');
      FS.writeFileSync('test/output/b', 'something something something complete');
      jsondir.dir2json('test/output', function(err, results) {
        if (err) return callback(err);
        test.deepEqual(results, {
          "-path": PATH.resolve('test/output'),
          "-type": 'd',
          "a": {
            "-path": PATH.resolve('test/output/a'),
            "-type": '-',
            "-content": 'something something something dark side'
          },
          "b": {
            "-path": PATH.resolve('test/output/b'),
            "-type": '-',
            "-content": 'something something something complete'
          }
        });
        FS.unlinkSync('test/output/a');
        FS.unlinkSync('test/output/b');
        FS.rmdirSync('test/output');
        callback();
      });
    },
    function(callback) {
      FS.mkdirSync('test/output');
      FS.mkdirSync('test/output/a');
      FS.mkdirSync('test/output/a/a1');
      FS.writeFileSync('test/output/a/a1/a11', '');
      FS.writeFileSync('test/output/b', '');
      jsondir.dir2json('test/output', { content: false }, function(err, results) {
        if (err) return callback(err);
        test.deepEqual(results, {
          "-path": PATH.resolve('test/output'),
          "-type": 'd',
          "a": {
            "-path": PATH.resolve('test/output/a'),
            "-type": 'd',
            "a1": {
              "-path": PATH.resolve('test/output/a/a1'),
              "-type": 'd',
              "a11": {
                "-path": PATH.resolve('test/output/a/a1/a11'),
                "-type": '-'
              }
            }
          },
          "b": {
            "-path": PATH.resolve('test/output/b'),
            "-type": '-'
          }
        });
        FS.unlinkSync('test/output/b');
        FS.unlinkSync('test/output/a/a1/a11');
        FS.rmdirSync('test/output/a/a1');
        FS.rmdirSync('test/output/a');
        FS.rmdirSync('test/output');
        callback();
      });
    }
  ], function(err) {
    if (err) throw err;
    test.done();
  });
};

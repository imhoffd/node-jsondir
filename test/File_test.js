/**
 * @fileOverview Unit tests for File class.
 */

var File = require('../src/File').File;
var FS = require('fs');
var ASYNC = require('async');
//var uidNumber = require('uid-number');

exports.interpretMode = function(test) {
  var umask = process.umask();

  // interpretMode() requires type if mode is not specified.
  test.ok(false === File.interpretMode());
  test.ok(false === File.interpretMode(undefined));

  // interpretMode() requires a string of length 9 (10 is okay, too)
  test.ok(false === File.interpretMode(''));
  test.ok(false === File.interpretMode('short'));
  test.ok(false === File.interpretMode('muchtoolong')); // actually, not too much

  // interpretMode() requires a number between 0 and 511, which is 000 and 777 in Octal.
  test.ok(false === File.interpretMode(-1));
  test.ok(false === File.interpretMode(777)); // False, because 777 is in decimal
  test.ok(false === File.interpretMode(Number.MAX_VALUE)); // lol

  // If mode is not specified, default permissions for a given file type is returned.
  test.ok(438 - umask === File.interpretMode(undefined, '-')); // 438 == 0666
  test.ok(511 - umask === File.interpretMode(undefined, 'd')); // 511 == 0777
  test.ok(511 === File.interpretMode(undefined, 'l'));

  // If mode is not specified, and a given umask is, return default file and directory permissions.
  test.ok(436 === File.interpretMode(undefined, '-', 02)); // 436 == 0664
  test.ok(509 === File.interpretMode(undefined, 'd', 02)); // 509 == 0775
  test.ok(511 === File.interpretMode(undefined, 'l', 02)); // 511 == 0777

  // Permission spectrum
  test.ok(511 === File.interpretMode('rwxrwxrwx')); // 511 == 0777
  test.ok(438 === File.interpretMode('rw-rw-rw-')); // 438 == 0666
  test.ok(365 === File.interpretMode('r-xr-xr-x')); // 365 == 0555
  test.ok(292 === File.interpretMode('r--r--r--')); // 292 == 0444
  test.ok(219 === File.interpretMode('-wx-wx-wx')); // 219 == 0333
  test.ok(146 === File.interpretMode('-w--w--w-')); // 146 == 0222
  test.ok(73  === File.interpretMode('--x--x--x')); //  73 == 0111
  test.ok(0   === File.interpretMode('---------')); //   0 == 0000

  // Common permissions
  test.ok(509 === File.interpretMode('rwxrwxr-x')); // 509 == 0775
  test.ok(493 === File.interpretMode('rwxr-xr-x')); // 493 == 0755
  test.ok(448 === File.interpretMode('rwx------')); // 384 == 0700
  test.ok(436 === File.interpretMode('rw-rw-r--')); // 436 == 0664
  test.ok(420 === File.interpretMode('rw-r--r--')); // 420 == 0644
  test.ok(384 === File.interpretMode('rw-------')); // 384 == 0600

  // Weird (but valid) permissions
  test.ok(179 === File.interpretMode('-w-rw--wx')); // 179 == 0263
  test.ok(335 === File.interpretMode('r-x--xrwx')); // 335 == 0517

  // You can pass Octal numbers into interpretMode, which does a bit more validation
  // than simply parseInt()
  test.ok(511 === File.interpretMode(0777));
  test.ok(438 === File.interpretMode(0666));
  test.ok(365 === File.interpretMode(0555));
  test.ok(292 === File.interpretMode(0444));
  test.ok(219 === File.interpretMode(0333));
  test.ok(146 === File.interpretMode(0222));
  test.ok(73  === File.interpretMode(0111));
  test.ok(0   === File.interpretMode(0));

  // Whew!
  test.done();
};

exports.getStats = function(test) {
  FS.writeFileSync('test/foo', '');
  FS.chmodSync('test/foo', 0644);
  FS.mkdirSync('test/bar');
  FS.chmodSync('test/bar', 0755);

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar' });
  var f1Stats = f1.getStats();
  var f2Stats = f2.getStats();

  test.ok(f1Stats instanceof FS.Stats);
  test.ok(f2Stats instanceof FS.Stats);
  test.ok(f1Stats.isFile());
  test.ok(f2Stats.isDirectory());
  test.ok((f1Stats.mode & 0777) === 0644);
  test.ok((f2Stats.mode & 0777) === 0755);

  FS.unlinkSync('test/foo');
  FS.rmdirSync('test/bar');

  test.done();
};

exports.getType = function(test) {
  FS.writeFileSync('test/foo', '');
  FS.mkdirSync('test/bar');
  FS.symlinkSync('bar', 'test/tobar');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar' });
  var f3 = new File({ path: 'test/tobar' });

  test.ok(f1.getType() === File.Types.file);
  test.ok(f2.getType() === File.Types.directory);
  test.ok(f3.getType() === File.Types.symlink);

  FS.unlinkSync('test/foo');
  FS.rmdirSync('test/bar');
  FS.unlinkSync('test/tobar');

  test.done();
};

exports.getPath = function(test) {
  FS.writeFileSync('test/foo', '');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar', type: '-' });

  test.ok(f1.getPath() === 'test/foo');
  test.ok(f2.getPath() === 'test/bar');

  FS.unlinkSync('test/foo');

  test.done();
};

exports.getContent = function(test) {
  FS.writeFileSync('test/foo', 'testing testing');
  FS.mkdirSync('test/bar');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar' });

  test.ok(f1.getContent() === 'testing testing');
  test.throws(function() {
    f2.getContent();
  }, File.IncorrectFileTypeException);

  FS.unlinkSync('test/foo');
  FS.rmdirSync('test/bar');

  test.done();
};

exports.getDest = function(test) {
  FS.mkdirSync('test/bar');
  FS.symlinkSync('bar', 'test/tobar');

  var f1 = new File({ path: 'test/bar' });
  var f2 = new File({ path: 'test/tobar' });

  test.throws(function() {
    f1.getDest();
  }, File.IncorrectFileTypeException);
  test.ok(f2.getDest() === 'bar');

  FS.rmdirSync('test/bar');
  FS.unlinkSync('test/tobar');

  test.done();
};

exports.create = function(test) {
  var f1 = new File({
    type: '-',
    path: 'test/foo'
  });
  var f2 = new File({
    type: 'd',
    path: 'test/bar'
  });
  var f3 = new File({
    type: '-',
    path: 'test/bar/foo',
    content: 'test'
  });
  var f4 = new File({
    type: 'l',
    path: 'test/bar/tofoo',
    dest: '../foo'
  });

  test.expect(10);

  ASYNC.series([
    function(callback) {
      f1.create(function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/foo'));
        test.ok(FS.statSync('test/foo').isFile());
        callback();
      });
    }, function(callback) {
      f2.create(function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/bar'));
        test.ok(FS.statSync('test/bar').isDirectory());
        callback();
      });
    }, function(callback) {
      f3.create(function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/bar/foo'));
        test.ok(FS.statSync('test/bar/foo').isFile());
        test.ok('test' === FS.readFileSync('test/bar/foo', { encoding: 'utf8' }));
        callback();
      });
    }, function(callback) {
      f4.create(function(err) {
        if (err) return callback(err);
        test.ok(FS.existsSync('test/bar/tofoo'));
        test.ok(FS.lstatSync('test/bar/tofoo').isSymbolicLink());
        test.ok(FS.statSync('test/bar/tofoo').isFile());
        callback();
      });
    }
  ], function(err) {
    if (err) throw err;
    FS.unlinkSync('test/bar/tofoo');
    FS.unlinkSync('test/bar/foo');
    FS.rmdirSync('test/bar');
    FS.unlinkSync('test/foo');

    test.done();
  });
};

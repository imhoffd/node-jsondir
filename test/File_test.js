/**
 * @fileOverview Unit tests for File class.
 */

var File = require('../src/File').File;
var PATH = require('path');
var FS = require('fs');
var ASYNC = require('async');
//var uidNumber = require('uid-number');

exports.interpretMode = function(test) {
  var umask = process.umask();

  // interpretMode() requires type if mode is not specified.
  test.strictEqual(File.interpretMode(), false);

  // interpretMode() requires a string of length 9 (10 is okay, too)
  test.strictEqual(File.interpretMode(''), false);
  test.strictEqual(File.interpretMode('short'), false);
  test.strictEqual(File.interpretMode('muchtoolong'), false); // actually, not too much

  // interpretMode() requires a number between 0 and 511, which is 000 and 777 in Octal.
  test.strictEqual(File.interpretMode(-1), false);
  test.strictEqual(File.interpretMode(777), false); // False, because 777 is in decimal
  test.strictEqual(File.interpretMode(Number.MAX_VALUE), false); // lol

  // If mode is not specified, default permissions for a given file type is returned.
  test.strictEqual(File.interpretMode(undefined, '-'), 438 - umask); // 438 == 0666
  test.strictEqual(File.interpretMode(undefined, 'd'), 511 - umask); // 511 == 0777
  test.strictEqual(File.interpretMode(undefined, 'l'), 511);

  // If mode is not specified, and a given umask is, return default file and directory permissions.
  test.strictEqual(File.interpretMode(undefined, '-', 02), 436); // 436 == 0664
  test.strictEqual(File.interpretMode(undefined, 'd', 02), 509); // 509 == 0775
  test.strictEqual(File.interpretMode(undefined, 'l', 02), 511); // 511 == 0777

  // Permission spectrum
  test.strictEqual(File.interpretMode('rwxrwxrwx'), 511); // 511 == 0777
  test.strictEqual(File.interpretMode('rw-rw-rw-'), 438); // 438 == 0666
  test.strictEqual(File.interpretMode('r-xr-xr-x'), 365); // 365 == 0555
  test.strictEqual(File.interpretMode('r--r--r--'), 292); // 292 == 0444
  test.strictEqual(File.interpretMode('-wx-wx-wx'), 219); // 219 == 0333
  test.strictEqual(File.interpretMode('-w--w--w-'), 146); // 146 == 0222
  test.strictEqual(File.interpretMode('--x--x--x'), 73);  //  73 == 0111
  test.strictEqual(File.interpretMode('---------'), 0);   //   0 == 0000

  // Common permissions
  test.strictEqual(File.interpretMode('rwxrwxr-x'), 509); // 509 == 0775
  test.strictEqual(File.interpretMode('rwxr-xr-x'), 493); // 493 == 0755
  test.strictEqual(File.interpretMode('rwx------'), 448); // 448 == 0700
  test.strictEqual(File.interpretMode('rw-rw-r--'), 436); // 436 == 0664
  test.strictEqual(File.interpretMode('rw-r--r--'), 420); // 420 == 0644
  test.strictEqual(File.interpretMode('rw-------'), 384); // 384 == 0600

  // Weird (but valid) permissions
  test.strictEqual(File.interpretMode('-w-rw--wx'), 179); // 179 == 0263
  test.strictEqual(File.interpretMode('r-x--xrwx'), 335); // 335 == 0517

  // setuid and setgid flags
  test.strictEqual(File.interpretMode('rws------'), 2496); // 2496 == 04700
  test.strictEqual(File.interpretMode('rwS------'), 2432); // 2432 == 04600
  test.strictEqual(File.interpretMode('rwx---r-t'), 965);  //  965 == 01705
  test.strictEqual(File.interpretMode('rwxrws---'), 1528); // 1528 == 02770
  test.strictEqual(File.interpretMode('rwxrwS---'), 1520); // 1520 == 02760
  test.strictEqual(File.interpretMode('rwsrws---'), 3576); // 3576 == 06770
  test.strictEqual(File.interpretMode('rwSrwS---'), 3504); // 3504 == 06660
  test.strictEqual(File.interpretMode('rwSrws--t'), 4025); // 4025 == 07671
  test.strictEqual(File.interpretMode('rwsr-xr-t'), 3053); // 3053 == 05755
  test.strictEqual(File.interpretMode('rwsrwxrw-'), 2558); // 2558 == 04776
  test.strictEqual(File.interpretMode('rwsrwSrwt'), 4087); // 4087 == 07767

  // You can pass Octal numbers into interpretMode, which does a bit more validation
  // than simply parseInt()
  test.strictEqual(File.interpretMode(0777), 511);
  test.strictEqual(File.interpretMode(0666), 438);
  test.strictEqual(File.interpretMode(0555), 365);
  test.strictEqual(File.interpretMode(0444), 292);
  test.strictEqual(File.interpretMode(0333), 219);
  test.strictEqual(File.interpretMode(0222), 146);
  test.strictEqual(File.interpretMode(0111), 73);
  test.strictEqual(File.interpretMode(0), 0);

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
  test.strictEqual(f1Stats.mode & 0777, 0644);
  test.strictEqual(f2Stats.mode & 0777, 0755);

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

  test.strictEqual(f1.getType(), File.Types.file);
  test.strictEqual(f2.getType(), File.Types.directory);
  test.strictEqual(f3.getType(), File.Types.symlink);

  FS.unlinkSync('test/foo');
  FS.rmdirSync('test/bar');
  FS.unlinkSync('test/tobar');

  test.done();
};

exports.getPath = function(test) {
  FS.writeFileSync('test/foo', '');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar', type: '-' });

  test.strictEqual(f1.getPath(), PATH.resolve('test/foo'));
  test.strictEqual(f2.getPath(), PATH.resolve('test/bar'));

  FS.unlinkSync('test/foo');

  test.done();
};

exports.getContent = function(test) {
  FS.writeFileSync('test/foo', 'testing testing');
  FS.mkdirSync('test/bar');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar' });

  test.strictEqual(f1.getContent(), 'testing testing');
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
  test.strictEqual(f2.getDest(), 'bar');

  FS.rmdirSync('test/bar');
  FS.unlinkSync('test/tobar');

  test.done();
};

exports.doesExist = function(test) {
  var f1 = new File({ type: '-', path: 'test/foo' });
  var f2 = new File({ type: 'd', path: 'test/bar' });
  var f3 = new File({ type: 'l', path: 'test/tobar', dest: 'bar' });

  test.ok(!f1.doesExist());
  test.ok(!f2.doesExist());
  test.ok(!f3.doesExist());

  FS.writeFileSync('test/foo', '');
  FS.mkdirSync('test/bar');
  FS.symlinkSync('bar', 'test/tobar');

  f1 = new File({ path: 'test/foo' });
  f2 = new File({ path: 'test/bar' });
  f3 = new File({ path: 'test/tobar' });

  test.ok(f1.doesExist());
  test.ok(f2.doesExist());
  test.ok(f3.doesExist());

  FS.unlinkSync('test/foo');
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
        test.strictEqual(FS.readFileSync('test/bar/foo', { encoding: 'utf8' }), 'test');
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

exports.remove = function(test) {
  test.expect(6);

  FS.writeFileSync('test/foo', '');
  FS.mkdirSync('test/bar');
  FS.symlinkSync('bar', 'test/tobar');

  var f1 = new File({ path: 'test/foo' });
  var f2 = new File({ path: 'test/bar' });
  var f3 = new File({ path: 'test/tobar' });

  test.ok(FS.existsSync('test/foo'));
  test.ok(FS.existsSync('test/bar'));
  test.ok(FS.existsSync('test/tobar'));

  ASYNC.parallel([
    function(callback) {
      f1.remove(function(err) {
        if (err) return callback(err);
        test.ok(!FS.existsSync('test/foo'));
        callback();
      });
    },
    function(callback) {
      f2.remove(function(err) {
        if (err) return callback(err);
        test.ok(!FS.existsSync('test/bar'));
        callback();
      });
    },
    function(callback) {
      f3.remove(function(err) {
        if (err) return callback(err);
        test.ok(!FS.existsSync('test/tobar'));
        callback();
      });
    }
  ], function(err) {
    if (err) throw err;
    test.done();
  });
};


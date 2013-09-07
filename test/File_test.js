/**
 * @fileOverview Unit tests for File class.
 */

var File = require('../src/File').File;

exports.interpretMode = function(test) {
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
  test.ok(420 === File.interpretMode(undefined, '-')); // 420 == 0644
  test.ok(493 === File.interpretMode(undefined, 'd')); // 493 == 0755
  test.ok(511 === File.interpretMode(undefined, 'l')); // 511 == 0777

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

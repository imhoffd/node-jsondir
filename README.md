node-jsondir
============

A Node package to convert JSON objects to directories and back again. Directory structures can easily be represented by JSON. Why not provide a way to go back and forth between them?

### Why?

Doing large asynchronous file operations in Node is simply a pain in the ass. Callbacks nest and nest and nest until suddenly you're ten or twenty levels of indentation deep and you have no idea what the hell is going on. JSONdir helps alleviate your I/O stress by giving you simple and familiar tools to do large amounts of work efficiently.

### Simple examples

#### json2dir (Turn a JSON object into a directory structure.)

```javascript
var jsondir = require('jsondir');

jsondir.json2dir({
    "-path": 'path/to/directory',
    "myfile": {
        "-content": 'Hello world!'
    },
    "mydir": {
        "a": {
            "b": {
                "c": {
                    "-type": 'd'
                }
            }
        },
        "1": {
            "2": {
                "3": {}
            }
        }
    }
}, function(err) {
    if (err) throw err;
});
```

By running the code above, you get the following directory structure in your current working directory:

```
path/
+-- to/
    +-- directory/
        |-- myfile
        +-- mydir/
            |-- a/
            |   +-- b/
            |       +-- c/
            +-- 1/
                +-- 2/
                    +-- 3
```

####dir2json (Turn a directory structure into a JSON object.)

```javascript
var jsondir = require('jsondir');

jsondir.dir2json('path/to/directory', function(err, results) {
    if (err) throw err;
    console.log(results);
});
```

After running the json2dir example to create that file structure, the following is the output of running the code above:

```
{ '-path': '/home/you/path/to/directory',
  '-type': 'd',
  mydir:
   { '1':
      { '2': [Object],
        '-path': '/home/you/path/to/directory/mydir/1',
        '-type': 'd' },
     '-path': '/home/you/path/to/directory/mydir',
     '-type': 'd',
     a:
      { '-path': '/home/you/path/to/directory/mydir/a',
        '-type': 'd',
        b: [Object] } },
  myfile:
   { '-path': '/home/you/path/to/directory/myfile',
     '-type': '-' } }
```

You can get additional attributes by adding elements to the `attributes` array in the dir2json options. The following example includes the `-content` (for files) and `-mode` attributes, as well as `-path` and `-type` (which are always included):

```javascript
jsondir.dir2json('path/to/directory', { attributes: ['content', 'mode'] }, function(err, results) {
    if (err) throw err;
    console.dir(results);
});
```

### Installation

Use npm.

    npm install jsondir

### Usage

* Files and directories (and symlinks) are represented as nested JSON nodes with filenames as keys and children and attributes as properties.
* Attributes are prefixed with a hyphen (`-`), which distinguish them from children.
* If a node has no children and the `-type` or `-content` attributes are not explicitly specified, JSONdir will make that node into a file. Otherwise, it will make it into a directory.
* All file operations are asynchronous. Love your callbacks.

### Attributes

Each node can have a variety of attributes:

* `-type`: `-` (or `f`) for files, `d` for directories, `l` for symlinks. See Usage for behavior when omitted.
* `-path`: Normally used on the origin node, this attribute is for specifying the file path of the directory structure.
* `-mode`: Use octal/decimal numbers or a 9-character string like `rwxr-xr-x` for file mode.
* `-umask`: Use octal/decimal numbers for file umask. Hint: The umask on Unix systems is usually `18` (`022`). Use `2` for sharing writing with the group.
* `-owner`: Use for specifying the owner of the node, such as `dwieeb`. You may also use UIDs, like `1001`.
* `-group`: Use for specifying the group of the node, such as `www-data`. You may also use GIDs, like `33`.
* `-name`: In case you need to determine the filename at runtime, if this attribute is specified, it will be used for the filename instead of the node's key.
* `-dest`: Specify the path of the symlink destination. If this attribute is specified, `-type` is assumed to be `l`.
* `-content`: Specify the contents of the file. If this attribute is specified, `-type` is assumed to be `f`.

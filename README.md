LabyMod Addon Archive
=====================

Script to locally archive addons from the LabyMod Store.

**Usage:**
```
$ node src/main.js --help
Usage: node src/main.js [options]

Bot to archive addons from the LabyMod store.

Options:
  -V, --version      output the version number
  -u, --update       update archived list of addons
  -l, --list         print list of archived addons
  -s, --show <uuid>  show all information for specified addon
  -h, --help         display help for command
```
Update should be run regularly (e. g. every day via a cronjob) in order to keep the list up to date and don't miss any versions.

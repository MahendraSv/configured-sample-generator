var Promise = require('bluebird'),
    fs      = Promise.promisifyAll(require('fs')),
    util    = require('util'),
    tar     = require('tar'),
    request = require('request'),
    zlib    = require('zlib'),
    _       = require('lodash'),
    debug   = require('debug')('configurated-sample-generator'),
    temp    = Promise.promisifyAll(require('temp')),
    path    = require('path'),
    streamToPromise = require('stream-to-promise'),
    archiver = require('archiver');

// Initializations
temp.track();

function Packer(configuration, options) {
  this.repo = options.repository;
  this.branch = options.gitBranch;
  this.path = options.examplePath;
  this.type = options.sampleType || 'noop';
  this.filePath = options.configurationFilePath || this.path;
  this.contextInformation = options.contextInformation;
  this.config = configuration;
}

Packer.prototype.create = function() {
  debug("Calling create function");
  return this.download()
    .then(this.config.infoLoader.bind(this.cofig))
    .then(this.config.types[this.type].bind(this.config))
    .then(this.zip.bind(this))
    .finally(function() {
      temp.cleanup();
    });
};

Packer.GITHUB_URL = 'https://github.com/%s/%s/archive/%s.tar.gz';

Packer.prototype.download = function() {
  var _this = this;
  var url = util.format(Packer.GITHUB_URL, this.config.organization, this.repo, this.branch);

  debug("Downloading file from URL", url);

  return temp.mkdirAsync('githubdownload')
    .then(function(dirPath) {
      debug("Temp dir created", dirPath);
      var examplePath = path.join(dirPath, _this.repo + '-' + _this.branch, _this.path);
      var filePath = path.join(dirPath, _this.repo + '-' + _this.branch, _this.filePath);

      return streamToPromise(
        request(url)
          .pipe(zlib.Unzip())
          .pipe(tar.Extract({path: dirPath})))
        .then(function() {
          debug("Converted download stream to promise");
          return _.extend({
              examplePath: examplePath,
              configurationFilePath: filePath
            }, _this.contextInformation);

        });
    });
};


Packer.prototype.zip = function(context) {
  debug("Zipping file");

  var archive = archiver('zip');

  archive.bulk([
    { expand: true, cwd: context.examplePath, src: ['**'], dot: true }
  ]);

  archive.finalize();

  return streamToPromise(archive)
    .then(function(data) {
      debug("Zip created");
      return data;
    });
};

module.exports = Packer;

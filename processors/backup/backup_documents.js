/**  Copies all revisions of all documents to a separate backup database
  *  Setup environment variables (see datacouch readme for more info):
  *    export DATACOUCH_ROOT="http://admin:pass@localhost:5984"
  *    export DATACOUCH_VHOST="couchdb.dev:5984"
  *  then "node backup_documents.js"
  *  Author: Max Ogden (@maxogden)
 **/
 
if(!process.env['DATACOUCH_ROOT']) throw ("OMGZ YOU HAVE TO SET $DATACOUCH_ROOT");

var follow = require('follow')
  , request = require('request').defaults({json: true})
  , deferred = require('deferred')
  , couchapp = require('couchapp')
  , http = require('http')
  , path = require('path')
  , url = require('url')
  , _ = require('underscore')
  ;

var configURL = url.parse(process.env['DATACOUCH_ROOT'])
  , couch = configURL.protocol + "//" + configURL.host
  , datasetsDB = couch + "/datacouch/_design/datacouch/_view/by_user?include_docs=true"
  ;

function backupDatabases() {
  request({uri: datasetsDB, include_docs: true}, function(err, resp, body) {
    var dbs = body.rows
      , pendingBackups = dbs.length
      ;
    _.each(dbs, function(db) {
      var metadataURL = couch + "/datacouch/" + db.id;
      request({uri: metadataURL}, function(err, resp, body) {
        var dbInfo = body
          , backupURL = couch + "/" + db.id + "-backup"
          , dbURL = couch + "/" + db.id
          ;
        function copyChanged() {
          request({uri: dbURL + "/_changes?since=" + (dbInfo.lastBackupSeq || "0")}, function(err, resp, body) {
            if (err) {
              console.log(dbURL + "/_changes?since=" + (dbInfo.lastBackupSeq || "0"), err)
              return;
            }
            var changes = body.results;
            var pendingDocs = changes.length;
            if(pendingDocs === 0) {
              pendingBackups--;
              if(pendingBackups === 0) setTimeout(backupDatabases, 5000);
            }
            _(changes).each(function(change) {
              var source = dbURL + "/" + change.id + "?attachments=true"
               , destination = backupURL + "/" + change.id + "-" + change.changes[0].rev
               ;
              request.get(source).pipe(request.put(destination, function(err, resp, body) {
                pendingDocs--;
                if(pendingDocs === 0 && change.seq > (dbInfo.lastBackupSeq || 0)) {
                  dbInfo.lastBackupSeq = change.seq;
                  request({uri: metadataURL, method: "PUT", body: dbInfo}, function(err, resp, body) {
                    // TODO handle conflicts
                    pendingBackups--;
                    if(pendingBackups === 0) setTimeout(backupDatabases, 5000);                    
                  })
                }
              }))
            })
          })
        }
        checkExistenceOf(backupURL).then(function(status) {
          if(status === 404) {
            createDB(backupURL).then(function(resp) {
              pushCouchapp("../../backup.js", backupURL).then(copyChanged);
            })
          } else {
            copyChanged()
          }
        })
      })
    })
  })
}

function pushCouchapp(app, target) {
  var dfd = deferred();
  var capp = require(absolutePath(app))
  couchapp.createApp(capp, target, function (app) { app.push(function(resp) { dfd.resolve() }) })
  return dfd.promise();
}

function absolutePath(pathname) {
  if (pathname[0] === '/') return pathname
  return path.join(process.env.PWD, path.normalize(pathname));
}

function checkExistenceOf(url) {
  var dfd = deferred();
  request({uri: url, method: "HEAD"}, function(err, resp, body) {
    if (err) {
      console.log("HEAD", err)
      dfd.resolve(200)
    } else {      
      dfd.resolve(resp.statusCode);
    }
  })
  return dfd.promise();
}

function createDB(url) {
  var dfd = deferred();
  request({uri: url, method: "PUT"}, function (err, resp, body) {
    if (err) throw new Error('ahh!! ' + err);
    if (!body) body = {"ok": true};
    if (!body.ok) throw new Error(url + " - " + body);
    dfd.resolve(resp.statusCode);
  })
  return dfd.promise();
}

backupDatabases();
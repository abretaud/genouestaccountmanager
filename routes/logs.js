var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs');
var fs = require('fs');
// var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var monk = require('monk');
var db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db);
// var groups_db = db.get('groups');
// var databases_db = db.get('databases');
// var web_db = db.get('web');
var users_db = db.get('users');
var events_db = db.get('events');

router.get('/log', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        events_db.find({}, {limit: 200, sort: {date: -1}}, function(err, events){
            res.send(events);
            res.end();
        });
    });
});

router.get('/log/user/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        events_db.find({'owner': req.params.id}, function(err, events){
            res.send(events);
            res.end();
        });
    });
});

router.get('/log/status/:id/:status', function(req, res){
    events_db.update({'logs': req.params.id}, {'$set':{'status': parseInt(req.params.status)}}, function(){});
    res.end();
});

router.get('/log/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }

        let file = req.params.id + '.log';
        let log_file = GENERAL_CONFIG.script_dir + '/' + file;
        fs.readFile(log_file, 'utf8', function (err,data) {
            if (err) {
                res.status(500).send(err);
                res.end();
                return;
            }
            res.send({log: data});
            res.end();
            return;
        });

    });
});

module.exports = router;

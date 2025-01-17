var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var utils = require('./utils');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');


/**
 * Change owner
 */
router.put('/web/:id/owner/:old/:new', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    if(! utils.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        if(!session_user.is_admin) {
            res.status(401).send('Not authorized');
            return;
        }
        // eslint-disable-next-line no-unused-vars
        web_db.update({name: req.params.id},{'$set': {owner: req.params.new}}, function(err){
            // eslint-disable-next-line no-unused-vars
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'change website ' + req.params.id + ' owner to ' + req.params.new  , 'logs': []}, function(err){});
            res.send({message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new});
            res.end();
            return;
        });
    });
});

router.get('/web', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {};
        if(!session_user.is_admin) {
            filter = {owner: session_user.uid};
        }
        web_db.find(filter, function(err, databases){
            res.send(databases);
            return;
        });
    });
});

router.get('/web/owner/:owner', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.owner])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {owner: req.params.owner};
        web_db.find(filter, function(err, databases){
            res.send(databases);
            return;
        });
    });
});


router.post('/web/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }

        var owner = session_user.uid;
        if(req.body.owner !== undefined && session_user.is_admin) {
            owner = req.body.owner;
        }
        let web = {
            owner: owner,
            name: req.params.id,
            url: req.body.url,
            description: req.body.description
        };
        // eslint-disable-next-line no-unused-vars
        web_db.insert(web, function(err){
            // eslint-disable-next-line no-unused-vars
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'register new web site ' + req.params.id , 'logs': []}, function(err){});

            res.send({web: web, message: 'New website added'});
        });
    });
});

router.delete('/web/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }


    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {name: req.params.id};
        if(!session_user.is_admin) {
            filter['owner'] = session_user.uid;
        }
        // eslint-disable-next-line no-unused-vars
        web_db.remove(filter, function(err){
            // eslint-disable-next-line no-unused-vars
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove web site ' + req.params.id , 'logs': []}, function(err){});
            res.send({message: 'Website deleted'});
        });
    });
});


router.delete_webs = function(user){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        web_db.find({'owner': user.uid}).then(function(webs){
            if(!webs){
                resolve(true);
                return;
            }
            logger.debug('delete_webs');
            Promise.all(webs.map(function(web){
                return delete_web(user, web._id);
            })).then(function(res){
                resolve(res);
            });
        });
    });

};

var delete_web = function(user, web_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        var filter = {_id: web_id};
        if(!user.is_admin) {
            filter['owner'] = user.uid;
        }
        web_db.remove(filter).then(function(){
            events_db.insert(
                {
                    'owner': user.uid,
                    'date': new Date().getTime(),
                    'action': 'remove web site ' + web_id ,
                    'logs': []
                }
            ).then(function(){
                resolve(true);
            });
        });
    });
};

module.exports = router;

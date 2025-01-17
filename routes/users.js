/*jslint es6 */
var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs');
var escapeshellarg = require('escapeshellarg');
var markdown = require('markdown').markdown;
var htmlToText = require('html-to-text');
var validator = require('email-validator');

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const filer = require('../routes/file.js');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;
var MAIL_CONFIG = {};
// todo: more and more ugly init...
if (CONFIG[MAILER]) { MAIL_CONFIG = CONFIG[MAILER]; }
// todo: find a cleaner way to allow registration if no mail are configured
if (!MAIL_CONFIG.origin) { MAIL_CONFIG.origin = 'nomail@nomail.org'; }

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];

// var cookieParser = require('cookie-parser');

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif_'+MAILER+'.js');
var utils = require('../routes/utils.js');

// var get_ip = require('ipware')().get_ip;

var monk = require('monk');
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + GENERAL_CONFIG.db);
var groups_db = db.get('groups');
var databases_db = db.get('databases');
var web_db = db.get('web');
var users_db = db.get('users');
var projects_db = db.get('projects');
var events_db = db.get('events');


var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

const runningEnv = process.env.NODE_ENV || 'prod';

for(let i = 0; i< plugins.length; i++){
    if(plugins[i]['admin']) {
        continue;
    }
    plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name});
}

// util function to execute scripts immediatly, for test purpose only
// on dev/prod, scripts should be executed by cron only
if (runningEnv === 'test'){
    const { spawn } = require('child_process');
    var if_dev_execute_scripts = function(){
        return new Promise(function (resolve, reject){
            if (runningEnv !== 'test'){
                resolve();
                return;
            }
            logger.info('In *test* environment, check for scripts to execute');
            let cron_bin_script = CONFIG.general.cron_bin_script || null;
            if(cron_bin_script === null){
                logger.error('cron script not defined');
                reject({'err': 'cron script not defined'});
                return;
            }
            var procScript = spawn(cron_bin_script, [CONFIG.general.script_dir, CONFIG.general.url]);
            procScript.on('exit', function (code, signal) {
                logger.info(cron_bin_script + ' process exited with ' +
                            `code ${code} and signal ${signal}`);
                resolve();
            });
        });
    };

    router.use('*', function(req, res, next){
        res.on('finish', function() {
            if_dev_execute_scripts().then(function(){});
        });
        next();
    });
}

function get_group_home (user) {
    let group_path = CONFIG.general.home+'/'+user.group;
    if(user.maingroup!='' && user.maingroup!=null) {
        group_path = CONFIG.general.home+'/'+user.maingroup+'/'+user.group;
    }
    return group_path.replace(/\/+/g, '/');
}

function get_user_home (user) {
    // todo check  or not if user.uid exist
    let user_home = CONFIG.general.home + '/' + user.uid;
    if(CONFIG.general.use_group_in_path) {
        user_home = get_group_home(user) + '/' + user.uid;
    }
    return user_home.replace(/\/+/g, '/');
}

router.user_home = function (user) {
    return get_user_home(user);
};

var send_notif = function(mailOptions, fid, errors) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        if(notif.mailSet()) {
            // eslint-disable-next-line no-unused-vars
            notif.sendUser(mailOptions, function(err, response) {
                resolve(errors);
            });
        } else {
            resolve(errors);
        }
    });
};

var create_extra_group = function(group_name, owner_name){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        utils.getGroupAvailableId().then(function (mingid) {
            var fid = new Date().getTime();
            let group = {name: group_name, gid: mingid, owner: owner_name};
            // eslint-disable-next-line no-unused-vars
            groups_db.insert(group, function(err){
                // eslint-disable-next-line no-unused-vars
                goldap.add_group(group, fid, function(err){
                    filer.user_create_extra_group(group, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                                resolve(group);  // todo: find if needed
                                return;
                            })
                        .catch(error => { // reject()
                            logger.error('Create Group Failed for: ' + group.name, error);
                            return;
                        });
                });
            });
        });

    });
};

var create_extra_user = function(user_name, group, internal_user){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        let password = Math.random().toString(36).slice(-10);
        if(process.env.MY_ADMIN_PASSWORD){
            password = process.env.MY_ADMIN_PASSWORD;
        }
        else {
            logger.info('Generated admin password:' + password);
        }

        let user = {
            status: STATUS_ACTIVE,
            uid: user_name,
            firstname: user_name,
            lastname: user_name,
            email: process.env.MY_ADMIN_EMAIL || CONFIG.general.support,
            address: '',
            lab: '',
            responsible: '',
            group: group.name,
            secondarygroups: [],
            maingroup: '',
            home: '',
            why: '',
            ip: '',
            regkey: Math.random().toString(36).slice(-10),
            is_internal: internal_user,
            is_fake: false,
            uidnumber: -1,
            gidnumber: -1,
            cloud: false,
            duration: 3,
            expiration: new Date().getTime() + 1000*3600*24*3,
            loginShell: '/bin/bash',
            history: [],
            password: password
        };

        utils.getUserAvailableId().then(function (minuid) {

            user.uidnumber = minuid;
            user.gidnumber = group.gid;
            user.home = get_user_home(user);
            var fid = new Date().getTime();
            goldap.add(user, fid, function(err) {
                if(!err){
                    delete user.password;
                    // eslint-disable-next-line no-unused-vars
                    users_db.insert(user, function(err){
                        // todo: do something if err
                        filer.user_create_extra_user(user, fid)
                            .then(
                                created_file => {
                                    logger.info('File Created: ', created_file);
                                })
                            .catch(error => { // reject()
                                logger.error('Create User Failed for: ' + user.uid, error);
                                return;
                            });

                        let plugin_call = function(plugin_info, userId, data, adminId){
                            // eslint-disable-next-line no-unused-vars
                            return new Promise(function (resolve, reject){
                                plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                    resolve(true);
                                });
                            });
                        };

                        Promise.all(plugins_info.map(function(plugin_info){
                            return plugin_call(plugin_info, user.uid, user, 'auto');
                        // eslint-disable-next-line no-unused-vars
                        })).then(function(results){
                            resolve(user);
                        }, function(err){
                            logger.error('failed to create extra user', user, err);
                            resolve(user);
                        });
                    });

                }
                else {
                    logger.error('Failed to create extra user', user, err);
                    resolve(null);
                }
            });

        });


    });
};

router.create_admin = function(default_admin, default_admin_group){
    users_db.findOne({'uid': default_admin}).then(function(user){
        if(user){
            logger.info('admin already exists, skipping');
        }
        else {
            logger.info('should create admin');
            groups_db.findOne({name: default_admin_group}).then(function(group){
                if(group){
                    logger.info('group already exists');
                    // eslint-disable-next-line no-unused-vars
                    create_extra_user(default_admin, group, true).then(function(user){
                        logger.info('admin user created');
                    });
                }
                else {
                    create_extra_group(default_admin_group, default_admin).then(function(group){
                        logger.info('admin group created');
                        // eslint-disable-next-line no-unused-vars
                        create_extra_user(default_admin, group, true).then(function(user){
                            logger.info('admin user created');
                        });
                    });
                }
            });
        }
    });
};

router.get('/user/:id/apikey', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(session_user.uid !== req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        users_db.findOne({uid: req.params.id}, function(err, user){
            if(!user) {
                res.send({msg: 'User does not exist'});
                res.end();
                return;
            }

            if (user.apikey === undefined) {
                res.send({'apikey': ''});
                res.end();
                return;
            } else {
                res.send({'apikey': user.apikey});
                res.end();
                return;
            }
        });
    });
});

router.post('/user/:id/apikey', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(session_user.uid !== req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }

        users_db.findOne({uid: req.params.id}, function(err, user){
            if(!user) {
                res.send({msg: 'User does not exist'});
                res.end();
                return;
            }

            var apikey = Math.random().toString(36).slice(-10);
            // eslint-disable-next-line no-unused-vars
            users_db.update({uid: req.params.id}, {'$set':{'apikey': apikey}}, function(err, data){
                res.send({'apikey': apikey});
                res.end();
            });
        });
    });
});


router.put('/user/:id/subscribe', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && ! GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }
        if(user.email == undefined || user.email == ''){
            res.send({'subscribed': false});
            res.end();
        } else {
            notif.add(user.email, function() {
                res.send({'subscribed': true});
                res.end();
            });
        }
    });
});

router.put('/user/:id/unsubscribe', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && ! GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }
        if(user.email == undefined || user.email == ''){
            res.send({'unsubscribed': false});
            res.end();
        } else {
            notif.remove(user.email, function() {
                res.send({'unsubscribed': true});
                res.end();
            });
        }
    });
});


router.get('/user/:id/subscribed', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }
        if(user.email == undefined || user.email == ''){
            res.send({'subscribed': false});
            res.end();
        } else {
            notif.subscribed(user.email, function(is_subscribed) {
                res.send({'subscribed': is_subscribed});
                res.end();
            });
        }
    });
});

router.get('/group/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
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
        users_db.find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}, function(err, users_in_group){
            res.send(users_in_group);
            res.end();
        });
    });
});

router.delete_group = function(group, admin_user_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        // eslint-disable-next-line no-unused-vars
        groups_db.remove({'name': group.name}, function(err){
            var fid = new Date().getTime();
            // eslint-disable-next-line no-unused-vars
            goldap.delete_group(group, fid, function(err){
                filer.user_delete_group(group, fid)
                    .then(
                        created_file => {
                            logger.info('File Created: ', created_file);
                        })
                    .catch(error => { // reject()
                        logger.error('Delete Group Failed for: ' + group.name, error);
                        return;
                    });

                group.fid = fid;
                events_db.insert({'owner': admin_user_id, 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update']}, function(){});
                utils.freeGroupId(group.gid).then(function(){
                    resolve(true);
                });

            });
        });
    });
};

router.clear_user_groups = function(user, admin_user_id){
    var allgroups = user.secondarygroups;
    allgroups.push(user.group);
    for(var i=0;i < allgroups.length;i++){
        groups_db.findOne({name: allgroups[i]}, function(err, group){
            if(group){
                users_db.find({'$or': [{'secondarygroups': group.name}, {'group': group.name}]}, function(err, users_in_group){
                    if(users_in_group && users_in_group.length == 0){
                        router.delete_group(group, admin_user_id);
                    }
                });
            }
        });
    }
};



router.delete('/group/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
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
        groups_db.findOne({name: req.params.id}, function(err, group){
            if(err || !group) {
                res.status(403).send('Group does not exist');
                return;
            }
            users_db.find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}, function(err, users_in_group){
                if(users_in_group && users_in_group.length > 0){
                    res.status(403).send('Group has some users, cannot delete it');
                    return;
                }
                router.delete_group(group, user.uid).then(function(){
                    res.send({'msg': 'group ' + req.params.id + ' deleted'});
                    res.end();
                });
            });
        });
    });
});


router.put('/group/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
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
        var owner = req.body.owner;
        users_db.findOne({uid: owner}, function(err, user){
            if(!user || err) {
                res.status(404).send('User does not exist');
                res.end();
                return;
            }
            groups_db.findOne({name: req.params.id}, function(err, group){
                if(! group) {
                    res.status(404).send('Group does not exist');
                    return;
                }
                events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'group owner modification ' + group.name + ' to ' +owner, 'logs': []}, function(){});
                groups_db.update({name: group.name}, {'$set':{'owner': owner}}, function(err, data){
                    res.send(data);
                    res.end();
                });
            });
        });
    });
});

router.post('/group/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
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
        var owner = req.body.owner;
        users_db.findOne({uid: owner}, function(err, user){
            if(!user || err) {
                res.status(404).send('Owner user does not exist');
                res.end();
                return;
            }
            groups_db.findOne({name: new RegExp('^' + req.params.id + '$', 'i')}, function(err, group){
                if(group) {
                    res.status(403).send('Group already exists');
                    return;
                }

                utils.getGroupAvailableId().then(function (mingid) {
                    var fid = new Date().getTime();
                    group = {name: req.params.id, gid: mingid, owner: owner};
                    // eslint-disable-next-line no-unused-vars
                    groups_db.insert(group, function(err){
                        // eslint-disable-next-line no-unused-vars
                        goldap.add_group(group, fid, function(err){
                            filer.user_add_group(group, fid)
                                .then(
                                    created_file => {
                                        logger.info('File Created: ', created_file);
                                    })
                                .catch(error => { // reject()
                                    logger.error('Add Group Failed for: ' + group.name, error);
                                    res.status(500).send('Add Group Failed');
                                    return;
                                });

                            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'create group ' + req.params.id , 'logs': [group.name + '.' + fid + '.update']}, function(){});

                            group.fid = fid;
                            res.send(group);
                            res.end();
                            return;
                        });
                    });
                });
            });
        });
    });
});

router.get('/ip', function(req, res) {

    var ip = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    //var ip_info = get_ip(req);
    res.json({ip: ip});
});

router.get('/group', function(req, res){
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
        groups_db.find({}, function(err, groups){
            res.send(groups);
            return;
        });
    });
});

router.post('/message', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    if(! notif.mailSet()){
        res.status(403).send('Mail provider is not set');
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
        let message = req.body.message;
        let html_message = req.body.message;

        if(req.body.input === 'Markdown'){
            html_message = markdown.toHTML(req.body.message);
            message =  htmlToText.fromString(html_message);
        } else if (req.body.input === 'HTML'){
            message =  htmlToText.fromString(html_message);
        }
        let mailOptions = {
            //origin: MAIL_CONFIG.origin,
            origin: req.body.from,
            subject: req.body.subject,
            message: message,
            html_message: html_message
        };
        // eslint-disable-next-line no-unused-vars
        notif.sendList(req.body.list, mailOptions, function(err, response) {
            res.send('');
            return;
        });
    });
});

// Get users listing - for admin
router.get('/user', function(req, res) {
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
        users_db.find({}, function(err, users){
            res.json(users);
        });
    });


});


router.post('/user/:id/group/:group', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        var uid = req.params.id;
        var secgroup = req.params.group;
        users_db.findOne({uid: uid}, function(err, user){
            if(err || user == null){
                res.status(404).send('User not found');
                return;
            }
            if(secgroup == user.group) {
                res.send({message: 'Group is user main\'s group: '+user.group});
                res.end();
                return;
            }
            for(var g=0;g < user.secondarygroups.length;g++){
                if(secgroup == user.secondarygroups[g]) {
                    res.send({message: 'group is already set'});
                    res.end();
                    return;
                }
            }
            user.secondarygroups.push(secgroup);
            var fid = new Date().getTime();
            // Now add group
            goldap.change_user_groups(user, [secgroup], [], fid, function() {
                users_db.update({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}}, function(err){
                    if(err){
                        res.send({message: 'Could not update user'});
                        res.end();
                        return;
                    }

                    filer.user_change_group(user, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                            })
                        .catch(error => { // reject()
                            logger.error('Group Change Failed for: ' + user.uid, error);
                            res.status(500).send('Change Group Failed');
                            return;
                        });

                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'add user ' + req.params.id + ' to secondary  group ' + req.params.group , 'logs': [user.uid + '.' + fid + '.update']}, function(){});
                    res.send({message: 'User added to group', fid: fid});
                    res.end();
                    return;
                });

            });
        });
    });

});

router.delete('/user/:id/group/:group', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        let uid = req.params.id;
        let secgroup = req.params.group;
        users_db.findOne({uid: uid}, function(err, user){
            if(secgroup == user.group) {
                res.send({message: 'Group is user main\'s group: '+user.group});
                res.end();
                return;
            }
            var present = false;
            var newgroup = [];
            for(var g=0;g < user.secondarygroups.length;g++){
                if(secgroup == user.secondarygroups[g]) {
                    present = true;
                }
                else {
                    newgroup.push(user.secondarygroups[g]);
                }
            }
            if(! present) {
                res.send({message: 'group is not set'});
                res.end();
                return;
            }
            user.secondarygroups = newgroup;
            var fid = new Date().getTime();
            // Now add group
            goldap.change_user_groups(user, [], [secgroup], fid, function() {
                users_db.update({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}}, function(err){
                    if(err){
                        res.send({message: 'Could not update user'});
                        res.end();
                        return;
                    }

                    filer.user_change_group(user, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                            })
                        .catch(error => { // reject()
                            logger.error('Group Change Failed for: ' + user.uid, error);
                            res.status(500).send('Change Group Failed');
                            return;
                        });

                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.params.id + ' from secondary  group ' + req.params.group , 'logs': [user.uid + '.' + fid + '.update']}, function(){});
                    users_db.find({'$or': [{'secondarygroups': secgroup}, {'group': secgroup}]}, function(err, users_in_group){
                        if(users_in_group && users_in_group.length > 0){
                            res.send({message: 'User removed from group', fid: fid});
                            res.end();
                            return;
                        }
                        // If group is empty, delete it
                        groups_db.findOne({name: secgroup}, function(err, group){
                            if(err || !group) {
                                res.send({message: 'User removed from group', fid: fid});
                                res.end();
                                return;
                            }
                            router.delete_group(group, session_user.uid).then(function(){
                                res.send({message: 'User removed from group. Empty group ' + secgroup + ' was deleted'});
                                res.end();
                                return;
                            });
                        });
                    });
                });
            });
        });
    });
});

router.delete_user = function(user, action_owner_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
            users_db.remove({_id: user._id}).then(function(){
                events_db.insert(
                    {
                        'owner': action_owner_id,
                        'date': new Date().getTime(),
                        'action': 'delete user ' + user.uid ,
                        'logs': []
                    }
                ).then(function(){
                    return utils.freeUserId(user.uidnumber);
                }).then(function(){
                    resolve(true);
                });
                router.clear_user_groups(user, action_owner_id);
            });
        }
        else {
            var fid = new Date().getTime();
            // Remove user from groups
            var allgroups = user.secondarygroups;
            allgroups.push(user.group);
            goldap.change_user_groups(user, [], allgroups, fid, function() {
                users_db.remove({_id: user._id}, function(err){
                    if(err){
                        resolve(false);
                        return;
                    }

                    filer.user_delete_user(user, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                            })
                        .catch(error => { // reject()
                            logger.error('Delete User Failed for: ' + user.uid, error);
                            return;
                        });

                    router.clear_user_groups(user, action_owner_id);
                    let msg_activ ='User ' + user.uid + ' has been deleted by ' + action_owner_id;
                    let msg_activ_html = msg_activ;
                    let mailOptions = {
                        origin: MAIL_CONFIG.origin, // sender address
                        destinations:  [GENERAL_CONFIG.accounts], // list of receivers
                        subject: GENERAL_CONFIG.name + ' account deletion: ' +user.uid, // Subject line
                        message: msg_activ, // plaintext body
                        html_message: msg_activ_html // html body
                    };
                    events_db.insert({
                        'owner': action_owner_id,
                        'date': new Date().getTime(),
                        'action': 'delete user ' + user.uid ,
                        'logs': [user.uid + '.' + fid + '.update']
                    })
                        .then(function(){
                            // Call remove method of plugins if defined
                            let plugin_call = function(plugin_info, userId, user, adminId){
                                // eslint-disable-next-line no-unused-vars
                                return new Promise(function (resolve, reject){
                                    if(plugins_modules[plugin_info.name].remove === undefined) {
                                        resolve(true);
                                    }
                                    plugins_modules[plugin_info.name].remove(userId, user, adminId).then(function(){
                                        resolve(true);
                                    });
                                });
                            };
                            return Promise.all(plugins_info.map(function(plugin_info){
                                return plugin_call(plugin_info, user.uid, user, action_owner_id);
                            }));
                        })
                        .then(function(){
                            return utils.freeUserId(user.uidnumber);
                        })
                        .then(function(){
                            if(notif.mailSet()) {
                                // eslint-disable-next-line no-unused-vars
                                notif.sendUser(mailOptions, function(error, response){
                                    resolve(true);
                                });
                            }
                            else {
                                resolve(true);
                            }
                        });
                });
            });
        }
    });
};

router.delete('/user/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }

        var uid = req.params.id;
        users_db.findOne({uid: uid}, function(err, user){
            if(err) {
                res.send({message: 'User not found ' + uid});
                res.end();
                return;
            }
            if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
                router.delete_user(user, session_user.uid).then(function(){
                    res.send({message: 'User deleted'});
                    res.end();
                    return;
                });

            }
            else {
                // Must check if user has databases and sites
                // Do not remove in this case, owners must be changed before
                databases_db.find({owner: uid}, function(err, databases){
                    if(databases && databases.length>0) {
                        res.send({message: 'User owns some databases, please change owner first!'});
                        res.end();
                        return;
                    }
                    web_db.find({owner: uid}, function(err, websites){
                        if(websites && websites.length>0) {
                            res.send({message: 'User owns some web sites, please change owner first!'});
                            res.end();
                            return;
                        }
                        router.delete_user(user, session_user.uid).then(function(){
                            res.send({message: 'User deleted'});
                            res.end();
                            return;
                        });
                    });
                });
            }
        });

    });

});

// activate user
router.get('/user/:id/activate', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }

    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(err || session_user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }

        users_db.findOne({uid: req.params.id}, function(err, user){
            if(!user) {
                res.status(403).send('User does not exist');
                res.end();
                return;
            }
            if(user.maingroup == undefined || user.group == undefined) {
                res.status(403).send('Group or main group directory are not set');
                res.end();
                return;
            }
            user.password = Math.random().toString(36).slice(-10);
            //var minuid = 1000;
            //var mingid = 1000;
            utils.getUserAvailableId().then(function (minuid) {
                //users_db.find({}, { limit: 1 , sort: { uidnumber: -1 }}, function(err, data){
                //if(!err && data && data.length>0){
                //  minuid = data[0].uidnumber+1;
                //}
                groups_db.findOne({'name': user.group}, function(err, data){
                    if(err || data === undefined || data === null) {
                        res.status(403).send('Group '+user.group+' does not exist, please create it first');
                        res.end();
                        return;
                    }

                    user.uidnumber = minuid;
                    user.gidnumber = data.gid;
                    user.home = get_user_home(user);
                    var fid = new Date().getTime();
                    goldap.add(user, fid, function(err) {
                        if(!err){
                            users_db.update({uid: req.params.id},{'$set': {status: STATUS_ACTIVE, uidnumber: minuid, gidnumber: user.gidnumber, expiration: new Date().getTime() + 1000*3600*24*user.duration}, '$push': { history: {action: 'validation', date: new Date().getTime()}} }, function(){

                                filer.user_add_user(user, fid)
                                    .then(
                                        created_file => {
                                            logger.info('File Created: ', created_file);
                                        })
                                    .catch(error => { // reject()
                                        logger.error('Add User Failed for: ' + user.uid, error);
                                        res.status(500).send('Add User Failed');
                                        return;
                                    });


                                notif.add(user.email, function(){
                                    let msg_activ = CONFIG.message.activation.join('\n').replace(/#UID#/g, user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '\n' + CONFIG.message.footer.join('\n');
                                    let msg_activ_html = CONFIG.message.activation_html.join('').replace(/#UID#/g, user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '<br/>'+CONFIG.message.footer.join('<br/>');
                                    let mailOptions = {
                                        origin: MAIL_CONFIG.origin, // sender address
                                        destinations: [user.email], // list of receivers
                                        subject: GENERAL_CONFIG.name + ' account activation', // Subject line
                                        message: msg_activ, // plaintext body
                                        html_message: msg_activ_html // html body
                                    };
                                    events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'activate user ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']}, function(){});

                                    let plugin_call = function(plugin_info, userId, data, adminId){
                                        // eslint-disable-next-line no-unused-vars
                                        return new Promise(function (resolve, reject){
                                            plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                                resolve(true);
                                            });
                                        });
                                    };
                                    Promise.all(plugins_info.map(function(plugin_info){
                                        return plugin_call(plugin_info, user.uid, user, session_user.uid);
                                    // eslint-disable-next-line no-unused-vars
                                    })).then(function(results){
                                        return send_notif(mailOptions, fid, []);
                                    }, function(err){
                                        return send_notif(mailOptions, fid, err);
                                    }).then(function(errs){
                                        res.send({msg: 'Activation in progress', fid: fid, error: errs});
                                        res.end();
                                        return;
                                    });
                                });
                            });
                        }
                        else {
                            res.send({msg: err});
                        }
                    });
                });
            });
        });
    });
});

// Get user - for logged user or admin
router.get('/user/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized, need to login first');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){

        users_db.findOne({uid: req.params.id}, function(err, user){
            if(err){
                res.status(404).send('User not found ' + err);
                return;
            }
            if(user.is_fake===undefined) {
                user.is_fake = false;
            }
            if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
                user.is_admin = true;
            }
            else {
                user.is_admin = false;
            }
            user.quota = [];
            for(var k in GENERAL_CONFIG.quota) {
                user.quota.push(k);
            }

            if(session_user._id.str == user._id.str || GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0){
                res.json(user);
                return;
            }
            else {
                res.status(401).send('Not authorized to access this user info');
                return;
            }

        });

    });
});

// Registration mail confirmation
router.get('/user/:id/confirm', function(req, res) {
    var uid = req.params.id;
    var regkey = req.query.regkey;
    if(! utils.sanitizeAll([uid])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({uid: uid}, function(err, user) {
        if(! user) {
            res.status(401).send('Invalid user');
            return;
        }
        else {
            if(user.regkey == regkey) {
                //if(user.status == STATUS_PENDING_APPROVAL) {
                if(user.status != STATUS_PENDING_EMAIL) {
                    // Already pending or active
                    res.redirect(GENERAL_CONFIG.url+'/manager2/pending');
                    res.end();
                    return;
                }
                var account_event = {action: 'email_confirm', date: new Date().getTime()};
                users_db.update(
                    { _id: user._id},
                    {
                        $set: {status: STATUS_PENDING_APPROVAL},
                        $push: {history: account_event}
                    }, function() {});
                let mailOptions = {
                    origin: MAIL_CONFIG.origin, // sender address
                    destinations: [GENERAL_CONFIG.accounts], // list of receivers
                    subject: GENERAL_CONFIG.name + ' account registration: '+uid, // Subject line
                    message: 'New account registration waiting for approval: '+uid, // plaintext body
                    html_message: 'New account registration waiting for approval: '+uid // html body
                };
                events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user confirmed email:' + req.params.id , 'logs': []}, function(){});
                if(notif.mailSet()) {
                    // eslint-disable-next-line no-unused-vars
                    notif.sendUser(mailOptions, function(error, response){
                        if(error){
                            logger.error(error);
                        }
                        res.redirect(GENERAL_CONFIG.url+'/manager2/pending');
                        res.end();
                        return;
                    });
                }
                else {
                    res.redirect(GENERAL_CONFIG.url+'/manager2/pending');
                    res.end();
                }
            }
            else {
                res.status(401).send('Invalid registration key');
                return;
            }
        }
    });
});



// Register
router.post('/user/:id', function(req, res) {
    logger.info('New register request for '+req.params.id);
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    /*
      if(req.body.ip.split('.').length != 4) {
      res.send({'status': 1, 'msg': 'invalid ip address format'});
      return;
      }*/
    if(req.body.group=='' || req.body.group==null || req.body.group==undefined) {
        res.send({'status': 1, 'msg': 'Missing field: team'});
        return;
    }
    if (!req.body.group.match(/^[0-9a-z_]+$/)) {
        res.send({'status': 1, 'msg': 'Group/Team name must be alphanumeric and lowercase [0-9a-z_]'});
        res.end();
        return;
    }

    if(req.body.lab=='' || req.body.lab==null || req.body.lab==undefined) {
        res.send({'status': 1, 'msg': 'Missing field: lab'});
        return;
    }
    if(req.body.address=='' || req.body.address==null || req.body.address==undefined) {
        res.send({'status': 1, 'msg': 'Missing field: address'});
        return;
    }

    if(req.body.responsible=='' || req.body.responsible==null || req.body.responsible==undefined) {
        res.send({'status': 1, 'msg': 'Missing field: Responsible/Manager'});
        return;
    }
    if(!req.params.id.match(/^[0-9a-z]+$/)){
        res.send({'status': 1, 'msg': 'invalid data identifier, numeric and lowercase letters only'});
        return;
    }

    if (req.params.id.length > 12) {
        res.send({'status': 1, 'msg': 'user id too long, must be < 12 characters'});
        res.end();
        return;
    }

    if(req.body.why=='' || req.body.why==null || req.body.why==undefined) {
        res.send({'status': 1, 'msg': 'Missing field: Why do you need an account'});
        return;
    }

    if(!validator.validate(req.body.email)) {
        res.send({'status': 1, 'msg': 'Invalid email format'});
        return;
    }

    users_db.findOne({email: req.body.email, is_fake: false}, function(err, user_email){
        if(user_email){
            res.send({'status': 1, 'msg': 'User email already exists'});
            return;
        }

        users_db.findOne({uid: req.params.id}, function(err, userexists){
            if(userexists){
                res.send({'status': 1, 'msg': 'User id already exists'});
                return;
            }

            let regkey = Math.random().toString(36).substring(7);
            let default_main_group = GENERAL_CONFIG.default_main_group || '';
            let user = {
                status: STATUS_PENDING_EMAIL,
                uid: req.params.id,
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                email: req.body.email,
                address: req.body.address,
                lab: req.body.lab,
                responsible: req.body.responsible,
                group: req.body.group,
                secondarygroups: [],
                maingroup: default_main_group,
                home: '',
                why: req.body.why,
                ip: req.body.ip,
                regkey: regkey,
                is_internal: false,
                is_fake: false,
                uidnumber: -1,
                gidnumber: -1,
                cloud: false,
                duration: req.body.duration,
                expiration: new Date().getTime() + 1000*3600*24*req.body.duration,
                loginShell: '/bin/bash',
                history: [{action: 'register', date: new Date().getTime()}]
            };
            // user[CONFIG.general.internal_flag] = false,
            user.home = get_user_home(user);

            events_db.insert({'owner': req.params.id, 'date': new Date().getTime(), 'action': 'user registration ' + req.params.id , 'logs': []}, function(){});

            let uid = req.params.id;
            users_db.insert(user);
            let link = GENERAL_CONFIG.url +
                encodeURI('/user/'+uid+'/confirm?regkey='+regkey);
            let msg_activ = CONFIG.message.emailconfirmation.join('\n').replace('#LINK#', link).replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '\n' + CONFIG.message.footer.join('\n');
            let msg_activ_html = CONFIG.message.emailconfirmationhtml.join('').replace('#LINK#', '<a href="'+link+'">'+link+'</a>').replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '<br/>' + CONFIG.message.footer.join('<br/>');
            let mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [user.email], // list of receivers
                subject: GENERAL_CONFIG.name + ' account registration', // Subject line
                message: msg_activ,
                html_message: msg_activ_html
            };
            if(notif.mailSet()) {
                // eslint-disable-next-line no-unused-vars
                notif.sendUser(mailOptions, function(error, response){
                    if(error){
                        logger.error(error);
                    }
                    res.send({'status': 0, 'msg': 'A confirmation email has been sent, please check your mailbox to validate your account creation. Once validated, the platform team will analyse your request and validate it.'});
                    res.end();
                    return;
                });
            }
            else {
                res.send({'status': 0, 'msg': 'Could not send an email, please contact the support.'});
                res.end();
                return;
            }

        });
    });
});

router.get('/user/:id/expire', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        users_db.findOne({uid: req.params.id}, function(err, user){
            if(err){
                res.status(404).send('User not found');
                return;
            }
            if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
                session_user.is_admin = true;
            }
            else {
                session_user.is_admin = false;
            }
            if(session_user.is_admin){
                var new_password = Math.random().toString(36).slice(-10);
                user.password = new_password;
                var fid = new Date().getTime();
                goldap.reset_password(user, fid, function(err) {
                    if(err){
                        res.send({message: 'Error during operation'});
                        return;
                    }
                    else {
                        user.history.push({'action': 'expire', date: new Date().getTime()});
                        // eslint-disable-next-line no-unused-vars
                        users_db.update({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}}, function(err){

                            filer.user_expire_user(user, fid)
                                .then(
                                    created_file => {
                                        logger.info('File Created: ', created_file);
                                    })
                                .catch(error => { // reject()
                                    logger.error('Expire User Failed for: ' + user.uid, error);
                                    res.status(500).send('Expire User Failed');
                                    return;
                                });
                            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user expiration:' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']}, function(){});

                            // Now remove from mailing list
                            try {
                                // eslint-disable-next-line no-unused-vars
                                notif.remove(user.email, function(err){
                                    var plugin_call = function(plugin_info, userId, user, adminId){
                                        // eslint-disable-next-line no-unused-vars
                                        return new Promise(function (resolve, reject){
                                            plugins_modules[plugin_info.name].deactivate(userId, user, adminId).then(function(){
                                                resolve(true);
                                            });
                                        });
                                    };
                                    Promise.all(plugins_info.map(function(plugin_info){
                                        return plugin_call(plugin_info, user.uid, user, session_user.uid);
                                    // eslint-disable-next-line no-unused-vars
                                    })).then(function(data){
                                        res.send({message: 'Operation in progress', fid: fid, error: []});
                                        res.end();
                                        return;
                                    }, function(errs){
                                        res.send({message: 'Operation in progress', fid: fid, error: errs});
                                        res.end();
                                    });
                                });
                            }
                            catch(error) {
                                res.send({message: 'Operation in progress, user not in mailing list', fid: fid, error: error});
                                res.end();
                                return;
                            }
                            return;
                        });
                    }
                });
            }
            else {
                res.status(401).send('Not authorized');
                return;
            }
        });
    });

});
router.post('/user/:id/passwordreset', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(session_user.uid != req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0) {
            res.send({message: 'Not authorized'});
            return;
        }
        users_db.findOne({uid: req.params.id}, function(err, user){
            if(err || !user) {
                res.status(404).send('User does not exist:'+req.params.id);
                res.end();
                return;
            }
            if(user.status != STATUS_ACTIVE){
                res.status(401).send('Your account is not active');
                res.end();
                return;
            }
            user.password=req.body.password;
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password update request', 'logs': []}, function(){});
            var fid = new Date().getTime();
            goldap.reset_password(user, fid, function(err) {
                if(err){
                    res.send({message: 'Error during operation'});
                    return;
                }
                else {

                    filer.user_reset_password(user, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                            })
                        .catch(error => { // reject()
                            logger.error('Reset Password Failed for: ' + user.uid, error);
                            res.status(500).send('Reset Password Failed');
                            return;
                        });

                    res.send({message:'Password updated'});
                    return;
                }
            });

        });
    });
});
//app.get('/user/:id/passwordreset', users);
router.get('/user/:id/passwordreset', function(req, res){
    var key = Math.random().toString(36).substring(7);
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(err || !user) {
            res.status(404).send('User does not exist');
            res.end();
            return;
        }
        if(user.status != STATUS_ACTIVE){
            res.status(401).send('Your account is not active');
            res.end();
            return;
        }
        users_db.update({uid: req.params.id},{'$set': {regkey: key}}, function(err){
            if(err) {
                res.status(404).send('User cannot be updated');
                res.end();
                return;
            }
            user.password='';
            // Now send email
            let link = CONFIG.general.url +
                encodeURI('/user/'+req.params.id+'/passwordreset/'+key);
            let html_link = `<a href="${link}">${link}</a>`;
            let msg = CONFIG.message.password_reset_request.join('\n').replace('#UID#', user.uid) + '\n' + link + '\n' + CONFIG.message.footer.join('\n');
            let html_msg = CONFIG.message.password_reset_request_html.join('').replace('#UID#', user.uid).replace('#LINK#', html_link)+CONFIG.message.footer.join('<br/>');
            let mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [user.email], // list of receivers
                subject: GENERAL_CONFIG.name + ' account password reset request',
                message: msg,
                html_message: html_msg
            };
            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password reset request', 'logs': []}, function(){});

            if(notif.mailSet()) {
                // eslint-disable-next-line no-unused-vars
                notif.sendUser(mailOptions, function(error, response){
                    if(error){
                        logger.error(error);
                    }
                    res.send({message: 'Password reset requested, check your inbox for instructions to reset your password.'});
                });
            }
            else {
                res.send({message: 'Could not send an email, please contact the support'});
            }
        });

    });
});

router.get('/user/:id/passwordreset/:key', function(req, res){
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(err) {
            res.status(404).send('User does not exist');
            res.end();
            return;
        }
        if(req.params.key == user.regkey) {
            // reset the password
            var new_password = Math.random().toString(36).slice(-10);
            user.password = new_password;
            var fid = new Date().getTime();
            goldap.reset_password(user, fid, function(err) {
                if(err){
                    res.send({message: 'Error during operation'});
                    return;
                }
                else {
                    user.history.push({'action': 'password reset', date: new Date().getTime()});
                    users_db.update({uid: user.uid},{'$set': {history: user.history}}, function(){
                        // Todo: find if we need another template (or not)
                        filer.user_reset_password(user, fid)
                            .then(
                                created_file => {
                                    logger.info('File Created: ', created_file);
                                })
                            .catch(error => { // reject()
                                logger.error('Reset Password Failed for: ' + user.uid, error);
                                res.status(500).send('Reset Password Failed');
                                return;
                            });

                        // Now send email
                        let msg = CONFIG.message.password_reset.join('\n').replace('#UID#', user.uid).replace('#PASSWORD#', user.password) + '\n' + CONFIG.message.footer.join('\n');
                        let msg_html = CONFIG.message.password_reset_html.join('').replace('#UID#', user.uid).replace('#PASSWORD#', user.password)+'<br/>'+CONFIG.message.footer.join('<br/>');
                        let mailOptions = {
                            origin: MAIL_CONFIG.origin, // sender address
                            destinations: [user.email], // list of receivers
                            subject: GENERAL_CONFIG.name + ' account password reset',
                            message: msg,
                            html_message: msg_html
                        };
                        events_db.insert({'owner': user.uid,'date': new Date().getTime(), 'action': 'user password ' + req.params.id + ' reset confirmation', 'logs': [user.uid + '.' + fid + '.update']}, function(){});

                        if(notif.mailSet()) {
                            // eslint-disable-next-line no-unused-vars
                            notif.sendUser(mailOptions, function(error, response){
                                if(error){
                                    logger.error(error);
                                }
                                res.redirect(GENERAL_CONFIG.url+'/manager2/passwordresetconfirm');
                                res.end();
                            });
                        }
                        else {
                            res.send({message: 'Could not send an email, please contact the support'});
                        }
                    });
                }
            });

        }
        else {
            res.status(401).send('Invalid authorization key.');
            return;
        }
    });
});

/**
 * Extend validity period if active
 */
router.get('/user/:id/renew/:regkey', function(req, res){
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({uid: req.params.id}, function(err, user){
        if(err){
            res.status(404).send('User not found');
            return;
        }
        if(user.status != STATUS_ACTIVE) {
            res.status(401).send('Not authorized');
            return;
        }
        var regkey = req.params.regkey;
        if(user.regkey == regkey) {
            user.history.push({'action': 'extend validity period', date: new Date().getTime()});
            var expiration = new Date().getTime() + 1000*3600*24*user.duration;
            // eslint-disable-next-line no-unused-vars
            users_db.update({uid: user.uid},{'$set': {expiration: expiration, history: user.history}}, function(err){
                events_db.insert({'owner': user.uid,'date': new Date().getTime(), 'action': 'Extend validity period: ' + req.params.id , 'logs': []}, function(){});
                res.redirect(GENERAL_CONFIG.url+'/manager2/user/' + user.uid + '/renew/' + regkey);
                res.end();
                // res.send({message: 'Account validity period extended', expiration: expiration});
                return;
            });
        }
        else {
            res.status(401).send('Not authorized');
            return;
        }
    });
});

router.get('/user/:id/renew', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        users_db.findOne({uid: req.params.id}, function(err, user){
            if(err){
                res.status(404).send('User not found');
                return;
            }
            if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
                session_user.is_admin = true;
            }
            else {
                session_user.is_admin = false;
            }
            if(session_user.is_admin){
                var new_password = Math.random().toString(36).slice(-10);
                user.password = new_password;
                var fid = new Date().getTime();
                goldap.reset_password(user, fid, function(err) {
                    if(err){
                        res.send({message: 'Error during operation'});
                        return;
                    }
                    else {
                        user.history.push({'action': 'reactivate', date: new Date().getTime()});
                        // eslint-disable-next-line no-unused-vars
                        users_db.update({uid: user.uid},{'$set': {status: STATUS_ACTIVE, expiration: (new Date().getTime() + 1000*3600*24*user.duration), history: user.history}}, function(err){
                            filer.user_renew_user(user, fid)
                                .then(
                                    created_file => {
                                        logger.info('File Created: ', created_file);
                                    })
                                .catch(error => { // reject()
                                    logger.error('Renew User Failed for: ' + user.uid, error);
                                    res.status(500).send('Renew User Failed');
                                    return;
                                });

                            events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Reactivate user ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']}, function(){});
                            notif.add(user.email, function(){
                                let msg_activ = CONFIG.message.reactivation.join('\n').replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '\n' + CONFIG.message.footer.join('\n');
                                let msg_activ_html = CONFIG.message.reactivation_html.join('').replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip) + '<br/>' + CONFIG.message.footer.join('<br/>');

                                var mailOptions = {
                                    origin: MAIL_CONFIG.origin, // sender address
                                    destinations: [user.email], // list of receivers
                                    subject: GENERAL_CONFIG.name + ' account reactivation', // Subject line
                                    message: msg_activ, // plaintext body
                                    html_message: msg_activ_html // html body
                                };
                                var plugin_call = function(plugin_info, userId, data, adminId){
                                    // eslint-disable-next-line no-unused-vars
                                    return new Promise(function (resolve, reject){
                                        plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                            resolve(true);
                                        });
                                    });
                                };
                                Promise.all(plugins_info.map(function(plugin_info){
                                    return plugin_call(plugin_info, user.uid, user, session_user.uid);
                                // eslint-disable-next-line no-unused-vars
                                })).then(function(results){
                                    return send_notif(mailOptions, fid, []);
                                }, function(err){
                                    return send_notif(mailOptions, fid, err);
                                }).then(function(errs){
                                    res.send({message: 'Activation in progress', fid: fid, error: errs});
                                    res.end();
                                    return;
                                });
                            });

                            return;
                        });
                    }
                });
            }
            else {
                res.status(401).send('Not authorized');
                return;
            }
        });
    });

});


router.put('/user/:id/ssh', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }

        users_db.findOne({uid: req.params.id}, function(err, user){
            // If not admin nor logged user
            if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
                res.status(401).send('Not authorized');
                return;
            }
            // Remove carriage returns if any
            // Escape some special chars for security
            user.ssh = user.ssh.replace(/[\n\r]+/g, '').replace(/(["'$`\\])/g,'\\$1');
            if (utils.sanitizeSSHKey(user.ssh) === undefined) {
                res.status(403).send('Invalid SSH Key');
                return;
            }
            if (utils.sanitizePath(user.home) === undefined) {
                res.status(403).send('Invalid home directory');
                return;
            }
            // Update SSH Key
            // eslint-disable-next-line no-unused-vars
            users_db.update({_id: user._id}, {'$set': {ssh: req.body.ssh}}, function(err){
                var fid = new Date().getTime();
                user.ssh = escapeshellarg(req.body.ssh);
                filer.user_add_ssh_key(user, fid)
                    .then(
                        created_file => {
                            logger.info('File Created: ', created_file);
                        }
                    )
                    .catch(error => { // reject()
                        logger.error('Add Ssh Key Failed for: ' + user.uid, error);
                        res.status(500).send('Ssh Key Failed');
                        return;
                    });

                events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'SSH key update: ' + req.params.id , 'logs': [ user.uid + '.' + fid + '.update']}, function(){});

                user.fid = fid;
                // user.ssh = req.body.ssh;
                res.send(user);
                res.end();
                return;

            });
        });
    });
});


router.get('/user/:id/usage', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    // eslint-disable-next-line no-unused-vars
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        let usage = JSON.parse(JSON.stringify(CONFIG.usage));
        let usages = [];
        for(var i=0;i<usage.length;i++){
            usage[i]['link'] = usage[i]['link'].replace('#USER#', req.params.id);
            usages.push(usage[i]);
        }
        res.send({'usages': usages});
        res.end();
        return;
    });
});

// Update user info
router.put('/user/:id', function(req, res) {

    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }

        users_db.findOne({uid: req.params.id}, function(err, user){
            if(err){
                res.status(401).send('Not authorized');
                return;
            }
            // If not admin nor logged user
            if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
                res.status(401).send('Not authorized');
                return;
            }

            user.firstname = req.body.firstname;
            user.lastname = req.body.lastname;
            user.oldemail = user.email;
            user.email = req.body.email;
            if(user.is_fake === undefined) {
                user.is_fake = false;
            }
            let userWasFake = user.is_fake;

            if(session_user.is_admin){
                user.is_fake = req.body.is_fake;
                if(req.body.is_trainer !== undefined ){
                    user.is_trainer = req.body.is_trainer;
                }
            }

            if(user.email == '' || user.firstname == '' || user.lastname == '') {
                if(! user.is_fake) {
                    res.status(403).send('Some mandatory fields are empty');
                    return;
                }
            }
            user.loginShell = req.body.loginShell.trim();
            user.address = req.body.address;
            user.lab = req.body.lab;
            user.responsible = req.body.responsible;
            user.why = req.body.why;
            user.duration = req.body.duration;

            user.history.push({'action': 'update info', date: new Date().getTime()});

            // Get group gid
            //groups_db.findOne({'name': user.group}, function(err, group){
            groups_db.findOne({'name': req.body.group}, function(err, group){
                if(err || group == null || group == undefined) {
                    res.status(403).send('Group ' + req.body.group + ' does not exist, please create it first');
                    return;
                }
                if(session_user.is_admin){
                    if(user.secondarygroups.indexOf(group.name) != -1) {
                        res.status(403).send('Group ' + req.body.group + ' is already a secondary group, please remove user from secondary group first!');
                        return;
                    }
                    user.oldgroup = user.group;
                    user.oldgidnumber = user.gidnumber;
                    user.oldmaingroup = user.maingroup;
                    user.oldhome = user.home;
                    user.group = req.body.group;
                    user.gidnumber = group.gid;
                    user.ip = req.body.ip;
                    user.is_internal = req.body.is_internal;
                    user.maingroup = req.body.maingroup;
                    user.home = get_user_home(user);
                    if(user.group == '' || user.group == null) {
                        res.status(403).send('Some mandatory fields are empty');
                        return;
                    }
                }

                if(user.status == STATUS_ACTIVE){

                    // eslint-disable-next-line no-unused-vars
                    users_db.update({_id: user._id}, user, function(err){
                        if(session_user.is_admin) {
                            user.is_admin = true;
                        }
                        var fid = new Date().getTime();
                        goldap.modify(user, fid, function(err){
                            if(err) {
                                res.status(403).send('Group '+user.group+' does not exist, please create it first');
                                return;
                            }

                            filer.user_modify_user(user, fid)
                                .then(
                                    created_file => {
                                        logger.info('File Created: ', created_file);

                                    })
                                .catch(error => { // reject()
                                    logger.error('Modify User Failed for: ' + user.uid, error);
                                    return;
                                });

                            if(session_user.is_admin && CONFIG.general.use_group_in_path) {
                                if(user.oldgroup != user.group || user.oldmaingroup != user.maingroup) {
                                    // If group modification, change home location
                                    events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'change group from ' + user.oldmaingroup + '/' + user.oldgroup + ' to ' + user.maingroup + '/' + user.group , 'logs': []}, function(){});
                                }
                            }

                            events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'User info modification: ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']}, function(){});
                            users_db.find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}, function(err, users_in_group){
                                if(users_in_group && users_in_group.length == 0){
                                    groups_db.findOne({name: user.oldgroup}, function(err, oldgroup){
                                        if(oldgroup){
                                            router.delete_group(oldgroup, session_user.uid);
                                        }
                                    });
                                }
                            });

                            user.fid = fid;
                            if(user.oldemail!=user.email && !user.is_fake) {
                                notif.modify(user.oldemail, user.email, function() {
                                    res.send(user);
                                });
                            } else if(userWasFake && !user.is_fake) {
                                notif.add(user.email, function() {
                                    res.send(user);
                                });
                            }else if (!userWasFake && user.is_fake) {
                                notif.remove(user.email, function(){
                                    res.send(user);
                                });
                            } else {
                                res.send(user);
                            }
                        });
                    });
                }
                else {
                    // eslint-disable-next-line no-unused-vars
                    users_db.update({_id: user._id}, user, function(err){
                        events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Update user info ' + req.params.id , 'logs': []}, function(){});
                        users_db.find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}, function(err, users_in_group){
                            if(users_in_group && users_in_group.length == 0){
                                groups_db.findOne({name: user.oldgroup}, function(err, oldgroup){
                                    if(oldgroup){
                                        router.delete_group(oldgroup, session_user.uid);
                                    }
                                });
                            }
                        });
                        user.fid = null;
                        res.send(user);
                    });
                }
            });
            // End group

        });

    });

});

router.get('/project/:id/users', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        users_db.find({'projects': req.params.id}, function(err, users_in_project){
            res.send(users_in_project);
            res.end();
        });
    });
});

router.post('/user/:id/project/:project', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send('Invalid parameters');
        return;
    }

    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            res.end();
            return;
        }
        let newproject = req.params.project;
        let uid = req.params.id;
        var fid = new Date().getTime();
        users_db.findOne({uid: uid}, function(err, user){
            if(!user || err) {
                res.status(404).send('User does not exist');
                res.end();
                return;
            }
            if (!user.projects){
                user.projects = [];
            }
            for(var g=0; g < user.projects.length; g++){
                if(newproject == user.projects[g]) {
                    res.send({message:'User is already in project : nothing was done.'});
                    res.end();
                    return;
                }
            }
            user.projects.push(newproject);
            users_db.update({_id: user._id}, {'$set': { projects: user.projects}}, function(err){
                if(err){
                    res.status(403).send('Could not update user');
                    res.end();
                    return;
                }

                filer.project_add_user_to_project({id: newproject}, user, fid)
                    .then(
                        created_file => {
                            logger.info('File Created: ', created_file);

                        })
                    .catch(error => { // reject()
                        logger.error('Add User to Project Failed for: ' + newproject, error);
                        res.status(500).send('Add Project Failed');
                        return;
                    });

                events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'add user ' + req.params.id + ' to project ' + newproject , 'logs': []}, function(){});
                res.send({message: 'User added to project', fid: fid});
                res.end();
                return;
            });
        });
    });
});

router.delete('/user/:id/project/:project', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            res.end();
            return;
        }
        let oldproject = req.params.project;
        let uid = req.params.id;
        var fid = new Date().getTime();
        users_db.findOne({uid: uid}, function(err, user){
            if(! user) {
                res.status(404).send('User ' + uid + ' not found');
                res.end();
                return;
            }
            projects_db.findOne({id:oldproject}, function(err, project){
                if(err){
                    logger.info(err);
                    res.status(500).send('Error, project not found');
                    res.end();
                    return;
                }
                if( project && uid === project.owner && ! req.query.force){
                    res.status(403).send('Cannot remove project owner. Please change the owner before deletion');
                    res.end();
                    return;
                }
                let tempprojects = [];
                for(var g=0; g < user.projects.length; g++){
                    if(oldproject != user.projects[g]) {
                        tempprojects.push(user.projects[g]);
                    }
                }
                users_db.update({_id: user._id}, {'$set': { projects: tempprojects}}, function(err){
                    if(err){
                        res.status(403).send('Could not update user');
                        res.end();
                        return;
                    }

                    filer.project_remove_user_from_project(project, user, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);

                            })
                        .catch(error => { // reject()
                            logger.error('Remove User from Project Failed for: ' + oldproject, error);
                            res.status(500).send('Remove from Project Failed');
                            return;
                        });


                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.params.id + ' from project ' + oldproject , 'logs': []}, function(){});
                    res.send({message: 'User removed from project', fid: fid});
                    res.end();
                    return;
                });
            });
        });
    });
});

router.get('/list/:list', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.list])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        var list_name = req.params.list;
        notif.getMembers(list_name, function(members) {
            res.send(members);
            return;
        });
    });
});


router.get('/lists', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        notif.getLists(function(listOfLists) {
            res.send(listOfLists);
            return;
        });
    });
});

module.exports = router;

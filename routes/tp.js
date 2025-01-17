var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs')
// var escapeshellarg = require('escapeshellarg')

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var plugins = CONFIG.plugins;

if (plugins === undefined) {
    plugins = [];
}

var plugins_modules = {};
var plugins_info = [];

for (var i = 0; i < plugins.length; i++) {
    if(plugins[i]['admin']) {
        continue;
    }
    plugins_modules[plugins[i].name] = require('../plugins/' + plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name});
}

// var cookieParser = require('cookie-parser')

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif_'+MAILER+'.js');
var fdbs = require('../routes/database.js');
var fwebs = require('../routes/web.js');
var fusers = require('../routes/users.js');

const filer = require('../routes/file.js');
var utils = require('../routes/utils.js');

// var get_ip = require('ipware')().get_ip;

var monk = require('monk');
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db);
var users_db = db.get('users');
var groups_db = db.get('groups');
var reservation_db = db.get('reservations');
var events_db = db.get('events');

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

var createExtraGroup = function (ownerName) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        // var mingid = 1000
        utils.getGroupAvailableId().then(function (mingid) {
            var fid = new Date().getTime();
            var group = { name: 'tp' + mingid, gid: mingid, owner: ownerName };
            // eslint-disable-next-line no-unused-vars
            groups_db.insert(group, function(err_insert) {
                // eslint-disable-next-line no-unused-vars
                goldap.add_group(group, fid, function(err_add_group) {
                    filer.user_add_group(group, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);
                            })
                        .catch(error => { // reject()
                            logger.error('Add Group Failed for: ' + group.name, error);
                        });
                    group.fid = fid;
                    resolve(group);
                    return;
                });
            });
        });
    });
};


var deleteExtraGroup = function (group) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (group === undefined || group === null) {
            resolve();
            return;
        }
        groups_db.findOne({'name': group.name}, function(err, group_to_remove){
            if(err || group_to_remove == null) {
                resolve();
                return;
            }
            groups_db.remove({ 'name': group.name }, function () {
                let fid = new Date().getTime();
                goldap.delete_group(group, fid, function () {
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
                    utils.freeGroupId(group.gid).then(function(){
                        events_db.insert({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update'] }, function(){});
                        resolve();
                        return;
                    });
                });
            });
        });
    });
};

var create_tp_users_db = function (owner, quantity, duration, end_date, userGroup) {
    // Duration in days
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('create_tp_users ', owner, quantity, duration);
        let minuid = 1000;

        let users = [];
        for(let i=0;i<quantity;i++){
            logger.debug('create user ', CONFIG.tp.prefix + minuid);
            let user = {
                status: STATUS_PENDING_APPROVAL,
                uid: CONFIG.tp.prefix + minuid,
                firstname: CONFIG.tp.prefix,
                lastname: minuid,
                email: CONFIG.tp.prefix + minuid + '@fake.' + CONFIG.tp.fake_mail_domain,
                address: '',
                lab: '',
                responsible: owner,
                group: userGroup.name,
                secondarygroups: [],
                maingroup: CONFIG.general.default_main_group,
                home: '',
                why: 'TP/Training',
                ip: '',
                regkey: '',
                is_internal: false,
                is_fake: true,
                uidnumber: minuid,
                gidnumber: userGroup.gid,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
                loginShell: '/bin/bash',
                history: []
            };
            user.home = fusers.user_home(user);
            users.push(user);
            minuid++;
        }
        Promise.all(users.map(function(user){
            logger.debug('map users to create_tp_user_db ', user);
            return create_tp_user_db(user);
        })).then(function(results){
            logger.debug('now activate users');
            return activate_tp_users(owner, results);
        }).then(function(activated_users){
            resolve(activated_users);
        });
    });
};

var create_tp_user_db = function (user) {
    return new Promise(function (resolve, reject){
        logger.debug('create_tp_user_db', user.uid);
        try {
            utils.getUserAvailableId().then(function (uid) {
                user.uid = CONFIG.tp.prefix + uid;
                user.lastname = uid;
                user.email = CONFIG.tp.prefix + uid + '@fake.' + CONFIG.tp.fake_mail_domain;
                user.uidnumber = uid;
                user.home = fusers.user_home(user);
                // eslint-disable-next-line no-unused-vars
                users_db.insert(user).then(function(data){
                    user.password = Math.random().toString(36).slice(-10);
                    resolve(user);
                });
            });
        }
        catch(exception){
            logger.error(exception);
            reject(exception);
        }
    });
};

var send_user_passwords = function(owner, from_date, to_date, users){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('send_user_passwords');
        let from = new Date(from_date);
        let to = new Date(to_date);
        let msg = 'TP account credentials from ' + from.toDateString() + ' to ' + to.toDateString() + '\n\n';
        let msg_html = '<h2>Date</h2>';
        msg_html += '<table border="0" cellpadding="0" cellspacing="15" align="left"><thead><tr><th align="left" valign="top">Start date</th><th align="left" valign="top">End date</th></tr></thead>';
        msg_html += '<tbody><tr><td align="left" valign="top">" + from.toDateString()+ "</td><td align="left" valign="top">" + to.toDateString()+ "</td></tr></tbody></table>';
        msg_html += '<p>Accounts will remain available for <b>" + CONFIG.tp.extra_expiration + " extra days </b>for data access</p>';
        msg_html += '<hr>';
        msg_html += '<h2>Credentials</h2>';
        msg_html += '<table border="0" cellpadding="0" cellspacing="15"><thead><tr><th align="left" valign="top">Login</th><th align="left" valign="top">Password</th><th>Fake email</th></tr></thead><tbody>';

        for(let i=0;i<users.length;i++){
            msg += users[i].uid + ' / ' + users[i].password + ', fake email: ' + users[i].email + '\n';
            msg_html += '<tr><td align="left" valign="top">' + users[i].uid + '</td><td align="left" valign="top">' + users[i].password + '</td><td align="left" valign="top">' + users[i].email + '</td></tr>';
        }
        msg_html += '</tbody></table>';
        msg += 'New TP group: ' + users[0].group + '\n';
        msg_html += '<hr><p>Users are in the group <strong>' + users[0].group + '</strong></p>';
        msg += 'Users can create an SSH key at ' + CONFIG.general.url + ' in SSH Keys section\n';
        msg_html += '<hr>';
        msg_html += '<h2>Access</h2>';
        msg_html += '<p>Users can create an SSH key at ' + CONFIG.general.url + ' in SSH Keys section</p>';
        msg += 'Accounts will remain available for ' + CONFIG.tp.extra_expiration + ' extra days for data access.\n\n';
        msg += 'In case of issue, you can contact us at ' + CONFIG.general.support + '\n\n';
        msg_html += '<hr>';
        msg_html += '<p>In case of issue, you can contact us at ' + CONFIG.general.support + '</p>';

        users_db.findOne({'uid': owner}).then(function(user_owner){
            if( notif.mailSet()){
                let mailOptions = {
                    origin: MAIL_CONFIG.origin, // sender address
                    destinations: [user_owner.email, CONFIG.general.accounts], // list of receivers
                    subject: '[TP accounts reservation] ' + owner,
                    message: msg,
                    html_message: msg_html
                };
                // eslint-disable-next-line no-unused-vars
                notif.sendUser(mailOptions, function(err, response) {
                    resolve(users);
                });
            }
        });
    });
};

var activate_tp_users = function(owner, users){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return activate_tp_user(user, owner);
        })).then(function(users){
            // logger.debug("activate_tp_users", users);
            resolve(users);
        });
    });
};

var delete_tp_user = function(user, admin_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('delete_tp_user', user.uid);
        try{
            fdbs.delete_dbs(user).then(function(db_res){
                return db_res;
            // eslint-disable-next-line no-unused-vars
            }).then(function(db_res){
                return fwebs.delete_webs(user);
            // eslint-disable-next-line no-unused-vars
            }).then(function(web_res){
                return fusers.delete_user(user, admin_id);
            }).then(function(){
                resolve(true);
            });

        }
        catch(exception){
            logger.error(exception);
            resolve(false);
        }
    });
};

router.delete_tp_users = function(users, group, admin_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return delete_tp_user(user, admin_id);
        })).then(function(users){
            logger.debug('deleted tp_users');
            deleteExtraGroup(group).then(function(){
                resolve(users);
            });
        });
    });

};

router.exec_tp_reservation = function(reservation_id){
    // Create users for reservation
    return new Promise(function (resolve, reject){
        reservation_db.findOne({'_id': reservation_id}).then(function(reservation){
            logger.debug('create a reservation group', reservation._id);
            createExtraGroup(reservation.owner).then(function(newGroup){
                logger.debug('create reservation accounts', reservation._id);
                create_tp_users_db(reservation.owner, reservation.quantity,Math.ceil((reservation.to-reservation.from)/(1000*3600*24)), reservation.to, newGroup).then(function(activated_users){
                    for(let i=0;i<activated_users.length;i++){
                        logger.debug('activated user ', activated_users[i].uid);
                        reservation.accounts.push(activated_users[i].uid);
                    }
                    try{
                        send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users).then(function(){
                            // eslint-disable-next-line no-unused-vars
                            reservation_db.update({'_id': reservation_id}, {'$set': {'accounts': reservation.accounts, 'group': newGroup}}).then(function(err){
                                logger.debug('reservation ', reservation);
                                resolve(reservation);
                            });
                        });
                    }
                    catch(exception){
                        logger.error(exception);
                        reject(exception);
                    }

                });
            });
        });
    });
};

var tp_reservation = function(userId, from_date, to_date, quantity, about){
    // Create a reservation
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){

        let reservation = {
            'owner': userId,
            'from': from_date,
            'to': to_date,
            'quantity': quantity,
            'accounts': [],
            'about': about,
            'created': false,
            'over': false
        };

        reservation_db.insert(reservation).then(function(reservation){
            logger.debug('reservation ', reservation);
            resolve(reservation);
        });
    });
};

var insert_ldap_user = function(user, fid){
    return new Promise(function (resolve, reject){
        logger.debug('prepare ldap scripts');
        goldap.add(user, fid, function(err) {
            if(err) {
                logger.error(err);
                reject(user);
            }
            logger.debug('switch to ACTIVE');
            // eslint-disable-next-line no-unused-vars
            users_db.update({uid: user.uid},{'$set': {status: STATUS_ACTIVE}}).then(function(data){});
            resolve(user);
        });
    });
};

var activate_tp_user = function(user, adminId){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': user.uid}, function(err, db_user){
            if(err || !db_user) {
                logger.error('failure:',err,db_user);
                reject(user);
                return;
            }
            logger.debug('activate', user.uid);
            let fid = new Date().getTime();
            insert_ldap_user(user, fid).then(function(user){

                filer.user_add_user(user, fid)
                    .then(
                        created_file => {
                            logger.info('File Created: ', created_file);
                        })
                    .catch(error => { // reject()
                        logger.error('Add User Failed for: ' + user.uid, error);


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
                    return plugin_call(plugin_info, user.uid, user, adminId);
                // eslint-disable-next-line no-unused-vars
                })).then(function(results){
                    resolve(user);
                });
            });
        });
    });
};

router.get('/tp', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }
        reservation_db.find({}, function(err, reservations){
            res.send(reservations);
            res.end();
        });
    });
});

router.post('/tp', function(req, res) {
    if(req.body.quantity<=0){
        res.status(403).send('Quantity must be >= 1');
        return;
    }
    if(req.body.about === undefined || req.body.about == ''){
        res.status(403).send('Tell us why you need some tp accounts');
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }

        let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
        if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
            res.status(403).send('Not authorized');
            return;
        }
        tp_reservation(user.uid, req.body.from, req.body.to, req.body.quantity, req.body.about).then(function(reservation){
            res.send({'reservation': reservation, 'msg': 'Reservation done'});
            res.end();
            return;
        });

    });

});

router.delete('/tp/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exist'});
            res.end();
            return;
        }

        let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
        if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
            res.status(403).send('Not authorized');
            return;
        }

        // add filter
        let filter = {};
        if(is_admin) {
            filter = {_id: req.params.id};
        }
        else{
            filter = {_id: req.params.id, owner: user.uid};
        }

        reservation_db.findOne(filter, function(err, reservation) {

            if(err){
                res.status(403).send({'msg': 'Not allowed to delete this reservation'});
                res.end();
                return;
            }

            if(reservation.over){
                res.status(403).send({'msg': 'Reservation is already closed'});
                res.end();
                return;
            }

            if(reservation.created){
                res.status(403).send({'msg': 'Reservation accounts already created, reservation will be closed after closing date'});
                res.end();
                return;
            }

            reservation_db.update({'_id': req.params.id},{'$set': {'over': true}}).then(function(){
                res.send({'msg': 'Reservation cancelled'});
                res.end();
                return;
            });
        });

    });

});



module.exports = router;

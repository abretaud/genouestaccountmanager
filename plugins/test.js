/* eslint-disable no-console */
//var CONFIG = require('config');
/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');
*/
//var Promise = require('promise');
var utils = require('../routes/utils');

// eslint-disable-next-line no-unused-vars
var remove_user = async function(userId, data, adminId){
    let user = await utils.mongo_users().findOne({'uid': userId});
    if(!user){
        console.trace('Error finding user');
        return false;
    }
    console.log('Plugin removal test done');
    return true;
};

// eslint-disable-next-line no-unused-vars
var activate_user = async function(userId, data, adminId){
    let user = await utils.mongo_users().findOne({'uid': userId});
    if(!user){
        console.trace('Error finding user');
        return false;
    }
    console.log('Plugin test done');
    return true;

};

// eslint-disable-next-line no-unused-vars
var deactivate_user = async function(userId, data, adminId){
    let user = utils.mongo_users().findOne({'uid': userId});
    if(!user){
        console.trace('Error finding user');
        throw 'user not found';
    }
    console.log('done');
    return user;
};

// eslint-disable-next-line no-unused-vars
var get_user_info = async function(userId, adminId){
    let user = await utils.mongo_users().findOne({'uid': userId});
    if(!user){
        console.trace('Error finding user');
        throw 'user not found';
    }
    return {'my': user.email};
};

// eslint-disable-next-line no-unused-vars
var set_user_info = async function(userId, data, adminId){
    console.log('should do something to update');
    let user = await utils.mongo_users().findOne({'uid': userId});
    if(!user){
        console.trace('Error finding user');
        throw 'user not found';
    }
    return {'my': 'test update message'};
};

module.exports = {
    remove: function(userId, data, adminId){
        console.log('Plugin test for removal of user : ' + userId);
        return remove_user(userId, data, adminId);
    },
    activate: function(userId, data, adminId){
        console.log('Plugin test for activation of user : ' + userId);
        return activate_user(userId, data, adminId);
    },
    deactivate: function(userId, data, adminId){
        console.log('Plugin test for deactivation of user : ' + userId);
        return deactivate_user(userId, data, adminId);
    },
    template: function(){
        return '<div>hello {{user.uid}}</div><div><input ng-model="plugin_data.test.my"></input> <button ng-click="plugin_update(\'test\')" class="button">Update</button></div>';
    },
    get_data: function(userId, adminId){
        return get_user_info(userId, adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    }
};

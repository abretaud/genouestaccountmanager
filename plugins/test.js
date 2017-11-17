
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var Promise = require('promise');

var activate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('activate ' + userId);
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){ reject(err)};
            console.log('done');
            resolve(data);
        });
    });
};

var deactivate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('deactivate ' + userId);
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){ reject(err)};
            console.log('done');
            resolve(data);
        });
    });
};

var get_user_info = function(userId, adminId){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){ reject(err)};
            resolve({'my': data.email});
        });
    });
};

var set_user_info = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log("should do something to update");
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){ reject(err)};
            events_db.insert({'owner': user.uid,'date': new Date().getTime(), 'action': 'plugin test modificiation' , 'logs': []}, function(err){});
            resolve({'my': "should do something to update"});
        });
    });
};

module.exports = {

    activate: function(userId, data, adminId){
        console.log('activation of user ' + user);
        return activate_user(userId, data, adminId);
        /*
        users_db.findOne({'uid': user}, function(err, data){
            console.log(data);
            return data;
        });
        */
        //return {'msg': 'nothing to do'};
    },
    deactivate: function(userId, data, adminId){
        console.log('deactivation of user ' + userId);
        return deactivate_user(userId, data, adminId);
        // return {'msg': 'nothing to do'};
    },
    template: function(){
        return "<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test.my\"></input> <button ng-click=\"plugin_update('test')\" class=\"button\">Update</button></div>";
    },
    get_data: function(userId, adminId){
        return get_user_info(userId);
        //return {'my': 'me'};
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
        //return {'msg': 'nothing to do'};
    }
}

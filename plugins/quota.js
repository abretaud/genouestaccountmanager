
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var path = require('path');
var http = require('http');
var GENERAL_CONFIG = CONFIG.general;


var Promise = require('promise');


var get_quota = function(quota) {
    var quotas = [];
    var quota_name = quota['quota_name'];
    var user = quota['user'];
    return new Promise(function(resolve, reject) {
    var serie = GENERAL_CONFIG.quota[quota_name]['series'].replace("#USER#", user);
    var options = {
            protocol: GENERAL_CONFIG.quota[quota_name]['protocol'],
            port: GENERAL_CONFIG.quota[quota_name]['port'],
            host: GENERAL_CONFIG.quota[quota_name]['hostname'],
            path: '/query?db=' + GENERAL_CONFIG.quota[quota_name]['db'] + "&q=SELECT%20last(%22value%22)%20FROM%20/" + serie + "/"
    };
    http.get(options
    , function(response){

        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
            var points = JSON.parse(body);
            var series = points.results[0]['series'];
            // If no stat available
            if(series == undefined) {
               resolve({'msg': 'no data'});
               return;
            }
            for(var s=0;s<series.length;s++){
                  quotas.push(series[s]['values'][0][1] / 1000000)
            }
            if(quotas.length==0){
                quotas.push(0);
                quotas.push(0);
            }
            if(quotas.length==1){
                quotas.push(0);
            }
            resolve({'name': quota_name, 'value': quotas[0], 'max': quotas[1]});
            //return {'name': req.param('id'), 'value': quotas[0], 'max': quotas[1]}
        });
    });
    });
};

var get_user_info = function(user){
    return new Promise(function (resolve, reject){
    var quotas = [];
    var quota_name = null;
    var quota_names = [];
    for(var key in GENERAL_CONFIG.quota) {
       quota_names.push({'quota_name': key, 'user': user});
    }
    var res = Promise.all(quota_names.map(get_quota)).then(function(values){
        resolve({'quotas': values});
    });
    });
};


module.exports = {

    activate: function(user, data){
        return new Promise(function (resolve, reject){
            resolve({'msg': 'nothing to do'});
        });
    },
    deactivate: function(user){
       return new Promise(function (resolve, reject){
            resolve({'msg': 'nothing to do'});
        });
    },
    template: function(){
        //return "<input ng-model=\"plugin_data.test.my\"></input> ";
        template='<div ng-repeat="quota in plugin_data.quota.quotas">' +
                 '<div class="panel panel-primary">' +
                 '<div class="panel-heading">' +
                 '<div class="row">' +
                 '<div class="col-xs-3">' +
                 '<i class="glyphicon glyphicon-user icon-5x"></i>' +
                 '</div>' +
                 '<div class="col-xs-9 text-right">' +
                 ' <div class="huge">{{quota.name}}</div>' +
                 '</div>' +
                 '</div>' +
                 '</div>' +
                 '<div class="panel-body">' +
                 '<div>Quota: {{quota.value | number: 2}} / {{quota.max | number: 2}} G</div>' +
                 '</div>' +
                 '</div>' +
                 '</div>';
        return template;
    },
    get_data: function(user){
        return get_user_info(user);
    },
    set_data: function(user, data){
        return {'msg': 'nothing to do'};
    }
}


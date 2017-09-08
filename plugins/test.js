
module.exports = {
    activate: function(user){
        console.log('activation of user ' + user.uid);
        return {'msg': 'nothing to do'};
    },
    deactivate: function(user){
        console.log('deactivation of user ' + user.uid);
        return {'msg': 'nothing to do'};
    },
    template: function(){
        return "<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test.my\"></input> <button ng-click=\"plugin_update('test')\" class=\"button\">Update</button></div>";
    },
    get_data: function(user){
        return {'my': 'me'};
    },
    set_data: function(user, data){
        if(data.my=='error'){
            return {'error': 'value not allowed'};
        }
        console.log('should do something')
        return {'msg': 'nothing to do'};
    }
}

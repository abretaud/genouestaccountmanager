/*global  angular:false */
/*jslint sub: true, browser: true, indent: 4, vars: true, nomen: true */
'use strict';

// Declare app level module which depends on filters, and services
angular.module('genouest', ['genouest.resources', 'ngSanitize', 'ngCookies', 'ngRoute', 'datatables'])
.directive('confirmDelete', function(){
    return {
      replace: true,
      templateUrl: 'templates/deleteConfirmation.html',
      scope: {
        onConfirm: '&'
      },
      controller: function($scope) {
        $scope.isDeleting = false;
        $scope.startDelete = function(){
          $scope.isDeleting = true;
        }
        $scope.cancel = function() {
          $scope.isDeleting = false;
        }
        $scope.confirm = function() {
          $scope.onConfirm();
        }
        }
    }
  })
.config(['$routeProvider','$logProvider',
    function ($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'views/main.html',
            controller: 'mainCtrl'
        });
        $routeProvider.when('/registered', {
            templateUrl: 'views/registered.html',
            controller: 'registeredCtrl'
        });
        $routeProvider.when('/pending', {
            templateUrl: 'views/pending.html',
            controller: 'pendingCtrl'
        });
        $routeProvider.when('/message', {
            templateUrl: 'views/message.html',
            controller: 'messageCtrl'
        });
        $routeProvider.when('/logs', {
            templateUrl: 'views/logs.html',
            controller: 'logsCtrl'
        });
        $routeProvider.when('/login', {
            templateUrl: 'views/login.html',
            controller: 'loginCtrl'
        });
        $routeProvider.when('/user', {
            templateUrl: 'views/users.html',
            controller: 'usersmngrCtrl'
        });
        $routeProvider.when('/group', {
            templateUrl: 'views/groups.html',
            controller: 'groupsmngrCtrl'
        });
        $routeProvider.when('/project', {
            templateUrl: 'views/projects.html',
            controller: 'projectsmngrCtrl'
        });
        $routeProvider.when('/database', {
            templateUrl: 'views/databases.html',
            controller: 'databasesmngrCtrl'
        });
        $routeProvider.when('/web', {
            templateUrl: 'views/web.html',
            controller: 'webmngrCtrl'
        });
        $routeProvider.when('/user/:id', {
            templateUrl: 'views/user.html',
            controller: 'usermngrCtrl'
        });
        $routeProvider.when('/user/:id/renew/:regkey', {
            templateUrl: 'views/info.html',
            controller: 'userextendCtrl'
        });
        $routeProvider.otherwise({
            redirectTo: '/'
        });
      }
])
.config(['$httpProvider', function ($httpProvider){
    $httpProvider.interceptors.push( function($q, $window){
        return {
        'request': function (config) {
                config.headers = config.headers || {};
                if ($window.sessionStorage.token) {
                    config.headers.Authorization = 'Bearer ' + $window.sessionStorage.token;
                }
                return config;
            },
            'response': function(response){
                return response;
            },
            'responseError': function(rejection){
                if(rejection.status == 401) {
                    // Route to #/login
                    location.replace('#/login');
                }
                return $q.reject(rejection);
            }
        };
    });
}]);

angular.module('genouest').controller('genouestCtrl',
    function ($rootScope) {
        $rootScope.alerts = [];
        $rootScope.closeAlert = function (index) {
            $rootScope.alerts.splice(index, 1);
        };
    });
angular.module('genouest').controller('registeredCtrl',
    function ($rootScope) {
    });
angular.module('genouest').controller('logsCtrl',
    function ($scope, $rootScope, User, Auth, GOLog, GOActionLog) {
        $scope.date_convert = function timeConverter(tsp){
          var a = new Date(tsp);
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var year = a.getFullYear();
          var month = months[a.getMonth()];
          var date = a.getDate();
          var hour = a.getHours();
          var min = a.getMinutes();
          var sec = a.getSeconds();
          var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
          return time;
        }
      $scope.get_status = function(status){
          if(status!=0 && status!=undefined) {
              return "alert alert-warning";
          }
      }
      $scope.logs = GOActionLog.list();
      //console.log(GOLog.get());
      $scope.logcontent = "";
      $scope.getlog = function(log_id, event_file) {
        GOActionLog.get({event: event_file}).$promise.then(function(data){
          $scope.logcontent = data.log.replace(/(\r\n|\n|\r)/g,"<br />");
          $scope.logid = log_id;
        });
      };
});

angular.module('genouest').controller('databasesmngrCtrl',
    function ($scope, $rootScope, User, Auth, Database) {
      $scope.user = Auth.getUser();
      /*
      <input  ng-model="db_name" placeholder="database name"/>
      <input  ng-model="db_owner" placeholder="owner uid"/>
      <select  ng-model="db_type">
          <option value="mysql">MySQL</option>
          <option value="postgresql">Postgres</option>
          <option value="mongo">Mongo</option>
      </select>
      <input ng-model="db_host" placeholder="hostname where is database"/>
      */
      $scope.db_name = null;
      $scope.db_owner = null;
      $scope.db_type = 'mysql';
      $scope.db_host = null;

      $scope.owner_db_name = null;
      $scope.owner_db_owner = null;

      Database.list().$promise.then(function(data){
        $scope.databases = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.change_owner = function(){
        $scope.msg = '';
        if($scope.owner_db_name === undefined || $scope.owner_db_owner === undefined){
            console.log("no database or owner selected");
            return;
        }
        c
        Database.changeowner({name: $scope.owner_db_name.name, old: $scope.owner_db_name.owner, new: $scope.owner_db_owner.uid},{}).$promise.then(function(data){
          $scope.msg = data.message;
          Database.list().$promise.then(function(data){
            $scope.databases = data;
          });
        });


      };

      $scope.declare_db = function(){
          Database.add({name: $scope.db_name},{
              owner: $scope.db_owner.uid,
              type: $scope.db_type,
              host: $scope.db_host,
              create: false
          }).$promise.then(function(){
              $scope.db_name = null;
              $scope.db_owner = null;
              $scope.db_type = 'mysql';
              $scope.db_host = null;
              Database.list().$promise.then(function(data){
                $scope.databases = data;
              });
          });

      }

    });

angular.module('genouest').controller('webmngrCtrl',
    function ($scope, $rootScope, User, Auth, Web) {
      $scope.user = Auth.getUser();
      $scope.owner_web_name = null;
      $scope.owner_web_owner = null;

      Web.list().$promise.then(function(data){
        $scope.websites = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.change_owner = function(){
        $scope.msg = '';
        if($scope.owner_web_name === undefined || $scope.owner_web_owner === undefined){
            console.log("no web or owner selected");
            return;
        }

        Web.changeowner({name: $scope.owner_web_name.name, old: $scope.owner_web_name.owner, new: $scope.owner_web_owner.uid},{}).$promise.then(function(data){
          $scope.msg = data.message;
          Web.list().$promise.then(function(data){
            $scope.websites = data;
          });
        });
    };
    });


angular.module('genouest').controller('messageCtrl',
    function ($scope, $rootScope, User, Auth) {
      $scope.msg = '';
      $scope.session_user = Auth.getUser();
      $scope.message = '';
      $scope.subject = '';
      $scope.send = function() {
        User.sendMessage({},{message: $scope.message, subject: $scope.subject}).$promise.then(function(data){
          $scope.msg = 'Message sent';
        });
      }
    });


angular.module('genouest').controller('projectsmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, Project, Auth, GOLog) {

    $scope.project_list = function(){
        Project.list().$promise.then(function(data) {
            for(var i=0;i<data.length;i++){
                data[i].expire = new Date(data[i].expire);
            }
            $scope.projects = data;
        });
    };
    $scope.project_list();

    $scope.project_id = '';
    $scope.project_owner = null;
    $scope.project_group = null;
    $scope.project_expire = null;
    $scope.project_size = null;


    $scope.date_convert = function timeConverter(tsp){
      var a = new Date(tsp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
    }

    $scope.add_project = function(){
          if($scope.project_id == '') {
            return;
          }
          Project.add({},{'id': $scope.project_id, 'owner': $scope.project_owner, 'group': $scope.project_group, 'size': $scope.project_size, 'expire': new Date($scope.project_expire).getTime()}).$promise.then(function(data){
            $scope.msg = '';
            Project.list().$promise.then(function(data) {
              $scope.projects = data;
            }, function(error){
              $scope.msg = error.data;
            });
          });
    };
    $scope.update_project = function(project){
        Project.update({'name': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime(), 'owner': project.owner, 'group': project.group}).$promise.then(function(data){
          $scope.project_list();
        });
    };

    $scope.delete_project = function(project){
        Project.delete({'name': project.id}).$promise.then(function(data){
          $scope.project_list();
        });
    };

});

angular.module('genouest').controller('groupsmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, Group, Auth, GOLog) {
    $scope.selectedGroup = null;
    $scope.users = [];

    Group.list().$promise.then(function(data) {
      $scope.groups = data;
    });

    $scope.show_group_users = function(group) {
        $scope.msg = '';
        var group_name = group.name;
        $scope.selectedGroup = group;
        Group.get({name: group_name}).$promise.then(function(user_list){
            $scope.users = user_list;
        });
    };

    $scope.new_group = '';

    $scope.update_group = function(){
        Group.update({name: $scope.selectedGroup.name},{owner: $scope.selectedGroup.owner}).$promise.then(function(data){
          $scope.msg = '';
          Group.list().$promise.then(function(data) {
            $scope.msg = 'Group updated';
          }, function(error){
            $scope.msg = error.data;
          });
        });
    };

    $scope.add_group = function(){
      if($scope.new_group == '') {
        return;
      }
      Group.add({name: $scope.new_group},{owner: $scope.new_group_user_id}).$promise.then(function(data){
        $scope.msg = '';
        GOLog.add(data.name, data.fid, 'Add group '+data.name);
        Group.list().$promise.then(function(data) {
          $scope.groups = data;
        }, function(error){
          $scope.msg = error.data;
        });
    }, function(error){
        $scope.msg = error.data;
    });
    }
    $scope.delete_group = function(selectedGroup) {
        Group.delete({name: selectedGroup.name}).$promise.then(function(data){
            $scope.msg = data.msg;
            Group.list().$promise.then(function(data) {
              $scope.groups = data;
            }, function(error){
              $scope.msg = error.data;
            });
        },function(error){
            console.log(error);
            $scope.msg = error.data;
        });
    }

});

angular.module('genouest').controller('usersmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User, Auth) {
    User.list().$promise.then(function(data) {
      $scope.users = data;
    });

    $scope.STATUS_PENDING_EMAIL = 'Waiting for email approval';
    $scope.STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
    $scope.STATUS_ACTIVE = 'Active';
    $scope.STATUS_EXPIRED = 'Expired';


    $scope.date_convert = function timeConverter(tsp){
      var a = new Date(tsp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
    }

});

angular.module('genouest').controller('userextendCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User) {

  $scope.date_convert = function timeConverter(tsp){
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
  }

  User.extend({name: $routeParams.id, regkey: $routeParams.regkey},{}).$promise.then(function(data){
    $scope.msg = '<h3>'+data.message+ ' '+$scope.date_convert(data.expiration)+'</h3>';
  });

});

angular.module('genouest').controller('usermngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $http, $location, User, Group, Quota, Database, Web, Auth, GOLog, GOActionLog) {
    $scope.session_user = Auth.getUser();
    $scope.maingroups = ['genouest', 'irisa', 'symbiose'];
    $scope.selected_group = '';
    $scope.password1 = '';
    $scope.password2 = '';
    $scope.events = [];
    $scope.plugins = [];
    $scope.plugin_data = {};
    $http({
      method: 'GET',
      url: '../plugin'
    }).then(function successCallback(response) {
        $scope.plugins = response.data;
        console.log($scope.plugins);
      }, function errorCallback(response) {
          console.log("Failed to get plugins ");
      });


    $scope.plugin_update = function(plugin) {
        // TODO send update to plugin with plugin_data
        // plugin is in charge of setting plugin_data.plugin content that will be posted
        console.log("should update " + plugin);
        console.log($scope.plugin_data[plugin]);
        $scope.plugin_data[plugin].alert = null;
        $http({
          method: 'POST',
          url: '../plugin/' + plugin + '/' + $scope.user.uid,
          data: $scope.plugin_data[plugin]
        }).then(function successCallback(response) {
            console.log('data updated');
            $scope.plugin_data[plugin] = response.data;
          }, function errorCallback(response) {
              console.log("Failed to update plugin "+plugin+": "+response.data);
              $scope.plugin_data[plugin].alert = response.data;
          });
    }

    $scope.change_group = function() {
      //console.log($scope.selected_group);
      $scope.user.group = $scope.selected_group.name;
    };
    $scope.quotas = [];

    $scope.update_password = function() {
        if(($scope.password1 != $scope.password2) || ($scope.password1=="")) {
            $scope.msg = "Passwords are not identical";
            return;
        }
        User.update_password({name: $routeParams.id},{password: $scope.password1}).$promise.then(function(data){
            $scope.msg = data.message;
        });
        $scope.msg = '';

    };

    Quota.get({name: $routeParams.id, disk: 'home'}).$promise.then(function(data){
      $scope.quotas.push(data);
    });
    Quota.get({name: $routeParams.id, disk: 'omaha'}).$promise.then(function(data){
      $scope.quotas.push(data);
    });
    Quota.get({name: $routeParams.id, disk: 'galaxy'}).$promise.then(function(data){
      //data['value'] = data['value'] * 1000000
      $scope.quotas.push(data);
    });



    User.get({name: $routeParams.id}).$promise.then(function(user){
      if(user.is_admin) {
      Group.list().$promise.then(function(data) {
        $scope.groups = data;
        var found = false;
        for(var i=0;i<$scope.groups.length;i++){
          if($scope.groups[i].name == user.group) {
            found = true;
            break;
          }
        }
        if(!found) { $scope.groups.push({name: user.group})}
        $scope.user = user;
      });
      }
      else {
        $scope.user = user;
      }
      User.is_subscribed({name: user.uid}).$promise.then(function(data){
          $scope.subscribed = data.subscribed;
      });

      for(var i=0;i<$scope.plugins.length;i++){
          (function(cntr) {
          $http({
            method: 'GET',
            url: $scope.plugins[cntr].url+ '/' + user.uid
          }).then(function successCallback(response) {
              $scope.plugin_data[$scope.plugins[cntr].name] = response.data;
            }, function errorCallback(response) {
                console.log("Failed to get info from plugin "+$scope.plugins[cntr].url);
            });
        })(i);
      };

    });
    $scope.STATUS_PENDING_EMAIL = 'Waiting for email approval';
    $scope.STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
    $scope.STATUS_ACTIVE = 'Active';
    $scope.STATUS_EXPIRED = 'Expired';

    $scope.date_convert = function timeConverter(tsp){
      var a = new Date(tsp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
    }

    $scope.database = "";
    $scope.website = "";
    $scope.website_url = "";
    $scope.website_description = "";

    Database.listowner({name: $routeParams.id}).$promise.then(function(data){
      $scope.databases = data;
    });


    Web.listowner({name: $routeParams.id}).$promise.then(function(data){
      $scope.websites = data;
    });

    GOActionLog.user_list({'id': $routeParams.id}).$promise.then(function(data){
        $scope.events = data;

    });


    $scope.add_secondary_group = function() {
      var sgroup = $scope.user.newgroup;
      if(sgroup.trim()!=''){
        User.add_group({name: $scope.user.uid, group: sgroup},{}).$promise.then(function(data){
          $scope.msg = data.message;
          $scope.user.secondarygroups.push(sgroup);
        });
      }
    };

    $scope.delete_secondary_group = function(sgroup) {
      User.delete_group({name: $scope.user.uid, group: sgroup}).$promise.then(function(data){
        $scope.msg = data.message;
        var tmpgroups = [];
        for(var t=0;t<$scope.user.secondarygroups;t++){
          if($scope.user.secondarygroups[t] != sgroup) {
            tmpgroup.push($scope.user.secondarygroups[t]);
          }
        }
        $scope.user.secondarygroups = tmpgroups;
      });
    };

    $scope.database_delete = function(db){
      $scope.dbmsg = '';
      Database.delete({name: db}).$promise.then(function(data){
        Database.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.databases = data;
        });
      });
    }

    $scope.web_delete = function(site){
      $scope.webmsg = '';
      Web.delete({name: site}).$promise.then(function(data){
        Web.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.database_add = function(){
      $scope.dbmsg = '';
      Database.add({name: $scope.database},{create: true}).$promise.then(function(data){
        $scope.dbmsg = data.message;
        Database.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.databases = data;
        });
      });
    }

    $scope.web_add = function(){
      $scope.webmsg = '';
      Web.add({name: $scope.website},{owner: $scope.user.uid, url: $scope.website_url, description: $scope.website_description}).$promise.then(function(data){
        $scope.webmsg = data.message;
        Web.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.expire = function() {
      User.expire({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        GOLog.add($scope.user.uid, data.fid, "Expire user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_EXPIRED;
      });
    };

    $scope.delete = function() {
      User.delete({name: $scope.user.uid},{}).$promise.then(function(data){
        //console.log(data.fid);
        if(data.fid === undefined) {
            $scope.msg = data.message;
        }
        else {
            GOLog.add($scope.user.uid, data.fid, "Delete user "+$scope.user.uid);
            $location.path('/user');
        }
      });
    };

    $scope.renew = function() {
      User.renew({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        GOLog.add($scope.user.uid, data.fid, "Renew user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_ACTIVE;
      });
    };

    $scope.extend = function() {
      User.extend({name: $scope.user.uid, regkey: $scope.user.regkey},{}).$promise.then(function(data){
        $scope.msg = data.message;
        $scope.user.expiration = data.expiration;
      });
    };

    $scope.activate = function() {
      User.activate({name: $scope.user.uid}).$promise.then(function (data){
        GOLog.add($scope.user.uid, data.fid, "Activate user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_ACTIVE;
        $scope.msg = data.msg;
      }, function(error){
          $scope.msg = error.data;
      });
    };

    $scope.update_info = function() {
      $scope.msg = "";
      User.update({name: $scope.user.uid}, $scope.user).$promise.then(function(data) {
        $scope.msg = "User info updated";
        $scope.user = data;
        if(data.fid!=null){
          GOLog.add($scope.user.uid, data.fid, "Update user "+$scope.user.uid);
        }

      }, function(error){
        $scope.msg = error.data;
      });
    };

    $scope.update_ssh = function() {
      $scope.ssh_message = "";
      User.update_ssh({name: $scope.user.uid}, {ssh: $scope.user.ssh}).$promise.then(function(data) {
        $scope.user = data;
        $scope.ssh_message = "SSH key added";
        GOLog.add($scope.user.uid, data.fid, "Add SSH key for user "+$scope.user.uid);
      });
    }

});

angular.module('genouest').controller('userCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $window, User, Auth, Logout) {

    $scope.is_logged = false;

    User.is_authenticated().$promise.then(function(data) {
      if(data.user !== undefined && data.user !== null) {
         $scope.user = data.user;
         //$scope.user['is_admin'] = data.is_admin;
         $scope.is_logged = true;
         if($window.sessionStorage != null) {
             $window.sessionStorage.token = data.token;
         }

         Auth.setUser($scope.user);
      }
      else {
        if($location.path().indexOf("renew") == -1 && $location.path().indexOf("pending") == -1) {
            $location.path('/login');
        }
      }
    });

    $scope.logout = function() {
      delete $window.sessionStorage.token;
      Logout.get().$promise.then(function(){
        $scope.user = null;
        $scope.is_logged = false;
        Auth.setUser(null);
        $location.path('/login');
      });
    };

    $rootScope.$on('loginCtrl.login', function (event) {
      $scope.user = Auth.getUser();
      $scope.is_logged = true;
    });



});

angular.module('genouest').controller('loginCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $window, IP, User, Auth) {

    var SUCCESS = 0;
    var ERROR = 1;

    $scope.duration = 365;

    IP.get().$promise.then(function(data) {
      var ips = data.ip.split(',');
      var ip = ips[0].trim();
      $scope.ip = ip;
    });

    $scope.password_reset_request = function() {
      $scope.msgstatus = 0;
      $scope.msg = "";
      if($scope.userid == null || $scope.userid == "") {
        $scope.msgstatus = 1;
        $scope.msg = "Please enter your used id!";
      }
      else {
        User.password_reset_request({name: $scope.userid}).$promise.then(function(data){
          $scope.msg = data.message;
        });
      }
    }

    $scope.update_userid = function() {
      if($scope.firstname && $scope.lastname) {
        $scope.userid = $scope.firstname.charAt(0).toLowerCase()+$scope.lastname.toLowerCase().replace(' ','').substring(0,7);
      }
    }

    $scope.register = function() {
      $scope.msg = "";
      $scope.msgstatus = 0;
      if(! $scope.agree) {
        $scope.msg="You must agree with the terms of use";
        $scope.msgstatus = 1;
        return;
      }
      User.register({name: $scope.userid},{
        firstname: $scope.firstname,
        lastname: $scope.lastname,
        address: $scope.address,
        lab: $scope.lab,
        responsible: $scope.responsible,
        group: $scope.group,
        email: $scope.email,
        ip: $scope.ip,
        duration: $scope.duration,
        why: $scope.why
      }).$promise.then(function(data){
        $scope.msg = data.msg;
        $scope.msgstatus = data.status;
        if(data.status==0) {
          $location.path('/registered');
        }
      });
    };

    $scope.auth = function() {
      User.authenticate({name: $scope.userid}, {password: $scope.password}).$promise.then(function(data) {
        if(data.user !== undefined && data.user !== null) {
          Auth.setUser(data.user);
          if($window.sessionStorage != null) {
              $window.sessionStorage.token = data.token;
          }
          $rootScope.$broadcast('loginCtrl.login');
          $location.path('/');
        }
        else {
          $scope.msg = data.msg;
          $scope.msgstatus = ERROR;
        }
      }, function(error){
          $scope.msg = error.data;
      });
    }
});

angular.module('genouest').controller('mainCtrl',
    function ($rootScope, $scope, $location, Auth) {
      var user = Auth.getUser();
      if(user) {
      $location.path('/user/'+user.uid);
      }
});

angular.module('genouest').controller('pendingCtrl',
    function ($rootScope, $scope, $location, Auth) {
});


angular.module('genouest').service('GOLog', function() {
  var logs = [];
  return {
    get: function() {
      return logs;
    },
    add: function(id, fid, desc) {
      logs.push({obj_id: id, file_id: fid, description: desc});
    }
  }
});

angular.module('genouest').service('Auth', function() {
    var user =null;
    return {
        getUser: function() {
            return user;
        },
        setUser: function(newUser) {
            user = newUser;
        },
        isConnected: function() {
            return !!user;
        }
    };
});

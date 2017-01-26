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
          if(status!=0) {
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

      Database.list().$promise.then(function(data){
        $scope.databases = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.changeOwner = function(db, oldowner, newowner){
        $scope.msg = '';
        Database.changeowner({name: db, old: oldowner, new: newowner},{}).$promise.then(function(data){
          $scope.msg = data.message;
          Database.list().$promise.then(function(data){
            $scope.databases = data;
          });
        });
      };

    });

angular.module('genouest').controller('webmngrCtrl',
    function ($scope, $rootScope, User, Auth, Web) {
      $scope.user = Auth.getUser();

      Web.list().$promise.then(function(data){
        $scope.websites = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.changeOwner = function(db, oldowner, newowner){
        $scope.msg = '';
        Web.changeowner({name: db, old: oldowner, new: newowner},{}).$promise.then(function(data){
          $scope.msg = data.message;
          Web.list().$promise.then(function(data){
            $scope.databases = data;
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

    $scope.show_group_users = function(group_name) {
        $scope.msg = '';
        $scope.selectedGroup = group_name;
        Group.get({name: group_name}).$promise.then(function(user_list){
            $scope.users = user_list;
        });
    };

    $scope.new_group = '';
    $scope.add_group = function(){
      if($scope.new_group == '') {
        return;
      }
      Group.add({name: $scope.new_group},{}).$promise.then(function(data){
        $scope.msg = '';
        GOLog.add(data.name, data.fid, 'Add group '+data.name);
        Group.list().$promise.then(function(data) {
          $scope.groups = data;
        }, function(error){
          $scope.msg = error.data;
        });
      });
    }
    $scope.delete_group = function(group_name) {
        Group.delete({name: group_name}).$promise.then(function(data){
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
  function($scope, $rootScope, $routeParams, $log, $location, User, Group, Quota, Database, Web, Auth, GOLog) {
    $scope.session_user = Auth.getUser();
    $scope.maingroups = ['genouest', 'irisa', 'symbiose'];
    $scope.selected_group = '';

    $scope.change_group = function() {
      //console.log($scope.selected_group);
      $scope.user.group = $scope.selected_group.name;
    };
    $scope.quotas = [];

    Quota.get({name: $routeParams.id, disk: 'home'}).$promise.then(function(data){
      $scope.quotas.push(data);
    });
    Quota.get({name: $routeParams.id, disk: 'omaha'}).$promise.then(function(data){
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
      Database.add({name: $scope.database},{}).$promise.then(function(data){
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
      });
    };

    $scope.update_info = function() {
      $scope.msg = "";
      User.update({name: $scope.user.uid}, $scope.user).$promise.then(function(data) {
        $scope.user = data;
        if(data.fid!=null){
          GOLog.add($scope.user.uid, data.fid, "Update user "+$scope.user.uid);
        }
      }, function(error){
        $scope.msg = error.data;
      });
    };

    $scope.update_ssh = function() {
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

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
        $routeProvider.when('/message', {
            templateUrl: 'views/message.html',
            controller: 'messageCtrl'
        });
        $routeProvider.when('/login', {
            templateUrl: 'views/login.html',
            controller: 'loginCtrl'
        });
        $routeProvider.when('/user', {
            templateUrl: 'views/users.html',
            controller: 'usersmngrCtrl'
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
        $routeProvider.otherwise({
            redirectTo: '/'
        });
      }
]);

angular.module('genouest').controller('genouestCtrl',
    function ($rootScope) {
        $rootScope.alerts = [];
        $rootScope.closeAlert = function (index) {
            $rootScope.alerts.splice(index, 1);
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


angular.module('genouest').controller('usersmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User, Auth) {
    User.list().$promise.then(function(data) {
      $scope.users = data;
    });
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

angular.module('genouest').controller('usermngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User, Group, Disk, Database, Web, Auth) {
    $scope.session_user = Auth.getUser();
    $scope.maingroups = ['genouest', 'irisa', 'symbiose'];
    $scope.selected_group = '';

    $scope.change_group = function() {
      console.log($scope.selected_group);
      $scope.user.group = $scope.selected_group.name;
    };

    Disk.get({name: $routeParams.id}).$promise.then(function(data){
      $scope.disk_home = data.home;
      $scope.disk_omaha = data.omaha;
      $scope.home_date = data.home_date;
      $scope.omaha_date = data.omaha_date;
    });
    User.get({name: $routeParams.id}).$promise.then(function(user){
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

    Database.list().$promise.then(function(data){
      $scope.databases = data;
    });

    Web.list().$promise.then(function(data){
      $scope.websites = data;
    });

    $scope.database_delete = function(db){
      $scope.dbmsg = '';
      Database.delete({name: db}).$promise.then(function(data){
        Database.list().$promise.then(function(data){
          $scope.databases = data;
        });
      });
    }

    $scope.web_delete = function(site){
      $scope.webmsg = '';
      Web.delete({name: site}).$promise.then(function(data){
        Web.list().$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.database_add = function(){
      $scope.dbmsg = '';
      Database.add({name: $scope.database},{}).$promise.then(function(data){
        $scope.dbmsg = data.message;
        Database.list().$promise.then(function(data){
          $scope.databases = data;
        });
      });
    }

    $scope.web_add = function(){
      $scope.webmsg = '';
      Web.add({name: $scope.website},{url: $scope.website_url, description: $scope.website_description}).$promise.then(function(data){
        $scope.webmsg = data.message;
        Web.list().$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.expire = function() {
      User.expire({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        $scope.user.status = $scope.STATUS_EXPIRED;
      });
    };

    $scope.delete = function() {
      User.delete({name: $scope.user.uid},{}).$promise.then(function(data){
        $location.path('/user');

      });
    };

    $scope.renew = function() {
      User.renew({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        $scope.user.status = $scope.STATUS_ACTIVE;
      });
    };

    $scope.activate = function() {
      User.activate({name: $scope.user.uid});
      $scope.user.status = $scope.STATUS_ACTIVE;
    };

    $scope.update_info = function() {
      User.update({name: $scope.user.uid}, $scope.user).$promise.then(function(data) {
        $scope.user = data;
      });
    };

    $scope.update_ssh = function() {
      User.update_ssh({name: $scope.user.uid}, {ssh: $scope.user.ssh}).$promise.then(function(data) {
        $scope.user = data;
      });
    }

});

angular.module('genouest').controller('userCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User, Auth, Logout) {

    $scope.is_logged = false;

    User.is_authenticated().$promise.then(function(data) {
      if(data.user !== undefined && data.user !== null) {
         $scope.user = data.user;
         //$scope.user['is_admin'] = data.is_admin;
         $scope.is_logged = true;
         Auth.setUser($scope.user);
      }
      else {
        $location.path('/login');
      }
    });

    $scope.logout = function() {
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
  function($scope, $rootScope, $routeParams, $log, $location, IP, User, Auth) {

    var SUCCESS = 0;
    var ERROR = 1;

    $scope.duration = 1;

    IP.get().$promise.then(function(data) {
      $scope.ip = data.ip;
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
        duration: $scope.duration
      }).$promise.then(function(data){
        $scope.msg = data.msg;
        $scope.msgstatus = data.status;
      });
    };

    $scope.auth = function() {
      User.authenticate({name: $scope.userid}, {password: $scope.password}).$promise.then(function(data) {
        if(data.user !== undefined && data.user !== null) {
          Auth.setUser(data.user);
          $rootScope.$broadcast('loginCtrl.login');
          $location.path('/');
        }
        else {
          $scope.msg = data.msg;
          $scope.status = ERROR;
        }
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

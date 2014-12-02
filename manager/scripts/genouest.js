/*global  angular:false */
/*jslint sub: true, browser: true, indent: 4, vars: true, nomen: true */
'use strict';

// Declare app level module which depends on filters, and services
angular.module('genouest', ['genouest.resources', 'ngSanitize', 'ngCookies', 'ngRoute']).
config(['$routeProvider','$logProvider',
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

});

angular.module('genouest').controller('usermngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User, Group, Disk, Auth) {
    $scope.session_user = Auth.getUser();
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

    $scope.expire = function() {
      console.log('not yet implemented');
    };
    $scope.renew = function() {
      console.log('not yet implemented');
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
    function () {

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

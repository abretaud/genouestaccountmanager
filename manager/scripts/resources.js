/*jslint sub:true, browser: true, indent: 4, vars: true, nomen: true */

(function () {
  'use strict';

      function IP($resource) {
        return $resource('http://jsonip.com', {}, {
            get: {
              paramDefault: {callback: '?'},
              method: 'GET',
              isArray: false,
              cache: false
            }
        });
      }

      function Group($resource) {
        return $resource('/group', {}, {
            list: {
              url: '/group',
              method: 'GET',
              isArray: true,
              cache: true
            }
          });
      }

      function Disk($resource) {
        return $resource('/disk', {}, {
            get: {
              url: '/disk/:name',
              method: 'GET',
              isArray: false,
              cache: true
            }
          });
      }

      function Database($resource) {
        return $resource('/database', {}, {
            list: {
              url: '/database',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: '/database/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete: {
              url: '/database/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
          });
      }

      function Web($resource) {
        return $resource('/web', {}, {
            list: {
              url: '/web',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: '/web/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete: {
              url: '/web/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
          });
      }

      function User($resource) {
        return $resource('/user', {}, {
            list: {
              url: '/user',
              method: 'GET',
              isArray: true,
              cache: false
            },
            update: {
              url: '/user/:name',
              method: 'PUT',
              isArray: false,
              cache: false
            },
            get: {
              url: '/user/:name',
              method: 'GET',
              isArray: false,
              cache: false
            },
            is_authenticated: {
              url: '/auth',
              method: 'GET',
              isArray: false,
              cache: false
            },
            authenticate: {
              url: '/auth/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            register: {
              url: '/user/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            activate: {
              url: '/user/:name/activate',
              method: 'GET',
              isArray: false,
              cache: false
            },
            sendMessage: {
              url: '/message',
              method: 'POST',
              isArray: false,
              cache:  false
            }
          });
      }

      function Logout($resource) {
        return $resource('/logout');
      }



  angular.module('genouest.resources', ['ngResource'])
  .factory('Group', Group)
  .factory('Disk', Disk)
  .factory('Database', Database)
  .factory('Web', Web)
  .factory('User', User)
  .factory('Logout', Logout)
  .factory('IP', IP);

}());

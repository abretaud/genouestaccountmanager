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

      function User($resource) {
        return $resource('/user', {}, {
            list: {
              url: '/user',
              method: 'GET',
              isArray: true,
              cache: true
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
          });
      }

      function Logout($resource) {
        return $resource('/logout');
      }



  angular.module('genouest.resources', ['ngResource'])
  .factory('Group', Group)
  .factory('User', User)
  .factory('Logout', Logout)
  .factory('IP', IP);

}());

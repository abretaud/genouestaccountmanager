var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var session = require('express-session');

var routes = require('./routes/index');
var users = require('./routes/users');
var auth = require('./routes/auth');
var disks = require('./routes/disks');
var database = require('./routes/database');
var web = require('./routes/web');

var CONFIG = require('config');

var app = express();


// view engine setup
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: CONFIG.general.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600*1000}
}))
app.use('/manager', express.static(path.join(__dirname, 'manager')));
app.use(express.static(path.join(__dirname, 'public')));


app.get('/', routes);
app.post('/message', users);
app.get('/group', users);
app.post('/group/:id', users);
app.get('/user', users);
app.get('/database', database);
app.post('/database/:id', database);
app.put('/database/:id/owner/:old/:new', database);
app.delete('/database/:id', database);
app.get('/web', web);
app.post('/web/:id', web);
app.put('/web/:id/owner/:old/:new', database);
app.delete('/web/:id', web);
app.post('/user/:id', users);
app.get('/disk/:id', disks);
app.put('/user/:id', users);
app.put('/user/:id/ssh', users);
app.get('/user/:id', users);
app.get('/user/:id/expire', users);
app.get('/user/:id/renew', users);
app.get('/user/:id/activate', users);
app.get('/user/:id/confirm', users);
app.get('/user/:id/passwordreset', users);
app.get('/user/:id/passwordreset/:key', users);
app.delete('/user/:id', users);

app.get('/auth', auth);
app.post('/auth/:id', auth);
app.get('/logout', auth);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;


if (!module.parent) {
  http.createServer(app).listen(app.get('port'), function(){
    console.log('Server listening on port ' + app.get('port'));
  });
}

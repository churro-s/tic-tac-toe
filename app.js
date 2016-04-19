/*jshint -W098 */
'use strict';

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

/*var routes = require('./routes/index');
var users = require('./routes/users');*/
var api = require('./api');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use("/api", api);

/*app.use('/', routes);
app.use('/users', users);*/

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

//The HTTP server
var server = require('http').Server(app);

/*
 * Client management
 */
var clients = [];//array of all sockets
var clientMap = {};//map of socket ID to socket
function addClient(socket) {
  clients.push(socket);
  clientMap[socket.id] = socket;
}
function deleteClient(socket) {
  clients.splice([clients.indexOf(socket), 1]);
  delete clientMap[socket.id];
}
function getClient(id) {
  return clientMap[id];
}

var sessions = {};
function createSession(id) {
  sessions[id] = {};
}
function adduser(sessionId, userId) {
  sessionId
}

//Keep track of hanging session
var waitingClient;
var partnersMap = {};//map of socket ID to socket ID (partners)

function deletePartner(id) {
  var partner = partnersMap[id];
  if (partner) {
    delete partnersMap[id];
    deletePartner(partner);
  }
}

function manageSession(socket) {
  if (!socket) {
    return;
  }
  var sessionId = socket.id;
  if (sessionId === waitingClient) {
    return;
  }

  if (waitingClient) {
    console.log("Connecting client", sessionId, "with", waitingClient);
    socket.join(waitingClient, function(err) {
      if (err) {
        console.log("Error joining room", waitingClient, err);
      }
      else {
        partnersMap[waitingClient] = sessionId;
        partnersMap[sessionId] = waitingClient;
        console.log("Connected  client", sessionId, "with", waitingClient);
        socket.emit("partner", {partner: waitingClient});
        waitingClient = null;
        console.log("Rooms:", socket.rooms);
      }
    });
  }
  else {
    socket.emit("partner", {});
    waitingClient = sessionId;
  }

}
/**
 * Socket.io
 */
var io = require('socket.io')(server);

//Socket connection handler
io.on('connection', function (socket) {
  addClient(socket);

  var clientId = socket.id;
  console.log("A user connected. Session ID is", clientId);
  socket.emit("session", clientId);

  //handle new user
  manageSession(socket);

  socket.on("disconnect", function() {
    var partnerId = partnersMap[socket.id];
    console.log("client disconnected!", socket.id);
    if (partnerId) {
      console.log("partner is orphaned:", partnerId);
    }
    else {
      console.log("No active players remain");
    }
    var partner = getClient(partnerId);
    manageSession(partner);
    deletePartner(socket.id);
    deleteClient(socket);
  });
});

/**
 * Start server
 */
var port = process.env.PORT || '8000';
server.listen(port, function(){
  console.log('listening on', server.address());
});


// module.exports = app;

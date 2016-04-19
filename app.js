/*jshint -W098 */
'use strict';

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require("lodash");

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

/**
 * Simple function to generate a unique ID based on current time
 */
function keyGen() {
  var time = process.hrtime();
  var uuid = (time[0] * 1e9 + time[1]).toString();
  return uuid;
}

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

/**
 * Session management
 */
var sessions = {};//map of session ID to session
var userToSessionMap = {};//map of user id to session
function getSessionByUserid(uid) {
  return sessions[userToSessionMap[uid]];
}
function setUserSession(uid, sid) {
  userToSessionMap[uid] = sid;
}
function createSession(uid1, uid2) {
  var sessionId = keyGen();
  var session = {
    users: [uid1, uid2],
    userX: uid1,
    userO: uid2,
    id: sessionId,
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ],
    nextPlayer: uid1,
    winner: null
  };
  session.setCell = function setCell(row, column, value) {
    session.board[row][column] = value;
  };
  sessions[sessionId] = session;
  setUserSession(uid1, sessionId);
  setUserSession(uid2, sessionId);
  return session;
}

function deleteSession(session) {
  delete userToSessionMap[session.userO];
  delete userToSessionMap[session.userX];
  delete sessions[session.id];
}

/**
 * Socket.io
 */
var io = require('socket.io')(server);

//Keep track of hanging session (single player waiting for partner)
var waitingClientId;

function manageSession(socket, callback) {
  if (!socket) {
    return;
  }
  var newClientId = socket.id;
  if (newClientId === waitingClientId) {
    return;
  }

  if (waitingClientId) {
    var waitingSocket = getClient(waitingClientId);
    if (!waitingSocket) {
      waitingClientId = null;
      console.log("Error! No socket found in memory for Client ID", waitingClientId);
      return;
    }

    var session = createSession(newClientId, waitingClientId);
    var sessionId = session.id;
    console.log("Connecting client", newClientId, "with", waitingClientId, " in session ID", sessionId);

    waitingSocket.join(sessionId, function (err) {
      if (err) {
        console.log("Error! Client", waitingClientId, "failed to join session", sessionId, err);
        return callback(err);
      }
      else {
        socket.join(sessionId, function (err) {
          if (err) {
            console.log("Error! Client", newClientId, "failed to join session", sessionId, err);
            waitingSocket.leave(sessionId);
            return callback(err);
          }
          else {//both clients connected to room SUCCESS
            console.log("Connected  client", newClientId, "with", waitingClientId, " in session ID", sessionId);
            io.to(sessionId).emit('boardChange', session.board);
            socket.emit("partner", waitingClientId);
            waitingSocket.emit("partner", newClientId);
            waitingClientId = null;
            return callback(null, session);
          }
        });
      }
    });
  }
  else {
    socket.emit("partner", null);
    waitingClientId = newClientId;
  }
}

/*
 board: [
   [null, null, null],
   [null, null, null],
   [null, null, null]
 ]
 */
function get(board, row, column) {
  return board[row][column];
}

function checkBoard(session) {
  var board = session.board;
  var horiz1, horiz2, horiz3, vert1, vert2, vert3;

  for (var i=0; i < 3; i++) {
    horiz1 = get(board, i, 0);
    horiz2 = get(board, i, 1);
    horiz3 = get(board, i, 2);
    vert1 = get(board, 0, i);
    vert2 = get(board, 1, i);
    vert3 = get(board, 2, i);
    if (horiz1 && horiz2 && horiz3 && horiz1 === horiz2 && horiz2 === horiz3) {
      return horiz1;//horizontal win
    }
    if (vert1 && vert2 && vert3 && vert1 === vert2 && vert2 === vert3) {
      return vert1;//vertical win
    }
  }
  horiz1 = get(board, 0, 0);
  horiz2 = get(board, 1, 1);
  horiz3 = get(board, 2, 2);
  if (horiz1 && horiz2 && horiz3 && horiz1 === horiz2 && horiz2 === horiz3) {
    return horiz1;//diagonal win (top-left to bottom-right)
  }
  horiz1 = get(board, 2, 0);
  horiz3 = get(board, 0, 2);
  if (horiz1 && horiz2 && horiz3 && horiz1 === horiz2 && horiz2 === horiz3) {
    return horiz1;//diagonal win (top-right to bottom-left)
  }
}

//Socket connection handler
io.on('connection', function (socket) {

  addClient(socket);

  var clientId = socket.id;
  console.log("A user connected. Session ID is", clientId);
  socket.emit("session", clientId);

  //handle new user
  manageSession(socket, function(){});

  //handle moves
  socket.on("action", function(event) {
    var userId = socket.id;
    var session = getSessionByUserid(userId);
    if (session) {
      var char, opponent;
      if (userId === session.userO) {
        char = "O";
        opponent = session.userX;
      }
      else {
        char = "X";
        opponent = session.userO;
      }
      // console.log("Action!", event, session);

      if (!session.winner && !session.board[event.row][event.col] && session.nextPlayer === userId) {
        session.board[event.row][event.col] = char;
        session.nextPlayer = opponent;
        io.to(session.id).emit("boardChange", session.board);
        var winner = checkBoard(session);
        if (winner) {
          var winningPlayer, losingPlayer;
          if (winner === "O") {
            winningPlayer = session.userO;
            losingPlayer = session.userX;
          }
          else {
            winningPlayer = session.userX;
            losingPlayer = session.userO;
          }
          getClient(winningPlayer).emit("gameOver", {status: 1, message: "You've won!"});
          getClient(losingPlayer).emit("gameOver", {status: 0, message: "You've lost!"});
          session.winner = winningPlayer;
        }
      }
      else {
        socket.emit("userError", "Not allowed");
      }
    }
  })

  //handle disbanding of sessions
  socket.on("disconnect", function () {
    var userId = socket.id;
    var session = getSessionByUserid(userId);
    console.log("client disconnected!", userId, "cleaning up resources");
    if (session) {
      var partnerId = session.userO === userId ? session.userX : session.userO;
      if (partnerId) {
        console.log("partner is orphaned:", partnerId);
        deleteSession(session);
      }
      else {
        console.log("No active players remain");
      }
      var partnerSocket = getClient(partnerId);
      manageSession(partnerSocket, function(){});
    }
    else {
      console.log("No active players remain");
    }
    deleteClient(socket);
  });
});

/**
 * Start server
 */
var port = process.env.PORT || '8000';
server.listen(port, function () {
  console.log('listening on', server.address());
});


// module.exports = app;

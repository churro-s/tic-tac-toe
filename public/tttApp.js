/*jshint -W098 */
"use strict";

/**
 * Resources:
 * http://jsfiddle.net/thai/8Gsyr/
 * https://github.com/btford/angular-socket-io-im/blob/master/public/js/services.js
 */

var tttApp =
  angular.module("tttApp", ['ngAnimate', 'toaster'])
    .controller("TicTacToeController", function ($scope, socket, toaster) {

      $scope.sessionId = "No session";
      $scope.gameOver = false;

      function resetBoard() {
        $scope.board = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        $scope.gameOver = false;
      }
      resetBoard();

      socket.on("session", function (sessionId) {
        $scope.sessionId = sessionId;
        toaster.pop('success', "Board Reset");
        resetBoard();
      });

      socket.on("partner", function (data) {
        $scope.partner = data || "Waiting for partner";
        console.log("received partner", data);
        resetBoard();
      });

      socket.on("boardChange", function(data) {
        $scope.board = data;
      });

      socket.on("userError", function(message) {
        toaster.pop('error', message);
      });

      socket.on("gameOver", function(data) {
        $scope.gameOver = true;
        if (data && data.status) {
          toaster.pop({
            type: "success",
            title: data.message,
            timeout: 5000
          });
        }
        else {
          toaster.pop({
            type: "warning",
            title: data.message,
            timeout: 5000
          });
        }
      });

      function getCell(row, column) {
        return $scope.board[row][column];
      }

      function setCell(row, column, value) {
        $scope.board[row][column] = value;
      }


      $scope.cellClass = function (row, column) {
        var value = getCell(row, column);
        return "cell cell-" + value;
      };

      //What text to display in cell
      $scope.cellText = function (row, column) {
        var value = getCell(row, column);
        return value ? value : " ";
      };

      //When a user clicks on a cell, emit the event to socket server
      $scope.cellClick = function (row, column) {
        socket.emit("action", {row: row, col: column});
      }

    });

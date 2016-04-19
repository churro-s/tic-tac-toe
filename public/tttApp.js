/*jshint -W098 */
"use strict";

var tttApp =
  angular.module("tttApp", ["ui.bootstrap"])
    .controller("TicTacToeController", function ($scope, socket) {

      $scope.sessionId = "No session";
      function resetBoard() {
        $scope.board = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
      }
      resetBoard();

      socket.on("session", function (sessionId) {
        
        $scope.sessionId = sessionId;
      });

      $scope.players = {
        X: "X",
        O: "O"
      };
      socket.on("partner", function (data) {
        console.log("received partner", data);
        alert("Received a new partner, the game has been reset");
        resetBoard();
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
      $scope.cellText = function (row, column) {
        var value = getCell(row, column);
        return value ? value : " ";
      };

      $scope.cellClick = function (row, column) {
        if ($scope.winner) {
          alert("Already game over.")
          return;
        }
        if ($scope.player != $scope.currentPlayer) {
          alert("Not your turn.")
          return;
        }
        setCell(row, column, $scope.player)
        checkBoard()
        $scope.currentPlayer = nextPlayer($scope.currentPlayer);
      }

    });

"use strict";

let webSocketServer = require('websocket').server;
let http = require('http');

let server = http.createServer(function (request, response) {});

//8080 포트로 서버 개통
server.listen(8080, function () {});

let wsServer = new webSocketServer({ httpServer: server });

let chattingRooms = {}; //채팅방의 커넥션을 관리 객체

wsServer.on('request', function (request) {
    let connection = request.accept(null, request.origin);

    connection.on('message', function (message) {
      let data = {};
      try {
        if (message.type === 'utf8') {
          data = JSON.parse(message.utf8Data); //client에서 JSON을 문자열 형태로 변환시켜 보내주므로, JSON형태로 다시 변환
        }
      } catch (e) {
        handleError(e);
      }

      switch (data.type) {
        case 'create': //채팅방 만들기 요청
          handleCreate(connection, data);
          break;
        case 'join' :
          handleJoin(connection, data);
          break;
        case 'offer' :
          handleOffer(connection, data);
          break;
        case 'answer' :
          handleAnswer(connection, data);
          break;
        case 'candidate' :
          handleCandidate(data);
          break;
        default : //위의 message type외에는 지원하지 않는다.
          sendTo(connection, {
            type : 'error',
            message : 'Command not found : ' + data.type
          });
          break;
      }
    });

    connection.on("close", function() {
      let chattingRoomId = connection.chattingRoomId;
      if (chattingRoomId) { //채팅방에 접속한 사람이라면 connection을 찾아 삭제한다.
        for (let i in chattingRooms[chattingRoomId]) {
          let peer = chattingRooms[chattingRoomId][i];
          if (peer.id === connection.id) { //채팅방의 id와 종료한 connection의 id가 같으면
            chattingRooms[chattingRoomId].splice(i, 1); //connection 삭제
          }
        }

        if (chattingRooms[chattingRoomId].length === 0) { //채팅방에 connection이 0이면 채팅방을 삭제
          delete chattingRooms[chattingRoomId];
        }
      }
    });
});

function handleCreate(connection, data) {
  if (chattingRooms[data.chattingRoomId]) { //이미 존재하는 채팅방이면
    sendTo(connection, {
      type : 'create',
      success : false, //채팅방 만들기 실패
      message : 'chatting room already exists' //이미 존재하는 채팅방이라는 메시지를 보낸다.
    });
  } else {
    chattingRooms[data.chattingRoomId] = new Array();

    connection.chattingRoomId = data.chattingRoomId; //브라우저 종료시 connection 삭제를 위해 채팅방 이름을 저장
    connection.id = data.id; //브라우저 종료시 connection 삭제를 위해 id를 저장
    chattingRooms[data.chattingRoomId].push({connection : connection, id : data.id}); //connection 저장(채팅방 만든 peer)

    sendTo(connection, {
      type : 'create',
      success : true //채팅방 만들기 성공
    });
  }
}

function handleJoin(connection, data) {
  if (chattingRooms[data.chattingRoomId]) {
    sendTo(connection, {
      type : 'join',
      success : true //채팅방 참가 실패
    });
  } else {
    sendTo(connection, {
      type : 'join',
      success : false, //채팅방 참가 실패
      message : 'chatting room doesn`t exists'
    });
  }
}

function handleAnswer(connection, data) {
  var conn;
  chattingRooms[data.chattingRoomId].forEach(function (chat) { //채팅방에 접속한 자신을 제외한 peer들에게 answer을 보낸다.
    if (chat.id != data.id) {
      sendTo(chat.connection, {
        type : 'answer',
        answer : data.answer //answer를 보낸 peer(기존의 채팅방에 있는)의 description을 기존의 peer에게 전달
      });
    }
  });
}

function handleOffer(connection, data) {
  connection.chattingRoomId = data.chattingRoomId; //브라우저 종료시 connection 삭제를 위해 채팅방 이름을 저장
  connection.id = data.id; //브라우저 종료시 connection 삭제를 위해 id를 저장
  chattingRooms[data.chattingRoomId].push({connection : connection, id : data.id}); //connection 저장(채팅방에 들어온 peer)

  var conn;
  chattingRooms[data.chattingRoomId].forEach(function (chat) { //채팅방에 접속한 자신을 제외한 peer들에게 offer를 보낸다.
    if (chat.id != data.id) {
      sendTo(chat.connection, {
        type : 'offer',
        success : true,
        offer : data.offer //offer를 보낸 peer(채팅방에 들어온)의 description을 기존의 peer에게 전달
      });
    }
  });
}

function handleCandidate(data) {
  chattingRooms[data.chattingRoomId].forEach(function (chat) {
    if (chat.id != data.id) { //채팅방에 참여한 peer들에게 ICE candidate를 보낸다.
      sendTo(chat.connection, {
          type : 'candidate',
          candidate : data.candidate //ICE candidate
      });
    }
  });
}

function sendTo(connection, message) {
   connection.send(JSON.stringify(message));
}

function handleError(e) {
  console.log(e);
}

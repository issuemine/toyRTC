"use strict";

let webSocketServer = require('websocket').server;
let http = require('http');

let server = http.createServer(function(request, response) {});

//8080 포트로 서버 개통
server.listen(8080, function() {});

let websocketServer = new webSocketServer({ httpServer: server });

let peerId = 0; //id 시리얼 번호
let chattingRooms = {}; //채팅방의 커넥션을 관리 객체

websocketServer.on('request', function (request) {
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
        case 'connect': //맨 처음 접속했을 때 server에서 내려주는 값
          handleConnect(connection);
          break;
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
        case 'bitrate' :
          handleBitrate(data);
          break;
        case 'leave' :
          delete connection.chattingRoomId; //connection에서 채팅방 이름을 없앤다.
          handleLeave(data.chattingRoomId, data.id);
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
      if (chattingRoomId) { //채팅방에 접속한 사람이 나간경우에는 채팅방에서 connection을 찾아 삭제한다.
        delete connection.chattingRoomId; //connection에서 채팅방 이름을 없앤다.
        handleLeave(chattingRoomId, connection.id);
      }
    });
});

function handleConnect(connection) { //접속한 peer에게 server에서 내려주는 초기 값
  let chattingRoomInformations = getChattingRoomInformations();
  let id = connection.id;

  if (id === null || id === undefined) { //이미 id가 있는 connection은 id를 새로 만들어주지 않는다.
    id = generateId();
  }

  sendTo(connection, {
    type : 'connect',
    chattingRoomInformations : chattingRoomInformations,
    id : id
  });
}

function handleCreate(connection, data) {
  if (chattingRooms[data.chattingRoomId]) { //이미 존재하는 채팅방이면
    sendTo(connection, {
      type : 'error',
      message : 'chatting room already exists' //이미 존재하는 채팅방이라는 메시지를 보낸다.
    });
  } else {
    chattingRooms[data.chattingRoomId] = new Array();

    connection.chattingRoomId = data.chattingRoomId; //브라우저 종료시 connection 삭제를 위해 채팅방 이름을 저장
    connection.id = data.id; //브라우저 종료시 connection 삭제를 위해 id를 저장
    chattingRooms[data.chattingRoomId].push({connection : connection, id : data.id}); //connection 저장(채팅방 만든 peer)

    sendTo(connection, {
      type : 'create'
    });
  }
}

function handleJoin(connection, data) {
  if (chattingRooms[data.chattingRoomId]) {
    let peerInformations = getPeerInformations(data.chattingRoomId); //새로운 참가자에게 보낼 채팅방 정보들

    connection.chattingRoomId = data.chattingRoomId; //브라우저 종료시 connection 삭제를 위해 채팅방 이름을 저장
    connection.id = data.id; //브라우저 종료시 connection 삭제를 위해 id를 저장

    let isPeer = chattingRooms[data.chattingRoomId].find(function (peer) { //이미 존재하는 peer인지 찾는다.
      return peer.id == data.id;
    });

    if (isPeer === null || isPeer === undefined) { //peer가 없다면, 처음 채팅방에 들어온 peer로 간주하여 connection을 저장한다.
      chattingRooms[data.chattingRoomId].push({connection : connection, id : data.id}); //connection 저장(채팅방에 들어온 peer)
    }

    sendTo(connection, {
      type : 'join',
      numberOfPeer : peerInformations.length, //peer들 수
      peerInformations : peerInformations
    });

  } else {
    sendTo(connection, {
      type : 'error',
      message : 'chatting room doesn`t exists'
    });
  }
}

function handleOffer(connection, data) {
  findPeer(data, function(connection, data) {
    sendTo(connection, {
      type : 'offer',
      offer : data.offer, //offer를 보낸 peer(채팅방에 들어온)의 description을 기존의 peer에게 전달
      otherId : data.id //offer를 보낸 peer의 id
    });
  });
}

function handleAnswer(connection, data) {
  findPeer(data, function (connection, data) {
    sendTo(connection, {
      type : 'answer',
      answer : data.answer, //answer를 보낸 peer(기존의 채팅방에 있는)의 description을 기존의 peer에게 전달
      otherId : data.id //answer를 보낸 peer의 id
    });
  });
}

function handleCandidate(data) {
  findPeer(data, function (connection, data) {
    sendTo(connection, {
      type : 'candidate',
      candidate : data.candidate,
      otherId : data.id //candidate를 보낸 peer의 id
    });
  });
}

function handleBitrate(data) {
  findPeer(data, function (connection, data) {
    sendTo(connection, {
      type : 'bitrate',
      bitrate : data.bitrate,
      otherId : data.id
    });
  });
}

function handleLeave(chattingRoomId, leavedPeerId) {
  for (let i in chattingRooms[chattingRoomId]) {
    let peerConnection = chattingRooms[chattingRoomId][i];
    if (peerConnection.id !== leavedPeerId) { //채팅방의 id와 종료한 peer의 id가 같으면
      sendTo(peerConnection.connection, { //client에 접속 종료 peer의 id를 알려준다.
        type : 'leave',
        otherId : leavedPeerId
      });
    }
  }

  for (let i in chattingRooms[chattingRoomId]) {
    let peerConnection = chattingRooms[chattingRoomId][i];
    if (peerConnection.id === leavedPeerId) { //채팅방의 id와 종료한 peer의 id가 같으면
      chattingRooms[chattingRoomId].splice(i, 1); //connection 삭제
    }
  }

  if (chattingRooms[chattingRoomId].length === 0) { //채팅방에 peer가 0이면 채팅방을 삭제
    delete chattingRooms[chattingRoomId];
  }
}

function getChattingRoomInformations() {
  let chattingRoomInformations = new Array();
  for (let chattingRoomId in chattingRooms) {
    chattingRoomInformations.push({chattingRoomId : chattingRoomId, numberOfPeer : chattingRooms[chattingRoomId].length});
  }
  return chattingRoomInformations;
}

function getPeerInformations(chattingRoomId) {
  let peersInformations = new Array();
  for (let i in chattingRooms[chattingRoomId]) { //채팅방에 접속한 peer들의 id를 얻어온다.
    let peerConnection = chattingRooms[chattingRoomId][i];
    peersInformations.push({id : peerConnection.id});
  }
  return peersInformations;
}

function findPeer(data, callBack) { //채팅방에 접속해있는 peer를 id로 찾아주는 메소드이다.
  chattingRooms[data.chattingRoomId].forEach(function(peerConnection) {
    if (peerConnection.id === data.otherId) {
      callBack(peerConnection.connection, data);
    }
  });
}

function generateId() {
  return ++peerId;
}

function sendTo(connection, message) {
   connection.send(JSON.stringify(message));
}

function handleError(e) {
  console.log(e);
}

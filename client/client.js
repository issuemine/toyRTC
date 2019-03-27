'use strict';

//web socket 생성
//let connection = new WebSocket('wss://hyobeom-toy.dongju.kim/websocket/');
let connection = new WebSocket('ws:127.0.0.1:8080');

let id = 0;

connection.onopen = function() {
  send({
    type : 'connect'
  });
}

connection.onerror = function(error) { //통신 접속에러시 에러 처리 이벤트 핸들러
  handleError(error);
}

//메세지 수신 이벤트 핸들러
connection.onmessage = function(message) {
  var data = JSON.parse(message.data);
  switch (data.type) {
    case 'connect' :
      handleConnect(data);
      break;
    case 'create' :
      handleCreate(data); //처음 채팅방을 만들 경우 실패 성공여부에 따라 설정 초기화를 할지를 결정
      break;
    case 'join' :
      handleJoin(data); //채팅방을 들어갈 경우, 채팅방의 존재 여부에 따라 작동이 달라진다.
      break;
    case 'offer' :
      handleOffer(data); //이미 존재하는 방에 상대방이 참여하여 offer메시지를 보냈을 경우 상대방 description에 offer 설정 및 answer 생성
      break;
    case 'answer' :
      handleAnswer(data); //offe를 받은 상대방이 보낸 answer를 받아 상대방의 description에 answer 설정
      break;
    case 'candidate' :
      handleCandidate(data); //offer/answer에 의해 description을 정상적으로 설정한 후 서로의 경로에 대한 candidate를 처리
      break;
    case 'bitrate' : //bitrate 수신 값 조종 처리
      handleBitrate(data);
      break;
    case 'leave' :
      handleLeave(data); //다른 peer가 종료시 connection과 화면에서 없애주는 처리
      break;
    case 'error' :
      handleServerMessage(data.message);
      break;
    default :
      handleError(data.message); //위에 정의되어 있지 않는 type의 메시지
      break;
  }
}

const joinDiv = document.getElementById('join_div'); //채팅방에 참여하는 화면을 관리하는 div 태그

const chattingRoomIdInput = document.getElementById('chatting_room_id'); //채팅방 이름를 입력하는 input 태그
let chattingRoomId; //채팅방 이름

const textChattingInput = document.getElementById('text_chatting_input');
const textChattingSendBtn = document.getElementById('text_chatting_send_btn');
const textChattingMessageListRoot = document.getElementById('text_chatting_message_list');

const createBtn = document.getElementById('create_btn'); //채팅방 만드는 버튼
const joinBtn = document.getElementById('join_btn'); //참여 버튼
const exitBtn = document.getElementById('exit_btn'); //참여 버튼

const chattingDiv = document.getElementById('chatting_div');

const localVideo = document.getElementById('local_video'); //local stream을 화면에 노출해주는 vidio 태그
const localId = document.getElementById("local_id");
const remoteVideo = document.getElementById('remote_video'); //P2P 연결시 받아온 상대방의 stream을 화면에 노출해주는 video 태그

let peerConnections = new Array();

let localStream;

//채팅방 만들기
createBtn.onclick = function(event) {
  //채팅방 이름 입력 input 태그에서 입력된 값을 가져온다.
  chattingRoomId = chattingRoomIdInput.value;

  if (chattingRoomId) { //채팅방 이름가 입력되어 있는지 확인
    send({
      type : 'create', //채팅방을 만드는 message type
      chattingRoomId : chattingRoomId,
      id : id //사용자 id
    });
  }
}

joinBtn.onclick = function(event) {
  send({
    type : 'join',
    chattingRoomId : chattingRoomIdInput.value, //참여할 채팅방 이름
    id : id //참여자 id
  });
}

exitBtn.onclick = function(event) {
  exitChattingRoom(); //채팅방 나가기 함수
}

textChattingSendBtn.onclick = function(event) {
  let message = textChattingInput.value;
  let sendedMessage = {
    message : message,
    id : id
  };

  for (let i in peerConnections) { //peer들에게 message를 보낸다.
    peerConnections[i].sendMessage(sendedMessage);
  }

  addTextChattingMessage(sendedMessage); //local 텍스트 채팅창에 채팅글 추가
  textChattingInput.value = '';
}

function handleConnect(data) {
  id = data.id;
  makeChattingRoomList("chatting_room_list", data); //채팅방 목록을 받아온다.
}

function handleCreate(data) { //채팅방 만들기 이벤트 후 결과를 받아 처리하는 함수
  init(); //방 만들기가 성공하면 설정을 초기화
}

async function handleJoin(data) {
  chattingRoomId = chattingRoomIdInput.value;

  await init(); //채팅방 접속시 설정 초기화

  let peerInformations = data.peerInformations; //기참여 peer들의 정보

  for (let i = 0; i < data.numberOfPeer; i++) { //peer 개수만큼 connection을 만든다.
    let otherId = peerInformations[i].id; //offer를 보낼 다른 peer의 id
    let newPeerConnection = makePeerConnection(localStream, otherId);

    try {
      const offer = await newPeerConnection.createOffer({
        offerToReceiveAudio : true, //연결된 다른 peer에 오디오 전송 요청 제어 여부
        offerToReceiveVideo : true  //연결된 다른 peer에 비디오 전송 요청 제어 여부
      });

      await newPeerConnection.setLocalDescription(offer); //offer로 만든 description을 local에 저장한다.

      send({
        type : 'offer', //offer를 보내는 message type
        offer : offer, //offer로 보낼 description
        chattingRoomId : chattingRoomId,
        id : id, //사용자 id
        otherId : otherId //offer를 받을 id
      });
    } catch (e) {
      handleError(e);
    }
  }
}

async function handleOffer(data) { //offer메시지를 보냈을 경우 상대방 description에 offer로 온 description 설정 및 answer 생성
  let otherId = data.otherId; //offer를 보낸 peer의 id
  let newPeerConnection = makePeerConnection(localStream, otherId);
  await newPeerConnection.setRemoteDescription(data.offer); //offer를 보낸 상대의 description을 설정한다.
  try {
    const answer = await newPeerConnection.createAnswer(); //offer를 보낸 상대방에게 보낼 answer를 생성한다.
    await newPeerConnection.setLocalDescription(answer); //local description을 설정한다.
    send({
      type : 'answer', //채팅방을 만드는 answer message type
      answer : answer, //SDP answer을 보낸다.
      chattingRoomId : chattingRoomId,
      id : id, //사용자 id
      otherId : otherId //answer를 받을 id
    });
  } catch (e) {
    handleError(e);
  }
}

function handleAnswer(data) {
  findPeer(data, async function(callBackData) {
    await peerConnections[callBackData.index].setRemoteDescription(callBackData.data); //ice candidate 목록을 추가한다.
  }, data.answer);
}

function handleCandidate(data) {
  findPeer(data, async function(callBackData) {
    await peerConnections[callBackData.index].addIceCandidate(callBackData.data); //ice candidate 목록을 추가한다.
  }, data.candidate);
}

function handleBitrate(data) {
  findPeer(data, function(callBackData) {
    //connection에서 data전송을 담당하는 sender를 가져온다.
    let sender = peerConnections[callBackData.index].getSenders().find(function (event) {
      return event.track.kind === 'video'; //video track에 대한 sender를 가져온다.
    });

    let parameters = sender.getParameters(); //track의 encoding과 전송 정보를 가져온다.

    if (!parameters.encodings) { //encoding정보가 없다면
      parameters.encodings = [{}]; //encoding을 생성
    }

    let selectedBitrate = callBackData.data;

    if (parameters.encodings.length > 0) { //bitrate 조절
      parameters.encodings[0].maxBitrate = selectedBitrate * 1000;
    } else {
      parameters.encodings[0].push({maxBitrate : selectedBitrate * 1000});
    }
    sender.setParameters(parameters); //변경된 encoding 정보를 설정한다.
  }, data.bitrate);
}

function handleLeave(data) {
  deleteOtherPeerVideo('video_chatting_div', data.otherId); //peer video ui삭제

  findPeer(data, function(callBackData) {
    let peerConnectionIndex = callBackData.index; //connection 삭제
    peerConnections[peerConnectionIndex].stop(); //connection 종료
    peerConnections.splice(peerConnectionIndex, 1);
  });
}

function handleError(error) {
  console.log(error);
}

function send(message) { //server에 보낼 메시지를 JSON형식으로 바꿔주는 메소드
  connection.send(JSON.stringify(message));
}

function handleServerMessage(message) { //user에게 server에서 보낸 메시지를 노출시킨다.
  alert(message);
}

async function init() { //채팅방 접속시 local 상태를 초기화하는 함수
  joinDiv.style.display = 'none'; //채팅방 만들기 화면을 가린다.
  chattingRoomIdInput.value = ''; //채팅방 id input
  chattingDiv.style.display = 'block';
  addTextChattingMessage({message : id + '님께서 입장하셨습니다.', id : id}); //채팅 내용 추가하기
  localId.innerHTML = id; //id정보 노출

  try {
    //local stream을 받아온다.
    const stream = await navigator.mediaDevices.getUserMedia({
      video : true,
      audio : true
    });
    getStream(stream); //local stream을 다루는 함수
  } catch (e) {
    handleError(e);
  }
}

function makePeerConnection(stream, otherId) {
  var configuration = { //connection에 stun server 설정하여, ice candidate를 찾을 수 있도록한다.
    "iceServers" : [{ "urls" : "stun:stun2.1.google.com:19302" }] //google에서 무료로 제공하는 stun server
  };

  let newPeerConnection = new RTCPeerConnection(configuration); //peer와 connection 생성
  newPeerConnection.id = otherId;

  let cloneStream = stream.clone(); //각 peer에게 보낼 stream을 복사하여 사용
  cloneStream.getTracks().forEach(track => {
    if (track.kind === 'audio') { //오디오이면 mute
      newPeerConnection.addTrack(track, cloneStream);
      newPeerConnection.mute = function mute() { //mute시 동작할 함수 등록
        track.enabled = !track.enabled;
      }
    } else if (track.kind === 'video') { //track이 video이면 blind
      newPeerConnection.addTrack(track, cloneStream);
      newPeerConnection.blind = function blind() { //blind시 동작할 함수 등록
        track.enabled = !track.enabled;
      }
    }
  }); //연결된 peer에게 보낼 track 을 설정한다.

  newPeerConnection.stop = function() { //peer connection 제거 함수 등록
    cloneStream.getTracks().forEach(track => {
        track.stop();
    });
  }

  newPeerConnection.onaddstream  = function(event) { //연결된 다른 peerd에서 넘어온 stream을 연결시킨다.
    makeVideo('video_chatting_div', newPeerConnection, event.stream);
  }

  newPeerConnection.onicecandidate = function(event) {
    if (event.candidate) {
      send({
        type : 'candidate', //ICE candidate를 교환하는 message type
        candidate : event.candidate, //candidate 정보
        chattingRoomId : chattingRoomId,
        id : id, //사용자 id
        otherId : otherId //ICE candidate를 받을 peer의 id
      });
    }
  }

  newPeerConnection.oniceconnectionstatechange = function(event) { //상대 peer의 상태 체크
    document.getElementById('state_span_' + newPeerConnection.id).innerHTML = newPeerConnection.iceConnectionState;
  }

  //out-band로 data channel을 연다.
  let dataChannel = newPeerConnection.createDataChannel("chat", {negotiated : true, id : chattingRoomId});
  newPeerConnection.sendMessage = function(message) {
    dataChannel.send(JSON.stringify(message));
  }

  dataChannel.onopen = function() { //data channel에 여는 것에 성공했을 때 보내는 메시지
    let message = {
      message : id + '님께서 입장하셨습니다.',
      id : id
    };
    dataChannel.send(JSON.stringify(message));
  }

  dataChannel.onmessage = function(event) {
    addTextChattingMessage(JSON.parse(event.data)); //채팅 내용 추가하기
  }

  peerConnections.push(newPeerConnection); //connection 관리를 위해 배열로 관리
  return newPeerConnection;
}

function getStream(stream) {
  localVideo.srcObject = stream;
  localStream = stream;
}

function findPeer(data, callBack, callBackData) { //채팅방에 접속해있는 peer를 id로 찾아주는 함수이다.
  for (let i in peerConnections) {
    if (peerConnections[i].id === data.otherId) {
      callBack({index : i, data : callBackData});
    }
  }
}

function blind(peerId) {
  let peerLocalStream = localStream;
  controlTrack(peerId, peerLocalStream,
    function () { //자신의 local stream에서 video를 blind시킨다.
      let videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
    },
    function(peerConnection, localStream) { //전체에게 blind하는 callback 함수
      peerConnection.blind();
  },
  function (peerConnection) { //특정 peer에게 blind하는 callback 함수
    peerConnection.blind();
  });

  let blindBtn = event.target; //blind 버튼 객체
  let isBlind = blindBtn.classList.toggle('blind'); //blind이 상태인지 아닌지 확인
  if (isBlind) {
    blindBtn.innerHTML = '화면 켜기';
  } else {
    blindBtn.innerHTML = '화면 끄기';
  }
}

function mute(peerId) {
  let peerLocalStream = localStream;
  controlTrack(peerId, localStream,
    function () { //자신의 local stream에서 audio를 mute시킨다.
      let audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
    },
    function(peerConnection) { //전체에게 mute를 하는 callback 함수
      peerConnection.mute();
  },
  function (peerConnection) { //특정 peer에게 mute를 하는 함수
    peerConnection.mute();
  });

  let muteBtn = event.target; //mute 버튼 객체
  let isMute = muteBtn.classList.toggle('mute'); //mute 상태인지 아닌지 확인
  if (isMute) {
    muteBtn.innerHTML = '소리 켜기';
  } else {
    muteBtn.innerHTML = '소리 끄기';
  }
}

//onceCallBack : 최초에 1번 실행될 callback함수
function controlTrack(peerId, localStream, onceCallBack, globalCallBack, peerCallBack) {
  for (let i in peerConnections) {
    let peerConnection = peerConnections[i];
    if (peerId === 'global') { //전체 peer에게 control이면
      if (i === '0') { //첫번째로 실행되는지 판단해서, 1번만 실행
        onceCallBack();
      }
      globalCallBack(peerConnection, localStream);
    } else {
      if (peerConnection.id === peerId) { //특정 peer에게 control이면
        peerCallBack(peerConnection, localStream);
      }
    }
  }
}

function makeChattingRoomList(chattingRoomListRootId, data) {
  let chattingRoomRoot = document.getElementById(chattingRoomListRootId);
  chattingRoomRoot.innerHTML = ''; //채팅방 리스트 초기화

  let chattingRoomInformations = data.chattingRoomInformations; //채팅방 정보

  chattingRoomInformations.forEach(function (chattingRoom) {
    let chattingRoomList = document.createElement('li');
    chattingRoomList.innerHTML = '방 이름 : ' + chattingRoom.chattingRoomId + ' 접속자 수 : ' + chattingRoom.numberOfPeer;
    chattingRoomRoot.appendChild(chattingRoomList);
  });
}

function makeVideo(videoDivId, peerConnection, stream) {
  let peerId = peerConnection.id; //새로 만들어질 peer의 id
  let remoteVideoDiv = document.createElement('div');
  remoteVideoDiv.setAttribute('id', peerId);

  let idSpan = document.createElement('span');
  idSpan.innerHTML = peerId;

  let stateSpan = document.createElement('span');
  stateSpan.setAttribute('id', 'state_span_' + peerId);

  let remoteIdDiv = document.createElement('div');
  remoteIdDiv.innerHTML = '상대방 ID : ' + idSpan.outerHTML + ' ' + stateSpan.outerHTML;
  remoteVideoDiv.appendChild(remoteIdDiv);

  let remoteVideo = document.createElement('video'); //remote 비디오 버튼
  remoteVideo.setAttribute('autoplay', '');
  remoteVideo.srcObject = stream;
  remoteVideoDiv.appendChild(remoteVideo);

  let blindBtn = document.createElement('button'); //blind 버튼
  blindBtn.innerHTML = '화면 끄기';
  blindBtn.setAttribute('onclick', 'blind(' + peerId +')');
  remoteVideoDiv.appendChild(blindBtn);

  let muteBtn = document.createElement('button'); //mute 버튼
  muteBtn.innerHTML = '소리 끄기';
  muteBtn.setAttribute('onclick', 'mute(' + peerId +')');
  remoteVideoDiv.appendChild(muteBtn);

  let bitRateSpan = document.createElement('span');
  bitRateSpan.innerHTML = 'bitrate';

  let bitrateSlider = document.createElement('input');
  bitrateSlider.setAttribute('type', 'range');
  bitrateSlider.setAttribute('min', 50);
  bitrateSlider.setAttribute('max', 1000);
  bitrateSlider.setAttribute('value', 500);
  bitrateSlider.oninput = function(event) {
    let bitRateValue = bitrateSlider.value
    //bitrate 조절시 상대방에게 bitrate 조절값을 보낸다.
    send({
      type : 'bitrate',
      chattingRoomId : chattingRoomId,
      bitrate : bitRateValue,
      id : id,
      otherId : peerId
    });
    bitRateSpan.innerHTML = 'bitrate : ' + bitRateValue + 'kbps';
  }
  remoteVideoDiv.appendChild(bitrateSlider);
  remoteVideoDiv.appendChild(bitRateSpan);
  document.getElementById(videoDivId).appendChild(remoteVideoDiv);
}

function addTextChattingMessage(data) {
  let textChattingMessagelist = document.createElement('li');
  textChattingMessagelist.innerHTML = data.id + ' : ' + data.message; //메시지 형식
  textChattingMessageListRoot.appendChild(textChattingMessagelist); //채팅 메시지 추가하기
}

function deleteOtherPeerVideo(videoDivId, otherId) {
  let videoDiv = document.getElementById(videoDivId);
  let remoteVideoDiv = document.getElementById(otherId);
  videoDiv.removeChild(remoteVideoDiv);
}

function exitChattingRoom() {
  send({
    type : 'leave',
    chattingRoomId : chattingRoomId,
    id : id
  });

  chattingRoomId = ''; //chattingRoomId 초기화
  joinDiv.style.display = 'block'; //참가창 노출
  chattingDiv.style.display = 'none'; //채팅방 가리기
  textChattingMessageListRoot.innerHTML = '';

  for (let i in peerConnections) {
    deleteOtherPeerVideo('video_chatting_div', peerConnections[i].id);
    peerConnections[i].stop(); //peerconnection 제거
  }

  peerConnections = new Array();

  localStream.getTracks().forEach(track => { //local stream 제거
    track.stop();
  });

  send({
    type : 'connect'
  });
}

'use strict';

//web socket 생성
let connection = new WebSocket('ws://localhost:8080');

//peer connection
let pc;

//id는 10000까지 랜덤으로 생성된다.
let id = Math.floor(Math.random() * 10000) + 1;


connection.onerror = function (error) { //통신 접속에러시 에러 처리 이벤트 핸들러
  handleError(error);
}

//메세지 수신 이벤트 핸들러
connection.onmessage = function (message) {
  var data = JSON.parse(message.data);
  switch (data.type) {
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
    default :
      handleError(data.message); //위에 정의되어 있지 않는 type의 메시지
      break;
  }
}

const joinDiv = document.getElementById('join_div'); //채팅방에 참여하는 화면을 관리하는 div 태그

const chattingRoomIdInput = document.getElementById('chatting_room_id'); //채팅방 이름를 입력하는 input 태그
let chattingRoomId; //채팅방 이름

const createBtn = document.getElementById('create_btn'); //채팅방 만드는 버튼
const joinBtn = document.getElementById('join_btn'); //참여 버튼

const chattingDiv = document.getElementById('chatting_div'); //채팅방 화면을 관리하는 div 태그
const localBlindBtn = document.getElementById('local_blind_btn');

const localVideo = document.getElementById('local_video'); //local stream을 화면에 노출해주는 vidio 태그
let localStream;

const remoteVideo = document.getElementById('remote_video'); //P2P 연결시 받아온 상대방의 stream을 화면에 노출해주는 video 태그

//채팅방 만들기
createBtn.onclick = function (event) {
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

joinBtn.onclick = function (event) {
  send({
    type : 'join',
    chattingRoomId : chattingRoomIdInput.value
  });
}

function handleCreate (data) { //채팅방 만들기 이벤트 후 결과를 받아 처리하는 함수
  if (data.success) { //방 만들기가 성공한지 여부를 확인한다.
    init(); //방 만들기가 성공하면 설정을 초기화
  } else {
    handleServerMessage(data.message); //방 만들기가 실패하면 실패한 이유가 message로 온다.
  }
}

async function handleJoin (data) {
  if (data.success) {
    chattingRoomId = chattingRoomIdInput.value;
    await init(); //채팅방 접속시 설정 초기화

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio : true, //연결된 다른 peer에 오디오 전송 요청 제어 여부
        offerToReceiveVideo : true  //연결된 다른 peer에 비디오 전송 요청 제어 여부
      });

      await pc.setLocalDescription(offer); //offer로 만든 description을 local에 저장한다.

      send({
        type : 'offer', //offer를 보내는 message type
        offer : offer, //offer로 보낼 description
        chattingRoomId : chattingRoomId,
        id : id //사용자 id
      });
    } catch (e) {
      handleError(e);
    }
  } else {
    handleServerMessage(data.message);
  }
}

async function handleOffer (data) { //offer메시지를 보냈을 경우 상대방 description에 offer로 온 description 설정 및 answer 생성
  await pc.setRemoteDescription(data.offer); //offer를 보낸 상대의 description을 설정한다.
  try {
    const answer = await pc.createAnswer(); //offer를 보낸 상대방에게 보낼 answer를 생성한다.
    await pc.setLocalDescription(answer); //local description을 설정한다.
    send({
      type : 'answer', //채팅방을 만드는 answer message type
      answer : answer, //SDP answer을 보낸다.
      chattingRoomId : chattingRoomId,
      id : id //사용자 id
    });
  } catch (e) {
    handleError(e);
  }
}

async function handleAnswer (data) {
  await pc.setRemoteDescription(data.answer); //answer의 description을 상대의 description로 설정
}

async function handleCandidate (data) {
  await pc.addIceCandidate(data.candidate); //ice candidate 목록을 추가한다.
}

function handleError(error) {
  console.log(error);
}

function send(message) { //server에 보낼 메시지를 JSON형식으로 바꿔주는 메소드
  connection.send(JSON.stringify(message));
}

function handleServerMessage(message) {
  alert(message);
}

async function init() { //채팅방 접속시 local 상태를 초기화하는 함수
  joinDiv.innerHTML = ""; //채팅방 만들기 화면을 없애므로, 채팅방 이름을 중간에 바꿀수 없게 한다.
  chattingDiv.style.display = 'block';

  try {
    //local stream을 받아온다.
    const stream = await navigator.mediaDevices.getUserMedia({
      video : true,
      audio : true
    });
    getStream(stream); //local stream을 다루는 함수
    peerConnection(stream); //peer connection을 설정하는 함수
  } catch (e) {
    handleError(e);
  }
}

function getStream(stream) {
  localVideo.srcObject = stream;
  localStream = stream;
}

function peerConnection(stream) {
  var configuration = { //connection에 stun server 설정하여, ice candidate를 찾을 수 있도록한다.
    "iceServers": [{ "urls": "stun:stun2.1.google.com:19302" }] //google에서 무료로 제공하는 stun server
  };

  pc = new RTCPeerConnection(configuration); //peer와 connection 생성

  stream.getTracks().forEach(track => pc.addTrack(track, stream)); //연결된 peer에게 보낼 track 을 설정한다.

  pc.onaddstream  = function (event) { //연결된 다른 peerd에서 넘어온 stream을 연결시킨다.
    remoteVideo.srcObject = event.stream;
  }

  pc.onicecandidate = function (event) {
    if (event.candidate) {
      send({
        type : 'candidate', //ICE candidate를 교환하는 message type
        candidate : event.candidate, //candidate 정보
        chattingRoomId : chattingRoomId,
        id : id //사용자 id
      });
    }
  }
}

localBlindBtn.onclick =  function blind(event) {
  let localVideoTrack = localStream.getVideoTracks()[0];
  localVideoTrack.enabled = !localVideoTrack.enabled; //video를 활용 여부 토글
}

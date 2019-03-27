class Model {
  constructor() {
    this.id = 0;
    this.chattingRoomId;
    this.peerConnections = new Array();
    this.localStream;
    this.connection;
    this.observer;
  }

  setConnection(connection) {
    this.connection = connection;
  }

  setObserver(observer) {
    this.observer = observer;
  }

  getId() {
    return this.id;
  }

  ///////////////////////////////////////////////////////////////////////////
  // view에서 action으로 넘어온 이벤트 처리
  ///////////////////////////////////////////////////////////////////////////
  requestCreateChattingRoom(chattingRoomId) {
    let $this = this;

    if(!(this.chattingRoomId)) {
      this.chattingRoomId = chattingRoomId;
      this._send({
        type : 'create', //채팅방을 만드는 message type
        chattingRoomId : chattingRoomId,
        id : $this.id //사용자 id
      });
    }
  }

  requestJoinChattingRoom(chattingRoomId) {
    let $this = this;

    if(!(this.chattingRoomId)) {
      this.chattingRoomId = chattingRoomId;
      this._send({
        type : 'join',
        chattingRoomId : chattingRoomId, //참여할 채팅방 이름
        id : $this.id //참여자 id
      });
    }
  }

  requestControlBitrate(bitrate, peerId) {
    let $this = this;
    //bitrate 조절시 상대방에게 bitrate 조절값을 보낸다.
    this._send({
      type : 'bitrate',
      chattingRoomId : $this.chattingRoomId,
      bitrate : bitrate,
      id : $this.id,
      otherId : peerId
    });
  }

  leaveChattingRoom() {
    let $this = this;
    this._send({
      type : 'leave',
      chattingRoomId : $this.chattingRoomId,
      id : $this.id
    });

    this.chattingRoomId = ''; //chattingRoomId 초기화


    for (let i in this.peerConnections) {
      let peerConnection = $this.peerConnections[i];
      $this.observer.notify('deleteOtherPeerVideo', peerConnection.id);
      peerConnection.stop(); //peerconnection 제거
    }

    this.peerConnections = new Array();

    this.localStream.getTracks().forEach(track => { //local stream 제거
      track.stop();
    });

    this._send({
      type : 'connect'
    });
  }

  sendTextChattingMessage(message) {
    let sendedMessage = {
      message : message,
      id : this.id
    };

    for (let i in this.peerConnections) { //peer들에게 message를 보낸다.
      this.peerConnections[i].sendMessage(sendedMessage);
    }
  }

  blind(peerId) {
    let peerLocalStream = this.localStream;
    this._controlTrack(peerId,
      function () { //자신의 local stream에서 video를 blind시킨다.
        let videoTrack = peerLocalStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
      },
      function(peerConnection) { //전체에게 blind하는 callback 함수
        peerConnection.blind();
    },
    function (peerConnection) { //특정 peer에게 blind하는 callback 함수
      peerConnection.blind();
    });
  }

  mute(peerId) {
    let peerLocalStream = this.localStream;
    this._controlTrack(peerId,
      function () { //자신의 local stream에서 audio를 mute시킨다.
        let audioTrack = peerLocalStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
      },
      function(peerConnection) { //전체에게 mute를 하는 callback 함수
        peerConnection.mute();
    },
    function (peerConnection) { //특정 peer에게 mute를 하는 함수
      peerConnection.mute();
    });
  }

  ////////////////////////////////////////////////////////////////////////
  //model의 websocket 통신 결과로 넘어온 이벤트 처리
  ////////////////////////////////////////////////////////////////////////
  handleConnect(data) {
    this.id = data.id;
  }

  async handleCreate() {
    return await this.localStreamInit(); //stream을 반환
  }

  async handleJoin(data) {
    let $this = this;
    let localStream = await this.localStreamInit(); //채팅방 접속시 설정 초기화

    let peerInformations = data.peerInformations; //기참여 peer들의 정보

    for (let i = 0; i < data.numberOfPeer; i++) { //peer 개수만큼 connection을 만든다.
      let otherId = peerInformations[i].id; //offer를 보낼 다른 peer의 id
      let newPeerConnection = this.makePeerConnection(localStream, otherId);

      try {
        const offer = await newPeerConnection.createOffer({
          offerToReceiveAudio : true, //연결된 다른 peer에 오디오 전송 요청 제어 여부
          offerToReceiveVideo : true  //연결된 다른 peer에 비디오 전송 요청 제어 여부
        });

        await newPeerConnection.setLocalDescription(offer); //offer로 만든 description을 local에 저장한다.

        this._send({
          type : 'offer', //offer를 보내는 message type
          offer : offer, //offer로 보낼 description
          chattingRoomId : $this.chattingRoomId,
          id : $this.id, //사용자 id
          otherId : otherId //offer를 받을 id
        });
      } catch (e) {
        handleError(e);
      }
    }
    return localStream;
  }

  async handleOffer(data) {
    let $this = this;
    let otherId = data.otherId; //offer를 보낸 peer의 id
    let newPeerConnection = this.makePeerConnection(this.localStream, otherId);
    await newPeerConnection.setRemoteDescription(data.offer); //offer를 보낸 상대의 description을 설정한다.
    try {
      const answer = await newPeerConnection.createAnswer(); //offer를 보낸 상대방에게 보낼 answer를 생성한다.
      await newPeerConnection.setLocalDescription(answer); //local description을 설정한다.
      this._send({
        type : 'answer', //채팅방을 만드는 answer message type
        answer : answer, //SDP answer을 보낸다.
        chattingRoomId : $this.chattingRoomId,
        id : $this.id, //사용자 id
        otherId : otherId //answer를 받을 id
      });
    } catch (e) {
      console.log(e);
      handleError(e);
    }
  }

  handleAnswer(data) {
    let $this = this;
    this._findPeer(data, async function(callBackData) {
      await $this.peerConnections[callBackData.index].setRemoteDescription(callBackData.data); //ice candidate 목록을 추가한다.
    }, data.answer);
  }

  handleCandidate(data) {
    let $this = this;
    this._findPeer(data, async function(callBackData) {
      await $this.peerConnections[callBackData.index].addIceCandidate(callBackData.data); //ice candidate 목록을 추가한다.
    }, data.candidate);
  }

  handleBitrate(data) {
    let $this = this;
    this._findPeer(data, function(callBackData) {
      //connection에서 data전송을 담당하는 sender를 가져온다.
      let sender = $this.peerConnections[callBackData.index].getSenders().find(function (event) {
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

  handleLeave(data) {
    let $this = this;

    this.observer.notify('deleteOtherPeerVideo', data.otherId);  //peer video ui삭제

    $this._findPeer(data, function(callBackData) {
      let peerConnectionIndex = callBackData.index; //connection 삭제
      $this.peerConnections[peerConnectionIndex].stop(); //connection 종료
      $this.peerConnections.splice(peerConnectionIndex, 1);
    });
  }

  makePeerConnection(stream, otherId) {
    let $this = this;
    let configuration = { //connection에 stun server 설정하여, ice candidate를 찾을 수 있도록한다.
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
      //onaddstream 이벤트 발생시 video화면을 만들기 위해 이벤트 발생을 client에게 알려준다.
      $this.observer.notify('onaddstream', {newPeerConnection : newPeerConnection, stream : event.stream});
    }

    newPeerConnection.onicecandidate = function(event) {
      if (event.candidate) {
        $this._send({
          type : 'candidate', //ICE candidate를 교환하는 message type
          candidate : event.candidate, //candidate 정보
          chattingRoomId : $this.chattingRoomId,
          id : $this.id, //사용자 id
          otherId : otherId //ICE candidate를 받을 peer의 id
        });
      }
    }

    newPeerConnection.oniceconnectionstatechange = function(event) { //상대 peer의 상태 체크
      $this.observer.notify('oniceconnectionstatechange', {id : newPeerConnection.id, state : newPeerConnection.iceConnectionState});
    }

    this._createDataChannel(newPeerConnection); //텍스트 채팅 채널 만들기

    this.peerConnections.push(newPeerConnection); //connection 관리를 위해 배열로 관리
    return newPeerConnection;
  }

  async localStreamInit() {
    try {
      //local stream을 받아온다.
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video : true,
        audio : true
      });
      return this.localStream;
    } catch (e) {
      handleError(e);
    }
  }

  sendMessage(type, data) { //message를 만들어서 보낸다.
    let message = {type : type};
    for (let key in data) {
      message[key] = data[key];
    }
    this._send(message);
  }

  _findPeer(data, callBack, callBackData) { //채팅방에 접속해있는 peer를 id로 찾아주는 함수이다.
    for (let i in this.peerConnections) {
      if (this.peerConnections[i].id === data.otherId) {
        callBack({index : i, data : callBackData});
      }
    }
  }

  _send(message) { //server에 보낼 메시지를 JSON형식으로 바꿔주는 메소드
    this.connection.send(JSON.stringify(message));
  }

  //onceCallBack : 최초에 1번 실행될 callback함수
  _controlTrack(peerId, onceCallBack, globalCallBack, peerCallBack) {
    for (let i in this.peerConnections) {
      let peerConnection = this.peerConnections[i];
      if (peerId === 'global') { //전체 peer에게 control이면
        if (i === '0') { //첫번째로 실행되는지 판단해서, 1번만 실행
          onceCallBack();
        }
        globalCallBack(peerConnection, this.localStream);
      } else {
        if (peerConnection.id === peerId) { //특정 peer에게 control이면
          peerCallBack(peerConnection, this.localStream);
        }
      }
    }
  }

  _createDataChannel(newPeerConnection) {
    let $this = this;
    //out-band로 data channel을 연다.
    let dataChannel = newPeerConnection.createDataChannel("chat", {negotiated : true, id : 1});
    newPeerConnection.sendMessage = function(message) {
      dataChannel.send(JSON.stringify(message));
    }

    dataChannel.onopen = function() { //data channel에 여는 것에 성공했을 때 보내는 메시지
      let message = {
        message : $this.id + '님께서 입장하셨습니다.',
        id : $this.id
      };
      dataChannel.send(JSON.stringify(message));
    }

    dataChannel.onmessage = function(event) {
      $this.observer.notify('onmessage', JSON.parse(event.data));
    }
  }
}

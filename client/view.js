class View {
  constructor() {
    this.client;
    this.createBtn = document.getElementById('create_btn'); //채팅방 만드는 버튼
    this.joinBtn = document.getElementById('join_btn'); //참여 버튼
    this.chattingRoomIdInput = document.getElementById('chatting_room_id'); //채팅방 이름를 입력하는 input 태그
    this.joinDiv = document.getElementById('join_div'); //채팅방에 참여하는 화면을 관리하는 div 태그
    this.chattingDiv = document.getElementById('chatting_div');
    this.localId = document.getElementById("local_id");
    this.localVideo = document.getElementById('local_video'); //local stream을 화면에 노출해주는 video 태그
    this.textChattingMessageListRoot = document.getElementById('text_chatting_message_list'); //텍스트 채팅 최상위 창
    this.textChattingInput = document.getElementById('text_chatting_input');
    this.textChattingSendBtn = document.getElementById('text_chatting_send_btn');
    this.exitBtn = document.getElementById('exit_btn'); //참여 버튼
    this.localBlindBtn = document.getElementById('local_blind_btn'); //참여 버튼
    this.localMuteBtn = document.getElementById('local_mute_btn'); //참여 버튼
  }

  setClient(client) {
    this.client = client;
  }

  init() {
    let $this = this;
    this.client.init();

    // ui에서 작동되는 이벤트 등록
    this.createBtn.onclick = function (event) {
      let chattingRoomId = $this.chattingRoomIdInput.value;
      $this.client.createChattingRoom(chattingRoomId);
    }

    this.joinBtn.onclick = function(event) {
      let chattingRoomId = $this.chattingRoomIdInput.value;
      $this.client.joinChattingRoom(chattingRoomId);
    }

    this.textChattingSendBtn.onclick = function(event) {
      let message = $this.textChattingInput.value;
      $this.client.sendTextChattingMessage(message);
      $this.addTextChattingMessage(message); //local 텍스트 채팅창에 채팅글 추가
      $this.textChattingInput.value = '';
    }

    this.exitBtn.onclick = function(event) {
      $this.joinDiv.style.display = 'block'; //참가창 노출
      $this.chattingDiv.style.display = 'none'; //채팅방 가리기
      $this.textChattingMessageListRoot.innerHTML = '';
      $this.client.leaveChattingRoom();
    }

    this.localBlindBtn.onclick = function(event) {
      $this.client.blind('global');

      let blindBtn = event.target;
      let isBlind = blindBtn.classList.toggle('blind'); //blind이 상태인지 아닌지 확인
      if (isBlind) {
        blindBtn.innerHTML = '화면 켜기';
      } else {
        blindBtn.innerHTML = '화면 끄기';
      }
    }

    this.localMuteBtn.onclick = function(event) {
      $this.client.mute('global');

      let muteBtn = event.target;
      let isMute = muteBtn.classList.toggle('mute'); //mute 상태인지 아닌지 확인
      if (isMute) {
        muteBtn.innerHTML = '소리 켜기';
      } else {
        muteBtn.innerHTML = '소리 끄기';
      }
    }
  }

  makeChattingRoom(id, stream) {
    this.joinDiv.style.display = 'none'; //채팅방 만들기 화면을 가린다.
    this.chattingRoomIdInput.value = ''; //채팅방 id input
    this.chattingDiv.style.display = 'block';
    this.localId.innerHTML = id; //id정보 노출
    this.localVideo.srcObject = stream;
    this.addTextChattingMessage(id + '님께서 입장하셨습니다.', id); //채팅 내용 추가하기
  }

  makeChattingRoomList(data) {
    let chattingRoomRoot = document.getElementById('chatting_room_list');
    chattingRoomRoot.innerHTML = ''; //채팅방 리스트 초기화

    let chattingRoomInformations = data.chattingRoomInformations; //채팅방 정보

    chattingRoomInformations.forEach(function (chattingRoom) {
      let chattingRoomList = document.createElement('li');
      chattingRoomList.innerHTML = '방 이름 : ' + chattingRoom.chattingRoomId + ' 접속자 수 : ' + chattingRoom.numberOfPeer;
      chattingRoomRoot.appendChild(chattingRoomList);
    });
  }

  makeVideo(peerConnection, stream) {
    let $this = this;
    let peerId = peerConnection.id; //새로 만들어질 peer의 id

    let remoteVideoDiv = this._createElement('div', {id : peerId});

    let idSpan = this._createElement('span', {}, peerId);

    let stateSpan = this._createElement('span', { id : 'state_span_' + peerId });

    let remoteIdDiv = this._createElement('div', {}, '상대방 ID : ' + idSpan.outerHTML + ' ' + stateSpan.outerHTML);
    remoteVideoDiv.appendChild(remoteIdDiv);

    let remoteVideo = document.createElement('video'); //remote 비디오 버튼
    remoteVideo.setAttribute('autoplay', '');
    remoteVideo.srcObject = stream;
    remoteVideoDiv.appendChild(remoteVideo);

    let blindBtn = this._createElement('button', {}, '화면 끄기');
    blindBtn.onclick = function(event) {
      $this.client.blind(peerId);

      let isBlind = blindBtn.classList.toggle('blind'); //mute 상태인지 아닌지 확인
      if (isBlind) {
        blindBtn.innerHTML = '화면 켜기';
      } else {
        blindBtn.innerHTML = '화면 끄기';
      }
    }
    remoteVideoDiv.appendChild(blindBtn);

    let muteBtn = this._createElement('button', {}, '소리 끄기');
    muteBtn.onclick = function() {
      $this.client.mute(peerId);

      let isMute = muteBtn.classList.toggle('mute'); //mute 상태인지 아닌지 확인
      if (isMute) {
        muteBtn.innerHTML = '소리 켜기';
      } else {
        muteBtn.innerHTML = '소리 끄기';
      }
    }
    remoteVideoDiv.appendChild(muteBtn);

    let bitRateSpan = this._createElement('span', {}, 'bitrate');

    let bitrateSlider = this._createElement('input', { type : 'range', min : 50, max : 1000, value : 500 });
    bitrateSlider.oninput = function(event) {
      let bitRateValue = bitrateSlider.value;
      $this.client.controlBitrate(bitRateValue, peerId);
      bitRateSpan.innerHTML = 'bitrate : ' + bitRateValue + 'kbps';
    }

    remoteVideoDiv.appendChild(bitrateSlider);
    remoteVideoDiv.appendChild(bitRateSpan);
    document.getElementById('video_chatting_div').appendChild(remoteVideoDiv);
  }

  setConnectionState(id, state) {
    let stateSpan = document.getElementById('state_span_' + id)
    if (stateSpan) {
      stateSpan.innerHTML = state;
    }
  }

  addTextChattingMessage(message, id) {
    let textChattingMessagelist = document.createElement('li');
    let sendedMessage = id ? id + ' : ' + message : message;
    textChattingMessagelist.innerHTML = sendedMessage; //메시지 형식
    this.textChattingMessageListRoot.appendChild(textChattingMessagelist); //채팅 메시지 추가하기
  }

  deleteOtherPeerVideo(otherId) {
    let videoDiv = document.getElementById('video_chatting_div');
    let remoteVideoDiv = document.getElementById(otherId);
    videoDiv.removeChild(remoteVideoDiv);
  }

  connectFailTextChat() {
    document.getElementById('text_chatting').innerHTML = '텍스트 채팅 접속에 실패하였습니다.';
  }

  alertMessage(message) {
    alert(message);
  }

  error(message) {
    console.log(message);
  }

  _createElement(elementType, attributes, innerHTML) {
    let element = document.createElement(elementType);

    for (let key in attributes) {
      element.setAttribute(key, attributes[key]);
    }

    if (innerHTML) {
      element.innerHTML = innerHTML;
    }
    return element;
  }
}

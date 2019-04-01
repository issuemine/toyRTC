'use strict';

class Client {
  constructor(view, model) {
    this.view = view;
    this.model = model;
    this.connection;
    this.observer = new Observer();
  }

  init() {
    this.connection = new WebSocket('ws:127.0.0.1:8080'); //소켓 통신 시작
    this.model.setConnection(this.connection);  //모델에서 사용할 connection 등록
    this.model.setObserver(this.observer); //옵저버 등록

    //model에서 이벤트발생시 view에게 알려주는 핸들러 등록
    this.observer.register('onaddstream', this.addVideo, this);
    this.observer.register('oniceconnectionstatechange', this.setConnectionState, this);
    this.observer.register('onmessage', this.addTextChattingMessage, this);
    this.observer.register('deleteOtherPeerVideo', this.deleteOtherPeerVideo, this);
    this.observer.register('connectFailTextChat', this.connectFailTextChat, this);
    this._initHandler();
  }

  ////////////////////////////////////////////////////////////////////////////
  //view에서 action 발생시 실행
  ////////////////////////////////////////////////////////////////////////////
  createChattingRoom(chattingRoomId) { //view에서 채팅방 신청 action 발생
    this.model.requestCreateChattingRoom(chattingRoomId);
  }

  joinChattingRoom(chattingRoomId) { //view에서 채팅방 참여 action 발생
    this.model.requestJoinChattingRoom(chattingRoomId);
  }

  leaveChattingRoom() { //view에서 채팅방 나가기 action 발생
    this.model.leaveChattingRoom();
  }

  sendTextChattingMessage(message) { //view에서 텍스트 채팅 메시지 보내기 action 발생
    this.model.sendTextChattingMessage(message);
  }

  blind(peerId) { //상대 / 자신 화면 끄기
    this.model.blind(peerId);
  }

  mute(peerId) { //상대 / 자신 소리 끄기
    this.model.mute(peerId);
  }

  controlBitrate(bitrate, peerId) { //상대방의 bitrate를 변화
    this.model.requestControlBitrate(bitrate, peerId);
  }

  ////////////////////////////////////////////////////////////////////////////
  //model에서 이벤트 발생시 실행
  ////////////////////////////////////////////////////////////////////////////

  //observer에 의해 model에서 이뤄지는 이벤트 감지
  addVideo(data) { //새로운 peer가 접속시 video 구역을 만들어준다.
    this.view.makeVideo(data.newPeerConnection, data.stream);
  }

  setConnectionState(data) { //peer의 접속 상태를 체크해서 화면에 표시
    this.view.setConnectionState(data.id, data.state);
  }

  //observer에 의해 model에서 발생되는 이벤트 감지
  addTextChattingMessage(data) { //보낸 message를 화면에 추가한다.
    this.view.addTextChattingMessage(data.message, data.id);
  }

  //observer에 의해 model에서 발생되는 이벤트 감지
  deleteOtherPeerVideo(otherId) { //다른 peer의 video 구역을 삭제
    this.view.deleteOtherPeerVideo(otherId);
  }

  connectFailTextChat() {
    this.view.connectFailTextChat();
  }

  ////////////////////////////////////////////////////////////////////////////
  //웹 소켓 핸들러
  ////////////////////////////////////////////////////////////////////////////

  handleConnect(data) { //server로부터 connect 메시지가 오면
    this.model.handleConnect(data); //model에게 저장시킬 data를 넘겨준다.
    this.view.makeChattingRoomList(data); //view에게 ui 생성에 필요한 값을 넘겨준다.
  }

  async handleCreate(data) {
    let stream = await this.model.handleCreate(data); //처음 채팅방을 만들 경우 실패 성공여부에 따라 설정 초기화를 할지를 결정
    let id = this.model.getId();
    this.view.makeChattingRoom(id, stream);
  }

  async handleJoin(data) {
    let stream = await this.model.handleJoin(data); //model에서 채팅방 참여자의 stream을 받아온다.
    let id = this.model.getId(); //model에서 채팅방 참여자의id를 받아온다.
    this.view.makeChattingRoom(id, stream); //view에게 strem과 id를 넘겨 video구역을 만든다.
  }

  handleOffer(data) {
    this.model.handleOffer(data);
  }

  handleAnswer(data) {
    this.model.handleAnswer(data);
  }

  handleCandidate(data) {
    this.model.handleCandidate(data);
  }

  handleBitrate(data) {
    this.model.handleBitrate(data);
  }

  handleLeave(data) {
    this.model.handleLeave(data);
  }

  handleServerMessage(message) {
    this.view.alertMessage(message);
  }

  handleError(message) {
    this.view.error(message);
  }

  _initHandler() {
    let $this = this;

    this.connection.onopen = function() {
      $this.model.sendMessage('connect');
    }

    this.connection.onerror = function(error) { //통신 접속에러시 에러 처리 이벤트 핸들러
      $this.handleError(error);
    }

    //메세지 수신 이벤트 핸들러
    this.connection.onmessage = function(message) {
      let data = JSON.parse(message.data);
      switch (data.type) {
        case 'connect' :
          $this.handleConnect(data);
          break;
        case 'create' :
          $this.handleCreate(data); //채팅방 참가에 대한 응답
          break;
        case 'join' :
          $this.handleJoin(data); //채팅방 참여에 대한 응답
          break;
        case 'offer' :
          $this.handleOffer(data); //이미 존재하는 방에 상대방이 참여하여 offer메시지를 보냈을 경우 상대방 description에 offer 설정 및 answer 생성
          break;
        case 'answer' :
          $this.handleAnswer(data); //offer를 받은 상대방이 보낸 answer를 받아 상대방의 description에 answer 설정
          break;
        case 'candidate' :
          $this.handleCandidate(data); //offer/answer에 의해 description을 정상적으로 설정한 후 서로의 경로에 대한 candidate를 처리
          break;
        case 'bitrate' : //bitrate 수신 값 조종 처리
          $this.handleBitrate(data);
          break;
        case 'leave' :
          $this.handleLeave(data); //다른 peer가 종료시 connection과 화면에서 없애주는 처리
          break;
        case 'error' :
          $this.handleServerMessage(data.message);
          break;
        default :
          $this.handleError(data.message); //위에 정의되어 있지 않는 type의 메시지
          break;
      }
    }
  }
}

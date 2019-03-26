WebRTC toy project v1.0.0
=============

WebRTC toy project입니다.
이 프로젝트는 server와 client로 구성되어 있으면 각각 다음과 같은 기능을 제공합니다.

Server
-------------

P2P 연결을 위한 signaling process를 제공하는 sigaling server입니다.

### 개발 환경
해당 signaling server는 다음의 개발 환경에서 제작되었습니다.
  - Node.js - v10.15.1
  - npm - 6.4.1

Signaling server를 실행 시키기위해 server.js와 같은 수준의 위치에 websocket 모듈이 설치되어 있어야 합니다.
<pre><code>npm install websocket</code></pre>

### 실행 방법
server.js가 있는 폴더에서 Node.js로 server.js를 실행시키면 signaling server가 작동하게 됩니다.
특별한 설정이 있지 않다면, 8080번 port가 사용되게 됩니다.

<pre><code>node server.js</code></pre>

Client
-------------

Signaling server를 이용하여 P2P 접속을 할 수 있게 해주는 client program입니다. P2P 접속에 성공하면,
다른 peer와 영상 및 음성 데이터를 교환할 수 있습니다.

### 개발 환경
해당 client program은 개발 환경에서 제작되었습니다.
  - WebRTC 지원 브라우저(Chrome, Firefox, Opera)
  - ECMA script 2017 이상 지원 브라우저

### 실행 방법
* Client program이 실행되면 signaling server로 socket 통신을 시도합니다. client program 실행 전 signaling server를 먼저 구동시켜야합니다.
* client.js에서 구동시킨 signaling server의 주소와 포트를 입력합니다.
<pre><code>let connection = new WebSocket('[wss 주소 | ws 주소 : 포트]');</code></pre>
* 실행 환경에 맞는 브라우저 혹은 디바이스로 index.html을 실행시킵니다.

### 사용 방법
해당 client program을 사용하기 위해서는 다음과 같이 사용법을 숙지 하셔야합니다.
* 맨 첫페이지에 채팅방 이름을 입력할 수 있는 입력창과 채팅방 만들기, 채팅방 접속하기 버튼이 노출됩니다
* 채팅방 만들기
    - 채팅방 이름을 입력한 뒤 create 버튼을 누르면 채팅방이 만들어집니다.
* 채팅방 접속하기
    - 만들어진 채팅방의 이름을 입력한 뒤 join 버튼을 누르면 채팅방에 접속됩니다.

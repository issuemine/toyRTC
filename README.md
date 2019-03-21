WebRTC toy project
=============

WebRTC toy project입니다.
이 프로젝트는 server와 client로 구성되어 있으면 각각 다음과 같은 기능을 제공합니다.

# Server
P2P 연결을 위한 signaling process를 제공하는 singaling server입니다.
Node.js 로 작성되어졌으며, server를 실행 시키기위해 server.js와 같은 수준의 위치에 websocket 모듈이 설치되어 있어야 합니다.
<pre><code>npm install websocket</code></pre>

# Client
Signaling server를 통해 P2P 접속을 할 수 있게 해주는 client program입니다. P2P 접속에 성공하면,
다른 Peer와 영상 및 음성 데이터를 교환할 수 있습니다.
해당 client program을 사용하기 위해서는 다음 기능 사용법을 숙지 하셔야합니다.
* 채팅방 만들기
    - 채팅방 이름을 입력하여 create 버튼을 누르면 채팅방이 만들어집니다.
* 채팅방 접속하기
    - 만들어진 채팅방의 이름을 입력한 뒤 join 버튼을 누르면 채팅방에 접속됩니다.

class Observer {
  constructor() {
    this.handlers = {};
  }

  register(eventName, handler, context) { //핸들러를 등록한다.
    let handlers = this.handlers[eventName]; //핸들러 이름으로 등록되어 있는 것이 있는지 확인

    if (handlers === undefined) { //핸들러가 핸들러 이름으로 없으면 새로 만든다.
      handlers = this.handlers[eventName] = new Array();
    }

    handlers.push({
      handler : handler, //핸들러 등록
      context : context  //핸들러 주체 등록
    });
  }

  unregister(eventName, handler, context) { //핸들러 삭제
    let handlers = this.handler[eventName];
    if (handlers === undefined) { //핸들러가 없으면 종료
      return ;
    }

    for (let i = 0; i < handlers.length; i++) {
      let currentHandler = handlers[i];
      //핸들러의 주체와 핸들러가 같다면 같은 이벤트 판별
      if (handler === currentHandler['handler'] && context === currentHandler['context']) {
        handlers.splice(i, 1);
        break;
      }
    }
  }

  notify(eventName, data) { //oberser에게 변화를 알리는 메소드
    let handlers = this.handlers[eventName];
    if (handlers === undefined) {
      return;
    }

    for (let i = 0; i < handlers.length; i++) {
      let currentHandler = handlers[i];
      //핸들러를 핸들러 주체에서 호출한다.
      currentHandler['handler'].call(currentHandler['context'], data);
    }
  }
}

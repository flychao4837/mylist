/**
 * websocket服务端
 */
'use strict'
const WebSocket = require('ws');
const wss = new WebSocket.Server({
    port: 8001,
    handshakeTimeout: 5000, //握手超时 毫秒
    maxPayload: 600000 //最大传输节 byte 允许30000个汉字
});

wss.on('message', function incoming(data) {
  console.log(`Roundtrip time: ${Date.now() - data} ms`);
 
  setTimeout(function timeout() {
    ws.send(Date.now());
  }, 500);
});
class AppServer {
    constructor(wss) {
        this.websocketServer = wss;
        this.createWebSocket(wss);
        this.websocket = null;
    }

    createWebSocket(websocketServer) {
        websocketServer.on('connection', (ws, request) => {
            //Note ws为连接的websocket-client。 request为连接wss的request请求包含url、header等参数
            console.log("connection")
            this.websocket = ws;
            this.bindWSClientEvent(ws);
        });
        
    }
    /**
     * 给当前加入的ws-client绑定事件
     */
    bindWSClientEvent(ws){
        ws.on("open", () =>{
            console.log('onopen')
        })
        ws.on('message', (data) => {
            console.log("server get message", data);
            try {
                let jsonData = JSON.parse(data);
                this.messageAct(jsonData)
            } catch (e) {
                console.log('websocket get wrong message data');
            }
        });

        ws.on('close', () => {
            //websocket连接关闭时，需要把文档锁打开，避免用户再次登入时被误判为多开
            console.log('websocket close');

        })
        ws.on('error', (e) => {
            console.log('websocket error');
        })

        ws.on('pong', () => {
            console.log("pong")
        });
        ws.on('ping', () => {
            console.log("ping")
        });
        ws.on("unexpected-response", (request, response) => {
            console.log('websocket unexpected-response');
        });
    }
    sendMessage(actData) {
        if (this.websocket && this.websocket.readyState == 1) {
            this.websocket.send(JSON.stringify(actData))
        } else {
            console.log('can not send message',this.websocket.readyState)
        }
    }

    //处理全部客户端的消息指令
    messageAct(data) {
        console.log("data", data)
        let jsonData = data;
        if (jsonData.command === 'ping' && jsonData.from === 0) {
            this.sendMessage({
                command: 'pong',
                from: 1
            })
        }
    }


}

let server = new AppServer(wss);
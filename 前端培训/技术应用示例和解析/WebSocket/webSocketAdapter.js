/**
 * webSocket 
 * 只负责websocket的创建、连接、通讯、状态监测、断线重连
 * 通讯有可能是队列或批量发送
 * 存在发送完通讯的后续函数回调的情况
 */
const wsURL = "ws://127.0.0.1:8001" //'wss://co-ws.xueleyun.com'
class webSocketAdapter {
    constructor(config) {
        this.wsADP = null;
        this.config = config || Object.create(null);
        this.customFunctionList = Object.create(null);
        this.commandlist = Object.create(null);

        //创建websocket
        return this.createWS();
    }
    /**
     * 配置adapter的参数
     */
    initConfig() {
        let opt = this.config;
        for (let key in opt) {
            this[key] = opt[key];
        }
    }
    /**
     * 创建websocket
     */
    createWS() {
        this.initConfig();
        
        if ('WebSocket' in window) {
            this.websocket = new WebSocket(wsURL);
        } else if ('MozWebSocket' in window) {
            this.websocket = new MozWebSocket(wsURL);
        } else {
            //'当前浏览器不支持websocket，请更换成最新Chrome浏览器'
            console.log("当前浏览器不支持websocket")
        }

        this.websocket.onopen = function () {
            console.log('正在建立websocket连接')
            this.sendMessage({
                command: 'ping',
                from: 0
            })
        }.bind(this)

        this.websocket.onmessage = function (data) {
            console.log("message", data)
            this.messageListener(data)
        }.bind(this)

        this.websocket.onclose = function () {
            //有重连逻辑，导致触发connection -> onerror -> onclose 这一流程
            console.log("client close")
        }.bind(this)

        this.websocket.onerror = function (e) {
            
            console.log("ws connection error",e)
        }.bind(this)
        
        //绑定指令列表
        //绑定各个APP里的消息事件
    }
    /**
     * 断线重连
     */
    clientReconnect() {
        return this.createWS();
    }
    /**
     * 处理接收到的消息
     */
    messageListener(msg) {
        console.log("client message", msg);
    }

    /**
     * 发送消息
     */
    sendMessage(data) {
        console.log("this.websocket.readyState",this.websocket.readyState)
        if (this.websocket.readyState === 1) {
            this.websocket.send(JSON.stringify(data));
        } else {
            //TODO -- reconnect
        }
    }
    /**
     * 检测网络连接状态
     */
    checkNetWork() {
        this.clientPingTimer = setTimeout(() => {
            let curTime = this.getTime();
            if (this.totlaPingNum >= 2) {
                this.stopCheckNetWork(false, 'stopNitify');
                return false;
            }
            ++this.totlaPingNum;
            if (this.websocket.readyState === 1) {
                this.sendMessage({
                    command: 'ping',
                    from: 0
                })
            }
            this.checkNetWork();
        }, this.spaceTime)

    }
    /**
     * 停止检测网络
     */
    stopCheckNetWork() {

    }
    setNetWorkStatus() {
        --this.totlaPingNum;
    }
    /**
     * 手动触发函数事件
     */
    emitCustomEvent(command) {
        let cb = this.customFunctionList[command];
        if(command){
            cb.call(cb)
        }
    }
    /**
     * 绑定单个函数
     */
    bindCustomFunction(command){
        if(command && this.hasCommand[command]){
            this.emitCustomEvent(command);
        }
    }
}
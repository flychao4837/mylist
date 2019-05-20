/**
 * 注册安装Service Worker
 */
//const Version = "1.0.4"; //当前版本号
let updateServiceWorkerPanel;
let timeoutInter;
let tmpVersion;
//Service Worker 安装、注册
function install() {
    //TOFix - xp 下不安装
    var uaString = navigator.userAgent.toLowerCase();
    var browser = uaString.match(/Chrome\/[\d.]+/ig);
    var browserVersion = browser.length ? browser[0].match(/[\d]+/) : null
    if (uaString.indexOf('wisdomclass_xp') != -1) {
        return true;
    }
    //chrome60以下版本或非chrome的浏览器不使用serviceWorker
    if(!browserVersion || browserVersion[0] && browserVersion[0] < 58){
        try{
            unInstall()
        }catch(e){

        }
        return false;
    }
    //TODO -- chrome低版本下不安装serviceworker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js?v='+Version, {
            scope: '/'
        })
        .then(
            (registration) => {
                //人为控制cache更新方式1：安装时设置版本号，根据版本号做本地更新比对
                bindAct();
                if (localStorage.getItem("ws_version") !== Version) {
                    //Note -- 注意 update是一个异步操作，不能立即得到serviceWorker.controller，注意回调的顺序
                    registration.update().then(
                        () => {
                            localStorage.setItem("ws_version", Version);  
                        }
                    )
                }
                // 监听事件(是否有新的serviceworker需要更新)，state改变时均会触发onupdatefound，所以onupdatefound不单单指更新
                registration.onupdatefound = updateFound(registration);
            }
        )
        .catch(err => console.log('pwa - ServiceWorker 注册失败: ', err));
       
    }
}
function updateFound(registration){
    // 有新版本serviceworker，安装的新版本，再次进入时会改变sw的状态，触发update
    console.log("pwa - 发现更新");
    getWaitingServiceWorker(
        (waitingWorker)=>{
            if(waitingWorker.state == "installed"){
                let localVersion = localStorage.getItem("ws_version");
                let updateVersion = getQueryString(waitingWorker.scriptURL,"v")
                if(localVersion == updateVersion ){
                    waitingWorker.postMessage("skipWaiting");
                }else{
                    //TODO -- 更新方式需要调整。暂时不弹提示框
                    //updateServiceWorkerPanel.setAttribute("class", "show");
                    waitingWorker.postMessage("skipWaiting");
                    afterCleanCache();
                }
            }
        }
    )
}
function bindAct() {
    //ServiceWorker注册成功后才能向ServiceWorker发送数据,但是此时ServiceWorker.controller不一定建立完毕，可能处于activing中
    getPostMessage();
    getControllerChage();
}

//PostMessage -- 向service worker发送数据
//与iframe传递数据的PostMessage方法的异同，同属于HTML5的PostMessage方法
function sendMessageToServiceWorker(msg) {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
        return;
    }
    controller.postMessage(msg, []);
}

//当处于wait状态的sw转成active时触发congtollerchange
function getControllerChage(){
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        let localVersion = localStorage.getItem("ws_version");
        if(localVersion != Version){
            //afterCleanCache();
        }
    })
}
//接受PostMessage数据 serviceWorker,worker,window 三种场景下的postMessage主体是不一样的，在不同场景下要取对应的对象窗体
let isHasReload = false;
function getPostMessage() {
    navigator.serviceWorker.addEventListener('message', (e) => {
        // 这里对收到的消息做origin验证，根据不同类型做不同的处理
        if (e.data && e.data.targetWindow == "top"){
            switch (e.data.type){
                case "hasCleanCache" : 
                    afterCleanCache();
                    break;
                case "upDateLocalStroge" :
                    tmpVersion = e.data.data;
                    localStorage.setItem("ws_version", tmpVersion);
                    break;
                case "disConnect":
                    showDisconnect();
                    break;
                default:
                    break;
            }
        } 
    });
}
function afterCleanCache(){
    //Note -- sw执行skipwait后缓存重新获取，此时不应再刷新页面，避免二次加载sw
    const gData = window.gData && window.gData();
    const curId = gData && gData.currAppId;
    let url = window.top.location.href;
    if(!curId ||curId == "00000001"){//在登录页面刷新，其他页面暂时不管
        if(url.indexOf("userId") < 0){
            let timeMap = new Date().getTime();
            if(url.indexOf("?")>-1){
                url = url.replace(/t\s*?=\s*?(\d){1,}/ig,"t="+timeMap)
            }else{
                url = url+"?t="+timeMap;
            }
        }  
        window.top.location.replace(url);  
    }
    //暂不刷新其他页面
    // else if(curId == "00000005"){//00000005  为教案列表页
    //     const quit = window.getQuit();
    //     //TOFix -- 登录进入到课件页后被强制退出，这里逻辑有问题。面板-upload and reload
    //     quit();
    // }else{
    //     window.clickCloseCom();
    // }
    
    // window.top.location.replace(url); 
    
}
function getWaitingServiceWorker(callback){
    //向等待中的serviceWorker发信息  跳过等待
    timeoutInter && clearTimeout(timeoutInter);
    navigator.serviceWorker.getRegistration().then(reg => {
        if(reg.waiting){
            callback(reg.waiting);
        }else{
            if(reg.active){//对serviceworker的第一次安装进行排除；
                timeoutInter = setTimeout(() => {
                    getWaitingServiceWorker(callback);
                }, 50);
            }
        }
    });
}
function unInstall() {
    navigator.serviceWorker && navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}
//获取URL的版本时间戳
function getQueryString(url, param) {
    var name, value;
    var str = url;
    var num = str.indexOf("?")
    str = str.substr(num + 1); 

    var arr = str.split("&"); //各个参数放到数组里
    for (var i = 0; i < arr.length; i++) {
        num = arr[i].indexOf("=");
        if (num > 0) {
            name = arr[i].substring(0, num);
            value = arr[i].substr(num + 1);
            if(name === param){
                break
            }
        }
    }
    return value
}

//断网提示，只能全局通用
function showDisconnect(){
    // let pannel = window.top.document.querySelector("#disConnectTip");
    // pannel.setAttribute("class", pannel.getAttribute("class").replace("hide","show"));
}
// 需要获取页面元素做弹层提示，故放到onload事件里面
window.onload = () => {
    updateServiceWorkerPanel = window.top.document.querySelector("#updateServiceWorkerBox");
    const confirmUpdateBtn = window.top.document.querySelector("#confirmUpdatePWA");
    const cancelUpdateBtn = window.top.document.querySelector("#cancleUpdatePWA");
    confirmUpdateBtn.onclick = (event) => {
        // 下课逻辑
        getWaitingServiceWorker((waitingWorker) => {
            //更新版本号，serviceWorker在页面开启状态只安装一次，所以不是每次都能进到安装流程并更新版本号。
            localStorage.setItem("ws_version", getQueryString(waitingWorker.scriptURL,"v"));
            waitingWorker.postMessage("skipWaiting");
            afterCleanCache();
        });
        updateServiceWorkerPanel.setAttribute("class", "hide");
    }
    cancelUpdateBtn.onclick = (event) => {
        updateServiceWorkerPanel.setAttribute("class", "hide");
    }
    
    let confirmdisConnectTip = window.top.document.querySelector("#confirmdisConnectTip");
    confirmdisConnectTip.onclick = (event) => {
        let d = window.top.document.querySelector("#disConnectTip");
        d.setAttribute("class", d.getAttribute("class").replace("show","hide"));
    }
    install();
    //  unInstall();
}
navigator.connection ? navigator.connection.onchange = function() {
    if(navigator.onLine === false){
        showDisconnect()
    }
} : '';

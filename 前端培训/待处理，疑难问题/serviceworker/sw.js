/**
 * 预缓存的资源列表
 */
let urlsToCache = [];


//不能缓存的资源
//正则字符串中不能有输入或换行的空格，空格容易导致匹配失败，不缓存MP4流文件，URI一致但range取值不一致
const nerverToCache = `.*(?=((\/apps\/aiClassroom)|(mon\.edugo\.cn\/eop\/services\/common\/get)|(www\.xueleyun\.com\/cloudteach\/aiClassroom)|(ul\.xueleyun\.com)|(book\.xueleyun\.com)))`;
let nerverToCacheReg = new RegExp(nerverToCache)
//部分app对应的接口需要缓存，这里需重新筛选
const tempToCacheByNetWork = `\/api\/(?=(coursewares|feedback|books|classes|classes\/teached(?!\/)|clouddisk|resources|bookcontent|labcatalogs|geometrytemplets|labresources|score\/studentscore|score\/grouplist|students|works|statistics\/teachinglessondata|functiontemplet|functiontemplets))(.*)`;
let tempToCacheByNetWorkReg = new RegExp(tempToCacheByNetWork);

let APIReg = new RegExp("\/api\/", "ig");
//从云盘拉取Mp3\Mp4\pdf时需要加origin的header头，不然报错
let dlMediaReg = new RegExp("\/dl\.xueleyun\.com\/files\/.*\.(mp4|mp3|pdf)", "i");
//Mp3,Mp4,若返回的response.ok为false或response.status=206表明请求的是流，不能缓存文件数据
let audioReg = new RegExp("(?:\.*\.(mp4|mp3))", "i");

const location = self.location;
const origin = location.origin;

//脚本安装时触发install事件
self.addEventListener('install', event => {
    console.log("install CACHE_NAME",CACHE_NAME)
    //跳过安装阶段，直接进入active阶段
    //event.waitUntil(self.skipWaiting())  //监听页面回传信息再跳过 等待 状态，故注释

});

//安装完成，触发激活状态
self.addEventListener('activate', event => {
    console.log("activate CACHE_NAME",CACHE_NAME);
    event.waitUntil(
        Promise.all([
            // 更新客户端
            clients.claim(),
            // 清理旧版本
            caches.keys().then(cacheList => Promise.all(
                cacheList.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        caches.delete(cacheName);
                    }
                })
            ))
        ])
        .then(
            () => {
                caches.open(CACHE_NAME).then(cache => {
                    // 添加要缓存的资源列表
                    return cache.addAll(urlsToCache);
                })
            }
        )
        .catch(
            (err) => {
                console.error(err);
            }
        )
    )
});

function loadFromCacheOrFetch(request) {
    //Fix chrominu bug;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
        return;
    }
    let option = null;
    if (request.url.match(dlMediaReg)) {
        option = {
            headers: {
                origin: origin
            }
        }
    }

    //所有非get请求都返回原值，不做缓存
    if (request.method != "GET") {
        return fetch(request, option).then(function (response) {
            return response;
        }).catch(
            (e) =>{
                console.log(e)
            }
        )
    }

    //不需要缓存的全部原路返回
    if (request.url.match(nerverToCacheReg)) {
        return fetch(request, option).then(function (response) {
            return response;
        });
    }



    /**
     * 对于接口做过滤，部分app对应的接口要缓存 http://jira.xuelebj.net/issues/?filter=11903
     * 缓存当前用户信息
     * 网络好时 1、缓存(读取)静态资源，2、接口全部走线上，部分接口需要缓存到本地
     * 网络不好时 1、读取本地静态资源，2、读取缓存的接口数据，3、未被缓存的接口仍然从线上读取(走正常的http访问错误流程)
     */
    if (request.url.match(APIReg)) {
        if (request.url.match(tempToCacheByNetWorkReg)) {
            //接口缓存到本地，根据网络状态切换
            if (navigator.onLine) {
                //有网络
                return caches.open(CACHE_NAME).then(function (cache) {
                    return fetch(request, option).then(function (response) {
                        if (response.ok && response.status == 200) {
                            cacheResponse(cache, request, response);
                        }

                        return response;
                    }).catch(
                        //Fetch线上资源出错，尝试切换到本地资源
                        ()=>{
                            return cache.match(request,{ignoreSearch:true}).then(function (response) {
                                if (response) {
                                    return response;
                                } else {
                                    return null
                                }
                            });
                        }
                    )
                }).catch(
                    (err) => {
                        console.error(err);
                    }
                )
            } else {
                //断网了
                return caches.open(CACHE_NAME).then(function (cache) {
                    return cache.match(request).then(function (response) {
                        if (response) {
                            return response;
                        }

                        return fetch(request, option).then(function (response) {
                            if (response.ok && response.status == 200) {
                                cacheResponse(cache, request, response);
                            }

                            return response;
                        }).catch(
                            (e) =>{
                                console.log(e)
                            }
                        )
                    });
                }).catch(
                    (err) => {
                        console.error(err);
                    }
                )
            }
        } else {
            //接口走线上
            return fetch(request).then(function (response) {
                return response;
            }).catch(
                (e) =>{
                    console.log(e)
                }
            )
        }
    } else {
        //非api接口请求
        if(request.url.indexOf("version.js") > -1){
            console.log("version.js")
            //针对version.js做特殊处理
            //不论什么情况，本地只保存一个version.js
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.match(request,{ignoreSearch:true}).then(function (response) {
                    if (response) {
                        return response;
                    }

                    return fetch(request, option).then(function (response) {
                        if (response.ok && response.status == 200) {
                            cacheResponse(cache, request, response);
                        }

                        return response;
                    }).catch(
                        (e) =>{
                            console.log(e)
                        }
                    )
                });
            }).catch(
                (err) => {
                    console.error(err);
                }
            )
            
        }else{
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.match(request).then(function (response) {
                    if (response) {
                        return response;
                    }

                    return fetch(request, option).then(
                        function (response) {
                            //avatar.xueleyun.com 头像判断
                            if ((response.ok && response.status == 200)) {
                                cacheResponse(cache, request, response);
                            }
                            return response;
                        }
                    );
                });
            }).catch(
                (err) => {
                    console.error(err);
                    if(navigator.onLine === false){
                        PostMessageToClient({type:"disConnect", targetWindow: "top"})
                    }
                }
            )
        }
    }
}

function cacheResponse(cache, request, response) {
    // Response objects are read-only, so to add our custom header, we need to
    // recreate the object.
    let status = response.status;
    var init = {
        status: status,
        statusText: response.statusText,
        headers: {
            'X-Shaka-From-Cache': true
        }
    };

    response.headers.forEach(function (value, key) {
        init.headers[key] = value;
    });

    // Response objects are single use.  This means we need to call clone() so
    // we can both store the ArrayBuffer and give the response to the page.
    return response.clone().arrayBuffer().then(function (ab) {
            cache.put(request, new Response(ab, init));
        }).catch(
            (err) => {
                console.error(err);
            }
        )
}


self.addEventListener('fetch', function (event) {
    if (!event.request.url.match(audioReg)) {
        event.respondWith(loadFromCacheOrFetch(event.request))
    }
});


//PostMessage -- 页面和service worker之间的数据传输
//向特定的页面传递数据
function PostMessageToClient(msg) {
    self.clients.matchAll().then(clientList => {
        clientList.forEach(client => {
            client.postMessage(msg);
        })
    });
}
//接收页面传来的数据
self.addEventListener('message', function (ev) {
    //TODO -- 待补充需求
    switch (ev.data) {
        case "skipWaiting":
            self.skipWaiting();
            break;
        default:
            break;
    }
});

self.addEventListener('error', event => {
    // 上报错误信息
    // 常用的属性：
    // event.message
    // event.filename
    // event.lineno
    // event.colno
    // event.error.stack
    console.error(event);
})
self.addEventListener('unhandledrejection', event => {
    // 上报错误信息
    // 常用的属性：
    // event.reason
    console.error(event);
})
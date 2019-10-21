
///////////////////////////////////////////////////////
//Start of app. we create a global object to store data
///////////////////////////////////////////////////////
var app = new Object();
app.globalData={
        isDebug:true,
        hasUserInfo:true,//默认认为有授权，如果判断未授权则显示授权按钮
        userInfo:null,
        hasBrokerInfo:false,//默认不是达人
        brokerInfo:null,
    };
app.config={
    auth_api:"https://data.shouxinjk.net/ilife-wechat",//获取UserInfo后端服务
    sx_api:"https://data.shouxinjk.net/ilife/a",//服务端数据服务
    data_api:"https://data.shouxinjk.net/_db/sea",//数据存取服务
    search_api:"https://data.pcitech.cn",//搜索服务:内容搜索后缀为 /stuff/_search
    message_api:"https://data.shouxinjk.net/kafka-rest"//日志等消息服务（kafka）
};

///////////////////////////////////////////////////////
//Start of util. we create a util object
///////////////////////////////////////////////////////
var util = new Object();

util.hasUserInfo =function (){
  util.getUserInfo();//从cookie读取存储的UserInfo
  if (app.globalData.userInfo) {
    return app.globalData.userInfo.country.length>0;
  } else {
    return false;
  }
}

util.hasBrokerInfo =function (){
  //util.getUserInfo();//从cookie读取存储的UserInfo
    return app.globalData.hasBrokerInfo;
}

util.getUserInfo =function (){
  var strUserInfo = $.cookie('sxUserInfo');
  console.log("load userInfo from cookie.",strUserInfo);
  var jsonUserInfo = {};
  if(strUserInfo && strUserInfo.trim().length>0){
    jsonUserInfo = JSON.parse(strUserInfo);
    app.globalData.userInfo = jsonUserInfo;
    app.globalData.hasUserInfo = true;
  }
  console.log("load userInfo from cookie json.",jsonUserInfo);
  return jsonUserInfo;
}

//登录并获取openid 
//example: login(code,{success,fail})
util.login=function(code,callback) {
    console.log("Util::login try to login and get userInfo.", code);
    //发送请求获取openid
    util.AJAX(app.config.auth_api+'/wechat/ilife/login', function (res) {
        //run success callback
        if (typeof callback === "function") {
            console.log("Util::login try to login and get userInfo.", res)
            //util.createPerson(res,callback);
            util.checkPerson(res,callback);//检查用户是否存在，并作相应处理
        } else {
            console.log("Util::login only accept callback function as callback.");
        }
      }, "GET",{ code: code },{'content-type': 'application/json'});
}

//check if user exists
//检查用户是否存在
//checkPerson({userInfo,callback})
util.checkPerson=function(userinfo,callback) {
    var query={
            collection: "user_users", 
            example: { 
                _key :userinfo.openId
            },
            limit:1
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        console.log("Util::checkPerson try to retrive user by openid.", res)
        if(res && res.count>0){//判断是否有用户信息，如果有则更新，
            util.updatePerson(userinfo.openId,userinfo,callback);
        }else{//否则创建
            util.createPerson(userinfo,callback);
        }
    }, "PUT",query,header);
}

util.createPerson=function(userInfo,callback) {
    console.log("Util::createPerson.",userInfo);
    userInfo.authorize = true;//设置授权标志
    userInfo.source="mp";//设置用户来源
    util.AJAX(app.config.data_api+"/user/users", function (res) {//先使用openid创建用户，然后更新 
        //now try to update
        console.log("Util::createPerson got userInfo",userInfo);
        util.updatePerson(userInfo.openId, userInfo);
        if (typeof callback === "function") {
            callback(res);
        } 
    }, "POST", { "_key": userInfo.openId });
}

util.updatePerson=function(id,userInfo,callback) {
    //字段补全: miniProgram: avatarUrl/nickName / mp: headImgUrl/nickname
    userInfo.avatarUrl = userInfo.headImgUrl;
    userInfo.nickName = userInfo.nickname;
    var url = app.config.data_api +"/user/users/"+id;
    if (app.globalData.isDebug) console.log("Util::updatePerson update person.",userInfo);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Util::updatePerson update person finished.", res);
      //更新本地UserInfo
      app.globalData.userInfo = res;      
      app.globalData.hasUserInfo = res.authorize ? res.authorize : false;//是否授权
      //检查是否是Broker
      util.checkBroker(res._key);
      if (typeof callback === "function") {
        callback(res);
      }
    }, "PATCH", userInfo, { "Api-Key": "foobar" });
}

util.checkBroker=function(openid,callback) {
    var url = app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid;
    if (app.globalData.isDebug) console.log("Util::checkBroker start check if current user is a broker.",openid);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Util::checkBroker check broker finished.", res);
      //更新本地Broker
      app.globalData.brokerInfo = res.data;      
      app.globalData.hasBrokerInfo = res.status;//是否是达人
      if (typeof callback === "function") {
        callback(res);
      }
    }, "GET", null, { "Api-Key": "foobar" });
}

util.AJAX = function( url = '', success, method = "get",data={}, header = {},fail){
  if(app.config.isDebug)console.log("Util::AJAX",url,method,data,header);

    $.ajax({
        url:url,
        type:method,
        data:method.toLowerCase()=="get"?data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        success:function(result){
            success(result);
        },
        error:function(jqXHR, textStatus, errorThrown){
            if (typeof fail === "function") {
                fail(jqXHR, textStatus, errorThrown);
            } 
        }
    })  

}
///////////////////////////////////////////////////////
//End of util
///////////////////////////////////////////////////////

function getQuery() {
    //取得查询字符串并去掉开头的问号
    var qs = location.search.length > 0 ? location.search.substring(1):"";
    //保存数据的对象
    var args = {};
    //取得每一项
    var items = qs.length > 0 ? qs.split('&'):[];
    var item = null,name = null,value = null;
    for(var i = 0;i < items.length;i++) {
        item = items[i].split('=');
        name = decodeURIComponent(item[0]);
        value = decodeURIComponent(item[1]);
        if(name.length) {
            args[name] = value;
        }
    }
    return args;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function logstash(item,client,action,fn){//记录日志
    var target = item.url2?item.url2:item.url;
    var type = item.url2?"processed":"original";
    var data = {
        records:[{
            value:{
                itemId:item._key,
                userId:app.globalData.userInfo?app.globalData.userInfo._key:"dummy",
                item:item,
                client:client,
                user:app.globalData.userInfo,//TODO: 需要增加用户信息
                action:action,
                timestamp:new Date()
            }
        }]
    };
    //console.log("$.support.cors",$.support.cors);
    $.ajax({
        //url:"http://kafka-rest.shouxinjk.net/topics/log",
        url:"https://data.shouxinjk.net/kafka-rest/topics/log",
        type:"post",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/vnd.kafka.json.v2+json",
            "Accept":"application/vnd.kafka.v2+json"
        },
        success:function(result){
            fn(result);
        }
    })            
}

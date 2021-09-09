
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

util.getUserInfo =function (){
  var strUserInfo = $.cookie('sxUserInfo');
  //console.log("load userInfo from cookie.",strUserInfo);
  var jsonUserInfo = {};
  if(strUserInfo && strUserInfo.trim().length>0){
    jsonUserInfo = JSON.parse(strUserInfo);
    app.globalData.userInfo = jsonUserInfo;
    app.globalData.hasUserInfo = true;
    util.checkBroker(app.globalData.userInfo._key);//获取用户后加载达人信息
  }
  console.log("load userInfo from cookie json.",jsonUserInfo);
  return jsonUserInfo;
}


util.hasBrokerInfo =function (){
    var strHasBroker = $.cookie('hasBrokerInfo');
    if(strHasBroker && strHasBroker.trim().length>0 && strHasBroker=="true"){//如果cookie里有 则直接返回
        return util.getBrokerInfo();
    }else{
        util.checkBroker(app.globalData.userInfo._key);//注意：是异步调用，初次进入时会导致无法正常显示
        return app.globalData.hasBrokerInfo;//有问题：这里返回应该是false
    }
    /**
    if(!app.globalData.hasBrokerInfo){//请求获得broker信息
        util.checkBroker(app.globalData.userInfo._key);//这里有问题，可能还未得到用户信息
    }else{//从cookie读取存储的BrokerInfo
        util.getBrokerInfo();
    }
    return app.globalData.hasBrokerInfo;
    //**/
}

util.getBrokerInfo =function (){
  var strHasBroker = $.cookie('hasBrokerInfo');
  var strBrokerInfo = $.cookie('sxBrokerInfo');
  var jsonBrokerInfo = {};
  if(strHasBroker && strHasBroker.trim().length>0 && strHasBroker=="true"){
    //console.log("load brokerInfo from cookie.",strBrokerInfo);
    jsonBrokerInfo = JSON.parse(strBrokerInfo);
    app.globalData.brokerInfo = jsonBrokerInfo;
    app.globalData.hasBrokerInfo = true;
  }
  //console.log("load brokerInfo from cookie json.",jsonBrokerInfo);
  return jsonBrokerInfo;
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
    userInfo.createOn = new Date();//记录创建时间
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
    userInfo.updateOn = new Date();//记录更新时间
    var url = app.config.data_api +"/user/users/"+id;
    if (app.globalData.isDebug) console.log("Util::updatePerson update person.",userInfo);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Util::updatePerson update person finished.", res);
      //更新本地UserInfo
      app.globalData.userInfo = res;      
      app.globalData.hasUserInfo = res.authorize ? res.authorize : false;//是否授权
      //检查是否是Broker:进入user页面时才进行检测
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
      //写入cookie
        $.cookie('sxBrokerInfo', JSON.stringify(res.data), { expires: 3650, path: '/' });
        $.cookie('hasBrokerInfo', res.status, { expires: 3650, path: '/' });      
      if (typeof callback === "function") {
        callback(res);
      }
    }, "GET", {}, { "Api-Key": "foobar" });
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

function logstash(item,client,action,fromUser="",fromBroker="",fn){//记录日志
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
                fromUser:fromUser.trim().length>0?fromUser:"system",//记录分享用户
                fromBroker:fromBroker.trim().length>0?fromBroker:"system",//记录分享达人
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

//产生一个hash值，只有数字，规则和java的hashcode规则相同
function hashCode(str) {
    var h = 0;
    var len = str.length;
    var t = 2147483648;
    for (var i = 0; i < len; i++) {
        h = 31 * h + str.charCodeAt(i);
        if (h > 2147483647) h %= t; //java int溢出则取模
    }
    /*var t = -2147483648 * 2;
     while (h > 2147483647) {
     h += t
     }*/
    return h;
}

//时间戳来自客户端，精确到毫秒，但仍旧有可能在在多线程下有并发，
//尤其hash化后，毫秒数前面的几位都不变化，导致不同日期hash化的值有可能存在相同，
//因此使用下面的随机数函数，在时间戳上加随机数，保证hash化的结果差异会比较大
/*
 ** randomWord 产生任意长度随机字母数字组合
 ** randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
 ** 用法  randomWord(false,6);规定位数 flash
 *      randomWord(true,3，6);长度不定，true
 * arr变量可以把其他字符加入，如以后需要小写字母，直接加入即可
 */
function randomWord(randomFlag, min, max) {
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    // 随机产生
    if (randomFlag) {
        range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
        pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
    }
    return str;
}
//获取hashcode
function gethashcode() {
    //定义一个时间戳，计算与1970年相差的毫秒数  用来获得唯一时间
    var timestamp = (new Date()).valueOf();
    var myRandom=randomWord(false,6);
    var hashcode=hashCode(myRandom+timestamp.toString());
    return hashcode;
}

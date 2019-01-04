
///////////////////////////////////////////////////////
//Start of app. we create a global object to store data
///////////////////////////////////////////////////////
var app = new Object();
app.globalData={
        isDebug:true,
        hasUserInfo:true,//默认认为有授权，如果判断未授权则显示授权按钮
        userInfo:null,
    };
app.config={
    auth_api:"http://bcs898.natappfree.cc/ilife-wechat",//获取UserInfo后端服务
    data_api:"https://data.shouxinjk.net/_db/sea",//数据存取服务
    search_api:"https://data.pcitech.cn",//搜索服务:内容搜索后缀为 /stuff/_search
    message_api:"https://data.shouxinjk.net/kafka-rest"//日志等消息服务（kafka）
};

///////////////////////////////////////////////////////
//Start of util. we create a util object
///////////////////////////////////////////////////////
var util = new Object();

util.hasUserInfo =function (){
  if (app.globalData.userInfo) {
    return app.globalData.userInfo.country.length>0;
  } else {
    return false;
  }
}

//登录并获取openid 
//example: login(code,{success,fail})
util.login=function(code,callback) {
    console.log("Util::login try to login and get userInfo.", code)
    //发送请求获取openid
    util.AJAX(app.config.auth_api+'/wechat/ilife/login', function (res) {
        //run success callback
        if (typeof callback === "function") {
            console.log("Util::login try to login and get userInfo.", res)
            util.createPerson(res,callback);
        } else {
            console.log("Util::login only accept callback function as callback.");
        }
      }, "GET",{ code: code },{'content-type': 'application/json'});
}

//check if user exists
//检查用户是否存在
//checkPerson({data,callback})
util.checkPerson=function(id,callback) {
    util.AJAX(app.config.data_api+"/user/users/" + id, function (res) {
      if (typeof callback === "function") {
        callback(res);
      }else{
        console.log("Util::checkPerson only accept callback function as parameter.");
      }
    }, "GET");
}

util.createPerson=function(userInfo,callback) {
    console.log("Util::createPerson.",userInfo);
    util.AJAX(app.config.data_api+"/user/users", function (res) {//先使用openid创建用户，然后更新 
        //now try to update
        console.log("Util::createPerson got userInfo",userInfo);
        var sxuser = userInfo;
        sxuser.authorize = true;//设置授权标志
        sxuser.source="mp";//设置用户来源
        util.updatePerson(userInfo.openId, sxuser);

        if (typeof callback === "function") {
            callback(res);
        } 
    }, "POST", { "_key": userInfo.openId });
}

util.updatePerson=function(id,userInfo,callback) {
    var that = this;
    //NOTICE: miniProgram doesn't support method PATCH. we have to walk around
    var url = "https://data.shouxinjk.net/util/wxPatch.php?collection=user/users&key=" + id + "&data=" + JSON.stringify(userInfo);
    //if (app.globalData.isDebug) console.log("update person.[url]"+url);
    if (app.globalData.isDebug) console.log("Util::updatePerson update person.",userInfo);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Util::updatePerson update person finished.", res.data);
      //更新本地UserInfo
      app.globalData.userInfo = res.data;      
      app.globalData.hasUserInfo = res.data.authorize ? res.data.authorize : false;//是否授权
      if (typeof callback === "function") {
        callback(res);
      }
    }, "GET", {}, { "Api-Key": "foobar" });
}

util.AJAX = function( url = '', fn, method = "get",data={}, header = {}){
  if(app.config.isDebug)console.log("Util::AJAX",url,method,data,header);
    wx.request({
        url: url,
        method : method ? method : 'get',
        data: data?data:{"error":"something is wrong"},
        header: header ? header : {"Content-Type":"application/json"},
        success: function( res ) {
            fn( res );
        }
    });
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

function logstash(item,client,action,fn){//记录日志
    var target = item.url2?item.url2:item.url;
    var type = item.url2?"processed":"original";
    var data = {
        records:[{
            value:{
                itemId:item._key,
                userId:"dummy",
                item:item,
                client:client,
                user:{},//TODO: 需要增加用户信息
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

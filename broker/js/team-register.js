// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   

    var args = getQuery();//获取参数

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["brokerId"]){//如果直接传递brokerId
        newBrokerId = args["brokerId"]; //获取已经存在的broker信息
    }else{//否则获取传递的openId和parentBrokerId
        if(args["openId"]){
            newBroker.openid = args["openId"]; //填写达人Openid
        }else{
            console.log("Error. Cannot get broker openid.");
        }
    }
    //获取上级达人信息
    if(args["parentBrokerId"]){
        parentBrokerId = args["parentBrokerId"]; //获取上级达人ID
        loadParentBrokerById(parentBrokerId);//加载上级达人信息：需要获取openid，用于发送通知信息
    }else{
        console.log("Error. Cannot get parent broker id.");
    }    
    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件
    $("#submitBtn").click(function(){
        if(newBrokerId.trim().length==0){//如果传递openid、parentBrokerId则新建
            registerBroker();
        }else{//如果传递brokerId则只做更新
            updateExistBrokerById(newBrokerId);
        }
    });

});

var parentBrokerId = "1001";
var parentBrokerOpenId = "";

var newBrokerId = "";

var newBroker = {
    openid:"",
    name: "",
    phone: "",
    hierarchy: "3",
    level: "推广达人",
    status: "active",
    upgrade: "无"
};

//----------------------------
//以下方法用于根据brokerId更新电话号码和姓名
//----------------------------

//更新Broker：扫码注册后已经创建broker，然后更新电话号码和姓名
function updateBroker(broker) {
    newBroker = broker;
    newBroker.name = $("#brokerName").val().trim();
    newBroker.phone = $("#brokerPhone").val().trim();

    console.log("try to update exist broker.[broker]",newBroker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+newBroker.id, function (res) {
        console.log("update broker successfully.",res);
        //发送通知给上级达人
        sendNotification();
    },"PUT",newBroker,{ "Content-Type":"application/json" });
}

//根据id查询加载broker用于当期更新
function updateExistBrokerById(brokerId) {
    console.log("try to load broker info by brokerId.[brokerId]",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerById/"+brokerId, function (res) {
        console.log("load broker info by id.",brokerId,res);
        if (res.status) {
            updateBroker(res.data);
        }
    });
}


//----------------------------
//以下方法用于根据openId和parentBrokerId创建新的broker
//----------------------------
//注册Broker
function registerBroker() {
    newBroker.name = $("#brokerName").val().trim();
    newBroker.phone = $("#brokerPhone").val().trim();

    console.log("try to register new broker.[broker]",newBroker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+parentBrokerId, function (res) {
        console.log("register broker successfully.",res);
        //发送通知给上级达人
        sendNotification();
    },"POST",newBroker,{ "Content-Type":"application/json" });
}

//发送注册成功通知
function sendNotification() {
    var msg = {
        parentBorkerOpenId:parentBrokerOpenId,
        name: newBroker.name,
        phone:newBroker.phone
    };

    console.log("try to register new broker.[broker]",newBroker);
    util.AJAX(app.config.auth_api+"/wechat/ilife/notify", function (res) {
        console.log("Notification message sent successfully.",res);
        window.location.href="../index.html";//注册完成后跳到首页
    },"POST",msg,{ "Content-Type":"application/json" });
}


//根据id查询加载parent broker
function loadParentBrokerById(brokerId) {
    console.log("try to load broker info by brokerId.[brokerId]",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerById/"+brokerId, function (res) {
        console.log("load broker info by id.",brokerId,res);
        if (res.status) {
            parentBrokerOpenId = res.data.openid;
        }
    });
}




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
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //设置需要修改的personaId
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户
    loadPersona(currentPersonaId);//加载待修改Persona

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有画像列表
var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = "none";
var currentPersona = {};

//加载Persona
function loadPersona(personaId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+personaId, function (res) {
        console.log("Broker::My Loaded persona by id.", res)
        if(res){
            currentPersona = res;
            showPersona(res);
        }
    }, "GET",{},header);
}

//将默认信息填写到表单
function showPersona(persona){
    $("#personaName").val(persona.name);
    $("#personaDescription").val(persona.description);
    $("#personaTags").val(persona.tags.join(" "));
    //注册事件
    $("#submitBtn").click(function(){
        updatePersona();
    });
    $("#deleteBtn").click(function(){
        deletePersona();
    });   

    // 表示加载结束
    loading = false;
}

//修改达人关注用户画像
function updatePersona(){
    var persona = {};
    persona.name = $("#personaName").val().trim().length>0?$("#personaName").val().trim():currentPersona.name;
    persona.description = $("#personaDescription").val().trim().length>0?$("#personaDescription").val():currentPersona.description;
    var tags = $("#personaTags").val();
    if(tags.trim().length>0){
        persona.tags = tags.trim().split(" ");
    }else{
        persona.tags = currentPersona.tags;
    }

    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+currentPersona._key, function (res) {
        console.log("Broker::My Persona updated.", res)
        window.location.href = "my.html";//跳转到设置页面
    }, "PATCH",persona,header);
}

//删用户画像
function deletePersona(){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+currentPersona._key, function (res) {
        console.log("Broker::My Persona deleted.", res)
        window.location.href = "my.html";//跳转到设置页面
    }, "DELETE",{},header);
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}

//更新Broker
function updateBroker(broker) {
    console.log("try to update broker.[broker]",broker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+broker.id, function (res) {
        console.log("update broker successfully.",res);
    },"PUT",broker,{ "Content-Type":"application/json" });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
            //loadData();//加载下级达人列表
            if(res.data.qrcodeUrl && res.data.qrcodeUrl.indexOf("http")>-1){//如果有QRcode则显示
                showQRcode(res.data.qrcodeUrl);
            }else{//否则请求生成后显示
                requestQRcode(res.data);
            }
        }
    });
}

//请求生成二维码
function requestQRcode(broker) {
    console.log("try to request QRCode.[broker]",broker);
    util.AJAX(app.config.auth_api+"/wechat/ilife/qrcode?brokerId="+broker.id, function (res) {
        console.log("Generate QRCode successfully.",res);
        if (res.status) {
            showQRcode(res.data.url);//显示二维码
            //将二维码URL更新到borker
            broker.qrcodeUrl = res.data.url;
            updateBroker(broker);
        }
    });
}

//显示二维码
function showQRcode(url) {
    $("#qrcode").html('<img src="'+url+'" width="200px" alt="分享二维码邀请达人加入"/>');
}

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink"><a href="../user.html">返回用户后台</a></div>';
    html += '</div>';
    $("#user").append(html);
}

function insertBroker(broker){
    $("#brokerHint").html("达人级别："+broker.level);
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
  }else{
    $("#footer").toggleClass("footer-hide",true);
    $("#footer").toggleClass("footer-show",false);
  }
}

//显示正在加载提示
function showloading(flag){
  if(flag){
    $("#loading").toggleClass("loading-hide",false);
    $("#loading").toggleClass("loading-show",true);
  }else{
    $("#loading").toggleClass("loading-hide",true);
    $("#loading").toggleClass("loading-show",false);    
  }
}

function changeActionType (e) {
    console.log("now try to change action type.",e);
    //首先清除原来高亮状态
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+".png"); 
        $("#"+currentActionType+" div").removeClass("actiontype-selected");
        $("#"+currentActionType+" div").addClass("actiontype");  
    }  
    //更改并高亮显示
    currentActionType = e.currentTarget.id;
    tagging = e.currentTarget.dataset.tagging;
    if (app.globalData.isDebug) console.log("User::ChangeActionType change action type.",currentActionType,tagging);
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+"-selected.png"); 
        $("#"+currentActionType+" div").removeClass("actiontype");
        $("#"+currentActionType+" div").addClass("actiontype-selected");  
    } 

    //跳转到相应页面
    window.location.href = currentActionType+".html";
}


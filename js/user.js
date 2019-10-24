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

    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        //columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户
    loadSelectedPersonas();//加载当前用户选中的画像列表

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
var selectedPersonas = [];//已经选中的列表
var selectedPersonaIds = [];//已经选中的列表,仅存储ID，便于比对使用

var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

setInterval(function ()
{
    console.log("Timer Broker::MySettings start load personas Timer.");
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        console.log("Broker::MySettings start load personas.");
        // 表示开始加载
        loading = true;
        showloading(true);

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            loadPersonas();
        }else{//否则使用本地内容填充
            insertPersona();
        }
    }
}, 300);

//加载系统提供的默认画像列表：是全部列表
function loadPersonas(){
    var query={
            collection: "persona_personas", 
            example: { 
                broker:"system"//查询系统提供的persona
            },
            skip:(page.current+1)*page.size,
            limit:page.size
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        showloading(false);
        console.log("Broker::My::loadPersonas try to retrive personas by broker id.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res.result;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertPersona();
        }
    }, "PUT",query,header);
}

//加载当前用户已经选中的Persona：是部分列表
function loadSelectedPersonas(){
    var query={
            collection: "user_persona", 
            example: { 
                _from:userInfo._key//查询当前用户关联的persona
            },
            limit:100
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        showloading(false);
        console.log("Broker::My::loadSelectedPersonas try to retrive personas by user id.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则根据列表修改选中状态
            var hits = res.result;
            for(var i = 0 ; i < hits.length ; i++){
                showPersona(hits[i]);//将persona加入已选列表，并且更改选中风格
            }
        }
    }, "PUT",query,header);
}

function changePersonaStyle(personaId){
    if(selectedPersonas.indexOf(personaId)>-1){//如果已选中
        $("#img"+personaId).toggleClass("persona-logo",false);
        $("#img"+personaId).toggleClass("persona-logo-selected",true);
    }else{
        $("#img"+personaId).toggleClass("persona-logo",true);
        $("#img"+personaId).toggleClass("persona-logo-selected",false);    
    }

    //$("#"+currentActionType+" div").removeClass("actiontype");
    //$("#"+currentActionType+" div").addClass("actiontype-selected");  
}

function showPersona(persona){//将已选中Persona添加到页面并显示
    selectedPersonas.push(persona);//装载到已选persona列表
    selectedPersonaIds.push(persona._key);//装载到已选personaId列表
    changePersonaStyle(personaId);//更改界面选中风格
}

function hidePersona(personaId){
    //从选中列表内删除
    for(var i=0; i<selectedPersonaIds.length; i++) {
        if(selectedPersonaIds[i] == personaId) {
            selectedPersonaIds.splice(i, 1);
            break;
        }
    }    
    changePersonaStyle(personaId);//更改界面选中风格    
}

function removePersona(personaId){//用户选择删除一个Persona
    //从选中列表内找到对应的Connection
    var connKey = "";
    for(var i=0; i<selectedPersonas.length; i++) {
        if(selectedPersonas[i]._to.indexOf(personaId)>0) {
            connKey = selectedPersonas[i]._key;
            selectedPersonas.splice(i, 1);//删除Persona
            break;
        }
    }      
    //将对应的connection删除
    util.AJAX(app.config.data_api+"/_api/document/user_persona/"+connKey, function (res) {
        console.log("User:removePersona try to remove  connected persona.", res)
        hidePersona(personaId);//不再显示选中状态
    }, "DELETE",{},header);
}

function addPersona(personaId){//用户选择增加一个Persona
    //提交并建立新的connection
    var conn={
        _from:"user_users/"+userInfo._key,
        _to:"persona_personas/"+personaId
    }
    util.AJAX(app.config.data_api+"/_api/document/user_persona?returnNew=true", function (res) {
        console.log("User:addPersona try to add connected persona.", res)
        showPersona(res.new);//显示选中状态
    }, "POST",conn,header);
}

//将persona显示到页面
function insertPersona(){
    // 加载内容
    var item = items[num-1];

    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+item.image+"' width='100' height='100'/>"
    var tagTmpl = "<a class='itemTag' href='#'>__TAG</a>";
    var tags = "<div class='itemTags'>";
    var taggingList = item.tags;
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.category).replace("__TAG",item.category);
    }
    tags += "</div>";
    //var tags = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='title'>"+item.name+"</div>"
    var description = "<div class='description'>"+item.description+"</div>"
    $("#waterfall").append("<li><div class='persona' data='"+item._key+"'><div id='img"+item._key+"' class='persona-logo'>" + image +"</div><div class='persona-tags'>" +title +description+ tags+ "</div></li>");
    num++;

    //检查选中状态
    changePersonaStyle(item._key);

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //点击后选中，再次点击取消选中
        changePersona(item);
    });

    // 表示加载结束
    loading = false;
}

//创建达人关注用户画像
function changePersona(persona){
    //检查当前item的状态，如果已经选中则删除，否则添加
    if(selectedPersonaIds.indexOf(persona._key)>-1){
        removePersona(persona._key);
    }else{
        addPersona(persona);
    }
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


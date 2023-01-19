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
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });    

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户

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

var items = [];//所有关联用户列表
var connNames = {};//预留。存放对应的关系名称，采用key-value存储

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
            loadItems();
        }else{//否则使用本地内容填充
            insertItem();
        }
    }
}, 300);

//加载当前用户关心的人：需要分两步，先加载关联，然后逐个加载用户
function loadItems(){
    var query={
            collection: "connections", 
            example: { 
                _from:"user_users/"+userInfo._key//查询当前用户关联的user
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
        console.log("Connections::loadItems try to retrive connections by presonId.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res.result;
            for(var i = 0 ; i < hits.length ; i++){
                var personId = hits[i]._to.split("/")[1];//原始handler形式为：user_users/o8HmJ1JeYicv-JFGPyHvicLO6QQ8
                getItem(personId,hits[i].name);//加载用户对象
            }
            //insertItem();//由于是异步加载，不能直接显示结果
        }
    }, "PUT",query,header);
}

//根据Id加载指定的关联用户Item
function getItem(personId,connName) {
    console.log("try to load connected person info.",personId,connName);
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        if(res){
            items.push(res);
            if(connName){
                connNames[personId]=connName;
            }
            insertItem();
        }
    }, "GET",{},header);
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];

    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+(item.avatarUrl?item.avatarUrl:(item.headImgUrl?item.headImgUrl:"/images/avatar/default.png"))+"' width='50' height='50' class='persona-logo'/>";
        /**
    var tagTmpl = "<a class='itemTag' href='#'>__TAG</a>";
    var tags = "<div class='itemTags'>";
    var taggingList = item.tags;
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    tags += "</div>";
    //**/
    var relation = "";
    if(connNames[item._key]){
        relation = "<div class='persona-description'>"+connNames[item._key]+(item.openId?"":"(分享二维码邀请)")+"</div>";
    }
    var title = "<div class='persona-title'>"+(item.nickName?item.nickName:(item.nickname?item.nickname:"没写名字的神秘人"))+(item.openId?"":"☆")+"</div>"
    //var description = "<div class='persona-description'>"+(item.province?item.province:"")+(item.city?(" "+item.city):"")+"</div>"
    $("#waterfall").append("<li><div class='persona' data='"+item._key+"'><div class='persona-logo-wrapper'>" + image +"</div><div class='persona-info'>" +title +relation+ "</div><div class='persona-action'>&gt;</div></li>");

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //点击后跳转到对应用户设置界面
        window.location.href = "user.html?from=connection&id="+item._key;//跳转到设置页面，传递personId
    });

    num++;//下标加一
    loading = false;// 表示加载结束
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        //insertPerson(userInfo);
        //requestQRcode(userInfo);
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
    //注册添加关心的人事件
    $("#add-connection").click(function(){
        //点击后跳转到对应用户设置界面
        window.location.href = "user-choosepersona.html?from=connection";//跳转到画像选择界面
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
        if (res.status) {//如果是达人则显示达人入口
            //insertBroker(res.data);//显示达人信息
        }
    });
}

//请求生成二维码：使用当前用户openid作为scene_str生成临时二维码，有效期7天。每次使用临时生成
function requestQRcode(person) {
    console.log("try to request temp QRCode.",person);
    util.AJAX(app.config.auth_api+"/wechat/ilife/tempQRcode?userId="+person._key, function (res) {
        console.log("Generate QRCode successfully.",res);
        if (res.status) {
            showQRcode(res.data.url);//显示二维码
        }
    });
}

//显示二维码
function showQRcode(url) {
    $("#qrcode").html('<img src="'+url+'" width="200px" alt="分享二维码邀请关心的人"/>');
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

function htmlItemImage(item){
    var html = '';
    html += '<div class="mainbody">';
    html += '<img class="WxMasonryImage" id="'+item._key+'" src="'+item.images[0]+'" width="100%" height="200px" />';
    html += '</div>';
    return html;
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


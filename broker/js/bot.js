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

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册申请事件：点击后发送通知，在界面显示回馈信息即可
    $("#add-persona-type").click(function(){
        //点击后跳转到对应用户设置界面
        window.location.href = "my-addpersona.html";//跳转到海报生成界面
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
            //查询bot信息
            loadBot(res.data);
        }
    });
}

//加载BOT
function loadBot(broker) {
    console.log("try to load bot.[broker]",broker);
    util.AJAX(app.config.sx_api+"/wx/wxBot/rest/byBrokerId/"+broker.id, function (res) {
        console.log("got bot info.",res);
        if (res.success) {//显示bot信息
            //显示bot
            var bot = res.data;
            var html = `
                    <div class='persona' id='add-persona-type'>
                        <div class='persona-logo-wrapper'>
                            <img src='__botlogo' width='50' height='50' class='persona-logo'/>
                        </div>
                        <div class='persona-info'>
                            <div class='persona-title' id="botInfo"></div>
                        </div>
                        <div class='persona-action'></div>
                    </div>
                ` 
            html = html.replace(/__botlogo/,broker.avatarUrl);    //使用达人头像：如果是共享情况则显示共享达人的头像      
            $("#botDiv").html(html);
            //$("#botInfo").append("<div>激活码 "+bot.broker.token+"</div>");
            $("#botInfo").append("<div style='line-height:18px;'>当前状态 "+(bot.status=="active"?"启用":"停用")+"</div>");
            $("#botInfo").append("<div style='line-height:18px;'>开通时间 "+bot.effectFrom+"</div>");
            $("#botInfo").append("<div style='line-height:18px;'>到期时间 "+(bot.expireOn?bot.expireOn:"")+"</div>");
            //加载托管微信群
            loadGroupTasks(broker);
        }else{//显示申请开通
            var html = `
                    <div class='persona' id='add-persona-type'>
                        <div class='persona-logo-wrapper'>
                            <img src='images/add-bot.png' width='50' height='50' class='persona-logo'/>
                        </div>
                        <div class='persona-info'>
                            <div class='persona-title' style="line-height: 55px">请添加微信 judyhappymore </div>
                        </div>
                        <div class='persona-action'></div>
                    </div>
                `
            $("#botDiv").html(html);
            showloading(false);
        }
    });
}

//加载托管微信群，一次性加载全部
function loadGroupTasks(broker) {
    console.log("try to load group tasks.[broker]",broker);
    util.AJAX(app.config.sx_api+"/wx/wxGroupTask/rest/byBrokerId/"+broker.id, function (res) {
        console.log("got group task info.",res);
        for(var i=0;i<res.length;i++){
            showGroupTask(res[i]);
        }
        showloading(false);
    });
}

//显示group task
function showGroupTask(item){
    var image = "<img src='images/"+item.type+".png' width='50' height='50' class='persona-logo'/>"
    var tagTmpl = "<div class='persona-tag'>__TAG</div>";
    var tags = "<div class='persona-tags'>";
    var taggingList = item.tags.split(" ");
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    tags += "</div>";
    var status = "<span style='border:1px solid silver;border-radius:5px;color:silver;padding:0 2px;margin-right:2px;'>停用</span>"
    if(item.status=="active")
        status = "<span style='border:1px solid darkgreen;border-radius:5px;color:darkgreen;padding:0 2px;margin-right:2px;'>启用</span>"
    var title = "<div class='persona-title'>"+status+item.wxgroup.name+"</div>"
    var description = "<div class='persona-description'>"+item.typeDesc +" "+ (item.cronDesc?item.cronDesc:"") +"</div>"    
    $("#waterfall").append("<li><div class='persona' data='"+item.id+"'><div class='persona-logo-wrapper'>" + image +"</div><div class='persona-info'>" +title +description+ tags+ "</div><div class='persona-action'>&gt;</div></li>");

    num++;

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //跳转到详情页
        window.location.href = "bot-updatetask.html?taskId="+item.id;
    });
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


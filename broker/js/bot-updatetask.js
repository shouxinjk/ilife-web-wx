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
    if(args["taskId"]){
        taskId = args["taskId"]; //设置需要修改的taskId
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //loadGroupTaskCrons();//加载cron字典定义
    loadGroupTaskTypes();//加载type字典定义
    loadGroupTaskStatus();//加载type字典定义
    loadPerson(currentPerson);//加载用户
    loadGroupTask(taskId);//加载待修改Task

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });    

    //提交修改事件
    $("#submitBtn").click(function(e){
        updateGroupTask();
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

var taskId = null;
var currentPersona = {};

var task = {};//缓存，在更新时直接重用


//加载group task
function loadGroupTask(taskId){
    console.log("try to load group task.[id]",taskId);
    util.AJAX(app.config.sx_api+"/wx/wxGroupTask/rest/byId/"+taskId, function (res) {
        console.log("got group task info.",res);
        if(res.success){//显示表单，等待修改
            task = res.data;
            console.log("got task.",task);
            $("#groupName").val(task.wxgroup.name);
            $("#type").val(task.type);
            $("#cron").val(task.cronDesc);
            $("#name").val(task.name);
            $("#status").val(task.status);
            $("#tags").val(task.tags);

            //直接从任务获取persona
            var persona = null;
            if(task.wxgroup && task.wxgroup.persona && task.wxgroup.persona.id && task.wxgroup.persona.name){ //直接从mysql中获取persona。支持后台直接设置的persona
                persona = task.wxgroup.persona;
                $("#persona").html(persona.name);
                $("#personaTags").val(persona.lambda?persona.lambda:"");
                $("#btnChangePersona").html("修改");
            }else if(task.wxgroup && task.wxgroup.persona && task.wxgroup.persona.id){ //直接从arangodb中获取persona。支持达人自定义画像
                var header={
                    "Content-Type":"application/json",
                    Authorization:"Basic aWxpZmU6aWxpZmU="
                };                 
                util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+task.wxgroup.persona.id, function (res) {
                    console.log("Broker::My Loaded persona by id.", res)
                    if(res){
                        $("#persona").html(res.name);
                        $("#personaTags").val(res.tags.join(" "));
                        $("#btnChangePersona").html("修改");
                    }
                }, "GET",{},header);
            }else{
                $("#btnChangePersona").html("设置");
            }

            //设置persona：注意，persona是设置在wxgroup上
            $("#btnChangePersona").click(function(){
                window.location.href = "bot-choosepersona.html?refer=group&referId="+task.wxgroup.id+"&groupTaskId="+task.id;
            });


        }else{
            //do nothing 
            console.log("failed query task by id."+taskId);
        }
    });
}

//修改达人关注用户画像
function updateGroupTask(){
    task.name = $("#name").val();
    //task.type = $("#type").val();
    //task.cron = $("#cron").val();
    task.tags = $("#tags").val();
    task.status = $("#status").val();
    console.log("try to update task.",task);

    var header={
        "Content-Type":"application/json"
    }; 
    util.AJAX(app.config.sx_api+"/wx/wxGroupTask/rest/byId/"+taskId, function (res) {
        console.log("Broker::My group task updated.", res)
        window.location.href = "bot.html";//跳转到群任务列表
    }, "POST",task,header);
}

//加载task cron定义
function loadGroupTaskCrons(){
    console.log("try to load group task cron.");
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType?type=wx_group_task_cron", function (res) {
        console.log("got group task cron.",res);
        var labeledCrons = [];
        res.forEach(function(item){
            labeledCrons.push(item.value);
            if(task.cron == item.value)
                $("#cron").append("<option value='"+item.value+"' selected>"+item.label+"</option>");
            else
                $("#cron").append("<option value='"+item.value+"'>"+item.label+"</option>");
        });
        //如果没有友好显示，则显示原本内容
        if(labeledCrons.indexOf(task.cron)<0){
            $("#cron").append("<option value='"+task.cron+"' selected>"+task.cron+"</option>");
        }
    });
}
//加载task type定义
function loadGroupTaskTypes(){
    console.log("try to load group task type.");
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType?type=wx_group_task_type", function (res) {
        console.log("got group task type.",res);
        res.forEach(function(item){
            if(task.type == item.value)
                $("#type").append("<option value='"+item.value+"' selected>"+item.label+"</option>");
            else
                $("#type").append("<option value='"+item.value+"'>"+item.label+"</option>");
        });
    });
}
//加载task status
function loadGroupTaskStatus(){
    console.log("try to load group task status.");
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType?type=active_inactive", function (res) {
        console.log("got group task type.",res);
        res.forEach(function(item){
            if(task.type == item.value)
                $("#status").append("<option value='"+item.value+"' selected>"+item.label+"</option>");
            else
                $("#status").append("<option value='"+item.value+"'>"+item.label+"</option>");
        });
    });
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        //insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
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
        }
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



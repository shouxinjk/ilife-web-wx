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

     //查看推荐内容列表，跳转到推荐页，需要带有当前用户ID
    $("#recommendationBtn").click(function(){
        goRecommend();
    });
    //查看用户行为列表，跳转到feed页，需要带有当前用户ID
    $("#historyBtn").click(function(){
        goActionHistory();
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

function goRecommend(){
    window.location.href = "../index.html?type=persona&id="+currentPersona._key;
}
function goActionHistory(){
    window.location.href = "../feeds.html?type=persona&id="+currentPersona._key;
}

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
    //加载标签列表供选择
    loadTags();
    //显示更多标签，供手动输入
    showMoreTags();
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
    /**
    persona.description = $("#personaDescription").val().trim().length>0?$("#personaDescription").val():currentPersona.description;
    var tags = $("#personaTags").val();
    if(tags.trim().length>0){
        persona.tags = tags.trim().split(" ");
    }else{
        persona.tags = currentPersona.tags;
    }
    //**/

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

//加载预定义用户标签
function loadTags(){
   var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    console.log("try to load user tags.",app.config.sx_api+"/mod/userTag/rest/tags");
    util.AJAX(app.config.sx_api+"/mod/userTag/rest/tags", function (res) {
        console.log("Broker::My Loaded persona tags.", res)
        if(res){
            showTags(res);//直接开始显示
        }
    }, "GET",{},header);    
}

//显示预定义标签。采用动态显示的方式
var userTagTypes = [];//存放类别名称
var userTags = [];//按照分类存放分类下的tags
function showTags(tags){
    //首先将所有tag按照类别放入二维数组
    for(var i=0;i<tags.length;i++){
        var tag = tags[i];
        var tagType = tag.userTagCategory.name;
        if(userTagTypes.indexOf(tagType)<0){
            userTagTypes.push(tagType);
            userTags[tagType] = [];
        }
        var subTags = userTags[tagType];
        subTags.push(tag);
        userTags[tagType] = subTags;
    }
    //然后按照二维数组组织HTML显示
    var html = "";
    for(var i=0;i<userTagTypes.length;i++){
        var userTagByCategory = userTagTypes[i];
        //添加标签分类
        $("#user-tags-div").append("<div class='user-tag-wrapper' id='user-tag-wrapper-"+userTagByCategory+"'></div>");
        //添加分类文字
        $("#user-tag-wrapper-"+userTagByCategory).append('<div class="user-tag-category">'+userTagByCategory+'</div>');
        //添加具体标签
        var taglist = userTags[userTagByCategory];
        $("#user-tag-wrapper-"+userTagByCategory).append('<div class="user-tag-list" id="user-tag-list-'+userTagByCategory+'"></div>');
        for(var j=0;j<taglist.length;j++){
            var tag = taglist[j];

            //创建动态判定脚本，并检查是否已经选中
            var myScript= document.createElement("script");
            myScript.type = "text/javascript";
            myScript.appendChild(document.createTextNode('function checkTag'+tag.id+'(doc){console.log("try to eval tag expr.",doc); return '+tag.ruleOfJudgment+';}'));
            document.body.appendChild(myScript); 

            //组织tag HTML            
            $("#user-tag-list-"+userTagByCategory).append('<div class="user-tag" id="tag'+tag.userTagCategory.id+'-'+tag.id+'" data-tagId="'+tag.id+'" data-name="'+tag.name+'" data-rule=\''+tag.ruleOfJudgment+'\' data-categoryId="'+tag.userTagCategory.id+'" data-type="'+tag.userMeasure.type+'" data-property="'+tag.userMeasure.property+'" data-isExclusive="'+tag.userTagCategory.isExclusive+'" data-expr=\''+tag.expression+'\'>'+tag.name+'</div>');
            //注册点击事件
            $("#tag"+tag.userTagCategory.id+'-'+tag.id).click(function(e){
                changeTag(e);
            }); 
    
            //检查tag状态
            checkTagStatus({
                tagId:tag.id,
                name:tag.name,
                type:tag.userMeasure.type,
                property:tag.userMeasure.property,  
                rule:tag.ruleOfJudgment,
                expr:tag.expression,  
                categoryId:tag.userTagCategory.id,                              
                isExclusive:tag.userTagCategory.isExclusive
            });       
        }
    }
}

//tag点选响应事件
function changeTag(e){
    console.log("tag changed.",e);
    var data = {};
    if(e.currentTarget.dataset.type=="script"){//通过脚本直接更新
        try{
            data = JSON.parse(e.currentTarget.dataset.expr); 
        }catch(err){
            console.log("parse expression error.",e.currentTarget.dataset.expr);
        }
    }else if(e.currentTarget.dataset.type=="array"){//这是一个数组，则要单独做一些处理
        var tag = e.currentTarget.dataset.name;
        var array = currentPersona[e.currentTarget.dataset.property];
        if(!array){
            array=[];
        }
        if(array.indexOf(tag)>=0){//如果存在则删除
            var str = array.join(" ");
            str = str.replace(tag,"").replace(/\s+/g," ");
            array = str.split(" ");
        }else{
            array.push(tag)
        }
        var uniqueArray = [...new Set(array)];//排重
        var newArray = [];
        for(var k=0;k<uniqueArray.length;k++){
            if(uniqueArray[k]&&uniqueArray[k].trim().length>0){
                newArray.push(uniqueArray[k].trim());
            }
        }
        data[e.currentTarget.dataset.property]=newArray;
        currentPersona[e.currentTarget.dataset.property]=newArray;
    }else{
        console.log("what the fuck. I dont know the type.[type]"+e.currentTarget.dataset.type);
    }
    //change persona
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+currentPersona._key, function (res) {
        console.log("Broker::My Persona updated by tag.", res)
        //TODO: 修改界面显示
        changeTagDisplay({
            tagId:e.currentTarget.dataset.tagid,
            name:e.currentTarget.dataset.name,
            type:e.currentTarget.dataset.type,
            property:e.currentTarget.dataset.property,
            categoryId:e.currentTarget.dataset.categoryid,
            isExclusive:e.currentTarget.dataset.isexclusive
        });
    }, "PATCH",data,header);    
}

//修改tag显示风格
function changeTagDisplay(tagInfo){
    //console.log("try to change tag style.",tagInfo);
    if(tagInfo.isExclusive=="1" || tagInfo.isExclusive==1){    //如果是单选，则先把所有已选中的干掉，然后把选中的加上高亮
        //把同一类标签风格都改为取消状态
        console.log("change exclusive tag.",tagInfo)
        $("div[id^='tag"+tagInfo.categoryId+"']").each(function(index, element) {
             $(this).removeClass("user-tag-selected");
             $(this).addClass("user-tag");
        });   
        //高亮显示当前选中的标签 
        $("#"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag");
        $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag-selected");        
    }else{//对于多选，如果当前值在列表内则加上高亮，如果不在则去掉高亮
        console.log("\n\nchange non-exclusive tag.",tagInfo)
        if(currentPersona[tagInfo.property] && currentPersona[tagInfo.property].indexOf(tagInfo.name)>=0){
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag");
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag-selected");             
        }else{
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag-selected");
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag");             
        }
    }
}

//检查tag是否选中。仅用于初次加载时
function checkTagStatus(tagInfo){
    //console.log("try to check tag status.",tagInfo);
    var result = false;
    eval("result=checkTag"+tagInfo.tagId+"(currentPersona);");
    console.log("check tag result.",result,tagInfo,currentPersona);
    if( result ){
        changeTagDisplay(tagInfo);
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

//show editable tags
function showMoreTags(){
    var moreTags = currentPersona.tags;
    for(var i=0;i<moreTags.length;i++){
        $('#moreTags').append("<li>"+moreTags[i]+"</li>");
    }
    var eventTags = $('#moreTags');

    var addEvent = function(text) {
        console.log(text);
        //$('#events_container').append(text + '<br>');
    };

    eventTags.tagit({
        availableTags: moreTags,//TODO: 可以获取所有标签用于自动补全
        //**
        beforeTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                addEvent('beforeTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },//**/
        afterTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                currentPersona.tags.push(eventTags.tagit('tagLabel', ui.tag));
                updatePersonaTags();
                addEvent('afterTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },
        //**
        beforeTagRemoved: function(evt, ui) {
            addEvent('beforeTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        afterTagRemoved: function(evt, ui) {
            var tags = currentPersona.tags.join(" ").replace(eventTags.tagit('tagLabel', ui.tag),"");
            currentPersona.tags = tags.split(" ");
            updatePersonaTags();
            addEvent('afterTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },
        /**
        onTagClicked: function(evt, ui) {
            addEvent('onTagClicked: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        onTagExists: function(evt, ui) {
            addEvent('onTagExists: ' + eventTags.tagit('tagLabel', ui.existingTag));
        }
    });    
}

//修改persona的tags：每次修改后均做更新，且仅更新tags
function updatePersonaTags(){
    var data={
        tags:currentPersona.tags//在发生操作后直接修改
    }
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+currentPersona._key, function (res) {
        console.log("Broker::My Persona tags updated.", res)
    }, "PATCH",data,header);
}


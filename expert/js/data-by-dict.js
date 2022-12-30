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

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //显示加载状态
    showloading(true);

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }    
    if(args["id"]){
        dictId = args["id"]; //dictId
    } 
    if(args["categoryId"]){
        categoryId = args["categoryId"]; //记录当前修改节点维度
    }    
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //初次设置时，默认使用persona属性填充
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    loadPerson(currentPersonId);//加载需要修改的用户信息

    //加载列表
    loadItems();

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var from = "my";//可选值为my/connections,默认认为是自己修改自己

var currentPersonId = app.globalData.userInfo?app.globalData.userInfo._key:null;//默认为当前登录用户
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = null;
var currentPersona = {};
var currentConnection = null;

var categoryId = null;
var categoryName = null;

var dictId = null;

var currentPerson = {};//默认当前修改用户为空

function loadItems(){
    util.AJAX(app.config.sx_api+"/mod/dictValue/rest/values-with-score", function (res) {
        showloading(false);
        console.log("loadItems try to retrive pending items.", res)
        if (res.values) {//有数值时才显示
            res.values.forEach(function(item){
                item.myScore = 0;//默认认为未打分
                if(items.find(entry => entry.id == item.id)){ //排重
                    //do nothing
                }else{
                    //如果已打分则添加到对应数值记录，用于初始化显示
                    if(res.scores){
                        var myScore = res.scores.find(entry => entry.dictValue.id == item.id);
                        if(myScore){ //找到对应值的打分
                            item.myScore = myScore.score;
                        }
                    }
                    items.push(item);
                    //显示到页面
                    insertItem();
                }
            });           
        }else{//如果没有则提示，
            shownomore();
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有数据标注任务哦~~</div>");
            }            
        }
    }, 
    "GET",
    {
        dictId:dictId,
        openid:userInfo._key,//当前用户openid
    },
    {});
}

//将item显示到页面
var cardTpl = `
        <div style='border:1px solid silver; border-radius:5px;margin:5px 0;width:96%;margin-left:2%;display:flex;flex-direction:row;align-items: center; padding:5px;'>
            <div style="width:50%;">
                <div style="font-size:12px;font-weight:bold;margin:2px 0;">__categoryName __schemeName</div>
                <div style="font-size:12px;line-height:14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;">__orginalValue</div>
            </div>
            <div style="width:20%;">
                <div style="text-align:center;font-size:16px;font-weight:bold;">__score</div>
                <div style="text-align:center;font-size:10px;">__markers</div>
            </div>
            <div id="rank__itemType__itemId" data-id="__itemId" data-type="__itemType" data-categoryid="__categoryId" data-schemeid="__schemeId" data-ovalue="__orginalValue"  style="width:30%;margin-top:-5px;" ></div>
            <!--div id="go__itemType__itemId" data-id="__itemId" data-type="__itemType" data-categoryid="__categoryId" data-schemeid="__schemeId" style="font-size:12px;width:10%;text-align:center;font-size:14px;font-weight:bold;">&gt;</div-->
        </div>
    `;    
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    var html = cardTpl;
    var type = "";
    html = html.replace(/__itemId/g,item.id);
    html = html.replace(/__orginalValue/g,item.originalValue);
    html = html.replace(/__score/g,item.markedValue);
    html = html.replace(/__markers/g,(item.markers+1)+"人标注");
    html = html.replace(/__categoryId/g,item.category&&item.category.id?item.category.id:"");
    html = html.replace(/__categoryName/g,item.category&&item.category.name?item.category.name:"");
    if(item.measure && item.measure.id && item.measure.name){ //如果是performance值
        type="humanMarkedValue";
        html = html.replace(/__schemeId/g,item.measure.id);
        html = html.replace(/__schemeName/g,item.measure.name);
    }else if(item.dictMeta && item.dictMeta.id && item.dictMeta.name){ //如果是dict值
        type="humanMarkedDict";
        html = html.replace(/__schemeId/g,item.dictMeta.id);
        html = html.replace(/__schemeName/g,item.dictMeta.name);
    }else{
        console.log("unknown data type.",item);
        html = "";//注意：数据错误时直接不予显示
    }
    html = html.replace(/__itemType/g,type);

    $("#waterfall").append("<li>"+html+"</li>");
    num++;

    //打分
    $("#rank"+type+item.id).starRating({//显示为starRating
        totalStars: 5,
        starSize:20,
        useFullStars:false,//能够显示半星
        initialRating: item.myScore/2,//注意：评分是0-1,直接转换。初始打分为当前用户的设置值，如果没有则置空，等待标注
        ratedColors:['#dc143c', '#ff4500', '#ff6347', '#9acd32','#32cd32'],
        callback: function(currentRating, el){
            //获取当前打分
            var type = $(el).data("type");
            var nScore={
                score: currentRating*2, //直接用打分值
                openid: userInfo._key,
                nickname: userInfo.nickname,
                originalValue: $(el).data("ovalue"),
                category:{
                    id:$(el).data("categoryid")
                }
            };
            if(type == "humanMarkedValue"){
                nScore.performance={
                    id: $(el).data("id") 
                }
                nScore.measure={
                    id: $(el).data("schemeid")
                }                
            }else if(type == "humanMarkedDict"){
                nScore.dictValue={
                    id: $(el).data("id")
                }
                nScore.dictMeta={
                    id: $(el).data("schemeid")
                }                
            }else{
                nScore.error = "unknow type:"+type;
            }
            console.log("dude, now try update rating.", nScore);

            //提交数据
            $.ajax({
                url:app.config.sx_api+"/ope/"+type+"/rest/score",
                type:"post",
                data:JSON.stringify(nScore),
                headers:{
                    "Content-Type":"application/json",
                    "Accept": "application/json"
                },         
                success:function(json){
                    console.log("score updated.",json);
                }
            });  
        }
    }); 
    /**
    //注册事件： 进入属性下所有数值列表
    $("#go"+type+item.id).click(function(){
        //根据类型区分  
        var type = $(this).data("type");
        if(type == "humanMarkedValue"){
            window.location.href = "data-by-measure.html?id="+$(this).data("schemeid");
        }else if(type == "humanMarkedDict"){
            window.location.href = "data-by-dict.html?id="+$(this).data("schemeid");
        }else{
            console.log("unknown type. ignore");
        }
    });
    //**/
    // 表示加载结束
    loading = false;
}


//加载当前修改的connection
function loadConnection(){
    var query={
            collection: "connections", 
            example: { 
                _from:"user_users/"+userInfo._key,//发起端为当前用户
                _to:"user_users/"+currentPersonId//目的端为修改用户
            },
            limit:1
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        //showloading(false);
        console.log("User::Settings::loadConnection try to retrive user connections.", res);
        if(res && res.count==0){//如果没有则表示有问题哦
            console.log("something wrong. we cannot get user-user connections.");
            $("#relationship").val("我关心的TA");//设置默认关系名称
        }else{//否则更新关系名称
            var hits = res.result;
            currentConnection = hits[0];
            $("#relationship").val(currentConnection.name);//设置默认关系名称
        }
    }, "PUT",query,header);
}

//加载用户关联的Persona
function loadPersona(personaId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+personaId, function (res) {
        console.log("Broker::My Loaded persona by id.", res)
        if(res){
            currentPersona = res;
            currentPerson = {//直接引用persona属性作为当前用户设置
              ...res
            };
            delete  currentPerson._key;
            delete  currentPerson._id;
            delete  currentPerson._rev;
            delete  currentPerson.broker;
            delete  currentPerson.image;
            delete  currentPerson.name;
            currentPerson.persona = res;//设置当前用户的persona信息
            if(res.image)
                currentPerson.avatarUrl = res.image;//设置默认头像
            if(res.name)
                currentPerson.nickName = res.name+"人设";//默认设置名称为画像名称
            currentPerson.status = "pending";//设置为待分析用户
            showPerson(currentPerson);
        }
    }, "GET",{},header);
}

//将默认信息填写到表单
function showPerson(person){
    $("#nickName").val(person.nickName);
    //如果当前修改的用户和登录用户不同，则显示关系字段，否则隐藏
    if(currentPerson._key==userInfo._key){
        $("#relationship-wrapper").css("display","none");
    }else{
        $("#relationship-wrapper").css("display","block");
    }
    //如果用户是画像则显示分享二维码按钮，否则隐藏
    if(person.openId){
        $("#qrcodeBtn").css("display","none");
        $("br").css("display","none");
    }    
    //$("#personTags").val(person.tags?person.tags.join(" "):"");
    //加载标签列表供选择
    //loadTags(); 

    // 表示加载结束
    loading = false;
}

function goRecommend(){
    window.location.href = "index.html?type="+(currentPerson.openId?"person":"persona")+"&id="+currentPerson._key;
}
function goActionHistory(){
    window.location.href = "feeds.html?type="+(currentPerson.openId?"person":"persona")+"&id="+currentPerson._key;
}

//修改用户信息
function updatePerson(){
    currentPerson.nickName = $("#nickName").val().trim().length>0?$("#nickName").val().trim():currentPersona.name;

    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 

    //创建或更新用户
    if(currentPerson._key && currentPerson._key.trim().length>0){//如果有_key则表示用户存在，直接更新
        console.log("update existing user.",currentPerson);
        util.AJAX(app.config.data_api+"/_api/document/user_users/"+currentPerson._key, function (res) {
            console.log("User::Setting updated.", res)
            if(from=="connection"){
                //window.location.href = "connection.html";//跳转到关心的人列表
                var conn={
                    name:$("#relationship").val()?$("#relationship").val():"我关心的TA"
                };
                console.log("try to update connections.",conn);
                util.AJAX(app.config.data_api+"/_api/document/connections/"+currentConnection._key, function (res) {
                    console.log("User::Connection updated.", res)
                    window.location.href = "connection.html";//跳转到关心的人列表
                }, "PATCH",conn,header); 
            }else{
                window.location.href = "user.html";//跳转到设置页面
            }
        }, "PATCH",currentPerson,header);
    }else{//否则创建后更新
        console.log("create new user.",currentPerson);
        var key = md5(currentPerson.persona._key+userInfo._key+new Date().getTime(),16);//构建一个user._key。注意用短md5，构成差异，并且避免微信 二维码 scene_str 总长64位限制
        util.AJAX(app.config.data_api+"/user/users/"+key, function (res) {
            console.log("User::Setting user created.", res)
            currentPerson = res;
            //建立与当前登录用户的关联
            if(from=="connection"){
                //新建connection后跳转回到列表页面
                var conn={
                    _from:"user_users/"+userInfo._key,
                    _to:"user_users/"+currentPerson._key,
                    name:$("#relationship").val()?$("#relationship").val():"我关心的TA"
                };
                console.log("try to create connections.",conn);
                util.AJAX(app.config.data_api+"/_api/document/connections", function (res) {
                    console.log("User::Connection created.", res)
                    window.location.href = "connection.html";//跳转到关心的人列表
                }, "POST",conn,header);                 
            }else{//不可能走到这里，自己设置时是已经有了用户的，仅对于新增关心的人才会进来
                console.log("how could it be?");
            }
        }, "POST",currentPerson,header);
    }

    //将用户信息推送到kafka
    util.updatePersonNotify(currentPerson);
}

//删除关心的人。注意：仅删除关联
function deletePerson(){
    currentPerson.nickName = $("#nickName").val().trim().length>0?$("#nickName").val().trim():currentPersona.name;

    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 

    console.log("try to remove connections.",currentConnection);
    util.AJAX(app.config.data_api+"/_api/document/connections/"+currentConnection._key, function (res) {
        console.log("User::Connection removed.", res)
        if(!currentPerson.openId){//如果是非注册用户，则直接删除
            console.log("try to remove unregistered user.",currentPerson);
            util.AJAX(app.config.data_api+"/_api/document/user_users/"+currentPerson._key, function (res) {
                console.log("User::Setting updated.", res)
                window.location.href = "connection.html";//跳转到关心的人列表
            }, "DELETE",{},header);
        }else{
            window.location.href = "connection.html";//跳转到关心的人列表
        }
    }, "DELETE",{},header); 
}

//加载预定义用户标签：仅加载用户标注类标签
function loadTags(){
   var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    console.log("try to load user tags.");
    util.AJAX(app.config.sx_api+"/mod/userTag/rest/tags?types=user-setting", function (res) {
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
        //添加标签分类及分割线
        $("#user-tags-div").append("<div class='user-tag-wrapper-separator'></div>");
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

    //修改currentPerson信息，直接merge
    currentPerson = {
      ...currentPerson,
      ...data
    };

    console.log("currentPerson changed by tag.",currentPerson);   
    changeTagDisplay({
        tagId:e.currentTarget.dataset.tagid,
        name:e.currentTarget.dataset.name,
        type:e.currentTarget.dataset.type,
        property:e.currentTarget.dataset.property,
        categoryId:e.currentTarget.dataset.categoryid,
        isExclusive:e.currentTarget.dataset.isexclusive
    });
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
        if(currentPerson[tagInfo.property] && currentPerson[tagInfo.property].indexOf(tagInfo.name)>=0){
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
    eval("result=checkTag"+tagInfo.tagId+"(currentPerson);");
    console.log("check tag result.",result,tagInfo,currentPerson);
    if( result ){
        changeTagDisplay(tagInfo);
    }
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        //userInfo = res;
        currentPerson = res;
        //检查是否有persona设置，如果没有则跳转到persona选择界面
        if((res.persona && res.persona._key) || !res.openId){//如果有persona则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有persona则提示先选择一个persona
            window.location.href = "user-choosepersona.html?id="+personId+"&refer=user";//refer=user表示设置后返回到user界面
        }
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


//show editable tags
function showMoreTags(){
    var moreTags = currentPerson.tags?currentPerson.tags:[];
    currentPerson.tags = moreTags;
    for(var i=0;i<moreTags.length;i++){
        $('#moreTags').append("<li>"+moreTags[i]+"</li>");
    }
    var eventTags = $('#moreTags');

    var addEvent = function(text) {
        console.log(text,currentPerson);
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
                currentPerson.tags.push(eventTags.tagit('tagLabel', ui.tag));
                addEvent('afterTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },
        //**
        beforeTagRemoved: function(evt, ui) {
            addEvent('beforeTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        afterTagRemoved: function(evt, ui) {
            var tags = currentPerson.tags.join(" ").replace(eventTags.tagit('tagLabel', ui.tag),"");
            currentPerson.tags = tags.split(" ");
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


